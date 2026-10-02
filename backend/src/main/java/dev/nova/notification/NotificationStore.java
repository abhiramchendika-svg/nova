package dev.nova.notification;

import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The native SQL the generator and settings need: idempotent inserts (ON CONFLICT), the muted types,
 * and compare-and-set on a rule's last-seen state. Callers own the transaction.
 */
@Component
public class NotificationStore {

    private final EntityManager em;

    public NotificationStore(EntityManager em) {
        this.em = em;
    }

    /** Creates the notification unless one with the same dedupe key exists; true if it was created. */
    public boolean insertIfNew(UUID userId, NotificationRules.Draft draft, Instant now) {
        int rows = em.createNativeQuery("insert into notifications"
                        + " (id, user_id, type, title, body, link_path, dedupe_key, created_at)"
                        + " values (gen_random_uuid(), :userId, :type, :title, :body, :link, :key, :now)"
                        + " on conflict (user_id, dedupe_key) do nothing")
                .setParameter("userId", userId)
                .setParameter("type", draft.type().name())
                .setParameter("title", draft.title())
                .setParameter("body", draft.body())
                .setParameter("link", draft.link())
                .setParameter("key", draft.dedupeKey())
                .setParameter("now", now)
                .executeUpdate();
        return rows == 1;
    }

    public Set<NotificationType> muted(UUID userId) {
        @SuppressWarnings("unchecked")
        List<String> rows = em.createNativeQuery("select type from notification_mutes where user_id = :userId")
                .setParameter("userId", userId)
                .getResultList();
        Set<NotificationType> muted = EnumSet.noneOf(NotificationType.class);
        rows.forEach(t -> muted.add(NotificationType.valueOf(t)));
        return muted;
    }

    public void setEnabled(UUID userId, NotificationType type, boolean enabled) {
        String sql = enabled
                ? "delete from notification_mutes where user_id = :userId and type = :type"
                : "insert into notification_mutes (user_id, type) values (:userId, :type) on conflict do nothing";
        em.createNativeQuery(sql)
                .setParameter("userId", userId)
                .setParameter("type", type.name())
                .executeUpdate();
    }

    /** The state a change-based rule last saw for a subject, or null the first time. */
    public String state(UUID userId, String subject) {
        @SuppressWarnings("unchecked")
        List<String> rows = em.createNativeQuery(
                        "select state from notification_states where user_id = :userId and subject = :subject")
                .setParameter("userId", userId)
                .setParameter("subject", subject)
                .getResultList();
        return rows.isEmpty() ? null : rows.getFirst();
    }

    /**
     * Moves a subject from {@code expected} (null: never seen) to {@code next}. Returns false if
     * another run changed it first, so only one run notifies about a change.
     */
    public boolean compareAndSetState(UUID userId, String subject, String expected, String next, Instant now) {
        String sql = expected == null
                ? "insert into notification_states (user_id, subject, state, updated_at)"
                        + " values (:userId, :subject, :next, :now) on conflict do nothing"
                : "update notification_states set state = :next, updated_at = :now"
                        + " where user_id = :userId and subject = :subject and state = :expected";
        var query = em.createNativeQuery(sql)
                .setParameter("userId", userId)
                .setParameter("subject", subject)
                .setParameter("next", next)
                .setParameter("now", now);
        if (expected != null) {
            query.setParameter("expected", expected);
        }
        return query.executeUpdate() == 1;
    }
}
