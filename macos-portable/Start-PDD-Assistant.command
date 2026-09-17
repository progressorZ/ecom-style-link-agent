#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
mkdir -p data runtime/generated
case "$(uname -m)" in
  arm64) SOURCE="runtime/node-arm64.runtime" ;;
  x86_64) SOURCE="runtime/node-x64.runtime" ;;
  *) echo "不支持当前 Mac 处理器：$(uname -m)"; read -r -p "按回车关闭。"; exit 1 ;;
esac
NODE="runtime/generated/node"
if [ ! -x "$NODE" ] || [ "$SOURCE" -nt "$NODE" ]; then
  cp "$SOURCE" "$NODE" && chmod 700 "$NODE"
fi
if [ ! -x "$NODE" ]; then
  echo "无法准备内置运行环境，请重新解压完整压缩包。"
  read -r -p "按回车关闭。"
  exit 1
fi
echo "正在启动，请稍候……"
"$NODE" scripts/portable-launcher.mjs 2>data/startup-error.log
STATUS=$?
echo
if [ "$STATUS" -ne 0 ]; then
  echo "启动失败："
  cat data/startup-error.log
else
  echo "助手已经停止。"
fi
read -r -p "按回车关闭。"
exit "$STATUS"
