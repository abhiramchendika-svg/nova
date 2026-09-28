package dev.nova.settings;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.nova.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class SettingsFlowTest extends IntegrationTest {

    private static String settingsJson(String timezone, String target) {
        return """
                {"timezone":"%s","weekStart":"MON","universityName":"SRM University AP",
                 "defaultAttendanceTarget":%s,"theme":"DARK"}""".formatted(timezone, target);
    }

    @Test
    void newAccountsStartWithNeutralDefaults() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("settings"));

        mvc.perform(get("/api/v1/settings").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone").value("UTC"))
                .andExpect(jsonPath("$.weekStart").value("MON"))
                .andExpect(jsonPath("$.theme").value("SYSTEM"))
                .andExpect(jsonPath("$.defaultAttendanceTarget").doesNotExist())
                .andExpect(jsonPath("$.onboardingCompleted").value(false));
    }

    @Test
    void updatesSettings() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("update"));

        mvc.perform(put("/api/v1/settings")
                        .cookie(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settingsJson("Asia/Kolkata", "75.00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone").value("Asia/Kolkata"))
                .andExpect(jsonPath("$.defaultAttendanceTarget").value(75.00))
                .andExpect(jsonPath("$.theme").value("DARK"));

        mvc.perform(get("/api/v1/settings").cookie(session)).andExpect(jsonPath("$.timezone").value("Asia/Kolkata"));
    }

    @Test
    void rejectsUnknownTimezoneAndOutOfRangeTarget() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("invalid"));

        mvc.perform(put("/api/v1/settings")
                        .cookie(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settingsJson("Mars/Olympus_Mons", "75")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("timezone"));

        mvc.perform(put("/api/v1/settings")
                        .cookie(session)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settingsJson("UTC", "100")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("defaultAttendanceTarget"));
    }

    @Test
    void onboardingCompletionShowsUpOnMe() throws Exception {
        Cookie session = registerAndGetSession(uniqueEmail("onboard"));

        mvc.perform(post("/api/v1/settings/onboarding/complete").cookie(session).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingCompleted").value(true));

        mvc.perform(get("/api/v1/auth/me").cookie(session)).andExpect(jsonPath("$.onboardingCompleted").value(true));
    }

    @Test
    void settingsRequireLogin() throws Exception {
        mvc.perform(get("/api/v1/settings")).andExpect(status().isUnauthorized());
    }
}
