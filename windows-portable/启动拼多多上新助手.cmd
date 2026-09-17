@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 拼多多上新助手
if not exist "data" mkdir "data"
if not exist "runtime\node.exe" (
  echo 缺少 runtime\node.exe。请从官方 Release 重新下载完整离线包并完整解压。
  echo 如果解压后仍缺失，请检查 Windows 安全中心的保护历史。
  pause
  exit /b 1
)
echo 正在启动，请稍候……
"runtime\node.exe" "scripts\portable-launcher.mjs" 2>"data\startup-error.log"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo 启动失败，错误如下：
  type "data\startup-error.log"
  echo.
  echo 也可以双击 Diagnose-PDD-Assistant.cmd 继续检查。
) else (
  echo 助手已经停止。
)
pause
exit /b %EXIT_CODE%
