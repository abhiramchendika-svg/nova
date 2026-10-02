package dev.nova;

import dev.nova.developer.github.FakeGitHubClient;
import dev.nova.developer.github.GitHubClient;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * Every full-stack test talks to an in-memory GitHub, never the real one (the brief: tests must not
 * depend on live external APIs). Tests that need GitHub data set it up on the {@link FakeGitHubClient}.
 */
@TestConfiguration(proxyBeanMethods = false)
public class FakeGitHubConfiguration {

    @Bean
    @Primary
    GitHubClient fakeGitHubClient() {
        return new FakeGitHubClient();
    }
}
