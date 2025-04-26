@echo off
echo 启动带系统代理的埃尔德拉编年史服务器...

REM 设置代理环境变量
set HTTP_PROXY=%1
set HTTPS_PROXY=%1

IF "%1"=="" (
  echo 未提供代理地址，尝试使用系统默认代理...
) ELSE (
  echo 使用代理: %1
)

REM 启动服务器
deno task start --allow-env

echo 服务器已关闭
pause