package dev.nova.notification;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bodies for /api/v1/notifications and /api/v1/settings/notifications (docs/api.md §2.14). */
public final class NotificationDtos {

    private NotificationDtos() {}

    /** {@code link}: an in-app path to what the notification is about. */
    public record NotificationResponse(
            UUID id,
            NotificationType type,
            String title,
            String body,
            String link,
            boolean read,
            Instant createdAt,
            Instant readAt) {

        static NotificationResponse from(Notification n) {
            return new NotificationResponse(
                    n.getId(),
                    n.getType(),
                    n.getTitle(),
                    n.getBody(),
                    n.getLinkPath(),
                    n.getReadAt() != null,
                    n.getCreatedAt(),
                    n.getReadAt());
        }
    }

    public record UnreadCountResponse(long count) {}

    public record ReadRequest(@NotNull(message = "Say whether it's read.") Boolean read) {}

    public record ReadAllResponse(int updated) {}

    /** Every type, in a fixed order, with whether it's on. */
    public record PreferencesResponse(List<TypePreference> types) {}

    public record TypePreference(NotificationType type, boolean enabled) {}

    /** Only the types to change, e.g. {@code {"enabled":{"TASK_OVERDUE":false}}}. */
    public record PreferencesPatch(@NotEmpty(message = "Choose at least one type.") Map<NotificationType, Boolean> enabled) {}
}
