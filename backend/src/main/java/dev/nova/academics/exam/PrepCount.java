package dev.nova.academics.exam;

import java.util.UUID;

/**
 * One row of {@link ExamTopicRepository#prepCounts}: an exam's topic total and how many are done.
 * Top-level (not nested) so the JPQL constructor expression can name it.
 */
public record PrepCount(UUID examId, Long total, Long done) {}
