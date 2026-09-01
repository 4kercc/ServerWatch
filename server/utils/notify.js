const https = require('https')
const http = require('http')
const nodemailer = require('nodemailer')
const config = require('../config')
const service = require('../models/node')

// 告警节点状态机映射表: node_id -> { fail_count, offline_since, last_state, last_alert_time }
const nodeAlertStates = new Map()

// 发送 Telegram 消息
async function sendTelegram(botToken, chatId, text) {
  if (!botToken || !chatId || !text) return { success: false, error: '缺少 Telegram Bot Token 或 Chat ID' }
  
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      chat_id: String(chatId).trim(),
      text: text,
      parse_mode: 'HTML'
    })

    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${String(botToken).trim()}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.ok) {
            resolve({ success: true, data: json })
          } else {
            resolve({ success: false, error: json.description || 'Telegram API 报错' })
          }
        } catch (e) {
          resolve({ success: false, error: `解析响应失败: ${data}` })
        }
      })
    })

    req.on('error', (err) => {
      resolve({ success: false, error: err.message || '网络连接超时/失败' })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({ success: false, error: '请求 Telegram API 超时 (10s)' })
    })

    req.write(postData)
    req.end()
  })
}

// 发送 SMTP 邮件
async function sendSmtp(options, subject, htmlContent) {
  const { host, port, user, pass, to } = options
  if (!host || !user || !pass || !to) {
    return { success: false, error: '缺少 SMTP 主机、发件账号、密码或收件人' }
  }

  const portNum = parseInt(port) || 465
  const isSecure = portNum === 465

  try {
    const transporter = nodemailer.createTransport({
      host: host.trim(),
      port: portNum,
      secure: isSecure,
      auth: {
        user: user.trim(),
        pass: pass.trim()
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000
    })

    const info = await transporter.sendMail({
      from: `"ServerWatch 监控告警" <${user.trim()}>`,
      to: to.split(/[,;，；\s]+/).filter(Boolean).join(', '),
      subject: subject,
      html: htmlContent
    })

    return { success: true, messageId: info.messageId }
  } catch (err) {
    return { success: false, error: err.message || 'SMTP 邮件发送失败' }
  }
}

// 统一分发告警消息
async function broadcastAlert(subject, contentObj) {
  const cfg = config.data()
  const alertCfg = cfg.alert || {}

  // 1. Telegram 推送
  if (alertCfg.tg_enabled && alertCfg.tg_token && alertCfg.tg_chat_id) {
    const tgText = `<b>${contentObj.title}</b>\n\n` +
      `<b>主机名称:</b> ${contentObj.label}\n` +
      `<b>IP 地址:</b> <code>${contentObj.ip || '0.0.0.0'}</code>\n` +
      `<b>地理位置:</b> ${contentObj.location || '-'}\n` +
      `<b>事件类型:</b> ${contentObj.type}\n` +
      `<b>告警详情:</b> ${contentObj.message}\n` +
      `<b>发生时间:</b> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`
    
    sendTelegram(alertCfg.tg_token, alertCfg.tg_chat_id, tgText).catch(e => {
      console.error('[Notify] Telegram 发送异常:', e)
    })
  }

  // 2. SMTP 邮件推送
  if (alertCfg.smtp_enabled && alertCfg.smtp_host && alertCfg.smtp_user && alertCfg.smtp_pass && alertCfg.smtp_to) {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: ${contentObj.isOffline ? '#ef4444' : '#10b981'}; padding: 16px 20px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px;">${contentObj.title}</h2>
        </div>
        <div style="padding: 20px; background: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <p><strong>主机名称:</strong> ${contentObj.label}</p>
          <p><strong>IP 地址:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${contentObj.ip || '0.0.0.0'}</code></p>
          <p><strong>地理位置:</strong> ${contentObj.location || '-'}</p>
          <p><strong>事件类型:</strong> <span style="color: ${contentObj.isOffline ? '#ef4444' : '#10b981'}; font-weight: bold;">${contentObj.type}</span></p>
          <p><strong>告警说明:</strong> ${contentObj.message}</p>
          <p><strong>触发时间:</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">此通知由 ServerWatch 现代服务器集群监控系统自动发出。</p>
        </div>
      </div>
    `
    sendSmtp({
      host: alertCfg.smtp_host,
      port: alertCfg.smtp_port,
      user: alertCfg.smtp_user,
      pass: alertCfg.smtp_pass,
      to: alertCfg.smtp_to
    }, subject, html).catch(e => {
      console.error('[Notify] SMTP 邮件发送异常:', e)
    })
  }
}

// 核心巡检函数：检测所有纳管节点并按防抖规则触发上下线告警
async function checkNodesAlert() {
  const cfg = config.data()
  const alertCfg = cfg.alert || {}
  
  // 未启用任何告警通道时直接跳过
  if (!alertCfg.tg_enabled && !alertCfg.smtp_enabled) {
    return
  }

  const failThreshold = parseInt(alertCfg.fail_count) || 3
  const offlineDurationThresholdSec = parseInt(alertCfg.offline_duration) || 100
  const silenceDurationMin = parseInt(alertCfg.silence_duration) || 1440
  const silenceDurationMs = silenceDurationMin * 60 * 1000

  const nodes = await service.getNodesWithoutHistory()
  const now = Date.now()

  for (const node of nodes) {
    // 仅针对已安装探针的受控主机执行上下线监测
    if (!node.installed) continue

    const nodeId = node.id
    let state = nodeAlertStates.get(nodeId)
    if (!state) {
      state = {
        fail_count: 0,
        offline_since: 0,
        last_state: 'online', // 初始假定正常
        last_alert_time: 0
      }
      nodeAlertStates.set(nodeId, state)
    }

    // 判定当前是否离线：超过 30 秒未收到心跳即视作单次检测失败
    const isCurrentlyDead = now - (node.time_response || 0) > 30000

    if (isCurrentlyDead) {
      state.fail_count += 1
      if (!state.offline_since) {
        state.offline_since = now
      }

      const offlineSec = Math.floor((now - state.offline_since) / 1000)

      // 判定是否达到下线告警阈值 (连续失败达标 && 累计断线时长达标)
      const reachFailCount = state.fail_count >= failThreshold
      const reachDuration = offlineSec >= offlineDurationThresholdSec
      const notInSilence = (now - state.last_alert_time) > silenceDurationMs

      if (reachFailCount && reachDuration && notInSilence && state.last_state !== 'offline') {
        state.last_state = 'offline'
        state.last_alert_time = now

        console.log(`[Alert] 触发主机下线告警: ${node.label} (${node.ip}) 持续断线 ${offlineSec} 秒`)
        
        broadcastAlert(`【ServerWatch 告警】主机离线: ${node.label} (${node.ip})`, {
          title: '🚨 服务器离线断连告警',
          label: node.label,
          ip: node.ip,
          location: node.location,
          type: '持续离线 / 失联',
          isOffline: true,
          message: `主机已连续 ${state.fail_count} 次检测无响应，累计断线时长达 ${offlineSec} 秒 (阈值: ${offlineDurationThresholdSec}s)，请及时排查！`
        })
      }
    } else {
      // 节点恢复上线
      if (state.last_state === 'offline') {
        const offlineSec = state.offline_since ? Math.floor((now - state.offline_since) / 1000) : 0
        state.last_state = 'online'
        state.fail_count = 0
        state.offline_since = 0

        console.log(`[Alert] 触发主机上线恢复: ${node.label} (${node.ip}) 恢复在线`)

        broadcastAlert(`【ServerWatch 恢复】主机恢复在线: ${node.label} (${node.ip})`, {
          title: '✅ 服务器恢复在线通知',
          label: node.label,
          ip: node.ip,
          location: node.location,
          type: '恢复连接 / 重新上线',
          isOffline: false,
          message: `主机通信已恢复正常，先前累计离线时长约 ${offlineSec} 秒。`
        })
      } else {
        // 持续在线：重置失败计数与离线起始时间
        state.fail_count = 0
        state.offline_since = 0
      }
    }
  }
}

module.exports = {
  sendTelegram,
  sendSmtp,
  checkNodesAlert,
  broadcastAlert
}
