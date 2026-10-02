package dev.nova.search;

import java.util.Locale;

/** How a query becomes a LIKE pattern, free of Spring so it can be unit-tested directly. */
public final class SearchRules {

    public static final int MIN_QUERY = 2;
    public static final int MAX_QUERY = 100;
    public static final int DEFAULT_LIMIT = 5;
    public static final int MAX_LIMIT = 10;
    /** The escape character used in every LIKE NOVA builds ('!', so no backslash quoting rules apply). */
    public static final char ESCAPE = '!';

    private SearchRules() {}

    /** Lower-cased, with LIKE's wildcards and the escape character escaped: matches literally. */
    public static String literal(String query) {
        String q = query.strip().toLowerCase(Locale.ROOT);
        StringBuilder out = new StringBuilder(q.length() + 8);
        for (char c : q.toCharArray()) {
            if (c == '%' || c == '_' || c == ESCAPE) {
                out.append(ESCAPE);
            }
            out.append(c);
        }
        return out.toString();
    }

    /** Anywhere in the text. */
    public static String contains(String query) {
        return "%" + literal(query) + "%";
    }

    /** At the start, so those rank first. */
    public static String startsWith(String query) {
        return literal(query) + "%";
    }

    /** "IN_PROGRESS" → "In progress". */
    public static String label(Enum<?> value) {
        String words = value.name().replace('_', ' ').toLowerCase(Locale.ROOT);
        return Character.toUpperCase(words.charAt(0)) + words.substring(1);
    }
}
