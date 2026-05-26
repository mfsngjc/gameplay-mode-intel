#!/bin/zsh
set -e

cd "$(dirname "$0")"

PORT="${PORT:-4173}"
HOST="127.0.0.1"
URL="http://${HOST}:${PORT}/index.html"
PID_FILE=".server-${PORT}.pid"
LOG_FILE=".server-${PORT}.log"
PYTHON="/usr/bin/python3"

# 释放端口（僵尸进程 / 旧实例）
if lsof -ti ":$PORT" >/dev/null 2>&1; then
  echo "端口 $PORT 被占用，释放中…"
  lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi
rm -f "$PID_FILE"

echo "启动：${URL}"
nohup "$PYTHON" -m http.server "$PORT" --bind "$HOST" >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
disown "$(<"$PID_FILE")" 2>/dev/null || true

# 等服务器就绪
for _ in {1..30}; do
  if curl -fsS --max-time 1 "http://${HOST}:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

open "$URL"
echo ""
echo "已打开：${URL}"
echo "关闭终端不会停止服务器。要停止：./stop.command"
