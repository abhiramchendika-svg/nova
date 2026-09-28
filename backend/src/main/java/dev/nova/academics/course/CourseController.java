package dev.nova.academics.course;

import dev.nova.academics.course.CourseDtos.CourseRequest;
import dev.nova.academics.course.CourseDtos.CourseResponse;
import dev.nova.academics.course.CourseDtos.GradeRequest;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
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
@RequestMapping("/api/v1/courses")
public class CourseController {

    private final CourseService service;

    public CourseController(CourseService service) {
        this.service = service;
    }

    /** Without {@code semesterId}: the current semester's courses. */
    @GetMapping
    public List<CourseResponse> list(
            @AuthenticationPrincipal NovaUserDetails me, @RequestParam(required = false) UUID semesterId) {
        return service.list(me.id(), semesterId);
    }

    @GetMapping("/{id}")
    public CourseResponse get(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        return service.get(me.id(), id);
    }

    @PostMapping
    public ResponseEntity<CourseResponse> create(
            @AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody CourseRequest body) {
        CourseResponse course = service.create(me.id(), body);
        return ResponseEntity.created(URI.create("/api/v1/courses/" + course.id())).body(course);
    }

    @PutMapping("/{id}")
    public CourseResponse update(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody CourseRequest body) {
        return service.update(me.id(), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/grade")
    public CourseResponse setGrade(
            @AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id, @Valid @RequestBody GradeRequest body) {
        return service.setGrade(me.id(), id, body);
    }

    @DeleteMapping("/{id}/grade")
    public ResponseEntity<Void> clearGrade(@AuthenticationPrincipal NovaUserDetails me, @PathVariable UUID id) {
        service.clearGrade(me.id(), id);
        return ResponseEntity.noContent().build();
    }
}
