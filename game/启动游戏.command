#!/bin/bash
# 阵型将军 - 双击启动（macOS .command 文件）

cd "$(dirname "$0")"

PORT=8765
URL="http://127.0.0.1:${PORT}"

clear
echo "================================"
echo "       ⚔  Tiny Swords  ⚔"
echo "================================"
echo ""

if lsof -i :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
  OLD_PID=$(lsof -i :${PORT} -sTCP:LISTEN -t 2>/dev/null | head -1)
  echo "检测到端口 ${PORT} 已被占用 (PID: ${OLD_PID})，正在重启..."
  kill "${OLD_PID}" 2>/dev/null
  sleep 0.5
fi

if ! command -v python3 &>/dev/null; then
  echo "错误: 未找到 Python3，请先安装 Python 3"
  read -r -p "按回车键关闭..."
  exit 1
fi

LAN_IP=$(python3 -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0])" 2>/dev/null || echo "127.0.0.1")

echo "正在启动游戏服务器..."
echo "本机地址: ${URL}"
echo "局域网地址: http://${LAN_IP}:${PORT}/"
echo "其他玩家请用局域网地址打开，共享通关次数"
echo ""
echo "提示: 关闭此窗口将停止游戏"
echo "================================"
echo ""

python3 server.py &
SERVER_PID=$!

READY=0
for _ in $(seq 1 30); do
  if curl -s -o /dev/null --connect-timeout 1 "http://127.0.0.1:${PORT}/"; then
    READY=1
    break
  fi
  sleep 0.2
done

if [ "${READY}" -eq 1 ]; then
  open "${URL}"
  echo "游戏已在浏览器中打开！"
  echo ""
  wait "${SERVER_PID}"
else
  echo "错误: 服务器启动失败，请检查 Python 环境"
  kill "${SERVER_PID}" 2>/dev/null
  read -r -p "按回车键关闭..."
  exit 1
fi
