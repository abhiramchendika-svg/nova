package dev.nova.demo;

import jakarta.validation.constraints.Size;

/** /api/v1/demo request bodies (docs/api.md §2.1, "Demo"). */
public final class DemoDtos {

    private DemoDtos() {}

    /**
     * {@code timezone} is the browser's IANA zone (Intl.DateTimeFormat), so "today" in the demo is the
     * visitor's today. Optional: anything missing or unknown means UTC.
     */
    public record StartRequest(@Size(max = 64, message = "Keep it under 64 characters.") String timezone) {}
}
