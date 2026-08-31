#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/bin

# 智能判断工作目录：优先 monitor 用户的隔离目录
if [ -f "$HOME/.serverwatch/token.log" ]; then
  SW_DIR="$HOME/.serverwatch"
elif [ -f /home/monitor/.serverwatch/token.log ]; then
  SW_DIR="/home/monitor/.serverwatch"
elif [ -f /etc/serverwatch/token.log ]; then
  SW_DIR="/etc/serverwatch"
else
  SW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [ -f "$SW_DIR/token.log" ]; then
  token=($(cat "$SW_DIR/token.log"))
else
  echo "Error: Token is missing."
  exit 1
fi

# 去收尾空格 取单行
function li ()
{
  echo "$1" | sed -e 's/^ *//g;s/[ \;]*$//g' | sed -n '1 p'
}

# 转数字 
function num ()
{
  case $1 in
      ''|*[!0-9\.]*) echo 0 ;;
      *) echo $1 ;;
  esac
}

# Base64
function base ()
{
  echo "$1" | tr -d '\n' | base64 | tr -d '=' | tr -d '\n' | sed 's/\//%2F/g' | sed 's/\+/%2B/g'
}

function system ()
{
  uptime=$(cat /proc/uptime 2>/dev/null | awk '{ print $1 }')

  # 会话数
  sessions=$(who 2>/dev/null | wc -l)

  # 进程数
  processes=$(ps axc 2>/dev/null | wc -l)

  # 进程快照 (截取前 15 个活跃进程)
  processes_array="$(ps axc -o uname:12,pcpu,rss,etime,state,cmd --sort=-pcpu,-rss --noheaders --width 120 2>/dev/null | head -n 15)"
  processes_array="$(echo "$processes_array" | grep -v " ps$" | sed 's/ \+ / /g' | sed '/^$/d' | tr "\n" ";")"

  # 已分配文件句柄的数目与上限
  if [ -r /proc/sys/fs/file-nr ]; then
    file_handles=$(cat /proc/sys/fs/file-nr | awk '{ print $1 }')
    file_handles_limit=$(cat /proc/sys/fs/file-nr | awk '{ print $3 }')
  else
    file_handles=0
    file_handles_limit=65535
  fi
}

