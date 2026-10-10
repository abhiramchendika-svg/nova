#!/bin/sh
# Starts NOVA with the AOT cache when the image has one. NOVA_AOT=off starts without it, to compare
# start-up times (docs/deployment.md). Everything else comes from the environment.
set -e
# The cache only works with the exact JVM and settings it was trained with. Check that it maps before
# relying on it (a second or so); if it doesn't, start without it rather than not at all.
if [ -f app.aot ] && [ "${NOVA_AOT:-on}" != "off" ]; then
    if java -XX:AOTCache=app.aot -XX:AOTMode=on -version >/dev/null 2>&1; then
        exec java -XX:AOTCache=app.aot -jar application.jar "$@"
    fi
    echo "NOVA: the AOT cache doesn't fit this JVM; starting without it" >&2
fi
exec java -jar application.jar "$@"
