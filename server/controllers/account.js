const service = require('./../models/account')
const createToken = require('../middleware/koa-auth').create
const config = require('../config')
const notify = require('../utils/notify')

// 登录防暴力破解记录器（基于客户端 IP 的滑动窗口与封禁保护）
const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const LOCK_TIME_MS = 15 * 60 * 1000 // 连续失败 5 次封禁 15 分钟

function getClientIp(ctx) {
  const forwarded = ctx.request.headers['x-forwarded-for']
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return ctx.request.ip || ctx.ip || '127.0.0.1'
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  // 公共公开系统信息 (供未登录前端判断访客模式是否开启)
  async publicInfo(ctx) {
    const cfg = config.data()
    ctx.body = {
      status: 0,
      message: '',
      data: {
        guest_mode: cfg.guest_mode !== false
      }
    }
  },

  async setting( ctx ){
    const currentCfg = Object.assign({}, config.data())
    // 脱敏 SMTP 密码
    const safeCfg = JSON.parse(JSON.stringify(currentCfg))
    if (safeCfg.alert) {
      safeCfg.alert.has_smtp_pass = Boolean(safeCfg.alert.smtp_pass)
      safeCfg.alert.smtp_pass = '' // 不明文返回密码到前端
    }

    let result = {
      message: '',
      data: safeCfg,
      status: 0
    }
    
    ctx.body = result
  },

  async update( ctx , next){
    let {username , password , port, guest_mode, alert} = ctx.request.body
    let result = {
      message: '',
      data: null,
      status: 0
    }

    let obj = {}
    if(username) obj.username = username
    if(password) obj.password = password
    if(port) obj.port = port
    if(typeof guest_mode !== 'undefined') obj.guest_mode = guest_mode === true || guest_mode === 'true' || guest_mode === '1' || guest_mode === 1
    
    // 合并上下线告警通知配置
    if (alert && typeof alert === 'object') {
      const oldAlert = (config.data() && config.data().alert) || {}
      obj.alert = {
        fail_count: parseInt(alert.fail_count) || 3,
        offline_duration: parseInt(alert.offline_duration) || 100,
        silence_duration: parseInt(alert.silence_duration) || 1440,
        tg_enabled: alert.tg_enabled === true || alert.tg_enabled === 'true' || alert.tg_enabled === 1,
        tg_token: (alert.tg_token || '').trim(),
        tg_chat_id: (alert.tg_chat_id || '').trim(),
        smtp_enabled: alert.smtp_enabled === true || alert.smtp_enabled === 'true' || alert.smtp_enabled === 1,
        smtp_host: (alert.smtp_host || '').trim(),
        smtp_port: parseInt(alert.smtp_port) || 465,
        smtp_user: (alert.smtp_user || '').trim(),
        smtp_pass: alert.smtp_pass ? String(alert.smtp_pass).trim() : (oldAlert.smtp_pass || ''),
        smtp_to: (alert.smtp_to || '').trim()
      }
    }

    if(Object.keys(obj).length > 0){
      let current = Object.assign({}, config.data(), obj)
      let ret = await config.save(current)
      if(!ret){
        result.message = '保存失败'
      }else{
        result.data = {port: current.port, username: current.username, guest_mode: current.guest_mode}
      }
    }
    ctx.body = result
  },

  // 测试 Telegram 连通性
  async testTelegram(ctx) {
    const { token, chat_id } = ctx.request.body || {}
    const cfg = config.data()
    const alertCfg = cfg.alert || {}
    
    const botToken = token ? String(token).trim() : alertCfg.tg_token
    const chatId = chat_id ? String(chat_id).trim() : alertCfg.tg_chat_id

    if (!botToken || !chatId) {
      ctx.body = { status: 412, message: '请先填写 Telegram Bot Token 与 Chat ID' }
      return
    }

    const testMsg = `<b>🔔 ServerWatch 告警测试</b>\n\n` +
      `这是一条来自 <b>ServerWatch 监控系统</b> 的测试推送消息。\n` +
      `如果收到此消息，说明您的 Telegram Bot 告警通道已配置成功！\n\n` +
      `<b>发送时间:</b> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`

    const res = await notify.sendTelegram(botToken, chatId, testMsg)
    if (res.success) {
      ctx.body = { status: 0, message: '测试消息发送成功！请检查 Telegram 频道/群组' }
    } else {
      ctx.body = { status: 400, message: `发送失败: ${res.error}` }
    }
  },

  // 测试 SMTP 邮件发送
  async testEmail(ctx) {
    const form = ctx.request.body || {}
    const cfg = config.data()
    const alertCfg = cfg.alert || {}

    const host = form.host ? String(form.host).trim() : alertCfg.smtp_host
    const port = form.port ? parseInt(form.port) : alertCfg.smtp_port
    const user = form.user ? String(form.user).trim() : alertCfg.smtp_user
    const pass = form.pass ? String(form.pass).trim() : alertCfg.smtp_pass
    const to = form.to ? String(form.to).trim() : alertCfg.smtp_to

    if (!host || !user || !pass || !to) {
      ctx.body = { status: 412, message: '请完整填写 SMTP 主机、发件账号、授权码和接收邮箱' }
      return
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #3b82f6; padding: 16px 20px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px;">🔔 ServerWatch 邮件告警测试</h2>
        </div>
        <div style="padding: 20px; background: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <p>您好！</p>
          <p>这是一封来自 <strong>ServerWatch 现代服务器集群监控系统</strong> 的测试邮件。</p>
          <p>当您收到这封��件时，说明您的 SMTP 邮件告警通道已配置成功！当受控服务器发生持续断线或恢复在线时，系统将自动向此邮箱发送通知。</p>
          <p><strong>测试发送时间:</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">ServerWatch &copy; 2026</p>
        </div>
      </div>
    `

    const res = await notify.sendSmtp({ host, port, user, pass, to }, '【ServerWatch】告警通道连通性测试邮件', html)
    if (res.success) {
      ctx.body = { status: 0, message: '测试邮件已成功投递！请检查收件箱 (及垃圾箱)' }
    } else {
      ctx.body = { status: 400, message: `发送失败: ${res.error}` }
    }
  },

  async signin( ctx , next){
    const ip = getClientIp(ctx)
    const now = Date.now()
    const record = loginAttempts.get(ip) || { count: 0, lockUntil: 0 }

    // 1. 检查是否处于锁定封禁期
    if (record.lockUntil > now) {
      const waitMinutes = Math.ceil((record.lockUntil - now) / 60000)
      ctx.body = {
        status: -1,
        message: `密码错误次数过多，IP 已被安全锁定，请在 ${waitMinutes} 分钟后再试`
      }
      return
    }

    let data = ctx.request.body || {}
    let result = {
      message: '',
      data: null,
      status: -1
    }
    let account = config.data()

    // 2. 账号密码匹配校验
    if(account.username === data.username && account.password === data.password){
      // 登录成功：清除该 IP 的错误计数
      loginAttempts.delete(ip)

      result.status = 0
      result.data = {
        token : createToken({account: data.username})
      }
    } else {
      // 登录失败：记录失败次数，并在失败时加入防时序攻击延时 (300ms)
      await sleep(300)

      record.count = (record.count || 0) + 1
      if (record.count >= MAX_ATTEMPTS) {
        record.lockUntil = now + LOCK_TIME_MS
        result.message = `连续密码错误达 ${MAX_ATTEMPTS} 次，该 IP 已被安全锁定 15 分钟！`
      } else {
        const remaining = MAX_ATTEMPTS - record.count
        result.message = `用户名或密码错误 (剩余尝试次数: ${remaining} 次)`
      }
      loginAttempts.set(ip, record)
    }

    ctx.body = result
  },

}
