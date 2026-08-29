const service = require('./../models/node')
const fs = require('fs')
const _ = require('../utils/_')
const format = require('../utils/format')
const path = require('path')
const staticData = require('../static_assets')

const createInterval = (v)=>{
  if(/\*/.test(v)){
    return '("'+v+'")'
  }else{
    return '("* * * * * sleep '+ new Array(Math.floor(60 / v)).fill(0).map((_,j)=>(j * v)).join(';" "* * * * * sleep ') + '")'
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

        sh = sh.replace(/__HOST__/g , host)

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
      let ds = data.split(' ')

      let field = ['uptime','sessions','processes','processes_array','file_handles','file_handles_limit','os_kernel','os_name','os_arch','cpu_name','cpu_cores','cpu_freq','ram_total','ram_usage','swap_total','swap_usage','disk_array','disk_total','disk_usage','connections','nic','ipv4','ipv6','rx','tx','rx_gap','tx_gap','load','load_cpu','load_io']

      let snapshot = {} , online = true

      for(let i = 0 ; i<ds.length ; i++){
        if(field[i]){
          snapshot[field[i]] = ds[i] ? _.base64(ds[i]) : ''
        }
      }

      format.parseInt(snapshot , ['cpu_cores','ram_total','ram_usage','swap_total','swap_usage','disk_total','disk_usage','rx','tx','rx_gap','tx_gap','sessions','file_handles','file_handles_limit','connections','processes'])
      snapshot.timestamp = Date.now()
      service.record(token , snapshot)
      
      ctx.body = 'success'
    }else{
      ctx.body = 'miss token'
      ctx.status = 403
    }

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
