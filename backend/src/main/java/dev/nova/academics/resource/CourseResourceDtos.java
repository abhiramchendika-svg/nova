package dev.nova.academics.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** Bodies for /api/v1/courses/{id}/resources (docs/api.md §2.4). */
public final class CourseResourceDtos {

    private CourseResourceDtos() {}

    public record ResourceRequest(
            @NotBlank(message = "Give the link a title.") @Size(max = 120, message = "Keep it under 120 characters.")
                    String title,
            @NotBlank(message = "Paste the link.")
                    @Size(max = WebLinks.MAX_LENGTH, message = "That link is too long.")
                    String url) {}

    public record ResourceResponse(UUID id, UUID courseId, String title, String url, Instant createdAt) {

        static ResourceResponse from(CourseResource r) {
            return new ResourceResponse(r.getId(), r.getCourseId(), r.getTitle(), r.getUrl(), r.getCreatedAt());
        }
    }
}
