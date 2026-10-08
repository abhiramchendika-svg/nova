package dev.nova.demo;

import jakarta.persistence.EntityManager;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import org.springframework.stereotype.Component;

/** The native SQL behind demo accounts: a creation lock, capacity numbers and clean-up. Callers own the transaction. */
@Component
class DemoStore {

    /** pg_advisory_xact_lock key for demo sign-ups ("NOVADEMO" in ASCII). */
    private static final long CREATE_LOCK = 0x4E4F564144454D4FL;

    private final EntityManager em;

    DemoStore(EntityManager em) {
        this.em = em;
    }

    /**
     * Serialises demo sign-ups until the transaction ends, so two requests can't both pass the
     * capacity check and overshoot it. Released automatically on commit or rollback.
     */
    void lockCreation() {
        em.createNativeQuery("select 1 from pg_advisory_xact_lock(:key)")
                .setParameter("key", CREATE_LOCK)
                .getSingleResult();
    }

    DemoRules.Usage usage(Instant now, Instant recentExpiryAfter) {
        Object[] row = (Object[]) em.createNativeQuery("select"
                        + " count(*) filter (where demo_expires_at > :now),"
                        + " min(demo_expires_at) filter (where demo_expires_at > :now),"
                        + " count(*) filter (where demo_expires_at > :recent),"
                        + " min(demo_expires_at) filter (where demo_expires_at > :recent)"
                        + " from users where demo_expires_at is not null")
                .setParameter("now", now)
                .setParameter("recent", recentExpiryAfter)
                .getSingleResult();
        return new DemoRules.Usage(
                ((Number) row[0]).longValue(), instant(row[1]), ((Number) row[2]).longValue(), instant(row[3]));
    }

    /**
     * Deletes demo accounts that expired at or before {@code now}, and their sessions. Everything
     * else a user owns goes with the user row (on delete cascade). Returns how many accounts went.
     */
    int deleteExpired(Instant now) {
        em.createNativeQuery("delete from spring_session where principal_name in"
                        + " (select email from users where demo_expires_at <= :now)")
                .setParameter("now", now)
                .executeUpdate();
        return em.createNativeQuery("delete from users where demo_expires_at <= :now")
                .setParameter("now", now)
                .executeUpdate();
    }

    /** Native queries may hand timestamps back as any of these, depending on driver and Hibernate. */
    private static Instant instant(Object value) {
        return switch (value) {
            case null -> null;
            case Instant i -> i;
            case OffsetDateTime o -> o.toInstant();
            case ZonedDateTime z -> z.toInstant();
            case Timestamp t -> t.toInstant();
            default -> throw new IllegalStateException("Unexpected timestamp type " + value.getClass());
        };
    }
}