# 操作系统
function os ()
{
  os_kernel=$(uname -r)

  # 主机名 (自动发现模式下用于服务端预填充节点名称)
  hostname=$(uname -n 2>/dev/null)

  if ls /etc/*release > /dev/null 2>&1; then
    os_name=$(li "$(cat /etc/*release 2>/dev/null | grep '^PRETTY_NAME=\|^NAME=\|^DISTRIB_ID=' | awk -F\= '{ print $2 }' | tr -d '"' | tac)")
  fi

  if [ -z "$os_name" ]; then
    if [ -e /etc/redhat-release ]; then
      os_name=$(li "$(cat /etc/redhat-release 2>/dev/null)")
    elif [ -e /etc/debian_version ]; then
      os_name=$(li "Debian $(cat /etc/debian_version 2>/dev/null)")
    fi

    if [ -z "$os_name" ]; then
      os_name=$(li "$(uname -s)")
    fi
  fi

  case $(uname -m) in
    x86_64)
      os_arch="x64"
      ;;
    i*86)
      os_arch="x86"
      ;;
    *)
      os_arch=$(uname -m)
      ;;
  esac
}

function cpu ()
{
  cpu_name=$(li "$(cat /proc/cpuinfo 2>/dev/null | grep 'model name' | awk -F\: '{ print $2 } END { if (!NR) print "N/A" }')")
  cpu_cores=$(($(cat /proc/cpuinfo 2>/dev/null | grep 'model name' | awk -F\: '{ print $2 }' | sed -e :a -e '$!N;s/\n/\|/;ta' | tr -cd \| | wc -c)+1))
  cpu_freq=$(li "$(cat /proc/cpuinfo 2>/dev/null | grep 'cpu MHz' | awk -F\: '{ print $2 }')")
}

# RAM
function ram ()
{
  ram_total=$(li $(num "$(cat /proc/meminfo 2>/dev/null | grep ^MemTotal: | awk '{ print $2 }')"))
  ram_free=$(li $(num "$(cat /proc/meminfo 2>/dev/null | grep ^MemFree: | awk '{ print $2 }')"))
  ram_cached=$(li $(num "$(cat /proc/meminfo 2>/dev/null | grep ^Cached: | awk '{ print $2 }')"))
  ram_buffers=$(li $(num "$(cat /proc/meminfo 2>/dev/null | grep ^Buffers: | awk '{ print $2 }')"))
  ram_usage=$((($ram_total-($ram_free+$ram_cached+$ram_buffers))*1024))
  ram_total=$(($ram_total*1024))

  swap_total=$(li $(num "$(cat /proc/meminfo 2>/dev/null | grep ^SwapTotal: | awk '{ print $2 }')"))
  swap_free=$(li $(num "$(cat /proc/meminfo 2>/dev/null | grep ^SwapFree: | awk '{ print $2 }')"))
  swap_usage=$((($swap_total-$swap_free)*1024))
  swap_total=$(($swap_total*1024))
}

# 磁盘
function disk ()
{
  disk_total=$(li $(num "$(($(df -P -B 1 2>/dev/null | grep '^/' | awk '{ print $2 }' | sed -e :a -e '$!N;s/\n/+/;ta')))"))
  disk_usage=$(li $(num "$(($(df -P -B 1 2>/dev/null | grep '^/' | awk '{ print $3 }' | sed -e :a -e '$!N;s/\n/+/;ta')))"))

  ## 所有挂载磁盘列表
  disk_array=$(li "$(df -P -B 1 2>/dev/null | grep '^/' | awk '{ print $1" "$2" "$3";" }' | sed -e :a -e '$!N;s/\n/ /;ta' | awk '{ print $0 } END { if (!NR) print "N/A" }')")
}

function network ()
{
  ## 活动链接
  if [ -n "$(command -v ss)" ]; then
    connections=$(li $(num "$(ss -tun 2>/dev/null | tail -n +2 | wc -l)"))
  else
    connections=$(li $(num "$(netstat -tun 2>/dev/null | tail -n +3 | wc -l)"))
  fi

  ## 当前活动网络接口
  nic=$(li "$(ip route get 8.8.8.8 2>/dev/null | grep dev | awk -F'dev' '{ print $2 }' | awk '{ print $1 }')")
  if [ -z "$nic" ]; then
    nic="eth0"
  fi

  ## IPv4 / IPv6
  ipv4=$(li "$(ip addr show $nic 2>/dev/null | grep 'inet ' | awk '{ print $2 }' | awk -F\/ '{ print $1 }' | grep -v '^127' | awk '{ print $0 } END { if (!NR) print "N/A" }')")
  ipv6=$(li "$(ip addr show $nic 2>/dev/null | grep 'inet6 ' | awk '{ print $2 }' | awk -F\/ '{ print $1 }' | grep -v '^::' | grep -v '^0000:' | grep -v '^fe80:' | awk '{ print $0 } END { if (!NR) print "N/A" }')")

  if [ -d "/sys/class/net/$nic/statistics" ]; then
    rx=$(li $(num "$(cat /sys/class/net/$nic/statistics/rx_bytes 2>/dev/null)"))
    tx=$(li $(num "$(cat /sys/class/net/$nic/statistics/tx_bytes 2>/dev/null)"))
  else
    rx=$(li $(num "$(ip -s link show $nic 2>/dev/null | grep '[0-9]*' | grep -v '[A-Za-z]' | awk '{ print $1 }' | sed -n '1 p')"))
    tx=$(li $(num "$(ip -s link show $nic 2>/dev/null | grep '[0-9]*' | grep -v '[A-Za-z]' | awk '{ print $1 }' | sed -n '2 p')"))
  fi
}

function load (){
  loadavg=$(li "$(cat /proc/loadavg 2>/dev/null | awk '{ print $1" "$2" "$3 }')")

  time=$(date +%s)
  stat=($(cat /proc/stat 2>/dev/null | head -n1 | sed 's/[^0-9 ]*//g' | sed 's/^ *//'))
  cpu=$((${stat[0]:-0}+${stat[1]:-0}+${stat[2]:-0}+${stat[3]:-0}))
  io=$((${stat[3]:-0}+${stat[4]:-0}))
  idle=${stat[3]:-0}

  if [ -e "$SW_DIR/data.log" ]; then
    data=($(cat "$SW_DIR/data.log" 2>/dev/null))
    interval=$(($time-${data[0]:-0}))
    if [ "$interval" -gt 0 ]; then
      cpu_gap=$(($cpu-${data[1]:-0}))
      io_gap=$(($io-${data[2]:-0}))
      idle_gap=$(($idle-${data[3]:-0}))

      if [[ $cpu_gap > "0" ]]; then
        load_cpu=$(((1000*($cpu_gap-$idle_gap)/$cpu_gap+5)/10))
      fi

      if [[ $io_gap > "0" ]]; then
        load_io=$(((1000*($io_gap-$idle_gap)/$io_gap+5)/10))
      fi

      if [[ $rx > ${data[4]:-0} ]]; then
        rx_gap=$((($rx-${data[4]:-0})/$interval))
      fi

      if [[ $tx > ${data[5]:-0} ]]; then
        tx_gap=$((($tx-${data[5]:-0})/$interval))
      fi
    fi
  fi

  ## 缓存中间状态 (由 monitor 用户在其自身目录下安全读写)
  echo "$time $cpu $io $idle $rx $tx" > "$SW_DIR/data.log"

  rx_gap=$(li $(num "$rx_gap"))
  tx_gap=$(li $(num "$tx_gap"))
  load_cpu=$(li $(num "$load_cpu"))
  load_io=$(li $(num "$load_io"))
}

