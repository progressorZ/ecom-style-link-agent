@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 拼多多上新助手诊断
set "ECOM_DATA_DIR=%CD%\data"
if not exist "runtime\node.exe" (
  echo 缺少 runtime\node.exe。请从官方 Release 重新下载完整离线包并完整解压。
  echo 如果解压后仍缺失，请检查 Windows 安全中心的保护历史。
  pause
  exit /b 1
)
"runtime\node.exe" "scripts\workbench-doctor.mjs"
echo.
pause
