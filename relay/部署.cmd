@echo off
chcp 65001 >nul
title Ticket DApp - relay Worker deploy

cd /d "%~dp0"

echo ============================================================
echo   COMP7610 Ticket DApp - relay Worker 部署
echo.
echo   它会依次做三件事：wrangler login -^> 写 GITHUB_TOKEN -^> deploy
echo.
echo   准备工作（只有你能做）：
echo     * 一个免费 Cloudflare 账号（用 GitHub 登录即可）
echo     * 一份 fine-grained PAT：
echo         GitHub -^> Settings -^> Developer settings -^> Personal access tokens
echo         -^> Fine-grained tokens -^> Generate new token
echo         Repository access: Only select repositories -^> scnu001/DAPP
echo         Permissions -^> Repository permissions -^> Contents = Read and write
echo ============================================================
echo.

if defined HTTPS_PROXY (
  echo [i] 检测到 HTTPS_PROXY=%HTTPS_PROXY%
  echo     wrangler 会走这个代理。如果 login/deploy 卡住或报 502，
  echo     说明这个端口到不了 Cloudflare，先改成能用的那个再重跑本脚本：
  echo        set HTTPS_PROXY=http://127.0.0.1:7890
  echo.
)

if not exist "node_modules" (
  echo [1/3] 安装依赖（首次需要联网，可能要一两分钟）...
  call npm install
  if errorlevel 1 (
    echo.
    echo [x] npm install 失败，检查网络后重试。
    pause
    exit /b 1
  )
) else (
  echo [1/3] 依赖已存在，跳过安装。
)

echo.
echo [2/3] 登录 Cloudflare（会打开浏览器，点 Allow）...
call npx wrangler login
if errorlevel 1 (
  echo.
  echo [x] 登录失败。
  pause
  exit /b 1
)

echo.
echo     写入 GITHUB_TOKEN：粘贴刚才生成的 PAT，回车确认（不会回显）...
call npx wrangler secret put GITHUB_TOKEN
if errorlevel 1 (
  echo.
  echo [x] 写入 secret 失败。
  pause
  exit /b 1
)

echo.
echo [3/3] 部署中...
call npx wrangler deploy
if errorlevel 1 (
  echo.
  echo [x] 部署失败。
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  部署完成。
echo.
echo  下一步：
echo    1. 把上面打印的 https://xxxx.workers.dev 地址写进
echo       frontend\.env 的 VITE_RELAY_URL= 这一行
echo    2. 重启前端（npm run dev），主办方控制台里就会出现封面上传
echo    3. 自检：把地址加上 /health 贴进浏览器，应返回 {"ok":true,...}
echo ============================================================
pause
