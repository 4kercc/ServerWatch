const sqlite = require('../utils/db/sqlite')

function parseNodeRow(row) {
  if (!row) return null
  let snapshot = {}
  try {
    snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : (row.snapshot || {})
  } catch (e) {
    snapshot = {}
  }
  return {
    id: row.id,
    index_id: row.index_id || 1,
    label: row.label,
    ip: row.ip,
    location: row.location,
    isp: row.isp,
    remark: row.remark,
    installed: !!row.installed,
    online: !!row.online,
    discovered: !!row.discovered,
    push_source: !!row.push_source,
    sync_token: !!row.sync_token,
    hostname: row.hostname || '',
    time_response: row.time_response,
    time_record: row.time_record,
    created_at: row.created_at || 0,
    update_interval: row.update_interval || 5,
    record_interval: row.record_interval || 60,
    record_limit: row.record_limit || 1440,
    recordable: true, // 默认开启时序历史归档
    snapshot: snapshot
  }
}

// 节点数据持久层
const node = {
  async getNodes(page, limit) {
    await sqlite.init()
    const rows = sqlite.queryAll('SELECT * FROM nodes WHERE discovered IS NULL OR discovered = 0 ORDER BY index_id ASC, created_at ASC LIMIT ? OFFSET ?', [limit, page * limit])
    return rows.map(parseNodeRow)
  },

  async getNodesWithoutHistory() {
    await sqlite.init()
    const rows = sqlite.queryAll('SELECT * FROM nodes WHERE discovered IS NULL OR discovered = 0 ORDER BY index_id ASC, created_at ASC')
    return rows.map(parseNodeRow)
  },

  async getNextIndexId() {
    await sqlite.init()
    const maxRow = sqlite.queryOne('SELECT MAX(index_id) as max_id FROM nodes')
    return (maxRow && maxRow.max_id) ? (parseInt(maxRow.max_id) + 1) : 1
  },

  async createNode(data) {
    await sqlite.init()
    const recordIntervalVal = data.record_interval || 60
    const recordLimitVal = data.record_limit || 1440 // 默认 1440 条 (按 60s/条 恰好 24 小时)
    const nextIndex = data.index_id || await this.getNextIndexId()

    const params = [
      data.id,
      nextIndex,
      data.label || '',
      data.ip || '',
      data.location || '',
      data.isp || '',
      data.remark || '',
      data.installed ? 1 : 0,
      data.online ? 1 : 0,
      data.time_response || 0,
      data.time_record || 0,
      data.update_interval || 5,
      recordIntervalVal,
      recordLimitVal,
      1, // 强制默认开启历史入库
      data.discovered ? 1 : 0,
      data.push_source ? 1 : 0,
      data.sync_token ? 1 : 0,
      data.hostname || '',
      JSON.stringify(data.snapshot || {}),
      Date.now()
    ]
    sqlite.execute(`
      INSERT INTO nodes (
        id, index_id, label, ip, location, isp, remark, installed, online,
        time_response, time_record, update_interval, record_interval,
        record_limit, recordable, discovered, push_source, sync_token, hostname,
        snapshot, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, params)
    data.index_id = nextIndex
    return data
  },

  async getNodesCount() {
    await sqlite.init()
    const res = sqlite.queryOne('SELECT count(*) as total FROM nodes')
    return res ? res.total : 0
  },

  // 支持按数字索引 index_id (如 1, 2, 3) 或 原始 token id (如 C0rc5JK2v) 查询
  // 支持按时间范围 range ('1h' | '6h' | '24h' | '7d', 默认 '6h') 智能下发精简绘图指标，大幅提升详情页秒开速度
  async getNodeById(idOrIndex, range = '6h') {
    await sqlite.init()
    let row = null
    const isNumeric = /^\d+$/.test(String(idOrIndex).trim())
    if (isNumeric) {
      row = sqlite.queryOne('SELECT * FROM nodes WHERE index_id = ?', [parseInt(idOrIndex)])
    }
    if (!row) {
      row = sqlite.queryOne('SELECT * FROM nodes WHERE id = ?', [String(idOrIndex)])
    }
    if (!row) return null

    const result = parseNodeRow(row)
    const realId = row.id
    
    // 计算时间范围对应的起始时间戳
    let rangeSeconds = 6 * 3600 // 默认 6h
    if (range === '1h') rangeSeconds = 3600
    else if (range === '24h') rangeSeconds = 24 * 3600
    else if (range === '7d') rangeSeconds = 7 * 24 * 3600
    const sinceTimestamp = Date.now() - rangeSeconds * 1000

    // 利用 (node_id, timestamp) 联合索引极速按时间段过滤
    const historyRows = sqlite.queryAll(`
      SELECT timestamp, data FROM node_history 
      WHERE node_id = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `, [realId, sinceTimestamp])

    // 轻量化历史数据：仅提取图表渲染所需的关键指标，剔除冗余长文本，将网络包体积压缩 90%+
    result.history = historyRows.map(h => {
      try {
        const d = JSON.parse(h.data)
        return {
          timestamp: h.timestamp || d.timestamp,
          load_cpu: d.load_cpu,
          load_io: d.load_io,
          ram_total: d.ram_total,
          ram_usage: d.ram_usage,
          swap_total: d.swap_total,
          swap_usage: d.swap_usage,
          rx_gap: d.rx_gap,
          tx_gap: d.tx_gap,
          load: d.load
        }
      } catch (e) {
        return { timestamp: h.timestamp }
      }
    })
    return result
  },

  async getNodeSnapshotById(idOrIndex) {
    await sqlite.init()
    let row = null
    const isNumeric = /^\d+$/.test(String(idOrIndex).trim())
    if (isNumeric) {
      row = sqlite.queryOne('SELECT snapshot FROM nodes WHERE index_id = ?', [parseInt(idOrIndex)])
    }
    if (!row) {
      row = sqlite.queryOne('SELECT snapshot FROM nodes WHERE id = ?', [String(idOrIndex)])
    }
    if (!row) return null
    try {
      return typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : (row.snapshot || {})
    } catch (e) {
      return {}
    }
  },

  async hasNode(idOrIndex) {
    await sqlite.init()
    let row = null
    const isNumeric = /^\d+$/.test(String(idOrIndex).trim())
    if (isNumeric) {
      row = sqlite.queryOne('SELECT id FROM nodes WHERE index_id = ?', [parseInt(idOrIndex)])
    }
    if (!row) {
      row = sqlite.queryOne('SELECT id FROM nodes WHERE id = ?', [String(idOrIndex)])
    }
    return !!row
  },

  async updateNodeById(idOrIndex, data) {
    await sqlite.init()
    let row = null
    const isNumeric = /^\d+$/.test(String(idOrIndex).trim())
    if (isNumeric) {
      row = sqlite.queryOne('SELECT * FROM nodes WHERE index_id = ?', [parseInt(idOrIndex)])
    }
    if (!row) {
      row = sqlite.queryOne('SELECT * FROM nodes WHERE id = ?', [String(idOrIndex)])
    }
    if (!row) return null

    const realId = row.id
    const current = parseNodeRow(row)
    const merged = Object.assign({}, current, data)

    sqlite.execute(`
      UPDATE nodes SET
        label = ?,
        ip = ?,
        location = ?,
        isp = ?,
        remark = ?,
        installed = ?,
        online = ?,
        time_response = ?,
        time_record = ?,
        update_interval = ?,
        record_interval = ?,
        record_limit = ?,
        recordable = 1,
        discovered = ?,
        push_source = ?,
        sync_token = ?,
        hostname = ?,
        snapshot = ?
      WHERE id = ?
    `, [
      merged.label || '',
      merged.ip || '',
      merged.location || '',
      merged.isp || '',
      merged.remark || '',
      merged.installed ? 1 : 0,
      merged.online ? 1 : 0,
      merged.time_response || 0,
      merged.time_record || 0,
      merged.update_interval || 5,
      merged.record_interval || 60,
      merged.record_limit || 1440,
      merged.discovered === true || merged.discovered === 1 ? 1 : 0,
      merged.push_source === true || merged.push_source === 1 ? 1 : 0,
      merged.sync_token === true || merged.sync_token === 1 ? 1 : 0,
      merged.hostname || '',
      JSON.stringify(merged.snapshot || {}),
      realId
    ])

    if (data.history && Array.isArray(data.history) && data.history.length === 0) {
      sqlite.execute('DELETE FROM node_history WHERE node_id = ?', [realId])
    }

    return merged
  },

  async removeNodeById(idOrIndex) {
    await sqlite.init()
    let row = null
    const isNumeric = /^\d+$/.test(String(idOrIndex).trim())
    if (isNumeric) {
      row = sqlite.queryOne('SELECT id FROM nodes WHERE index_id = ?', [parseInt(idOrIndex)])
    }
    if (!row) {
      row = sqlite.queryOne('SELECT id FROM nodes WHERE id = ?', [String(idOrIndex)])
    }
    if (!row) return false

    const realId = row.id
    sqlite.execute('DELETE FROM node_history WHERE node_id = ?', [realId])
    sqlite.execute('DELETE FROM nodes WHERE id = ?', [realId])
    return true
  },

  // ============ 自动发现 (嗅探推送) 体系持久层 ============

  // 查询待认领的嗅探节点 (按源 IP 精确匹配)
  async findDiscoveredPendingByIp(ip) {
    await sqlite.init()
    const row = sqlite.queryOne('SELECT * FROM nodes WHERE ip = ? AND discovered = 1 LIMIT 1', [String(ip || '')])
    return row ? parseNodeRow(row) : null
  },

  // 查询已认领且持续由嗅探推送通道供数的节点 (按源 IP 分流)
  async findPushBoundByIp(ip) {
    await sqlite.init()
    const row = sqlite.queryOne('SELECT * FROM nodes WHERE ip = ? AND discovered = 0 AND push_source = 1 LIMIT 1', [String(ip || '')])
    return row ? parseNodeRow(row) : null
  },

  // 待认领嗅探节点：仅刷新实时快照与在线状态 (不写入历史时序，避免未认领垃圾数据膨胀)
  async updateDiscoveredSnapshot(idOrIndex, data) {
    await sqlite.init()
    let row = null
    const isNumeric = /^\d+$/.test(String(idOrIndex).trim())
    if (isNumeric) {
      row = sqlite.queryOne('SELECT id, hostname FROM nodes WHERE index_id = ?', [parseInt(idOrIndex)])
    }
    if (!row) {
      row = sqlite.queryOne('SELECT id, hostname FROM nodes WHERE id = ?', [String(idOrIndex)])
    }
    if (!row) return false

    const curTime = Date.now()
    const hostname = (data && data.hostname) || row.hostname || ''
    sqlite.execute(`
      UPDATE nodes SET
        snapshot = ?,
        hostname = ?,
        online = 1,
        time_response = ?
      WHERE id = ?
    `, [JSON.stringify(data || {}), hostname, curTime, row.id])
    return true
  },

  // 全部待认领嗅探节点列表
  async getDiscoveredNodes() {
    await sqlite.init()
    const rows = sqlite.queryAll('SELECT * FROM nodes WHERE discovered = 1 ORDER BY time_response DESC')
    return rows.map(parseNodeRow)
  },

  // 移除 (忽略) 待认领嗅探节点
  async removeDiscoveredByIp(ip) {
    await sqlite.init()
    const rows = sqlite.queryAll('SELECT id FROM nodes WHERE ip = ? AND discovered = 1', [String(ip || '')])
    for (const row of rows) {
      sqlite.execute('DELETE FROM node_history WHERE node_id = ?', [row.id])
      sqlite.execute('DELETE FROM nodes WHERE id = ?', [row.id])
    }
    return rows.length > 0
  },

  // ============ 来源 IP 封禁体系 (嗅探通道防滥用) ============

  // 封禁来源 IP (幂等)：已存在时刷新原因与时间
  async banIp(ip, reason) {
    await sqlite.init()
    const cleanIp = String(ip || '').trim()
    if (!cleanIp) return false
    sqlite.execute('INSERT OR REPLACE INTO banned_ips (ip, reason, created_at) VALUES (?, ?, ?)', [
      cleanIp, reason || '', Date.now()
    ])
    return true
  },

  // 查询 IP 是否已被封禁
  async isIpBanned(ip) {
    await sqlite.init()
    const row = sqlite.queryOne('SELECT ip FROM banned_ips WHERE ip = ?', [String(ip || '').trim()])
    return !!row
  },

  // 全部封禁记录 (按时间倒序)
  async getBannedIps() {
    await sqlite.init()
    return sqlite.queryAll('SELECT ip, reason, created_at FROM banned_ips ORDER BY created_at DESC')
  },

  // 解除封禁
  async unbanIp(ip) {
    await sqlite.init()
    const cleanIp = String(ip || '').trim()
    if (!cleanIp) return false
    const row = sqlite.queryOne('SELECT ip FROM banned_ips WHERE ip = ?', [cleanIp])
    if (!row) return false
    sqlite.execute('DELETE FROM banned_ips WHERE ip = ?', [cleanIp])
    return true
  },

  // 巡检：清理超过 TTL 仍未认领的嗅探节点，并自动封禁其来源 IP
  // 返回被清理的节点摘要 [{ id, ip, label }]
  async sweepExpiredDiscovered(ttlMs) {
    await sqlite.init()
    const deadline = Date.now() - (ttlMs || 7 * 24 * 60 * 60 * 1000)
    const rows = sqlite.queryAll('SELECT id, ip, label FROM nodes WHERE discovered = 1 AND created_at < ?', [deadline])
    for (const row of rows) {
      if (row.ip) {
        sqlite.execute('INSERT OR REPLACE INTO banned_ips (ip, reason, created_at) VALUES (?, ?, ?)', [
          row.ip, '7 天未认领自动封禁', Date.now()
        ])
      }
      sqlite.execute('DELETE FROM node_history WHERE node_id = ?', [row.id])
      sqlite.execute('DELETE FROM nodes WHERE id = ?', [row.id])
    }
    return rows
  },

  async record(idOrIndex, data) {
    await sqlite.init()
    let row = null
    const isNumeric = /^\d+$/.test(String(idOrIndex).trim())
    if (isNumeric) {
      row = sqlite.queryOne('SELECT id, record_interval, record_limit, time_record, ip, location, isp, hostname FROM nodes WHERE index_id = ?', [parseInt(idOrIndex)])
    }
    if (!row) {
      row = sqlite.queryOne('SELECT id, record_interval, record_limit, time_record, ip, location, isp, hostname FROM nodes WHERE id = ?', [String(idOrIndex)])
    }
    if (!row) return 'error'

    const realId = row.id
    const record_interval = row.record_interval || 60
    const record_limit = row.record_limit || 1440 // 默认保持 24 小时数据
    const curTime = Date.now()
    let lastSaveTime = row.time_record || 0

    // 默认开启历史入库：达到采样周期或首次接入时，自动归档一条时序记录到 SQLite
    if (curTime - lastSaveTime >= record_interval * 1000 || lastSaveTime === 0) {
      sqlite.execute('INSERT INTO node_history (node_id, timestamp, data) VALUES (?, ?, ?)', [
        realId,
        curTime,
        JSON.stringify(data)
      ])
      lastSaveTime = curTime

      // 历史队列滑动窗口截断，超出上限自动清理早期数据
      const countRes = sqlite.queryOne('SELECT count(*) as count FROM node_history WHERE node_id = ?', [realId])
      if (countRes && countRes.count > record_limit) {
        const toDelete = Math.max(1, Math.round(record_limit / 10))
        sqlite.execute(`
          DELETE FROM node_history WHERE id IN (
            SELECT id FROM node_history WHERE node_id = ? ORDER BY timestamp ASC LIMIT ?
          )
        `, [realId, toDelete])
      }
    }

    // 更新实时快照
    const finalIp = row.ip || data.ipv4 || ''
    const finalLoc = row.location || data.location || ''
    const finalIsp = row.isp || data.isp || ''
    const finalHostname = (data && data.hostname) || row.hostname || ''

    sqlite.execute(`
      UPDATE nodes SET
        snapshot = ?,
        time_record = ?,
        time_response = ?,
        online = 1,
        installed = 1,
        ip = ?,
        location = ?,
        isp = ?,
        hostname = ?,
        recordable = 1
      WHERE id = ?
    `, [
      JSON.stringify(data),
      lastSaveTime,
      curTime,
      finalIp,
      finalLoc,
      finalIsp,
      finalHostname,
      realId
    ])

    return true
  }
}

module.exports = node
