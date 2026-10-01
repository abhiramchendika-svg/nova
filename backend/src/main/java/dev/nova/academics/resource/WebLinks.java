package dev.nova.academics.resource;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Optional;

/**
 * Checks that a user-supplied link is a plain web address before it's stored and later rendered
 * as an {@code <a href>}. Only http and https with a host are accepted, so javascript:, data: and
 * file: links (and look-alikes such as "https:/x" or " javascript:…") never get through. The
 * database has the same scheme check as a backstop.
 */
public final class WebLinks {

    static final int MAX_LENGTH = 2048;

    private WebLinks() {}

    /** The trimmed URL if it's acceptable; empty otherwise. */
    public static Optional<String> normalize(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String url = raw.strip();
        if (url.isEmpty() || url.length() > MAX_LENGTH || url.chars().anyMatch(c -> c <= 0x20 || c == 0x7f)) {
            return Optional.empty();
        }
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https"))) {
                return Optional.empty();
            }
            boolean hasHost = uri.getHost() != null && !uri.getHost().isBlank();
            boolean slashes = url.regionMatches(true, 0, scheme + "://", 0, scheme.length() + 3);
            if (!hasHost || !slashes) {
                return Optional.empty();
            }
            return Optional.of(url);
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
    }
}
