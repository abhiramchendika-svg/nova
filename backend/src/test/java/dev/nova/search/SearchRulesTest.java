package dev.nova.search;

import static org.assertj.core.api.Assertions.assertThat;

import dev.nova.planner.task.TaskStatus;
import org.junit.jupiter.api.Test;

/** Queries match literally, case-insensitively. */
class SearchRulesTest {

    @Test
    void escapesLikeWildcards() {
        assertThat(SearchRules.contains("  DBMS ")).isEqualTo("%dbms%");
        assertThat(SearchRules.contains("50%")).isEqualTo("%50!%%");
        assertThat(SearchRules.contains("a_b")).isEqualTo("%a!_b%");
        assertThat(SearchRules.contains("wow!")).isEqualTo("%wow!!%");
        assertThat(SearchRules.startsWith("Lab")).isEqualTo("lab%");
    }

    @Test
    void labelsStatuses() {
        assertThat(SearchRules.label(TaskStatus.IN_PROGRESS)).isEqualTo("In progress");
        assertThat(SearchRules.label(TaskStatus.DONE)).isEqualTo("Done");
    }
}
