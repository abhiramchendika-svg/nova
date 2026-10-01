package dev.nova.planner.calendar;

import dev.nova.planner.calendar.CalendarDtos.CalendarResponse;
import dev.nova.security.NovaUserDetails;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/calendar")
public class CalendarController {

    private final CalendarService service;

    public CalendarController(CalendarService service) {
        this.service = service;
    }

    /** Both dates inclusive, in the user's timezone; at most 62 days. */
    @GetMapping
    public CalendarResponse range(
            @AuthenticationPrincipal NovaUserDetails me,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.range(me.id(), from, to);
    }
}
