package dev.nova.notification;

import dev.nova.common.web.ApiException;
import dev.nova.common.web.PageResponse;
import dev.nova.notification.NotificationDtos.NotificationResponse;
import dev.nova.notification.NotificationDtos.PreferencesPatch;
import dev.nova.notification.NotificationDtos.PreferencesResponse;
import dev.nova.notification.NotificationDtos.TypePreference;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reading and marking the user's own notifications, and the per-type on/off settings. */
@Service
public class NotificationService {

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final NotificationRepository notifications;
    private final NotificationStore store;
    private final Clock clock;

    public NotificationService(NotificationRepository notifications, NotificationStore store, Clock clock) {
        this.notifications = notifications;
        this.store = store;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> list(UUID userId, boolean unreadOnly, int page, int size) {
        PageResponse.validate(page, size);
        PageRequest request = PageRequest.of(page, size, NEWEST_FIRST);
        Page<Notification> found = unreadOnly
                ? notifications.findByUserIdAndReadAtIsNull(userId, request)
                : notifications.findByUserId(userId, request);
        return PageResponse.of(found, NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return notifications.countByUserIdAndReadAtIsNull(userId);
    }

    /** Marks one read or unread. Someone else's notification is a 404, never a 403. */
    @Transactional
    public NotificationResponse markRead(UUID userId, UUID id, boolean read) {
        Notification n = notifications.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
        n.markRead(read, clock.instant());
        return NotificationResponse.from(n);
    }

    @Transactional
    public int markAllRead(UUID userId) {
        return notifications.markAllRead(userId, clock.instant());
    }

    @Transactional
    public int deleteReadBefore(Instant before) {
        return notifications.deleteReadBefore(before);
    }

    @Transactional(readOnly = true)
    public PreferencesResponse preferences(UUID userId) {
        Set<NotificationType> muted = store.muted(userId);
        return new PreferencesResponse(Arrays.stream(NotificationType.values())
                .map(t -> new TypePreference(t, !muted.contains(t)))
                .toList());
    }

    /** Switching a type off stops new ones; what's already in the list stays. */
    @Transactional
    public PreferencesResponse updatePreferences(UUID userId, PreferencesPatch patch) {
        for (Map.Entry<NotificationType, Boolean> e : patch.enabled().entrySet()) {
            if (e.getKey() == null || e.getValue() == null) {
                throw ApiException.invalidField("enabled", "Use true or false for each type.");
            }
        }
        patch.enabled().forEach((type, enabled) -> store.setEnabled(userId, type, enabled));
        return preferences(userId);
    }
}
