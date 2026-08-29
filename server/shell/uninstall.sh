#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

echo -e "\n|   ServerWatch is uninstalling ... "

MONITOR_USER="monitor"

# 1. 彻底清除 monitor 用户的 crontab 调度
if id "$MONITOR_USER" >/dev/null 2>&1; then
  crontab -u "$MONITOR_USER" -r 2>/dev/null || true
  USER_HOME=$(getent passwd "$MONITOR_USER" | cut -d: -f6)
  if [ -n "$USER_HOME" ] && [ -d "$USER_HOME" ]; then
    rm -Rf "$USER_HOME/.serverwatch" 2>/dev/null || true
  fi
fi

# 2. 清除 root 可能存在的历史残留
if [ -d /etc/serverwatch ]; then
  rm -Rf /etc/serverwatch 2>/dev/null || true
fi
crontab -l 2>/dev/null | grep -v "agent.sh" | crontab - 2>/dev/null || true

# 3. 通知服务端移除该节点
if [ -n "$(command -v curl)" ]; then
  curl -s -k "__HOST__" >/dev/null 2>&1
elif [ -n "$(command -v wget)" ]; then
  wget --no-check-certificate -qO- "__HOST__" >/dev/null 2>&1
fi

# 4. 可选：删除 monitor 系统用户 (如果不需要保留)
userdel -r "$MONITOR_USER" 2>/dev/null || true

echo -e "|\n|   Success: ServerWatch agent and dedicated 'monitor' user have been completely removed.\n|"
