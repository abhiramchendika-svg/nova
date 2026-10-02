package dev.nova.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data generates the queries from the method names. Callers pass normalised emails. */
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /** User ids after {@code after}, in id order: keyset paging for background jobs over every user. */
    @Query("select u.id from User u where u.id > :after order by u.id")
    List<UUID> idsAfter(@Param("after") UUID after, Pageable limit);
}
