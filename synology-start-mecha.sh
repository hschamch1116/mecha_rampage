#!/bin/bash

PROJECT_DIR="/volume1/docker/mecha_rampage_siege_walker_v5"
PORT="8080"
LOG_FILE="$PROJECT_DIR/logs/mecha-rampage-node.log"
PID_FILE="$PROJECT_DIR/logs/mecha-rampage-node.pid"

mkdir -p "$PROJECT_DIR/logs"
cd "$PROJECT_DIR" || exit 1

PATHS=(
    "/usr/bin/node"
    "/usr/local/bin/node"
    "/var/packages/Node.js_v20/target/usr/local/bin/node"
    "/var/packages/Node.js_v18/target/usr/local/bin/node"
    "/var/packages/Node.js_v16/target/usr/local/bin/node"
    "/var/packages/Node.js/target/bin/node"
)

NODE_BIN=""
for path_candidate in "${PATHS[@]}"; do
    if [ -x "$path_candidate" ]; then
        NODE_BIN="$path_candidate"
        break
    fi
done

if [ -z "$NODE_BIN" ]; then
    NODE_BIN="$(find /volume1/@appstore/ -name node -type f -executable 2>/dev/null | head -n 1)"
fi

if [ -z "$NODE_BIN" ]; then
    {
        echo "=== [ERROR] Node.js not found ==="
        echo "Install Node.js from Synology Package Center."
        echo "Search result:"
        find /usr /var/packages /volume1 -name node -type f -executable 2>/dev/null
    } > "$LOG_FILE"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/server.js" ]; then
    echo "=== [ERROR] server.js not found: $PROJECT_DIR/server.js ===" >> "$LOG_FILE"
    exit 1
fi

REQUIRED_VENDOR_FILES=(
    "$PROJECT_DIR/vendor/three/build/three.module.js"
    "$PROJECT_DIR/vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js"
    "$PROJECT_DIR/vendor/three/examples/jsm/utils/BufferGeometryUtils.js"
    "$PROJECT_DIR/vendor/three/examples/jsm/postprocessing/EffectComposer.js"
    "$PROJECT_DIR/vendor/three/examples/jsm/postprocessing/RenderPass.js"
    "$PROJECT_DIR/vendor/cannon-es/dist/cannon-es.js"
)
for required_file in "${REQUIRED_VENDOR_FILES[@]}"; do
    if [ ! -f "$required_file" ]; then
        echo "=== [ERROR] Required local module is missing: $required_file ===" >> "$LOG_FILE"
        echo "Copy the complete vendor directory before starting the NAS server." >> "$LOG_FILE"
        exit 1
    fi
done

if [ -f "$PID_FILE" ]; then
    OLD_PID="$(cat "$PID_FILE")"
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Already running. PID=$OLD_PID NODE=$NODE_BIN" >> "$LOG_FILE"
        exit 0
    fi
    rm -f "$PID_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Node server with $NODE_BIN" >> "$LOG_FILE"
MECHA_ROOT="$PROJECT_DIR" PORT="$PORT" \
    nohup "$NODE_BIN" "$PROJECT_DIR/server.js" \
    >> "$LOG_FILE" 2>&1 < /dev/null &

SERVER_PID="$!"
echo "$SERVER_PID" > "$PID_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Started. PID=$SERVER_PID PORT=$PORT" >> "$LOG_FILE"
