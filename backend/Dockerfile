# syntax=docker/dockerfile:1
# NOVA backend image: build with Maven, extract the Spring Boot jar, train a JDK 25 AOT cache, run as a
# non-root user. Follows Spring Boot's "AOT cache" Dockerfile (reference/packaging/container-images).
# Build from the backend folder:  docker build -t nova-backend ./backend

# ── 1. Build the jar (tests run in CI, not here: they need Docker for Testcontainers) ──
FROM bellsoft/liberica-openjdk-debian:25 AS build
WORKDIR /src
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
# Windows checkouts can turn the wrapper's line endings into CRLF, which breaks `sh`
RUN sed -i 's/\r$//' mvnw && sh ./mvnw --batch-mode --no-transfer-progress dependency:go-offline
COPY src/ src/
RUN sh ./mvnw --batch-mode --no-transfer-progress -DskipTests package \
    && cp target/nova-backend-*.jar application.jar

# ── 2. Extract into the layout that starts fastest and suits the AOT cache ──
FROM bellsoft/liberica-openjre-debian:25-cds AS extract
WORKDIR /builder
COPY --from=build /src/application.jar application.jar
RUN java -Djarmode=tools -jar application.jar extract --layers --destination extracted

# ── 3. Runtime ──
FROM bellsoft/liberica-openjre-debian:25-cds
WORKDIR /application

# Same JVM options for the training run and at runtime, or the JVM refuses the cache. The heap is a
# fixed size on purpose: a percentage of memory gives a huge heap on the build machine and a small one
# on Render, which changes the object layout (compressed pointers) and makes the cache unusable.
# 384 MB is 75% of Render's 512 MB; Serial GC suits a single small CPU.
ENV JAVA_TOOL_OPTIONS="-XX:+UseSerialGC -Xms64m -Xmx384m"

# Dependencies change least often, the application code most: separate layers keep rebuilds small
COPY --from=extract /builder/extracted/dependencies/ ./
COPY --from=extract /builder/extracted/spring-boot-loader/ ./
COPY --from=extract /builder/extracted/snapshot-dependencies/ ./
COPY --from=extract /builder/extracted/application/ ./

# AOT cache training run: start the context once and exit right after refresh, recording the loaded and
# linked classes into app.aot. There is no database during the build, so nothing may connect: Flyway
# and Hibernate's start-up checks are off for this run only (the connection pool connects lazily).
# If training fails for any reason the image still builds and simply starts without the cache.
RUN java -XX:AOTCacheOutput=app.aot \
        -Dspring.context.exit=onRefresh \
        -Dspring.flyway.enabled=false \
        -Dspring.jpa.hibernate.ddl-auto=none \
        -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
        -Dspring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect \
        -jar application.jar \
    || (echo "AOT cache training failed: the image will start without it" && rm -f app.aot)

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod 755 /usr/local/bin/docker-entrypoint.sh \
    && useradd --system --no-create-home --shell /usr/sbin/nologin nova
USER nova

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
