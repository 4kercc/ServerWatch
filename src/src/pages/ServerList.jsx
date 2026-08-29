import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import http from '../lib/http'
import { formatByte, formatTime } from '../lib/utils'
import { CountryFlag } from '../components/CountryFlag'
import { 
  Server, 
  Activity, 
  Cpu, 
  HardDrive, 
  Layers, 
  Search, 
  Plus, 
  ArrowUpRight, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Globe, 
  Terminal,
  LayoutGrid,
  List as ListIcon,
  Edit,
  Trash2,
  Settings2
} from 'lucide-react'

export default function ServerList({ onStatsUpdate }) {
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('all') // all | online | offline
  const [viewMode, setViewMode] = useState('grid') // grid | table
  const [isEditing, setIsEditing] = useState(false) // 列表模式下的快捷编辑模式开关
  const [isGuest, setIsGuest] = useState(false)

  const token = localStorage.getItem('token')
  const isLoggedIn = Boolean(token)

  const navigate = useNavigate()
  const isMounted = useRef(true)

  const fetchNodes = async () => {
    try {
      const res = await http.get('/api/nodes')
      if (res && res.data && isMounted.current) {
        setNodes(res.data)
        setIsGuest(Boolean(res.isGuest))

        // 汇总在线状态与吞吐
        let onlineCount = 0
        let rxTotal = 0
        let txTotal = 0

        res.data.forEach((n) => {
          if (n.online) {
            onlineCount++
            const snap = n.snapshot || {}
            rxTotal += parseInt(snap.rx_gap) || 0
            txTotal += parseInt(snap.tx_gap) || 0
          }
        })

        if (onStatsUpdate) {
          onStatsUpdate({
            onlineCount,
            totalCount: res.data.length,
            rxTotal,
            txTotal
          })
        }
      }
    } catch (err) {
      console.error('Fetch nodes error:', err)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  useEffect(() => {
    isMounted.current = true
    fetchNodes()

    const timer = setInterval(() => {
      fetchNodes()
    }, 2500)

    return () => {
      isMounted.current = false
      clearInterval(timer)
    }
  }, [])

  // 搜索与过滤过滤结果
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchSearch =
        n.label?.toLowerCase().includes(search.toLowerCase()) ||
        n.ip?.toLowerCase().includes(search.toLowerCase()) ||
        n.location?.toLowerCase().includes(search.toLowerCase()) ||
        n.isp?.toLowerCase().includes(search.toLowerCase())

      if (!matchSearch) return false
      if (filterState === 'online') return n.online
      if (filterState === 'offline') return !n.online
      return true
    })
  }, [nodes, search, filterState])

  // 轻量指标解析辅助函数
  const getNodeMetrics = (node) => {
    const snap = node.snapshot || {}
    const ramTotal = parseInt(snap.ram_total) || 1
    const ramUsage = parseInt(snap.ram_usage) || 0
    const ramPercent = Math.min(100, Math.max(0, Math.round((ramUsage / ramTotal) * 100)))

    const diskTotal = parseInt(snap.disk_total) || 1
    const diskUsage = parseInt(snap.disk_usage) || 0
    const diskPercent = Math.min(100, Math.max(0, Math.round((diskUsage / diskTotal) * 100)))

    const cpuUsage = Math.min(100, Math.max(0, parseInt(snap.load_cpu) || 0))
    const ioUsage = Math.min(100, Math.max(0, parseInt(snap.load_io) || 0))

    const loadArr = (snap.load || '0.00 0.00 0.00').split(' ')
    const load1 = loadArr[0] || '0.00'

    const netSpeed = (parseInt(snap.rx_gap) || 0) + (parseInt(snap.tx_gap) || 0)

    return {
      ramPercent,
      ramText: `${formatByte(ramUsage)} / ${formatByte(ramTotal)}`,
      diskPercent,
      diskText: `${formatByte(diskUsage)} / ${formatByte(diskTotal)}`,
      cpuUsage,
      ioUsage,
      load1,
      netSpeedText: `${formatByte(netSpeed)}/s`,
      uptimeText: snap.uptime ? formatTime(snap.uptime) : '00:00:00'
    }
  }

  const handleDeleteQuick = async (e, node) => {
    e.stopPropagation()
    if (!window.confirm(`确定要移除监控节点 [${node.label}] 吗？`)) {
      return
    }
    try {
      const res = await http.post(`/api/node/${node.id}/remove`)
      if (res && res.status === 0) {
        fetchNodes()
      } else {
        alert(res?.message || '删除失败')
      }
    } catch (err) {
      alert('网络异常，删除失败')
    }
  }

  return (
    <div className="space-y-6">
      
      {/* 顶部过滤控制台 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        
        {/* 搜索框 */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="按名称、IP、地理位置搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
        </div>

        {/* 状态过滤与视图切换 */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          
          <div className="flex bg-muted/60 p-1 rounded-lg border border-border text-xs font-medium">
            <button
              onClick={() => setFilterState('all')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${filterState === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              全部 ({nodes.length})
            </button>
            <button
              onClick={() => setFilterState('online')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${filterState === 'online' ? 'bg-card text-emerald-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              在线 ({nodes.filter(n => n.online).length})
            </button>
            <button
              onClick={() => setFilterState('offline')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${filterState === 'offline' ? 'bg-card text-zinc-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              离线 ({nodes.filter(n => !n.online).length})
            </button>
          </div>

          <div className="flex bg-muted/60 p-1 rounded-lg border border-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition cursor-pointer ${viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              title="网格视图"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition cursor-pointer ${viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              title="表格视图"
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>

          {/* 管理员专属：新建节点与编辑模式按钮 */}
          {isLoggedIn && (
            <div className="flex items-center gap-2">
              <Link
                to="/server/create"
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-primary/90 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>新建节点</span>
              </Link>
            </div>
          )}
        </div>

      </div>

      {/* 节点展示区域 */}
      {loading && nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm">正在加载集群数据...</span>
        </div>
      ) : filteredNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl bg-card/40 text-center">
          <Server className="h-10 w-10 text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-semibold">未找到匹配的主机</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {search ? '请尝试更改搜索关键字或状态筛选条件' : '当前集群尚未添加监控节点'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* 网格卡片视图 (带高清矢量 SVG 国旗) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNodes.map((node) => {
            const metrics = getNodeMetrics(node)
            const targetId = node.index_id || node.id
            return (
              <div
                key={node.id}
                onClick={() => navigate(`/server/${targetId}`)}
                className="group relative bg-card border border-border/80 rounded-xl p-5 hover:border-zinc-500 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                {/* 头部：标题与状态 */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                          !node.installed
                            ? 'bg-amber-500'
                            : node.online
                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                            : 'bg-zinc-600'
                        }`}
                      />
                      <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                        {node.label || '未命名主机'}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {node.online ? metrics.uptimeText : '离线'}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* 国旗 + 网络与地理信息 */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <CountryFlag location={node.location || node.isp || ''} />
                    {node.ip ? (
                      <span className="font-mono bg-muted/70 px-2 py-0.5 rounded text-foreground/90 font-medium">
                        {node.ip}
                      </span>
                    ) : null}
                    {(node.location || node.isp) && (
                      <span className="truncate max-w-[180px]">
                        {[node.location, node.isp].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* 主机指标网格 (CPU / 内存 / 磁盘 3 维度进度条) */}
                {node.installed ? (
                  <div className="space-y-3 pt-3 border-t border-border/60">
                    
                    {/* CPU & 内存 & 磁盘 3 栏并排展示 */}
                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      {/* CPU */}
                      <div>
                        <div className="flex justify-between text-muted-foreground mb-1">
                          <span>CPU</span>
                          <span className="font-mono font-medium text-foreground">{metrics.cpuUsage}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              metrics.cpuUsage > 85 ? 'bg-red-500' : metrics.cpuUsage > 60 ? 'bg-amber-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${metrics.cpuUsage}%` }}
                          />
                        </div>
                      </div>

                      {/* 内存 */}
                      <div>
                        <div className="flex justify-between text-muted-foreground mb-1">
                          <span>内存</span>
                          <span className="font-mono font-medium text-foreground">{metrics.ramPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              metrics.ramPercent > 90 ? 'bg-red-500' : metrics.ramPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${metrics.ramPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* 磁盘 */}
                      <div>
                        <div className="flex justify-between text-muted-foreground mb-1">
                          <span>磁盘</span>
                          <span className="font-mono font-medium text-foreground">{metrics.diskPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              metrics.diskPercent > 90 ? 'bg-red-500' : metrics.diskPercent > 75 ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${metrics.diskPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* IO & 负载与网络吞吐 */}
                    <div className="flex items-center justify-between text-xs font-mono pt-1 text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span>负载: <strong className="text-foreground font-normal">{metrics.load1}</strong></span>
                        <span>IO: <strong className="text-foreground font-normal">{metrics.ioUsage}%</strong></span>
                      </div>
                      <div className="text-blue-400">
                        {metrics.netSpeedText}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-500 flex items-center justify-between mt-2">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5" />
                      待安装探针脚本
                    </span>
                    <span className="text-[10px] underline">点击获取 &rarr;</span>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      ) : (
        /* 表格精简视图 */
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          
          {/* 表格工具条 (含编辑模式开关) */}
          <div className="px-5 py-3 border-b border-border/80 flex items-center justify-between bg-muted/20">
            <span className="text-xs text-muted-foreground">
              共展示 {filteredNodes.length} 台服务器
            </span>
            {isLoggedIn && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border transition cursor-pointer ${
                  isEditing 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                    : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span>{isEditing ? '退出编辑模式' : '开启快捷编辑模式'}</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-5 py-3">主机 / 归属 / IP</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">运行时间</th>
                  <th className="px-5 py-3">CPU 使用率</th>
                  <th className="px-5 py-3">内存占用</th>
                  <th className="px-5 py-3">磁盘占用</th>
                  <th className="px-5 py-3">负载</th>
                  <th className="px-5 py-3">实时速率</th>
                  {isEditing && (
                    <th className="px-5 py-3 text-right">操作管理</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredNodes.map((node) => {
                  const metrics = getNodeMetrics(node)
                  const targetId = node.index_id || node.id
                  return (
                    <tr
                      key={node.id}
                      onClick={() => !isEditing && navigate(`/server/${targetId}`)}
                      className={`transition-colors ${isEditing ? 'hover:bg-muted/10' : 'hover:bg-muted/30 cursor-pointer'}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <CountryFlag location={node.location || node.isp || ''} />
                          <span>{node.label}</span>
                        </div>
                        <div className="text-xs font-mono text-muted-foreground mt-0.5">
                          {node.ip || '未获取 IP'} {node.location ? `· ${node.location}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            !node.installed
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : node.online
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                          }`}
                        >
                          {!node.installed ? '未安装' : node.online ? '在线' : '离线'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {node.online ? metrics.uptimeText : '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        {node.installed ? (
                          <div className="w-20">
                            <div className="flex justify-between text-xs mb-1 font-mono">
                              <span>{metrics.cpuUsage}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500" style={{ width: `${metrics.cpuUsage}%` }} />
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        {node.installed ? (
                          <div className="w-20">
                            <div className="flex justify-between text-xs mb-1 font-mono">
                              <span>{metrics.ramPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${metrics.ramPercent}%` }} />
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        {node.installed ? (
                          <div className="w-20">
                            <div className="flex justify-between text-xs mb-1 font-mono">
                              <span>{metrics.diskPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${metrics.diskPercent}%` }} />
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {node.installed ? metrics.load1 : '-'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-blue-400">
                        {node.installed ? metrics.netSpeedText : '-'}
                      </td>
                      {isEditing && (
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/server/${node.id}/edit`}
                              className="p-1.5 rounded bg-muted hover:bg-zinc-200 dark:hover:bg-zinc-700 text-foreground transition"
                              title="编辑配置"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              onClick={(e) => handleDeleteQuick(e, node)}
                              className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 transition cursor-pointer"
                              title="删除节点"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
