const service = require('./../models/node')
const config = require('./../config')
const fs = require('fs')
const _ = require('../utils/_')
const format = require('../utils/format')
const path = require('path')
const shortid = require('shortid')
const staticData = require('../static_assets')

// 嗅探安装阶段缓存的地理位置元数据 (install.sh 一次性上报，按 IP 供 push 通道预填充位置/运营商)
const pendingMeta = {}

// 与 /client/update 一致的数据字段顺序 (末位追加 hostname，向后兼容旧探针)
const dataFields = ['uptime','sessions','processes','processes_array','file_handles','file_handles_limit','os_kernel','os_name','os_arch','cpu_name','cpu_cores','cpu_freq','ram_total','ram_usage','swap_total','swap_usage','disk_array','disk_total','disk_usage','connections','nic','ipv4','ipv6','rx','tx','rx_gap','tx_gap','load','load_cpu','load_io','hostname']

// 解析探针源 IP：优先本机直连 socket IP (防伪造 X-Forwarded-For 污染分流)，
// 仅当来源为内网/回环地址 (判定经过反代) 时才采信 X-Forwarded-For / X-Real-IP
function getSourceIp(ctx) {
  const raw = (ctx.ip || ctx.request.ip || '').replace(/^::ffff:/, '')
  const isPrivate = /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^::1$|^localhost$/.test(raw)
  if (isPrivate) {
    const fwd = (ctx.get('x-forwarded-for') || ctx.request.headers['x-real-ip'] || '').split(',')[0].trim().replace(/^::ffff:/, '')
    if (fwd) return fwd
  }
  return raw
}

// 将探针上报的 base64 字段串解析为快照对象
function parseSnapshot(data) {
  const ds = String(data).split(' ')
  const snapshot = {}
  for (let i = 0; i < ds.length; i++) {
    if (dataFields[i]) {
      snapshot[dataFields[i]] = ds[i] ? _.base64(ds[i]) : ''
    }
  }
  format.parseInt(snapshot, ['cpu_cores','ram_total','ram_usage','swap_total','swap_usage','disk_total','disk_usage','rx','tx','rx_gap','tx_gap','sessions','file_handles','file_handles_limit','connections','processes'])
  snapshot.timestamp = Date.now()
  return snapshot
}

const createInterval = (v)=>{
  if(/\*/.test(v)){
    return '("'+v+'")'
  }else{
    const step = parseInt(v) || 5
    const count = Math.floor(60 / step)
    const items = []
    for (let j = 0; j < count; j++) {
      items.push(`* * * * * sleep ${j * step};`)
    }
    return '("' + items.join('" "') + '")'
  }
}

function getShellContent(name) {
  let content = ''
  if (staticData && staticData.shellScripts && staticData.shellScripts[name]) {
    content = staticData.shellScripts[name]
  } else {
    const searchPaths = [
      path.join(__dirname, '../shell', name),
      path.resolve(process.cwd(), 'shell', name)
    ]
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, 'utf8')
        break
      }
    }
  }
  // 确保输出至 Linux 客户端执行的脚本 100% 过滤掉 Windows \r 回车符
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

