package dev.nova.academics.semester;

import dev.nova.academics.grading.GradingScheme;
import dev.nova.academics.grading.GradingSchemeRepository;
import dev.nova.academics.semester.SemesterDtos.SemesterRequest;
import dev.nova.academics.semester.SemesterDtos.SemesterResponse;
import dev.nova.common.web.ApiException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SemesterService {

    static final int MAX_SEMESTERS = 20;

    private final SemesterRepository semesters;
    private final GradingSchemeRepository schemes;

    public SemesterService(SemesterRepository semesters, GradingSchemeRepository schemes) {
        this.semesters = semesters;
        this.schemes = schemes;
    }

    /** All the user's semesters in chronological order (by semester number). */
    @Transactional(readOnly = true)
    public List<SemesterResponse> list(UUID userId) {
        Map<UUID, GradingScheme> schemesById = schemes.findVisibleTo(userId).stream()
                .collect(Collectors.toMap(GradingScheme::getId, Function.identity()));
        return semesters.findByUserIdOrderByOrdinalAsc(userId).stream()
                .map(s -> SemesterResponse.from(s, schemesById.get(s.getGradingSchemeId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public SemesterResponse get(UUID userId, UUID semesterId) {
        Semester semester = require(userId, semesterId);
        return SemesterResponse.from(semester, schemes.getReferenceById(semester.getGradingSchemeId()));
    }

    @Transactional
    public SemesterResponse create(UUID userId, SemesterRequest request) {
        if (semesters.countByUserId(userId) >= MAX_SEMESTERS) {
            throw ApiException.ruleViolation("ordinal", "You can have up to " + MAX_SEMESTERS + " semesters.");
        }
        if (semesters.existsByUserIdAndOrdinal(userId, request.ordinal())) {
            throw duplicateOrdinal();
        }
        GradingScheme scheme = requireScheme(userId, request);
        checkDates(request);

        Semester semester = new Semester(userId);
        apply(semester, request);
        if (request.current()) {
            clearCurrent(userId);
            semester.setCurrent(true);
        }
        return SemesterResponse.from(semesters.saveAndFlush(semester), scheme);
    }

    @Transactional
    public SemesterResponse update(UUID userId, UUID semesterId, SemesterRequest request) {
        Semester semester = require(userId, semesterId);
        if (semesters.existsByUserIdAndOrdinalAndIdNot(userId, request.ordinal(), semesterId)) {
            throw duplicateOrdinal();
        }
        GradingScheme scheme = requireScheme(userId, request);
        // A course's grade must come from its semester's scheme; switching would orphan those grades
        if (!scheme.getId().equals(semester.getGradingSchemeId()) && semesters.hasGradedCourses(semesterId)) {
            throw ApiException.ruleViolation(
                    "gradingSchemeId",
                    "Some courses in this semester have grades. Clear them before switching the grading scheme.");
        }
        checkDates(request);

        apply(semester, request);
        if (request.current() && !semester.isCurrent()) {
            clearCurrent(userId);
            semester.setCurrent(true);
        } else if (!request.current()) {
            semester.setCurrent(false);
        }
        semesters.flush();
        return SemesterResponse.from(semester, scheme);
    }

    /** Moves the "current" flag to this semester (at most one is current, enforced by the database). */
    @Transactional
    public SemesterResponse makeCurrent(UUID userId, UUID semesterId) {
        Semester semester = require(userId, semesterId);
        if (!semester.isCurrent()) {
            clearCurrent(userId);
            semester.setCurrent(true);
            semesters.flush();
        }
        return SemesterResponse.from(semester, schemes.getReferenceById(semester.getGradingSchemeId()));
    }

    /** Deletes the semester and (by database cascade) its courses. The UI confirms first. */
    @Transactional
    public void delete(UUID userId, UUID semesterId) {
        semesters.delete(require(userId, semesterId));
    }

    // ───────────── helpers ─────────────

    private Semester require(UUID userId, UUID semesterId) {
        return semesters.findByIdAndUserId(semesterId, userId).orElseThrow(ApiException::notFound);
    }

    private GradingScheme requireScheme(UUID userId, SemesterRequest request) {
        return schemes.findVisible(request.gradingSchemeId(), userId)
                .orElseThrow(() -> ApiException.invalidField("gradingSchemeId", "Choose one of your grading schemes."));
    }

    /**
     * Clears the flag on the previous current semester and writes that immediately. Without the flush,
     * Hibernate could insert or update the new current semester first, and the database's
     * "one current semester" index would (correctly) reject it.
     */
    private void clearCurrent(UUID userId) {
        semesters.findByUserIdAndCurrentTrue(userId).ifPresent(previous -> {
            previous.setCurrent(false);
            semesters.flush();
        });
    }

    private static void apply(Semester semester, SemesterRequest request) {
        semester.apply(
                request.name().strip(),
                request.ordinal(),
                request.startsOn(),
                request.endsOn(),
                request.gradingSchemeId(),
                request.attendanceTarget());
    }

    private static void checkDates(SemesterRequest request) {
        if (request.startsOn() != null && request.endsOn() != null && request.endsOn().isBefore(request.startsOn())) {
            throw ApiException.invalidField("endsOn", "The end date can't be before the start date.");
        }
    }

    private static ApiException duplicateOrdinal() {
        return ApiException.invalidField("ordinal", "You already have a semester with this number.");
    }
}
