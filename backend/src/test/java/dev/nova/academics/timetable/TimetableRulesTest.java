package dev.nova.academics.timetable;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.academics.timetable.TimetableRules.ClassTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TimetableRulesTest {

    private static final UUID DBMS = UUID.fromString("00000000-0000-0000-0000-0000000000c1");
    private static final UUID OS = UUID.fromString("00000000-0000-0000-0000-0000000000c2");

    private static ClassTime at(String id, UUID course, int day, String start, String end) {
        return new ClassTime(
                UUID.fromString("00000000-0000-0000-0000-0000000000" + id),
                course,
                day,
                LocalTime.parse(start),
                LocalTime.parse(end));
    }

    @Test
    void findsClassesWhoseTimesIntersectOnTheSameDay() {
        ClassTime lecture = at("01", DBMS, 1, "09:00", "09:50");
        ClassTime lab = at("02", OS, 1, "09:30", "11:00");
        ClassTime later = at("03", OS, 1, "11:00", "12:00"); // touches the lab's end: not a clash
        ClassTime tuesday = at("04", DBMS, 2, "09:00", "09:50"); // same time, other day

        Map<UUID, List<UUID>> overlaps = TimetableRules.overlaps(List.of(lecture, lab, later, tuesday));

        assertThat(overlaps.get(lecture.id())).containsExactly(lab.id());
        assertThat(overlaps.get(lab.id())).containsExactly(lecture.id());
        assertThat(overlaps.get(later.id())).isEmpty();
        assertThat(overlaps.get(tuesday.id())).isEmpty();
    }

    @Test
    void aClassInsideAnotherOverlapsIt() {
        ClassTime block = at("01", DBMS, 3, "09:00", "13:00");
        ClassTime inside = at("02", OS, 3, "10:00", "11:00");
        ClassTime alsoInside = at("03", OS, 3, "12:00", "12:30");

        Map<UUID, List<UUID>> overlaps = TimetableRules.overlaps(List.of(block, inside, alsoInside));

        assertThat(overlaps.get(block.id())).containsExactly(inside.id(), alsoInside.id());
        assertThat(overlaps.get(inside.id())).containsExactly(block.id());
    }

    @Test
    void numbersEachCoursesClassesByStartTime() {
        ClassTime lab = at("01", DBMS, 1, "14:00", "16:00");
        ClassTime lecture = at("02", DBMS, 1, "09:00", "09:50");
        ClassTime os = at("03", OS, 1, "11:00", "11:50");

        Map<UUID, Integer> slots = TimetableRules.slotNumbers(List.of(lab, lecture, os));

        assertThat(slots).containsEntry(lecture.id(), 1).containsEntry(lab.id(), 2).containsEntry(os.id(), 1);
    }

    @Test
    void sameStartTimesAreNumberedInIdOrder() {
        ClassTime a = at("02", DBMS, 1, "09:00", "10:00");
        ClassTime b = at("01", DBMS, 1, "09:00", "11:00");

        assertThat(TimetableRules.slotNumbers(List.of(a, b))).containsEntry(b.id(), 1).containsEntry(a.id(), 2);
    }
}
