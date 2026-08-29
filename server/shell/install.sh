#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/bin

echo "|   ServerWatch is installing ... "

# 智能判断工作目录：root 存储于 /etc/serverwatch，普通用户存储于 $HOME/.serverwatch
if [ "$(id -u)" -eq 0 ]; then
  SW_DIR="/etc/serverwatch"
else
  SW_DIR="$HOME/.serverwatch"
fi

# Base64
function base ()
{
  echo "$1" | tr -d '\n' | base64 | tr -d '=' | tr -d '\n' | sed 's/\//%2F/g' | sed 's/\+/%2B/g'
}

# 若具备 root/sudo 权限且缺失核心依赖，尝试安装
if [ "$(id -u)" -eq 0 ]; then
  if [ -n "$(command -v apt-get)" ]; then
    if [ -z "$(command -v crontab)" ]; then
      apt-get -y update >/dev/null 2>&1
      apt-get -y install cron >/dev/null 2>&1
    fi
    if [ -z "$(command -v curl)" ]; then
      apt-get -y install curl >/dev/null 2>&1
    fi
  elif [ -n "$(command -v yum)" ]; then
    if [ -z "$(command -v crontab)" ]; then
      yum -y install cron vixie-cron >/dev/null 2>&1
    fi
    if [ -z "$(command -v curl)" ]; then
      yum -y install curl >/dev/null 2>&1
    fi
  elif [ -n "$(command -v pacman)" ]; then
    if [ -z "$(command -v crontab)" ]; then
      pacman -S --noconfirm cronie >/dev/null 2>&1
    fi
    if [ -z "$(command -v curl)" ]; then
      pacman -S --noconfirm curl >/dev/null 2>&1
    fi
  fi
fi

if [ -z "$(command -v crontab)" ]; then
  echo -e "|\n|  Error: Crontab is required but not found. Please install cron/cronie.\n|"
  exit 1
fi

# 清除旧脚本
if [ -f "$SW_DIR/agent.sh" ]; then
  rm -Rf "$SW_DIR"
  (crontab -l 2>/dev/null | grep -v "$SW_DIR/agent.sh") | crontab -
fi

# 创建工作目录
mkdir -p "$SW_DIR"

# 获取一次基础数据: 位置 运营商 等
meta=""
if [ -n "$(command -v curl)" ]; then
  meta=$(curl -s --connect-timeout 5 myip.ipip.net -4 2>/dev/null)
elif [ -n "$(command -v wget)" ]; then
  meta=$(wget -qO- -T 5 myip.ipip.net 2>/dev/null)
fi

wget -O "$SW_DIR/agent.sh" --post-data="data=$(base "$meta")" --no-check-certificate __HOST__ >/dev/null 2>&1

if [ -f "$SW_DIR/agent.sh" ]; then
  chmod +x "$SW_DIR/agent.sh"
  ## 写入 token
  echo "__TOKEN__" > "$SW_DIR/token.log"

  ## 配置 cron 检测频率
  interval=__INTERVAL__

  for x in "${interval[@]}"
  do
    crontab -l 2>/dev/null | { cat; echo "$x bash $SW_DIR/agent.sh > $SW_DIR/cron.log 2>&1"; } | crontab -
  done

  echo -e "|\n|   Success: ServerWatch agent has been installed to $SW_DIR\n|"

  ### 删除自身安装脚本
  if [ -f "$0" ]; then
    rm -f "$0"
  fi
else
  echo -e "|\n|   Error: ServerWatch agent could NOT be downloaded.\n|"
fi
