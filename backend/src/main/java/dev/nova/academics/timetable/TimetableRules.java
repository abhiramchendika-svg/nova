package dev.nova.academics.timetable;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Pure timetable logic: which classes overlap, and how a day's classes map to attendance slots. */
public final class TimetableRules {

    private TimetableRules() {}

    /** The facts these rules need about a class. */
    public record ClassTime(UUID id, UUID courseId, int dayOfWeek, LocalTime startsAt, LocalTime endsAt) {}

    /**
     * For each class, the other classes on the same weekday whose times intersect it. Touching end
     * to start (09:00–09:50 then 09:50–10:40) is not an overlap. Overlaps are allowed (labs sometimes
     * clash with lectures); the UI only warns about them.
     */
    public static Map<UUID, List<UUID>> overlaps(List<ClassTime> classes) {
        Map<UUID, List<UUID>> result = new HashMap<>();
        for (ClassTime a : classes) {
            List<UUID> clashes = new ArrayList<>();
            for (ClassTime b : classes) {
                if (!a.id().equals(b.id())
                        && a.dayOfWeek() == b.dayOfWeek()
                        && a.startsAt().isBefore(b.endsAt())
                        && b.startsAt().isBefore(a.endsAt())) {
                    clashes.add(b.id());
                }
            }
            clashes.sort(Comparator.naturalOrder());
            result.put(a.id(), List.copyOf(clashes));
        }
        return result;
    }

    /**
     * Attendance slot numbers for one day's classes: each course's classes that day are numbered
     * 1, 2, … in start-time order (ties broken by id), the same "1st class, 2nd class" the
     * attendance page uses.
     */
    public static Map<UUID, Integer> slotNumbers(List<ClassTime> dayClasses) {
        Map<UUID, Integer> slots = new HashMap<>();
        Map<UUID, List<ClassTime>> byCourse =
                dayClasses.stream().collect(Collectors.groupingBy(ClassTime::courseId));
        for (List<ClassTime> course : byCourse.values()) {
            List<ClassTime> ordered = new ArrayList<>(course);
            ordered.sort(Comparator.comparing(ClassTime::startsAt).thenComparing(ClassTime::id));
            for (int i = 0; i < ordered.size(); i++) {
                slots.put(ordered.get(i).id(), i + 1);
            }
        }
        return slots;
    }
}
