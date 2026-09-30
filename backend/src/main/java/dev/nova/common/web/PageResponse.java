package dev.nova.common.web;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * The page shape for unbounded collections (docs/api.md §1):
 * {@code { "items": [...], "page": 0, "size": 20, "totalItems": 57, "totalPages": 3 }}.
 * Spring's own Page JSON isn't a stable contract, so the API never returns it directly.
 */
public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    public static <E, R> PageResponse<R> of(Page<E> page, Function<E, R> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }

    /** Rejects out-of-range paging parameters with a field error instead of silently clamping them. */
    public static void validate(int page, int size) {
        if (page < 0) {
            throw ApiException.invalidField("page", "Must be 0 or more.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw ApiException.invalidField("size", "Must be between 1 and " + MAX_SIZE + ".");
        }
    }
}
