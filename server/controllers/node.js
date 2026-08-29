const service = require('./../models/node')
const shortid = require('shortid')
const _ = require('../utils/_')

const getShell = (f) => {
  return 'wget --no-check-certificate -qO- ' + f + ' | bash'
}

// 访客模式敏感信息脱敏过滤器 (隐藏 IP 末位、掩盖进程详情、彻底抹除未安装脚本信息、隐藏底层对接 Token)
function sanitizeForGuest(nodeItem) {
  const clone = JSON.parse(JSON.stringify(nodeItem))
  // 将暴露给前端的 ID 替换为纯数字 index_id，保护真实的对接 token
  if (clone.index_id) {
    clone.id = clone.index_id
  }
  // 脱敏 IP (例: 23.95.253.12 -> 23.95.*.*)
  if (clone.ip && typeof clone.ip === 'string') {
    const parts = clone.ip.split('.')
    if (parts.length === 4) {
      clone.ip = `${parts[0]}.${parts[1]}.*.*`
    }
  }
  if (clone.snapshot) {
    if (clone.snapshot.ipv4) {
      const p = clone.snapshot.ipv4.split('.')
      if (p.length === 4) clone.snapshot.ipv4 = `${p[0]}.${p[1]}.*.*`
    }
    if (clone.snapshot.ipv6) clone.snapshot.ipv6 = '******'
    // 访客模式彻底移除服务器具体活跃进程列表，保障私密安全
    clone.snapshot.processes_array = ''
  }
  // 彻底移除一键安装命令
  delete clone.script
  delete clone.install_script
  delete clone.uninstall_script
  return clone
}

module.exports = {

  async list(ctx) {
    let result = {
      status: 0,
      message: '',
      data: null,
    }

    let data = await service.getNodesWithoutHistory()
    let now = Date.now()
    data.forEach((i) => {
      i.online = now - i.time_response < 1000 * 30 
      // 统一把前端展示和跳转的公共 id 设置为 index_id (例如 1, 2, 3)
      if (i.index_id) {
        i.display_id = i.index_id
      }
    })
    
    // 如果是访客模式 (未登录)：
    // 1. ��滤掉所有未安装脚本的孤儿/占位节点 (防止被未登录访客看到或滥用)
    // 2. 对已安装节点的敏感信息进行脱敏，并使用 index_id 作为路由 id
    if (!ctx.authData) {
      data = data.filter(n => n.installed).map(sanitizeForGuest)
    } else {
      // 即使是管理员，也默认将对外展示/路由 ID 替换为 index_id
      data = data.map(n => {
        const item = Object.assign({}, n)
        item.route_id = n.index_id || n.id
        return item
      })
    }

    result.data = data
    result.isGuest = !ctx.authData
    ctx.body = result
  },

  async queryBase(ctx) {
    let result = {
      status: 0,
      message: '',
      data: null,
    }

    let id = ctx.params.id

    let data = await service.getNodeById(id)

    if (data) {
      result.data = {
        id: data.id,
        index_id: data.index_id || 1,
        label: data.label,
        installed: data.installed,
        update_interval: data.update_interval,
        record_interval: data.record_interval,
        record_limit: data.record_limit,
        recordable: data.recordable,
        uninstall_script: getShell(ctx.origin + '/client/uninstall/' + data.id),
        install_script: getShell(ctx.origin + '/client/install/' + data.id)
      }
    } else {
      result.status = 412
      result.message = '没有匹配的数据'
    }
    
    ctx.body = result
  },

  async queryLatest(ctx) {
    let result = {
      status: 0,
      message: '',
      data: null,
    }

    let id = ctx.params.id

    let data = await service.getNodeSnapshotById(id)

    if (data && !ctx.authData) {
      if (data.ipv4) {
        const p = data.ipv4.split('.')
        if (p.length === 4) data.ipv4 = `${p[0]}.${p[1]}.*.*`
      }
      data.ipv6 = '******'
      data.processes_array = ''
    }

    result.data = data
    
    ctx.body = result
  },

  async query(ctx) {
    let result = {
      status: 0,
      message: '',
      data: null,
    }

    let id = ctx.params.id

    let data = await service.getNodeById(id)

    if (data) {
      // 未登录访客访问未安装的服务器：直接拒绝并提示无权限/需登录
      if (!ctx.authData && !data.installed) {
        result.status = 403
        result.message = '该节点尚未接入，请先以管理员身份登录'
        ctx.body = result
        return
      }

      if (!data.installed) {
        data.script = getShell(ctx.origin + '/client/install/' + data.id)
        delete data.history
      }

      // 访客权限脱敏
      if (!ctx.authData) {
        data = sanitizeForGuest(data)
      } else {
        // 管理员模式带上真实安装脚本与对接信息
        data.script = getShell(ctx.origin + '/client/install/' + data.id)
      }
      result.data = data
      result.isGuest = !ctx.authData
    } else {
      result.status = 412
      result.message = '无数据'
    }

    ctx.body = result
  },

  async update(ctx) {
    let result = {
      status: 0,
      message: '成功',
      data: null,
    }
    let id = ctx.params.id

    if (await service.hasNode(id)) {
      let form = ctx.request.body

      form.recordable = form.recordable === '1' || form.recordable === 1 || form.recordable === true ? 1 : 0
      if (!form.recordable) {
        form.history = []
      }

      await service.updateNodeById(id, form)
      ctx.body = result
    } else {
      result.message = '没有匹配的数据'
      result.status = 412
      ctx.body = result
    }
  },

  async create(ctx) {
    let result = {
      status: 0,
      message: '成功',
      data: null,
    }

    let form = ctx.request.body

    form.installed = false

    let data = {
      id: shortid.generate(),
      label: form.label,
      ip: '',
      location: '',
      isp: '',
      remark: form.remark,
      online: false,
      installed: false,
      time_response: 0,
      time_record: 0,
      update_interval: form.update_interval || 5,
      record_interval: form.record_interval || 60,
      record_limit: form.record_limit || 1440,
      recordable: form.recordable === '0' || form.recordable === 0 || form.recordable === false ? 0 : 1,
      history: [],
      snapshot: {}
    }

    await service.createNode(data)

    result.data = {
      id: data.id,
      index_id: data.index_id
    }
    ctx.body = result
  },

  async remove(ctx) {
    let result = {
      status: 0,
      message: '成功',
      data: null,
    }

    let id = ctx.params.id

    let success = await service.removeNodeById(id)
    if (success) {
      result.status = 0
      result.message = '删除成功'
    } else {
      result.status = 412
      result.message = '删除失败'
    }

    ctx.body = result
  }
}