# 构造上报数据体 (与 /client/update 固定字段顺序一致，末位 hostname 向后兼容旧探针)
function payload ()
{
  echo "$(base "$uptime") $(base "$sessions") $(base "$processes") $(base "$processes_array") $(base "$file_handles") $(base "$file_handles_limit") $(base "$os_kernel") $(base "$os_name") $(base "$os_arch") $(base "$cpu_name") $(base "$cpu_cores") $(base "$cpu_freq") $(base "$ram_total") $(base "$ram_usage") $(base "$swap_total") $(base "$swap_usage") $(base "$disk_array") $(base "$disk_total") $(base "$disk_usage") $(base "$connections") $(base "$nic") $(base "$ipv4") $(base "$ipv6") $(base "$rx") $(base "$tx") $(base "$rx_gap") $(base "$tx_gap") $(base "$loadavg") $(base "$load_cpu") $(base "$load_io") $(base "$hostname")"
}

function update ()
{
  # ============ 嗅探发现模式 ============
  # token.log 首段为 DISCOVER 时进入免 Token 推送通道：
  # 服务端按源 IP 自动归档；管理员认领后推送响应将下发正式 TOKEN，本脚本自动切换到托管通道
  if [ "${token[0]}" = "DISCOVER" ]; then
    dkey="${token[1]}"
    data_payload="$(payload)"
    resp=""
    if type curl >/dev/null 2>&1; then
      resp=$(curl -s --max-time 15 --data "key=${dkey}&data=${data_payload}" -k "__PUSH_HOST__" 2>/dev/null)
    elif type wget >/dev/null 2>&1; then
      resp=$(wget -qO- -T 15 --post-data "key=${dkey}&data=${data_payload}" --no-check-certificate "__PUSH_HOST__" 2>/dev/null)
    fi

    case "$resp" in
      TOKEN\ *)
        ntoken="$(echo "$resp" | awk '{ print $2 }' | tr -d '\r\n')"
        if [ -n "$ntoken" ]; then
          # 原子换发正式专属 Token (下一轮起自动走托管通道)
          echo "$ntoken" > "$SW_DIR/token.log.sw" && mv -f "$SW_DIR/token.log.sw" "$SW_DIR/token.log"
          echo "token switched, syncing via managed channel..." > "$SW_DIR/agent.log"
          # 立即以正式 Token 向托管通道补报一次，实现零中断切换
          if type curl >/dev/null 2>&1; then
            curl -s --max-time 15 --data "token=${ntoken}&data=${data_payload}" -k "__UPDATE_HOST__" > "$SW_DIR/agent.log" 2>&1
          elif type wget >/dev/null 2>&1; then
            wget -q -o /dev/null -O "$SW_DIR/agent.log" -T 15 --post-data "token=${ntoken}&data=${data_payload}" --no-check-certificate "__UPDATE_HOST__"
          fi
        fi
        ;;
      *)
        echo "$resp" > "$SW_DIR/agent.log" 2>&1
        ;;
    esac
    return
  fi

  # ============ 常规托管模式 ============
  data_payload="$(payload)"
  data_post="token=${token[0]}&data=${data_payload}"

  # 上传数据 (优先 curl，备用 wget)
  if type curl >/dev/null 2>&1; then
    curl -s --max-time 15 --data "$data_post" -k "__UPDATE_HOST__" > "$SW_DIR/agent.log" 2>&1
  elif type wget >/dev/null 2>&1; then
    wget -q -o /dev/null -O "$SW_DIR/agent.log" -T 15 --post-data "$data_post" --no-check-certificate "__UPDATE_HOST__"
  fi
}

function main ()
{
  system
  os
  cpu
  ram
  disk
  network
  load
  update
}

main

exit 0