module.exports = {

  async install(ctx) {

    let id = ctx.params.id

    let interval = 5

    // 自动嗅探模式安装：以全局嗅探密钥作为安装令牌，批量部署无需预先创建节点
    if (id && id === config.data().discover_key) {
      // 已封禁来源 IP 拒绝嗅探探针安装
      if (await service.isIpBanned(getSourceIp(ctx))) {
        ctx.status = 403
        ctx.body = 'banned'
        return
      }
      let sh = getShellContent('install.sh')
      let host = ctx.origin + '/client/agent/' + id
      sh = sh.replace(/__HOST__/g, host)
            .replace('__TOKEN__', 'DISCOVER ' + id)
            .replace('__INTERVAL__', createInterval(5))
      ctx.type = 'text/plain; charset=utf-8'
      ctx.body = sh.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      return
    }

    if(id){
      let obj = await service.getNodeById(id)
      if(obj){
        let sh = getShellContent('install.sh')

        let host = ctx.origin + '/client/agent/' + id

        let update_interval = obj.update_interval || 5

        sh = sh.replace(/__HOST__/g , host)
              .replace('__TOKEN__',id)
              .replace('__INTERVAL__',createInterval(update_interval))
        ctx.type = 'text/plain; charset=utf-8'
        ctx.body = sh.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      }else{
        ctx.status = 403
        ctx.body = 'Node not found'
      }
    }else{
      ctx.status = 403
      ctx.body = 'Missing node id'
    }
    
  },

  async uninstall(ctx){
    let id = ctx.params.id
    if(id){
      let isValid = await service.hasNode(id)
      if(isValid){
        let sh = getShellContent('uninstall.sh')

        let host = ctx.origin + '/client/remove/' + id

        sh = sh.replace(/__HOST__/g , host)
              .replace('__TOKEN__',id)

        ctx.type = 'text/plain; charset=utf-8'
        ctx.body = sh.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      }else{
        ctx.status = 403
        ctx.body = 'Node not found'
      }
    }else{
      ctx.status = 403
      ctx.body = 'Missing node id'
    }
  },

  async agent(ctx){
    let id = ctx.params.id

    if(id){

      // 嗅探模式的探针脚本下发：携带双通道地址 (嗅探推送 + 正式托管上报)，
      // 并缓存本次安装上报的地理位置元数据，供该 IP 后续 push 预填充位置信息
      if (id === config.data().discover_key) {
        // 已封禁来源 IP 拒绝下发嗅探探针脚本
        if (await service.isIpBanned(getSourceIp(ctx))) {
          ctx.status = 403
          ctx.body = 'banned'
          return
        }
        let { data } = ctx.request.body || {}
        if (data) {
          try {
            const meta = _.base64(data)
            const parts = meta.split(/(?:：|\s{2,})/)
            const srcIp = getSourceIp(ctx)
            // 解构语义与托管通道一致：parts[1]=IP, parts[3]=位置, parts[4]=运营商
            if (srcIp && parts[1]) {
              pendingMeta[srcIp] = {
                location: parts[3] || '',
                isp: parts[4] || '',
                ts: Date.now()
              }
            }
          } catch (e) {}
        }

        let sh = getShellContent('agent.sh')
        sh = sh.replace(/__UPDATE_HOST__/g, ctx.origin + '/client/update')
              .replace(/__PUSH_HOST__/g, ctx.origin + '/client/push/' + id)
              .replace(/__HOST__/g, ctx.origin + '/client/update')
        ctx.type = 'text/plain; charset=utf-8'
        ctx.body = sh.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        return
      }

      let isValid = await service.hasNode(id)

      if(isValid){

        let { data } = ctx.request.body
        let [ip , location , isp ] = ['','','']
        if(data){
          data = _.base64(data);
          [,ip,, location, isp] = data.split(/(?:：|\s{2,})/)
        }

        let sh = getShellContent('agent.sh')

        let host = ctx.origin + '/client/update'

        sh = sh.replace(/__UPDATE_HOST__/g, host)
              .replace(/__PUSH_HOST__/g, host)
              .replace(/__HOST__/g , host)

        service.updateNodeById(id , {
          installed:true , ip , location , isp
        })

        ctx.type = 'text/plain; charset=utf-8'
        ctx.body = sh.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

      }else{
        ctx.status = 403
        ctx.body = 'Node not found'
      }

    }else{
      ctx.status = 403
      ctx.body = 'Missing node id'
    }

  },

  async update(ctx){
    let {token , data} = ctx.request.body

    let doc = await service.hasNode( token )
    if(doc){
      if (!data) {
        ctx.status = 400
        ctx.body = 'missing data'
        return
      }
      let snapshot = parseSnapshot(data)
      service.record(token , snapshot)

      ctx.body = 'success'
    }else{
      ctx.body = 'miss token'
      ctx.status = 403
    }

  },

  // ============ 自动嗅探推送通道 (零接触发现) ============
  // 携带全局嗅探密钥的免 Token 上报通道：服务端按源 IP 自动归档分流
  //  1. 全新服务器 → 自动登记为"待认领"嗅探节点
  //  2. 已待认领   → 仅刷新实时快照
  //  3. 已认领 (push_source=1) → 完整入库；若开启 sync_token 则下发正式 Token 供探针自动切换托管通道
  async push(ctx){
    const cfg = config.data()
    const key = ctx.params.key

    if (!key || key !== cfg.discover_key) {
      ctx.status = 403
      ctx.body = 'invalid key'
      return
    }

    let { data } = ctx.request.body || {}
    if (!data) {
      ctx.status = 400
      ctx.body = 'missing data'
      return
    }

    const snapshot = parseSnapshot(data)

    // 源 IP 识别：socket 直连优先，内网来源 (反代) 时采信转发头，最后回退探针自报地址
    let srcIp = getSourceIp(ctx)
    if (!srcIp || srcIp === '::1') {
      srcIp = (snapshot.ipv4 || '').split(',')[0].trim()
    }

    if (!srcIp) {
      ctx.body = 'OK'
      return
    }

    // 已封禁来源 IP：拒绝通过嗅探通道再次注册或上报
    if (await service.isIpBanned(srcIp)) {
      ctx.status = 403
      ctx.body = 'banned'
      return
    }

    // 1. 已存在待认领嗅探节点：仅刷新快照
    const pending = await service.findDiscoveredPendingByIp(srcIp)
    if (pending) {
      await service.updateDiscoveredSnapshot(pending.id, snapshot)
      ctx.body = 'OK'
      return
    }

    // 2. 已认领的推送分流节点：完整入库 (按 record_interval 归档时序)
    const bound = await service.findPushBoundByIp(srcIp)
    if (bound) {
      service.record(bound.id, snapshot)
      // 开启密钥同步：下发正式专属 Token，探针将自动切换到托管上报通道
      ctx.body = bound.sync_token ? ('TOKEN ' + bound.id) : 'OK'
      return
    }

    // 3. 全新服务器：自动登记为待认领嗅探节点 (合并安装阶段缓存的地理位置元数据)
    const meta = pendingMeta[srcIp] || {}
    delete pendingMeta[srcIp]
    const curNow = Date.now()
    await service.createNode({
      id: shortid.generate(),
      label: snapshot.hostname || snapshot.os_name || ('待认领 ' + srcIp),
      ip: srcIp,
      hostname: snapshot.hostname || '',
      location: meta.location || '',
      isp: meta.isp || '',
      remark: '嗅探自动发现',
      discovered: true,
      online: true,
      installed: false,
      time_response: curNow,
      snapshot
    })
    ctx.body = 'OK'
  },

  // 探针卸载通知：仅将该节点标记为未安装与离线状态，杜绝通过该无认证接口恶意物理删除节点数据
  async remove(ctx){
    let id = ctx.params.id
    if (id && await service.hasNode(id)) {
      await service.updateNodeById(id, {
        installed: false,
        online: false
      })
      ctx.body = 'success'
    } else {
      ctx.status = 404
      ctx.body = 'node not found'
    }
  }
}
