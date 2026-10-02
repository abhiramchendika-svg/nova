package dev.nova.notification;

import dev.nova.common.web.PageResponse;
import dev.nova.notification.NotificationDtos.NotificationResponse;
import dev.nova.notification.NotificationDtos.PreferencesPatch;
import dev.nova.notification.NotificationDtos.PreferencesResponse;
import dev.nova.notification.NotificationDtos.ReadAllResponse;
import dev.nova.notification.NotificationDtos.ReadRequest;
import dev.nova.notification.NotificationDtos.UnreadCountResponse;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The bell, the notifications page and Settings → Notifications (docs/api.md §2.14). */
@RestController
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping("/api/v1/notifications")
    public PageResponse<NotificationResponse> list(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(defaultValue = "false") boolean unread,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + PageResponse.DEFAULT_SIZE) int size) {
        return service.list(me.id(), unread, page, size);
    }

    @GetMapping("/api/v1/notifications/unread-count")
    public UnreadCountResponse unreadCount(@AuthenticationPrincipal NovaUserDetails me) {
        return new UnreadCountResponse(service.unreadCount(me.id()));
    }

    @PatchMapping("/api/v1/notifications/{id}")
    public NotificationResponse markRead(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody ReadRequest body) {
        return service.markRead(me.id(), id, body.read());
    }

    @PostMapping("/api/v1/notifications/read-all")
    public ReadAllResponse markAllRead(@AuthenticationPrincipal NovaUserDetails me) {
        return new ReadAllResponse(service.markAllRead(me.id()));
    }

    @GetMapping("/api/v1/settings/notifications")
    public PreferencesResponse preferences(@AuthenticationPrincipal NovaUserDetails me) {
        return service.preferences(me.id());
    }

    @PatchMapping("/api/v1/settings/notifications")
    public PreferencesResponse updatePreferences(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody PreferencesPatch body) {
        return service.updatePreferences(me.id(), body);
    }
}
