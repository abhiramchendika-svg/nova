package dev.nova.academics.timetable;

import dev.nova.academics.timetable.TimetableDtos.DayResponse;
import dev.nova.academics.timetable.TimetableDtos.EntryRequest;
import dev.nova.academics.timetable.TimetableDtos.EntryResponse;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/timetable")
public class TimetableController {

    private final TimetableService service;

    public TimetableController(TimetableService service) {
        this.service = service;
    }

    @GetMapping
    public List<EntryResponse> week(
            @AuthenticationPrincipal NovaUserDetails me, @RequestParam(required = false) UUID semesterId) {
        return service.week(me.id(), semesterId);
    }

    /** Without {@code date}: today in the user's timezone. */
    @GetMapping("/day")
    public DayResponse day(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.day(me.id(), date);
    }

    @PostMapping
    public ResponseEntity<EntryResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody EntryRequest body) {
        EntryResponse created = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/timetable/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public EntryResponse update(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody EntryRequest body) {
        return service.update(me.id(), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }
}
