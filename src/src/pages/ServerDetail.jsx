import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import http from '../lib/http'
import { formatByte, formatTime, formatDateTime } from '../lib/utils'
import { CountryFlag } from '../components/CountryFlag'
import {
  Server,
  ArrowLeft,
  Edit,
  Trash2,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  Clock,
  Terminal,
  Globe,
  RefreshCw,
  Zap,
  Network,
  Lock
} from 'lucide-react'

// 注册 Chart.js 核心组件
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line as ChartJsLine } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
)

export default function ServerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [snapshot, setSnapshot] = useState({})
  const [rawHistory, setRawHistory] = useState([]) // 存储原始完整的历史快照数组
  const [timeRange, setTimeRange] = useState('6h') // 1h | 6h | 24h | 7d
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const isMounted = useRef(true)

  const token = localStorage.getItem('token')
  const isLoggedIn = Boolean(token)

  // 支持最多 10080 个采样点（覆盖完整 7 天时序历史）
  const MAX_HISTORY_POINTS = 10080

  const pushMetricsToHistory = (snap) => {
    if (!snap || !snap.timestamp) return
    setRawHistory((prev) => [...prev, snap].slice(-MAX_HISTORY_POINTS))
  }

  const fetchDetail = async (range = timeRange, isInitial = false) => {
    try {
      const res = await http.get(`/api/node/${id}?range=${range}`)
      if (res && res.status === 403) {
        setErrorMsg(res.message || '未授权访问')
        return
      }
      if (res && res.data && isMounted.current) {
        setData(res.data)
        setSnapshot(res.data.snapshot || {})

        // 从 SQLite 历史库初始化真实数据
        if (res.data.history && Array.isArray(res.data.history)) {
          setRawHistory(res.data.history.slice(-MAX_HISTORY_POINTS))
        }
      }
    } catch (err) {
      console.error('Fetch detail error:', err)
      if (err.response && err.response.status === 403) {
        setErrorMsg('该节点尚未接入，请先以管理员身份登录')
      }
    } finally {
      if (isMounted.current && isInitial) setLoading(false)
    }
  }

  const tickLatest = async () => {
    try {
      const res = await http.get(`/api/node/${id}/latest`)
      if (res && res.data && isMounted.current) {
        setSnapshot(res.data)
        pushMetricsToHistory(res.data)
      }
    } catch (err) {
      console.error('Tick latest error:', err)
    }
  }

  useEffect(() => {
    isMounted.current = true
    setLoading(true)
    fetchDetail(timeRange, true)

    const timer = setInterval(() => {
      tickLatest()
    }, 2500)

    return () => {
      isMounted.current = false
      clearInterval(timer)
    }
  }, [id])

  // 切换时间跨度时，动态拉取该时间段对应的历史时序数据 (极速毫秒级响应)
  const handleRangeChange = (range) => {
    setTimeRange(range)
    fetchDetail(range, false)
  }

  // 根据当前选择的时间窗口 (1小时 / 6小时 / 24小时 / 7天) 计算过滤后的时序数据
  const history = useMemo(() => {
    if (!rawHistory || rawHistory.length === 0) {
      return {
        labels: [],
        cpu: [],
        ram: [],
        swap: [],
        io: [],
        load1: [],
        load5: [],
        load15: [],
        rx: [],
        tx: []
      }
    }

    const now = Date.now()
    let durationMs = 6 * 3600 * 1000 // 默认 6 小时
    if (timeRange === '1h') durationMs = 1 * 3600 * 1000
    else if (timeRange === '6h') durationMs = 6 * 3600 * 1000
    else if (timeRange === '24h') durationMs = 24 * 3600 * 1000
    else if (timeRange === '7d') durationMs = 7 * 24 * 3600 * 1000

    const cutoff = now - durationMs
    const filtered = rawHistory.filter(h => h && h.timestamp && h.timestamp >= cutoff)

    // 智能采样：当数据点过多时（如 7 天数据），按步长抽稀防止前端渲染过载
    let sampled = filtered
    if (filtered.length > 300) {
      const step = Math.ceil(filtered.length / 300)
      sampled = filtered.filter((_, idx) => idx % step === 0 || idx === filtered.length - 1)
    }

    const labels = []
    const cpu = []
    const ram = []
    const swap = []
    const io = []
    const load1 = []
    const load5 = []
    const load15 = []
    const rx = []
    const tx = []

    sampled.forEach((snap) => {
      const dt = formatDateTime(snap.timestamp)
      const tStr = timeRange === '7d' ? (dt ? dt.slice(5, 16) : '00-00 00:00') : (dt ? dt.slice(5) : '00:00')
      const loadArr = (snap.load || '0 0 0').split(' ').map((v) => parseFloat(v) || 0)
      const ramMB = Math.round((parseInt(snap.ram_usage) || 0) / 1024 / 1024)
      const swapMB = Math.round((parseInt(snap.swap_usage) || 0) / 1024 / 1024)
      const cpuVal = parseInt(snap.load_cpu) || 0
      const ioVal = parseInt(snap.load_io) || 0
      const rxVal = Math.round((parseFloat(snap.rx_gap) || 0) / 1024)
      const txVal = Math.round((parseFloat(snap.tx_gap) || 0) / 1024)

      labels.push(tStr)
      cpu.push(cpuVal)
      ram.push(ramMB)
      swap.push(swapMB)
      io.push(ioVal)
      load1.push(loadArr[0])
      load5.push(loadArr[1])
      load15.push(loadArr[2])
      rx.push(rxVal)
      tx.push(txVal)
    })

    return { labels, cpu, ram, swap, io, load1, load5, load15, rx, tx }
  }, [rawHistory, timeRange])

  // 强壮的跨浏览器复制实现
  const copyScript = (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }).catch(() => fallbackCopy(text))
      } else {
        fallbackCopy(text)
      }
    } catch (e) {
      fallbackCopy(text)
    }
  }

  const fallbackCopy = (text) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Fallback copy failed', err)
    }
    document.body.removeChild(textArea)
  }

  // 解析进程列表
  const parseProcesses = (raw) => {
    if (!raw || typeof raw !== 'string') return []
    return raw
      .split(';')
      .filter(Boolean)
      .map((row) => {
        const parts = row.trim().split(' ')
        return {
          user: parts[0] || 'root',
          cpu: parts[1] || '0.0',
          mem: parts[2] ? formatByte(parseInt(parts[2]) * 1024) : '0 B',
          time: parts[3] || '00:00',
          stat: parts[4] || 'S',
          name: parts.slice(5).join(' ') || '-'
        }
      })
  }

  // 计算是否在线
  const isOnline = Boolean(snapshot.timestamp && Date.now() - snapshot.timestamp < 30000)
  const installCmd = data?.script || `wget --no-check-certificate -qO- ${window.location.origin}/client/install/${id} | bash`

  // 获取时间区间的文字描述
  const timeRangeLabel = timeRange === '1h' ? '1小时' : timeRange === '6h' ? '6小时' : timeRange === '24h' ? '24小时' : '7天'

  // 图表统一样式生成器
  const createChartOptions = (unit = '%', max = null) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'rgba(156, 163, 175, 0.9)',
          boxWidth: 12,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(156, 163, 175, 0.1)' },
        ticks: { color: 'rgba(156, 163, 175, 0.7)', font: { size: 10 }, maxTicksLimit: 10 }
      },
      y: {
        grid: { color: 'rgba(156, 163, 175, 0.1)' },
        ticks: {
          color: 'rgba(156, 163, 175, 0.7)',
          font: { size: 10 },
          callback: (v) => `${v} ${unit}`
        },
        min: 0,
        ...(max !== null ? { max } : {})
      }
    }
  })

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* 顶部标题栏骨架 */}
        <div className="flex items-center justify-between border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted/60"></div>
            <div className="space-y-2">
              <div className="h-5 w-40 bg-muted/80 rounded"></div>
              <div className="h-3 w-64 bg-muted/50 rounded"></div>
            </div>
          </div>
          <div className="h-8 w-24 bg-muted/60 rounded-lg"></div>
        </div>

        {/* 顶部硬件概况卡片骨架 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="h-3 w-16 bg-muted/60 rounded"></div>
              <div className="h-5 w-24 bg-muted/80 rounded"></div>
            </div>
          ))}
        </div>

        {/* 核心指标与进程列表骨架 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="h-4 w-32 bg-muted/70 rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted/40 rounded-lg"></div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="h-4 w-28 bg-muted/70 rounded mb-4"></div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 bg-muted/40 rounded"></div>
            ))}
          </div>
        </div>

        {/* 折线图网格骨架 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-64 bg-muted/20"></div>
          ))}
        </div>
      </div>
    )
  }

  // 访客访问未安装节点：友好拦截并引导登录
  if (errorMsg || (!isLoggedIn && data && !data.installed)) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="inline-flex h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 items-center justify-center">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">该主机尚未接入探针</h2>
        <p className="text-xs text-muted-foreground">
          {errorMsg || '为了防止安装命令与节点信息泄露，未安装探针的节点仅管理员可见。'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link to="/servers" className="px-4 py-2 text-xs rounded-lg border border-border bg-muted/60 text-muted-foreground hover:text-foreground transition">
            返回列表
          </Link>
          <Link to="/signin" className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition">
            管理员登录
          </Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold">未找到该节点</h2>
        <Link to="/servers" className="text-sm text-primary underline mt-2 inline-block">
          返回主机列表
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* 头部标题与控制条 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/servers"
            className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <CountryFlag location={data.location || data.isp || ''} className="h-4 w-6 rounded-[2px] inline-block shadow-sm" />
              <h1 className="text-xl font-bold text-foreground">{data.label}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  !data.installed
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    : isOnline
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}
              >
                {!data.installed ? '未安装脚本' : isOnline ? '在线' : '离线'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1 font-mono">
              <span>{data.ip || '0.0.0.0'}</span>
              {data.location && <span>· {data.location}</span>}
              {data.isp && <span>· {data.isp}</span>}
              {data.price && (
                <span className="text-emerald-500 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  💰 {data.price}
                </span>
              )}
              {data.expire_time && data.expire_time > 0 && (() => {
                const msLeft = data.expire_time - Date.now()
                const daysLeft = Math.ceil(msLeft / (1000 * 3600 * 24))
                const dateStr = new Date(data.expire_time).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
                const isUrgent = daysLeft <= 3
                const isWarn = daysLeft <= 7
                return (
                  <span className={`px-2 py-0.5 rounded-md border font-semibold ${
                    daysLeft < 0
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : isUrgent
                      ? 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse'
                      : isWarn
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    ⏳ {dateStr} ({daysLeft < 0 ? '已过期' : `剩 ${daysLeft} 天`})
                  </span>
                )
              })()}
            </div>
          </div>
        </div>

        {/* 仅管理员可见操作区 */}
        {isLoggedIn && (
          <div className="flex flex-wrap items-center gap-2.5">
            {(!isOnline || !data.installed) && (
              <button
                onClick={() => copyScript(installCmd)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
                title="复制当前服务器的安装与探针对接命令"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? '已复制命令！' : '复制对接命令'}</span>
              </button>
            )}

            <Link
              to={`/server/${id}/edit`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium transition"
            >
              <Edit className="h-3.5 w-3.5" />
              编辑配置
            </Link>
            <Link
              to={`/server/${id}/remove`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              移除节点
            </Link>
          </div>
        )}
      </div>

      {!data.installed ? (
        /* 未安装探针时的引导界面 (仅管理员登录可见) */
        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-amber-500 font-semibold">
            <Terminal className="h-5 w-5" />
            <h3>请在待监控服务器上执行安装探针命令</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            请以 root 权限在目标 Linux 服务器上执行以下命令（安装脚本将自动创建禁止交互式登录的专属 <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-emerald-400">monitor</code> 隔离系统用户，并通过其个人 crontab 进行数据采集与上报，确保底层系统安全）。
          </p>

          <div className="relative">
            <pre className="bg-zinc-950 dark:bg-zinc-950 bg-slate-900 border border-border rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-x-auto selection:bg-emerald-500/20">
              {installCmd}
            </pre>
            <button
              onClick={() => copyScript(installCmd)}
              className="absolute right-3 top-3 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 text-xs flex items-center gap-1.5 font-medium transition cursor-pointer shadow-sm active:scale-95"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已复制！' : '复制命令'}
            </button>
          </div>
        </div>
      ) : (
        /* 已安装探针：硬件概况 + 时间选择器 + 5 大时序折线图 + 进程榜单 */
        <div className="space-y-6">
          
          {/* 硬件信息概览卡片 */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            
            {/* 顶部突出横幅：服务器价格与续费到期时间 */}
            {(data.price || (data.expire_time && data.expire_time > 0)) && (
              <div className="bg-muted/40 border border-border/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">服务器费用 / 续费周期</div>
                    <div className="text-base font-bold text-foreground font-mono mt-0.5">
                      {data.price || '未设置价格'}
                    </div>
                  </div>
                </div>

                {data.expire_time && data.expire_time > 0 && (() => {
                  const now = Date.now()
                  const msLeft = data.expire_time - now
                  const daysLeft = Math.ceil(msLeft / (1000 * 3600 * 24))
                  const dateStr = new Date(data.expire_time).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
                  const isOverdue = daysLeft < 0
                  const isUrgent = daysLeft <= 3 && !isOverdue
                  const isWarn = daysLeft <= 7 && !isOverdue
                  const progressPct = isOverdue ? 0 : Math.min(100, Math.max(10, Math.round((daysLeft / 30) * 100)))

                  return (
                    <div className="w-full sm:w-72 bg-background border border-border/80 rounded-lg p-2.5 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1 font-mono">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {dateStr} 到期
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          isOverdue
                            ? 'bg-red-500/15 text-red-500 border-red-500/30'
                            : isUrgent
                            ? 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse'
                            : isWarn
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}>
                          {isOverdue ? `已过期 ${Math.abs(daysLeft)} 天` : daysLeft === 0 ? '今日到期' : `剩余 ${daysLeft} 天`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isOverdue
                              ? 'bg-red-500'
                              : isUrgent
                              ? 'bg-red-500'
                              : isWarn
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              主机系统与硬件概况
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg border border-border/50">
                <span className="text-muted-foreground block mb-1">系统运行时间</span>
                <span className="font-semibold text-foreground font-mono">{formatTime(snapshot.uptime)}</span>
              </div>
              <div className="bg-muted/40 p-3 rounded-lg border border-border/50">
                <span className="text-muted-foreground block mb-1">操作系统</span>
                <span className="font-semibold text-foreground truncate block">{snapshot.os_name || '-'} ({snapshot.os_arch || '-'})</span>
              </div>
              <div className="bg-muted/40 p-3 rounded-lg border border-border/50">
                <span className="text-muted-foreground block mb-1">内核版本</span>
                <span className="font-semibold text-foreground font-mono truncate block">{snapshot.os_kernel || '-'}</span>
              </div>
              <div className="bg-muted/40 p-3 rounded-lg border border-border/50">
                <span className="text-muted-foreground block mb-1">CPU 型号</span>
                <span className="font-semibold text-foreground truncate block">{snapshot.cpu_name || '-'}</span>
              </div>
              <div className="bg-muted/40 p-3 rounded-lg border border-border/50">
                <span className="text-muted-foreground block mb-1">CPU 核心 / 频率</span>
                <span className="font-semibold text-foreground font-mono">{snapshot.cpu_cores || 1} 核 @ {snapshot.cpu_freq || '-'} MHz</span>
              </div>
              <div className="bg-muted/40 p-3 rounded-lg border border-border/50">
                <span className="text-muted-foreground block mb-1">内存 / 交换空间</span>
                <span className="font-semibold text-foreground font-mono">{formatByte(snapshot.ram_usage)} / {formatByte(snapshot.ram_total)}</span>
              </div>
              <div className="bg-muted/40 p-3 rounded-lg border border-border/50">
                <span className="text-muted-foreground block mb-1">磁盘使用</span>
                <span className="font-semibold text-foreground font-mono">{formatByte(snapshot.disk_usage)} / {formatByte(snapshot.disk_total)}</span>
              </div>
              <div className="bg-muted/40 p-3 rounded-lg border border-border/50">
                <span className="text-muted-foreground block mb-1">连接数 / 文件句柄</span>
                <span className="font-semibold text-foreground font-mono">{snapshot.connections || 0} 连接 · {snapshot.file_handles || 0}/{snapshot.file_handles_limit || 0}</span>
              </div>
            </div>
          </div>

          {/* 时间跨度选择器 (1小时 / 6小时 / 24小时 / 7天) */}
          <div className="flex items-center justify-end">
            <div className="inline-flex bg-muted/60 p-1 rounded-lg border border-border text-xs font-medium shadow-sm">
              <button
                onClick={() => handleRangeChange('1h')}
                className={`px-3.5 py-1.5 rounded-md transition cursor-pointer ${
                  timeRange === '1h'
                    ? 'bg-card text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                1 小时
              </button>
              <button
                onClick={() => handleRangeChange('6h')}
                className={`px-3.5 py-1.5 rounded-md transition cursor-pointer ${
                  timeRange === '6h'
                    ? 'bg-card text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                6 小时
              </button>
              <button
                onClick={() => handleRangeChange('24h')}
                className={`px-3.5 py-1.5 rounded-md transition cursor-pointer ${
                  timeRange === '24h'
                    ? 'bg-card text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                24 小时
              </button>
              <button
                onClick={() => handleRangeChange('7d')}
                className={`px-3.5 py-1.5 rounded-md transition cursor-pointer ${
                  timeRange === '7d'
                    ? 'bg-card text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                7 天
              </button>
            </div>
          </div>

          {/* 实时折线图网格 (CPU / 内存 / IO / 负载 / 实时网络) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* CPU 使用率图表 */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-purple-400" />
                  CPU 使用率趋势 ({timeRangeLabel})
                </h4>
                <span className="text-xs font-mono font-bold text-purple-400">{snapshot.load_cpu || 0}%</span>
              </div>
              <div className="h-56">
                <ChartJsLine
                  options={createChartOptions('%', 100)}
                  data={{
                    labels: history.labels,
                    datasets: [
                      {
                        label: 'CPU (%)',
                        data: history.cpu,
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.15)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0
                      }
                    ]
                  }}
                />
              </div>
            </div>

            {/* 内存与 SWAP 图表 */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-emerald-400" />
                  内存与 Swap 占用趋势 ({timeRangeLabel})
                </h4>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {formatByte(snapshot.ram_usage)}
                </span>
              </div>
              <div className="h-56">
                <ChartJsLine
                  options={createChartOptions('MB')}
                  data={{
                    labels: history.labels,
                    datasets: [
                      {
                        label: 'RAM (MB)',
                        data: history.ram,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0
                      },
                      {
                        label: 'Swap (MB)',
                        data: history.swap,
                        borderColor: '#f97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0
                      }
                    ]
                  }}
                />
              </div>
            </div>

            {/* 磁盘 IO 图表 */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-400" />
                  磁盘 I/O 活跃度 ({timeRangeLabel})
                </h4>
                <span className="text-xs font-mono font-bold text-amber-400">{snapshot.load_io || 0}%</span>
              </div>
              <div className="h-56">
                <ChartJsLine
                  options={createChartOptions('%', 100)}
                  data={{
                    labels: history.labels,
                    datasets: [
                      {
                        label: 'I/O 负载 (%)',
                        data: history.io,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0
                      }
                    ]
                  }}
                />
              </div>
            </div>

            {/* 系统负载 (1 / 5 / 15 分钟) */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-400" />
                  系统平均负载 ({timeRangeLabel})
                </h4>
                <span className="text-xs font-mono text-muted-foreground">{snapshot.load || '0.00 0.00 0.00'}</span>
              </div>
              <div className="h-56">
                <ChartJsLine
                  options={createChartOptions('')}
                  data={{
                    labels: history.labels,
                    datasets: [
                      {
                        label: 'Load 1m',
                        data: history.load1,
                        borderColor: '#38bdf8',
                        tension: 0.3,
                        pointRadius: 0
                      },
                      {
                        label: 'Load 5m',
                        data: history.load5,
                        borderColor: '#818cf8',
                        tension: 0.3,
                        pointRadius: 0
                      },
                      {
                        label: 'Load 15m',
                        data: history.load15,
                        borderColor: '#c084fc',
                        tension: 0.3,
                        pointRadius: 0
                      }
                    ]
                  }}
                />
              </div>
            </div>

            {/* 网络吞吐 (出网 / 入网) */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Network className="h-4 w-4 text-cyan-400" />
                  实时网络吞吐带宽 (RX / TX · {timeRangeLabel})
                </h4>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-emerald-400">入网 ↓ {formatByte(snapshot.rx_gap)}/s</span>
                  <span className="text-blue-400">出网 ↑ {formatByte(snapshot.tx_gap)}/s</span>
                </div>
              </div>
              <div className="h-56">
                <ChartJsLine
                  options={createChartOptions('KB/s')}
                  data={{
                    labels: history.labels,
                    datasets: [
                      {
                        label: '入网 RX (KB/s)',
                        data: history.rx,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0
                      },
                      {
                        label: '出网 TX (KB/s)',
                        data: history.tx,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0
                      }
                    ]
                  }}
                />
              </div>
            </div>

          </div>

          {/* 实时高负载进程榜单 (仅管理员可见) */}
          {parseProcesses(snapshot.processes_array).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                当前活跃进程快照
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-muted/40 uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-4 py-2.5">进程名</th>
                      <th className="px-4 py-2.5">所有者</th>
                      <th className="px-4 py-2.5">CPU (%)</th>
                      <th className="px-4 py-2.5">内存占用</th>
                      <th className="px-4 py-2.5">运行时间</th>
                      <th className="px-4 py-2.5">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {parseProcesses(snapshot.processes_array).map((p, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition">
                        <td className="px-4 py-2 font-semibold text-foreground truncate max-w-xs">{p.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{p.user}</td>
                        <td className="px-4 py-2 text-purple-400 font-bold">{p.cpu}%</td>
                        <td className="px-4 py-2 text-emerald-400">{p.mem}</td>
                        <td className="px-4 py-2 text-muted-foreground">{p.time}</td>
                        <td className="px-4 py-2">
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-zinc-300">
                            {p.stat}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
