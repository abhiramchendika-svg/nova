package dev.nova.developer.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class TechStackTest {

    @Test
    void tidiesAndDeduplicatesKeepingTheFirstSpelling() {
        assertThat(TechStack.normalize(Arrays.asList(" Spring  Boot ", "react", "", null, "React", "PostgreSQL")))
                .isEqualTo(List.of("Spring Boot", "react", "PostgreSQL"));
    }

    @Test
    void nothingIsAnEmptyStack() {
        assertThat(TechStack.normalize(null)).isEqualTo(List.of());
    }

    @Test
    void refusesTooManyOrTooLong() {
        List<String> sixteen = new ArrayList<>();
        for (int i = 0; i < 16; i++) {
            sixteen.add("tech" + i);
        }
        assertThatThrownBy(() -> TechStack.normalize(sixteen)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TechStack.normalize(List.of(String.join("", Collections.nCopies(31, "x")))))
                .isInstanceOf(IllegalArgumentException.class);
        // Duplicates don't count towards the limit
        List<String> repeated = new ArrayList<>(Collections.nCopies(20, "Java"));
        assertThat(TechStack.normalize(repeated)).isEqualTo(List.of("Java"));
    }
}
