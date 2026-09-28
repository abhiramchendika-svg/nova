package dev.nova.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatusCode;

/** Plain unit test: the status → code mapping is a contract with the frontend (docs/api.md §1). */
class ApiExceptionHandlerTest {

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({
        "400, MALFORMED_REQUEST",
        "401, UNAUTHENTICATED",
        "403, FORBIDDEN",
        "404, NOT_FOUND",
        "405, METHOD_NOT_ALLOWED",
        "409, CONFLICT",
        "422, RULE_VIOLATION",
        "429, RATE_LIMITED",
        "500, INTERNAL",
        "503, INTERNAL",
        "418, BAD_REQUEST",
    })
    void mapsStatusToStableCode(int status, String expected) {
        assertThat(ApiExceptionHandler.codeFor(HttpStatusCode.valueOf(status))).isEqualTo(expected);
    }
}
