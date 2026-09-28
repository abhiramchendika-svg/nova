package dev.nova.settings;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SettingsServiceTest {

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({
        "Asia/Kolkata, true",
        "America/New_York, true",
        "UTC, true",
        "Mars/Olympus_Mons, false",
        "+05:30, false", // fixed offsets ignore daylight-saving rules; require a region id
        "IST, false", // ambiguous abbreviation
        "'', false",
    })
    void acceptsOnlyRegionTimezones(String zone, boolean valid) {
        assertThat(SettingsService.isValidZone(zone)).isEqualTo(valid);
    }
}
