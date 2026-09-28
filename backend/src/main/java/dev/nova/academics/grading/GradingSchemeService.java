package dev.nova.academics.grading;

import dev.nova.academics.grading.GradingDtos.GradeRequest;
import dev.nova.academics.grading.GradingDtos.SchemeRequest;
import dev.nova.academics.grading.GradingDtos.SchemeResponse;
import dev.nova.common.web.ApiException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Built-in presets are visible to everyone and never editable. A user's own schemes are visible and
 * editable only by them; anything else looks like it doesn't exist (404), per docs/api.md §1.
 */
@Service
public class GradingSchemeService {

    static final int MAX_SCHEMES_PER_USER = 20;
    private static final String COPY_SUFFIX = " (copy)";

    private final GradingSchemeRepository schemes;

    public GradingSchemeService(GradingSchemeRepository schemes) {
        this.schemes = schemes;
    }

    /** Presets first, then the user's own schemes by name. */
    @Transactional(readOnly = true)
    public List<SchemeResponse> list(UUID userId) {
        return schemes.findVisibleTo(userId).stream()
                .sorted(Comparator.comparing(GradingScheme::isBuiltIn)
                        .reversed()
                        .thenComparing(s -> s.getName().toLowerCase(Locale.ROOT)))
                .map(SchemeResponse::from)
                .toList();
    }

    @Transactional
    public SchemeResponse create(UUID userId, SchemeRequest request) {
        requireRoomForAnother(userId);
        List<ValidGrade> grades = validate(request, Set.of());
        GradingScheme scheme = new GradingScheme(userId, request.name().strip(), request.maxPoints());
        for (int i = 0; i < grades.size(); i++) {
            ValidGrade g = grades.get(i);
            scheme.addGrade(g.label(), g.points(), g.passing(), g.countsInGpa(), i);
        }
        return SchemeResponse.from(schemes.saveAndFlush(scheme));
    }

    /** Copies a preset (or one of the user's schemes) into a new scheme the user can edit. */
    @Transactional
    public SchemeResponse cloneScheme(UUID userId, UUID sourceId) {
        GradingScheme source = schemes.findVisible(sourceId, userId).orElseThrow(ApiException::notFound);
        requireRoomForAnother(userId);
        GradingScheme copy = new GradingScheme(userId, copyName(source.getName()), source.getMaxPoints());
        List<GradeDefinition> ordered = source.getGrades().stream()
                .sorted(Comparator.comparingInt(GradeDefinition::getPosition))
                .toList();
        for (int i = 0; i < ordered.size(); i++) {
            GradeDefinition g = ordered.get(i);
            copy.addGrade(g.getLabel(), g.getPoints(), g.isPassing(), g.isCountsInGpa(), i);
        }
        return SchemeResponse.from(schemes.saveAndFlush(copy));
    }

    /**
     * Full replacement, applied in place: grades keep their ids, so courses graded with them keep
     * their grade (and their GPA simply follows any change in points). Removing a grade that a course
     * still uses is refused, rather than silently un-grading that course.
     */
    @Transactional
    public SchemeResponse update(UUID userId, UUID schemeId, SchemeRequest request) {
        GradingScheme scheme = requireOwned(userId, schemeId);
        Map<UUID, GradeDefinition> existing = scheme.getGrades().stream()
                .collect(Collectors.toMap(GradeDefinition::getId, Function.identity()));
        List<ValidGrade> grades = validate(request, existing.keySet());

        Set<UUID> kept = grades.stream().map(ValidGrade::id).filter(Objects::nonNull).collect(Collectors.toSet());
        List<GradeDefinition> removed = existing.values().stream()
                .filter(g -> !kept.contains(g.getId()))
                .toList();
        if (!removed.isEmpty()) {
            List<String> inUse = schemes.findLabelsInUse(removed.stream().map(GradeDefinition::getId).toList());
            if (!inUse.isEmpty()) {
                throw ApiException.conflict("Courses are still graded " + String.join(", ", inUse.stream().sorted().toList())
                        + ". Change those grades before removing them from the scheme.");
            }
        }

        scheme.rename(request.name().strip());
        scheme.changeMaxPoints(request.maxPoints());
        removed.forEach(scheme::removeGrade);
        for (int i = 0; i < grades.size(); i++) {
            ValidGrade g = grades.get(i);
            if (g.id() == null) {
                scheme.addGrade(g.label(), g.points(), g.passing(), g.countsInGpa(), i);
            } else {
                existing.get(g.id()).update(g.label(), g.points(), g.passing(), g.countsInGpa(), i);
            }
        }
        schemes.flush(); // assigns ids to new grades before they're returned
        return SchemeResponse.from(scheme);
    }

    @Transactional
    public void delete(UUID userId, UUID schemeId) {
        GradingScheme scheme = requireOwned(userId, schemeId);
        if (schemes.isUsedBySemester(schemeId)) {
            throw ApiException.conflict(
                    "A semester uses this grading scheme. Switch that semester to another scheme first.");
        }
        schemes.delete(scheme);
    }

    // ───────────── helpers ─────────────

    /** A grade after validation: label trimmed, ids checked. */
    private record ValidGrade(UUID id, String label, BigDecimal points, boolean passing, boolean countsInGpa) {}

    /**
     * Rules Bean Validation can't express: labels unique (ignoring case), no grade above the maximum,
     * at least one passing grade, and ids (on update) must be grades of this scheme, each used once.
     */
    private static List<ValidGrade> validate(SchemeRequest request, Set<UUID> knownIds) {
        List<ValidGrade> result = new ArrayList<>();
        Set<String> labels = new HashSet<>();
        Set<UUID> seenIds = new HashSet<>();
        boolean anyPassing = false;
        for (int i = 0; i < request.grades().size(); i++) {
            GradeRequest g = request.grades().get(i);
            String field = "grades[" + i + "]";
            String label = g.label().strip();
            if (!labels.add(label.toUpperCase(Locale.ROOT))) {
                throw ApiException.invalidField(field + ".label", "Each grade needs a different label.");
            }
            if (g.points().compareTo(request.maxPoints()) > 0) {
                throw ApiException.invalidField(
                        field + ".points",
                        "Can't be more than the maximum of " + request.maxPoints().stripTrailingZeros().toPlainString() + ".");
            }
            UUID id = knownIds.isEmpty() ? null : g.id(); // ids are ignored when creating
            if (id != null && (!knownIds.contains(id) || !seenIds.add(id))) {
                throw ApiException.invalidField(field + ".id", "That grade isn't part of this scheme.");
            }
            anyPassing |= g.passing();
            result.add(new ValidGrade(id, label, g.points(), g.passing(), g.countsInGpa()));
        }
        if (!anyPassing) {
            throw ApiException.invalidField("grades", "Mark at least one grade as passing.");
        }
        return result;
    }

    private GradingScheme requireOwned(UUID userId, UUID schemeId) {
        return schemes.findVisible(schemeId, userId)
                .filter(s -> s.isOwnedBy(userId)) // presets are read-only: "not found" for edits
                .orElseThrow(ApiException::notFound);
    }

    private void requireRoomForAnother(UUID userId) {
        if (schemes.countByUserId(userId) >= MAX_SCHEMES_PER_USER) {
            throw ApiException.ruleViolation(
                    "name", "You can have up to " + MAX_SCHEMES_PER_USER + " grading schemes. Delete one first.");
        }
    }

    static String copyName(String name) {
        int room = 60 - COPY_SUFFIX.length();
        String base = name.length() > room ? name.substring(0, room).strip() : name;
        return base + COPY_SUFFIX;
    }
}
