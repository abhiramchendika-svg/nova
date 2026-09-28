package dev.nova.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/**
 * The session cookie, defined explicitly rather than through server.servlet.session.cookie.*
 * properties, so its name and flags don't depend on how Spring Session picks those up.
 */
@Configuration(proxyBeanMethods = false)
public class SessionCookieConfig {

    public static final String COOKIE_NAME = "NOVA_SESSION";

    @Bean
    CookieSerializer cookieSerializer(@Value("${nova.security.cookie-secure:false}") boolean secure) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName(COOKIE_NAME);
        serializer.setCookiePath("/");
        serializer.setUseHttpOnlyCookie(true); // JavaScript can't read it, so XSS can't steal it
        serializer.setSameSite("Lax"); // not sent on cross-site POSTs
        serializer.setUseSecureCookie(secure); // HTTPS-only in production
        return serializer;
    }
}
