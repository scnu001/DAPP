@echo off
chcp 65001 >nul
title Ticket DApp - dev server (keep this window open)

cd /d "%~dp0"

echo ============================================================
echo   COMP7610 Ticket DApp - 本地开发服务器
echo.
echo   启动后请在浏览器打开：  http://127.0.0.1:5173/
echo.
echo   需要你的浏览器里装了 MetaMask，并切到 Sepolia 网络。
echo   * 关掉这个黑窗口 = 停止服务
echo ============================================================
echo.

if not exist "node_modules" (
  echo [1/2] 首次运行，正在安装依赖（需要联网，可能要几分钟）...
  call npm install
  if errorlevel 1 (
    echo.
    echo [x] npm install 失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo [2/2] 启动 Vite dev server...
call npm run dev

echo.
echo 服务已停止。
pause
