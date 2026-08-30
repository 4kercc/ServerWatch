const service = require('./../models/node')
const config = require('./../config')
const crypto = require('crypto')

module.exports = {

  // 自动发现总览：嗅探密钥、接入地址、批量安装命令与全部待认领节点
  async info(ctx) {
    const cfg = config.data()
    const key = cfg.discover_key || ''
    const nodes = await service.getDiscoveredNodes()
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
        last_seen: n.time_response
      }
    })

    ctx.body = {
      status: 0,
      message: '',
      data: {
        key,
        push_url: ctx.origin + '/client/push/' + key,
        install_command: 'wget --no-check-certificate -qO- ' + ctx.origin + '/client/install/' + key + ' | bash',
        nodes: data
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

  // 重新生成嗅探密钥 (旧密钥立即失效，需重新部署探针)
  async regenerate(ctx) {
    const result = { status: 0, message: '成功', data: null }
    const newKey = crypto.randomBytes(8).toString('hex')
    await config.save(Object.assign({}, config.data(), { discover_key: newKey }))
    result.data = { key: newKey }
    ctx.body = result
  }
}
