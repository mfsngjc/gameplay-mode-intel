#!/bin/zsh
set -e

cd "$(dirname "$0")"

PORT="${PORT:-4173}"
HOST="127.0.0.1"
URL="http://${HOST}:${PORT}/index.html"
PID_FILE=".server-${PORT}.pid"
LOG_FILE=".server-${PORT}.log"

server_running() {
  curl -fsS "http://${HOST}:${PORT}/" >/dev/null 2>&1
}

if server_running; then
  echo "玩法情报工作台已经在运行：${URL}"
else
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1; then
    echo "发现旧的服务器进程，继续使用：${URL}"
  else
    echo "启动本地服务器：${URL}"
    nohup python3 -m http.server "$PORT" --bind "$HOST" >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
    disown "$(<"$PID_FILE")" 2>/dev/null || true
  fi

  for _ in {1..30}; do
    if server_running; then
      break
    fi
    sleep 0.1
  done
fi

open "$URL"
echo ""
echo "已经打开：${URL}"
echo "关闭这个终端不会自动停止服务器。要停止服务器，请运行：./stop.command"
