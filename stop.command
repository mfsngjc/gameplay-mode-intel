#!/bin/zsh
set -e

cd "$(dirname "$0")"

PORT="${PORT:-4173}"
PID_FILE=".server-${PORT}.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID"
    echo "已停止本地服务器：${PID}"
  else
    echo "没有正在运行的记录进程。"
  fi
  rm -f "$PID_FILE"
else
  echo "没有找到服务器 PID 文件。"
fi
