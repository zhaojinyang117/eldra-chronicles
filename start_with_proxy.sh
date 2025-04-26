#!/bin/bash

echo "启动带系统代理的埃尔德拉编年史服务器..."

# 设置代理环境变量
if [ -z "$1" ]; then
  echo "未提供代理地址，尝试使用系统默认代理..."
else
  echo "使用代理: $1"
  export HTTP_PROXY=$1
  export HTTPS_PROXY=$1
fi

# 启动服务器
deno task start --allow-env

echo "服务器已关闭"