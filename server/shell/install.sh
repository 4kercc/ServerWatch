#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

echo "|   ServerWatch is installing with dedicated non-login security user 'monitor' ... "

# 1. 检查 root 权限 (创建系统用户与初始配置需要 root 权限)
if [ "$(id -u)" -ne 0 ]; then
  echo -e "|\n|  Error: Please run this installation script as root (or via sudo).\n|"
  exit 1
fi

# 2. Base64 编码辅助函数
function base ()
{
  echo "$1" | tr -d '\n' | base64 | tr -d '=' | tr -d '\n' | sed 's/\//%2F/g' | sed 's/\+/%2B/g'
}

# 3. 依赖安装与检测
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

if [ -z "$(command -v crontab)" ]; then
  echo -e "|\n|  Error: Crontab is required but not found. Please install cron.\n|"
  exit 1
fi

# 确保 cron 服务启动
if [ -z "$(ps -Al 2>/dev/null | grep cron | grep -v grep)" ]; then
  if [ -n "$(command -v systemctl)" ]; then
    systemctl start cron 2>/dev/null || systemctl start crond 2>/dev/null || systemctl start cronie 2>/dev/null
    systemctl enable cron 2>/dev/null || systemctl enable crond 2>/dev/null || systemctl enable cronie 2>/dev/null
  elif [ -n "$(command -v service)" ]; then
    service cron start 2>/dev/null || service crond start 2>/dev/null
  fi
fi

# 4. 创建专用无登录权限的系统用户 monitor (禁止 Shell 登录，专属目录 /home/monitor 或 /opt/serverwatch)
MONITOR_USER="monitor"
SW_DIR="/home/monitor/.serverwatch"

# 如果已存在 monitor 用户，确保其禁止交互式登录
if id "$MONITOR_USER" >/dev/null 2>&1; then
  usermod -s /usr/sbin/nologin "$MONITOR_USER" 2>/dev/null || usermod -s /sbin/nologin "$MONITOR_USER" 2>/dev/null || true
else
  # 创建无登录权限的系统用户
  useradd -m -s /usr/sbin/nologin "$MONITOR_USER" 2>/dev/null || \
  useradd -m -s /sbin/nologin "$MONITOR_USER" 2>/dev/null || \
  useradd -m -s /bin/false "$MONITOR_USER" 2>/dev/null || true
fi

# 获取 monitor 用户的实际家目录
USER_HOME=$(getent passwd "$MONITOR_USER" | cut -d: -f6)
if [ -n "$USER_HOME" ] && [ -d "$USER_HOME" ]; then
  SW_DIR="$USER_HOME/.serverwatch"
fi

# 5. 清除旧残留并创建探针目录
rm -Rf "$SW_DIR" 2>/dev/null || true
crontab -u "$MONITOR_USER" -r 2>/dev/null || true
crontab -l 2>/dev/null | grep -v "/etc/serverwatch" | grep -v "$SW_DIR" | crontab - 2>/dev/null || true

mkdir -p "$SW_DIR"

# 6. 获取一次地理位置与 IP 基础元数据 (带 3 秒严格超时与多源备用解析)
meta=""
if [ -n "$(command -v curl)" ]; then
  meta=$(curl -s --connect-timeout 3 --max-time 5 myip.ipip.net -4 2>/dev/null)
  if [ -z "$meta" ]; then
    meta=$(curl -s --connect-timeout 3 --max-time 5 https://ipinfo.io/json 2>/dev/null)
  fi
elif [ -n "$(command -v wget)" ]; then
  meta=$(wget -qO- -T 3 -t 1 myip.ipip.net 2>/dev/null)
fi

wget -O "$SW_DIR/agent.sh" --post-data="data=$(base "$meta")" --no-check-certificate __HOST__ >/dev/null 2>&1

if [ -f "$SW_DIR/agent.sh" ]; then
  chmod +x "$SW_DIR/agent.sh"
  echo "__TOKEN__" > "$SW_DIR/token.log"

  # 7. 配置 monitor 用户的专属 crontab 调度
  interval=__INTERVAL__

  # 写入 monitor 用户的独立 cron 任务
  CRON_TMP=$(mktemp)
  for x in "${interval[@]}"
  do
    echo "$x bash $SW_DIR/agent.sh > $SW_DIR/cron.log 2>&1" >> "$CRON_TMP"
  done

  crontab -u "$MONITOR_USER" "$CRON_TMP"
  rm -f "$CRON_TMP"

  # 8. 设置严格的文件所有权与权限 (仅 monitor 用户可读写执行)
  chown -R "$MONITOR_USER":"$MONITOR_USER" "$SW_DIR"
  chmod 700 "$SW_DIR"
  chmod 600 "$SW_DIR/token.log"
  chmod 700 "$SW_DIR/agent.sh"

  echo -e "|\n|   [Success] ServerWatch agent has been installed safely!"
  echo -e "|   [Security] Running under isolated non-login user: '$MONITOR_USER'"
  echo -e "|   [Directory] $SW_DIR\n|"

  ### 删除自身安装脚本
  if [ -f "$0" ]; then
    rm -f "$0"
  fi
else
  echo -e "|\n|   Error: ServerWatch agent could NOT be downloaded.\n|"
  exit 1
fi
