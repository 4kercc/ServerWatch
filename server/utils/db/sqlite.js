const initSqlJs = require('sql.js')
const path = require('path')
const fs = require('fs')
const staticData = require('../../static_assets')

const dbPath = path.resolve(process.cwd(), 'serverwatch.db')

let SQL = null
let db = null
let isDirty = false
let saveTimer = null

// 异步节流持久化落盘机制：内存中微秒级读写，异步批量将 SQLite 写入磁盘，杜绝 I/O 阻塞并保证 100% 跨平台零二进制依赖
function scheduleSave() {
  isDirty = true
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (isDirty && db) {
      try {
        const data = db.export()
        const buffer = Buffer.from(data)
        fs.writeFileSync(dbPath, buffer)
        isDirty = false
      } catch (err) {
        console.error('[SQLite] 保存数据库到磁盘失败:', err)
      }
    }
  }, 1000)
}

function flushSync() {
  if (isDirty && db) {
    try {
      const data = db.export()
      const buffer = Buffer.from(data)
      fs.writeFileSync(dbPath, buffer)
      isDirty = false
    } catch (e) {}
  }
}

// 退出进程时同步落盘
process.on('exit', flushSync)
process.on('SIGINT', () => { flushSync(); process.exit(0) })
process.on('SIGTERM', () => { flushSync(); process.exit(0) })

// 辅助方法：将 SQL 执行结果转换为对象数组
function queryAll(sql, params = []) {
  if (!db) return []
  const stmt = db.prepare(sql)
  if (params && params.length > 0) {
    stmt.bind(params)
  }
  const results = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params)
  return rows.length > 0 ? rows[0] : null
}

function execute(sql, params = []) {
  if (!db) return
  if (params && params.length > 0) {
    const stmt = db.prepare(sql)
    stmt.run(params)
    stmt.free()
  } else {
    db.run(sql)
  }
  scheduleSave()
}

// 同步/异步初始化方法
async function init() {
  if (db) return db

  const sqlConfig = {}
  if (staticData && staticData.wasmBinaryBase64) {
    sqlConfig.wasmBinary = Buffer.from(staticData.wasmBinaryBase64, 'base64')
  }

  SQL = await initSqlJs(sqlConfig)

  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath)
      db = new SQL.Database(fileBuffer)
    } catch (e) {
      db = new SQL.Database()
    }
  } else {
    db = new SQL.Database()
  }

  // 初始化基础表结构
  db.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      ip TEXT DEFAULT '',
      location TEXT DEFAULT '',
      isp TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      installed INTEGER DEFAULT 0,
      online INTEGER DEFAULT 0,
      time_response INTEGER DEFAULT 0,
      time_record INTEGER DEFAULT 0,
      update_interval INTEGER DEFAULT 5,
      record_interval INTEGER DEFAULT 60,
      record_limit INTEGER DEFAULT 1440,
      recordable INTEGER DEFAULT 1,
      discovered INTEGER DEFAULT 0,
      push_source INTEGER DEFAULT 0,
      sync_token INTEGER DEFAULT 0,
      hostname TEXT DEFAULT '',
      snapshot TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS node_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banned_ips (
      ip TEXT PRIMARY KEY,
      reason TEXT DEFAULT '',
      created_at INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_node_history_node_time ON node_history(node_id, timestamp);
  `)

  // 为旧表平滑升级添加 index_id 列 (若不存在)
  try {
    db.run(`ALTER TABLE nodes ADD COLUMN index_id INTEGER;`)
  } catch(e) {}

  // 自动发现体系平滑升级列：
  // discovered  = 1 表示嗅探推送发现、待管理员认领的节点
  // push_source = 1 表示该节点由嗅探推送通道持续供数 (按 IP 分流)
  // sync_token  = 1 表示认领时开启了"密钥自动同步"，推送响应将下发正式 Token 供探针自动切换
  try { db.run(`ALTER TABLE nodes ADD COLUMN discovered INTEGER DEFAULT 0;`) } catch(e) {}
  try { db.run(`ALTER TABLE nodes ADD COLUMN push_source INTEGER DEFAULT 0;`) } catch(e) {}
  try { db.run(`ALTER TABLE nodes ADD COLUMN sync_token INTEGER DEFAULT 0;`) } catch(e) {}
  try { db.run(`ALTER TABLE nodes ADD COLUMN hostname TEXT DEFAULT '';`) } catch(e) {}

  // 创建 index_id 索引
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_nodes_index_id ON nodes(index_id);`)
  } catch(e) {}

  // 创建 IP 路由索引 (嗅探推送按 IP 分流高频查询)
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_nodes_ip ON nodes(ip);`)
  } catch(e) {}

  // 为缺少 index_id 的历史节点初始化顺序序号 (1, 2, 3...)
  try {
    const existing = queryAll('SELECT id, created_at FROM nodes ORDER BY created_at ASC')
    let seq = 1
    for (const item of existing) {
      db.run('UPDATE nodes SET index_id = ? WHERE id = ? AND (index_id IS NULL OR index_id = 0)', [seq++, item.id])
    }
  } catch(e) {}

  // 修复并确保所有节点的 recordable 默认全部开启 (recordable = 1)
  try {
    db.run(`UPDATE nodes SET recordable = 1 WHERE recordable IS NULL OR recordable = 0;`)
  } catch(e) {}

  scheduleSave()
  return db
}

module.exports = {
  init,
  queryAll,
  queryOne,
  execute,
  flushSync
}
