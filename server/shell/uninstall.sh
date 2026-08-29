#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/bin

echo -e "\n|   ServerWatch is uninstalling ... "

# 智能判断工作目录
if [ -d /etc/serverwatch ]; then
  SW_DIR="/etc/serverwatch"
elif [ -d "$HOME/.serverwatch" ]; then
  SW_DIR="$HOME/.serverwatch"
else
  SW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# 清除当前用户的 crontab 调度
if [ -n "$(command -v crontab)" ]; then
  (crontab -l 2>/dev/null | grep -v "agent.sh") | crontab -
fi

# 清除工作目录
if [ -d "$SW_DIR" ]; then
  rm -Rf "$SW_DIR"
fi

# 通知服务端移除
if [ -n "$(command -v curl)" ]; then
  curl -s -k "__HOST__" >/dev/null 2>&1
elif [ -n "$(command -v wget)" ]; then
  wget --no-check-certificate -qO- "__HOST__" >/dev/null 2>&1
fi

echo -e "|\n|   Success: ServerWatch agent has been removed from $SW_DIR\n|"
