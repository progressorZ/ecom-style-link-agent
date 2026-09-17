#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
mkdir -p data runtime/generated
case "$(uname -m)" in
  arm64) SOURCE="runtime/node-arm64.runtime" ;;
  x86_64) SOURCE="runtime/node-x64.runtime" ;;
  *) echo "不支持当前 Mac 处理器。"; read -r -p "按回车关闭。"; exit 1 ;;
esac
NODE="runtime/generated/node"
if [ ! -x "$NODE" ] || [ "$SOURCE" -nt "$NODE" ]; then cp "$SOURCE" "$NODE" && chmod 700 "$NODE"; fi
export ECOM_DATA_DIR="$PWD/data"
"$NODE" scripts/workbench-doctor.mjs
echo
read -r -p "按回车关闭。"
