#!/bin/sh
# Starts NOVA with the AOT cache when the image has one. NOVA_AOT=off starts without it, to compare
# start-up times (docs/deployment.md). Everything else comes from the environment.
set -e
# If the cache doesn't fit this JVM, Java prints a warning and starts without it (the default
# AOTMode=auto), so a stale cache slows start-up down but never stops it. CI checks that it fits.
if [ -f app.aot ] && [ "${NOVA_AOT:-on}" != "off" ]; then
    exec java -XX:AOTCache=app.aot -jar application.jar "$@"
fi
exec java -jar application.jar "$@"
