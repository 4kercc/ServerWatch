const service = require('./../models/node')
const config = require('./../config')
const crypto = require('crypto')

// 嗅探节点认领保留期：超过该时长无人认领将自动清理并封禁来源 IP
const DISCOVER_TTL_MS = 7 * 24 * 60 * 60 * 1000

module.exports = {

  // 自动发现总览：嗅探密钥、接入地址、批量安装命令、待认领节点与封禁列表
  async info(ctx) {
    const cfg = config.data()
    const key = cfg.discover_key || ''
    const nodes = await service.getDiscoveredNodes()
    const banned = await service.getBannedIps()
    const now = Date.now()

    const data = nodes.map((n) => {
      const s = n.snapshot || {}
      return {
        id: n.id,
        ip: n.ip,
        hostname: n.hostname || s.hostname || '',
        label: n.label,
        location: n.location,
        isp: n.isp,
        os_name: s.os_name || '',
        os_arch: s.os_arch || '',
        os_kernel: s.os_kernel || '',
        cpu_name: s.cpu_name || '',
        cpu_cores: s.cpu_cores || 0,
        ram_total: s.ram_total || 0,
        ram_usage: s.ram_usage || 0,
        disk_total: s.disk_total || 0,
        disk_usage: s.disk_usage || 0,
        uptime: s.uptime || '',
        online: now - n.time_response < 1000 * 30,
        first_seen: n.created_at,
        last_seen: n.time_response,
        expire_at: n.created_at + DISCOVER_TTL_MS
      }
    })

    ctx.body = {
      status: 0,
      message: '',
      data: {
        key,
        ttl_days: DISCOVER_TTL_MS / (24 * 60 * 60 * 1000),
        push_url: ctx.origin + '/client/push/' + key,
        install_command: 'wget --no-check-certificate -qO- ' + ctx.origin + '/client/install/' + key + ' | bash',
        nodes: data,
        banned: banned
      }
    }
  },

  // 认领待发现的嗅探节点：转为正式监控节点，可设置参数与密钥同步策略
  async claim(ctx) {
    const result = { status: 0, message: '成功', data: null }
    const form = ctx.request.body || {}
    const ip = (form.ip || '').trim()

    if (!ip) {
      result.status = 412
      result.message = '缺少节点 IP'
      ctx.body = result
      return
    }

    const pending = await service.findDiscoveredPendingByIp(ip)
    if (!pending) {
      result.status = 412
      result.message = '未找到该 IP 对应的待认领节点 (可能已被认领或移除)'
      ctx.body = result
      return
    }

    const syncToken = form.sync_token === true || form.sync_token === 'true' || form.sync_token === 1 || form.sync_token === '1'

    await service.updateNodeById(pending.id, {
      label: form.label || pending.label,
      ip: ip,
      location: form.location !== undefined ? form.location : pending.location,
      isp: form.isp !== undefined ? form.isp : pending.isp,
      remark: form.remark !== undefined ? form.remark : '嗅探自动发现',
      discovered: false,
      push_source: true,
      sync_token: syncToken,
      installed: true,
      online: true,
      update_interval: form.update_interval || pending.update_interval || 5,
      record_interval: form.record_interval || pending.record_interval || 60,
      record_limit: form.record_limit || pending.record_limit || 1440
    })

    result.data = {
      id: pending.id,
      index_id: pending.index_id,
      ip: ip,
      sync_token: syncToken
    }
    ctx.body = result
  },

  // 忽略 (移除) 待认领的嗅探节点
  async remove(ctx) {
    const result = { status: 0, message: '成功', data: null }
    const form = ctx.request.body || {}
    const ip = (form.ip || '').trim()

    if (!ip) {
      result.status = 412
      result.message = '缺少节点 IP'
      ctx.body = result
      return
    }

    const success = await service.removeDiscoveredByIp(ip)
    if (!success) {
      result.status = 412
      result.message = '未找到该 IP 对应的待认领节点'
    }
    ctx.body = result
  },

  // 手动封禁来源 IP：删除其待认领嗅探节点，并禁止该 IP 再次通过嗅探通道注册
  async ban(ctx) {
    const result = { status: 0, message: '成功', data: null }
    const form = ctx.request.body || {}
    const ip = (form.ip || '').trim()

    if (!ip) {
      result.status = 412
      result.message = '缺少节点 IP'
      ctx.body = result
      return
    }

    await service.removeDiscoveredByIp(ip)
    await service.banIp(ip, form.reason || '管理员手动封禁')
    ctx.body = result
  },

  // 解除封禁：该 IP 下次推送时将重新被自动登记
  async unban(ctx) {
    const result = { status: 0, message: '成功', data: null }
    const form = ctx.request.body || {}
    const ip = (form.ip || '').trim()

    if (!ip) {
      result.status = 412
      result.message = '缺少节点 IP'
      ctx.body = result
      return
    }

    const success = await service.unbanIp(ip)
    if (!success) {
      result.status = 412
      result.message = '该 IP 不在封禁列表中'
    }
    ctx.body = result
  },

  // 执行一次过期巡检 (清理超时未认领节点并封禁来源 IP)，供启动时与定时任务调用
  async sweepExpired() {
    try {
      const removed = await service.sweepExpiredDiscovered(DISCOVER_TTL_MS)
      if (removed.length > 0) {
        console.log('[Discover] 已自动清理 ' + removed.length + ' 个超时未认领的嗅探节点并封禁来源 IP: ' + removed.map(r => r.ip).join(', '))
      }
    } catch (err) {
      console.error('[Discover] 嗅探节点巡检失败:', err.message)
    }
  },

  // 重新生成嗅探密钥 (旧密钥立即失效，需重新部署探针)
  async regenerate(ctx) {
    const result = { status: 0, message: '成功', data: null }
    const newKey = crypto.randomBytes(8).toString('hex')
    await config.save(Object.assign({}, config.data(), { discover_key: newKey }))
    result.data = { key: newKey }
    ctx.body = result
  }
}
