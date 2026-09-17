#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use --silent default
fi
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请安装 Node.js 24.15 或以上版本，再双击此文件。"
  read -r -p "按回车关闭。"
  exit 1
fi
if ! node -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>24||(major===24&&minor>=15)?0:1)'; then
  echo "Node.js 版本过低，需要 24.15 或以上版本。"
  read -r -p "按回车关闭。"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "尚未安装项目依赖。请在本目录运行 npm install 后再启动。"
  read -r -p "按回车关闭。"
  exit 1
fi
if node scripts/workbench-service.mjs start; then
  open "http://127.0.0.1:5173/"
else
  echo "启动未就绪。可运行 npm run workbench:doctor 查看原因。"
  read -r -p "按回车关闭。"
  exit 1
fi
