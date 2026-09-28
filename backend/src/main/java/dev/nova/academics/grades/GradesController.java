package dev.nova.academics.grades;

import dev.nova.academics.grades.GradesDtos.GradesSummaryResponse;
import dev.nova.academics.grades.GradesDtos.WhatIfRequest;
import dev.nova.security.NovaUserDetails;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/grades")
public class GradesController {

    private final GradesService service;

    public GradesController(GradesService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public GradesSummaryResponse summary(@AuthenticationPrincipal NovaUserDetails me) {
        return service.summary(me.id());
    }

    /** A POST because it carries a body, but it changes nothing. */
    @PostMapping("/what-if")
    public GradesSummaryResponse whatIf(@AuthenticationPrincipal NovaUserDetails me, @Valid @RequestBody WhatIfRequest body) {
        return service.whatIf(me.id(), body);
    }
}
