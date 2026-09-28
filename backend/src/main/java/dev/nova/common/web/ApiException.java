package dev.nova.common.web;

import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * An expected, user-facing failure (duplicate email, invalid timezone, too many attempts ...).
 * Services throw it; {@link ApiExceptionHandler} turns it into a Problem Details response.
 * The title is written for humans; the code is the stable contract with the frontend.
 */
public class ApiException extends RuntimeException {

    public record FieldProblem(String field, String message) {}

    private final HttpStatus status;
    private final String code;
    private final String title;
    private final List<FieldProblem> fieldProblems;
    private final Long retryAfterSeconds;

    private ApiException(
            HttpStatus status, String code, String title, List<FieldProblem> fieldProblems, Long retryAfterSeconds) {
        super(title);
        this.status = status;
        this.code = code;
        this.title = title;
        this.fieldProblems = List.copyOf(fieldProblems);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public static ApiException conflict(String title) {
        return new ApiException(HttpStatus.CONFLICT, "CONFLICT", title, List.of(), null);
    }

    public static ApiException invalidField(String field, String message) {
        return new ApiException(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                "Some fields need attention",
                List.of(new FieldProblem(field, message)),
                null);
    }

    public static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "We couldn't find that", List.of(), null);
    }

    public static ApiException tooManyRequests(long retryAfterSeconds) {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many attempts", List.of(), retryAfterSeconds);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public String getTitle() {
        return title;
    }

    public List<FieldProblem> getFieldProblems() {
        return fieldProblems;
    }

    public Long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
