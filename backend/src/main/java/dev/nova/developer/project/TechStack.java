package dev.nova.developer.project;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** A project's technologies: trimmed, blanks dropped, case-insensitive duplicates removed, order kept. */
public final class TechStack {

    static final int MAX_ITEMS = 15;
    static final int MAX_LENGTH = 30;

    private TechStack() {}

    /** @throws IllegalArgumentException with a message for the user when the list can't be accepted */
    public static List<String> normalize(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        Map<String, String> unique = new LinkedHashMap<>();
        for (String item : raw) {
            String t = item == null ? "" : item.strip().replaceAll("\\s+", " ");
            if (t.isEmpty()) {
                continue;
            }
            if (t.length() > MAX_LENGTH) {
                throw new IllegalArgumentException("Keep each technology under " + MAX_LENGTH + " characters.");
            }
            unique.putIfAbsent(t.toLowerCase(Locale.ROOT), t);
        }
        if (unique.size() > MAX_ITEMS) {
            throw new IllegalArgumentException("List up to " + MAX_ITEMS + " technologies.");
        }
        return new ArrayList<>(unique.values());
    }
}
