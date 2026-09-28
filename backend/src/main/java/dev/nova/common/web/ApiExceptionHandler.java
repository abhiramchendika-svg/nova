package dev.nova.common.web;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Turns every error into an RFC 9457 Problem Details response (application/problem+json) with:
 *  - a stable machine-readable {@code code} the frontend maps to human messages (docs/api.md §1)
 *  - the {@code requestId} so a user-visible error can be matched to server logs
 *  - field-level {@code errors} for validation failures
 * Stack traces and exception messages from unexpected errors are logged, never returned.
 *
 * Extending ResponseEntityExceptionHandler means Spring's built-in MVC exceptions
 * (malformed JSON, unknown route, wrong method ...) all flow through {@link #handleExceptionInternal}.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private static final String PROBLEM_BASE = "https://nova.dev/problems/";

    /** Bean Validation failures on @Valid request bodies → 400 with per-field messages. */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Some fields need attention");
        List<Map<String, String>> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.of(
                        "field", fe.getField(),
                        "message", fe.getDefaultMessage() == null ? "is invalid" : fe.getDefaultMessage()))
                .toList();
        problem.setDetail(errors.size() == 1 ? "1 field is invalid." : errors.size() + " fields are invalid.");
        problem.setProperty("errors", errors);
        problem.setProperty("code", "VALIDATION_FAILED");
        return handleExceptionInternal(ex, problem, headers, HttpStatus.BAD_REQUEST, request);
    }

    /** Expected, user-facing failures thrown by services. */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Object> handleApiException(ApiException ex, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatus(ex.getStatus());
        problem.setTitle(ex.getTitle());
        problem.setProperty("code", ex.getCode());
        HttpHeaders headers = new HttpHeaders();
        if (!ex.getFieldProblems().isEmpty()) {
            problem.setProperty(
                    "errors",
                    ex.getFieldProblems().stream()
                            .map(fp -> Map.of("field", fp.field(), "message", fp.message()))
                            .toList());
        }
        if (ex.getRetryAfterSeconds() != null) {
            headers.set(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()));
            problem.setProperty("retryAfterSeconds", ex.getRetryAfterSeconds());
        }
        return handleExceptionInternal(ex, problem, headers, ex.getStatus(), request);
    }

    /**
     * Not logged in, session expired, or wrong credentials → 401. The same message is used for an
     * unknown email and a wrong password so the API can't be used to discover which accounts exist.
     * Also reached from the security filter chain (see SecurityConfig's entry point).
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Object> handleAuthentication(AuthenticationException ex, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        problem.setTitle(ex instanceof BadCredentialsException ? "Invalid email or password" : "Log in to continue");
        problem.setProperty("code", "UNAUTHENTICATED");
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.UNAUTHORIZED, request);
    }

    /** Missing/invalid CSRF token, or an authenticated user lacking access → 403. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Object> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        if (ex instanceof CsrfException) {
            problem.setTitle("Your security token is missing or expired. Refresh and try again.");
            problem.setProperty("code", "CSRF_INVALID");
        } else {
            problem.setTitle("You don't have access to that");
            problem.setProperty("code", "FORBIDDEN");
        }
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.FORBIDDEN, request);
    }

    /** A database constraint rejected the write (e.g. two sign-ups racing for one email) → 409. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Object> handleConstraintViolation(DataIntegrityViolationException ex, WebRequest request) {
        log.warn("Constraint violation: {}", ex.getMostSpecificCause().getMessage());
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("That conflicts with existing data");
        problem.setProperty("code", "CONFLICT");
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.CONFLICT, request);
    }

    /** Anything unexpected → generic 500. Details go to the log only. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleUnexpected(Exception ex, WebRequest request) {
        log.error("Unhandled exception", ex);
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problem.setTitle("Something went wrong on our side");
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.INTERNAL_SERVER_ERROR, request);
    }

    /** Single exit point: enrich every ProblemDetail with type, code and requestId. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        ProblemDetail problem = body instanceof ProblemDetail pd ? pd : ProblemDetail.forStatus(statusCode);
        String code = problem.getProperties() != null && problem.getProperties().get("code") instanceof String c
                ? c
                : codeFor(statusCode);
        problem.setType(URI.create(PROBLEM_BASE + code.toLowerCase().replace('_', '-')));
        problem.setProperty("code", code);
        Object requestId = request.getAttribute(RequestIdFilter.ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        if (requestId != null) {
            problem.setProperty("requestId", requestId);
        }
        if (statusCode.is5xxServerError()) {
            problem.setDetail(null); // never leak internal messages
        }
        return super.handleExceptionInternal(ex, problem, headers, statusCode, request);
    }

    static String codeFor(HttpStatusCode status) {
        return switch (status.value()) {
            case 400 -> "MALFORMED_REQUEST";
            case 401 -> "UNAUTHENTICATED";
            case 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            case 405 -> "METHOD_NOT_ALLOWED";
            case 409 -> "CONFLICT";
            case 415 -> "UNSUPPORTED_MEDIA_TYPE";
            case 422 -> "RULE_VIOLATION";
            case 429 -> "RATE_LIMITED";
            default -> status.is5xxServerError() ? "INTERNAL" : "BAD_REQUEST";
        };
    }
}
