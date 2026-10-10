#!/bin/sh
# Starts NOVA with the AOT cache when the image has one. NOVA_AOT=off starts without it, to compare
# start-up times (docs/deployment.md). Everything else comes from the environment.
set -e
if [ -f app.aot ] && [ "${NOVA_AOT:-on}" != "off" ]; then
    exec java -XX:AOTCache=app.aot -jar application.jar "$@"
fi
exec java -jar application.jar "$@"
