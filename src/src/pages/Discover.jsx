import React, { useState, useEffect, useRef } from 'react'
import http from '../lib/http'
import { cn, formatByte, formatDateTime } from '../lib/utils'
import { CountryFlag } from '../components/CountryFlag'
import {
  Radar, RefreshCw, Copy, Check, ClipboardPaste, ChevronDown, ChevronUp,
  MonitorCheck, Trash2, X, AlertCircle, CheckCircle2, KeyRound, Terminal, Server,
  ShieldBan, ShieldOff, Timer, DollarSign, Calendar
} from 'lucide-react'

// 强壮的跨浏览器复制实现 (兼容 HTTP 非安全上下文)
function useCopy() {
  const [copiedKey, setCopiedKey] = useState('')
  const fallbackCopy = (text, key) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(''), 2000)
    } catch (err) {}
    document.body.removeChild(textArea)
  }
  const copy = (text, key = 'default') => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
          setCopiedKey(key)
          setTimeout(() => setCopiedKey(''), 2000)
        }).catch(() => fallbackCopy(text, key))
      } else {
        fallbackCopy(text, key)
      }
    } catch (e) {
      fallbackCopy(text, key)
    }
  }
  return { copiedKey, copy }
}

export default function Discover() {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [claimTarget, setClaimTarget] = useState(null)
  const [claimForm, setClaimForm] = useState({
    label: '', location: '', isp: '',
    update_interval: 5, record_interval: 60,
    sync_token: true
  })
  const [claiming, setClaiming] = useState(false)
  const [expanded, setExpanded] = useState({})
  const pollRef = useRef(null)
  const { copiedKey, copy } = useCopy()

  const fetchData = async () => {
    try {
      const res = await http.get('/api/discover')
      if (res && res.status === 0) {
        setInfo(res.data)
        setError('')
      }
    } catch (err) {
      setError('获取自动发现数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    pollRef.current = setInterval(fetchData, 10000)
    return () => clearInterval(pollRef.current)
  }, [])

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleRegenerate = async () => {
    if (!window.confirm('重新生成嗅探密钥后，已部署的嗅探探针将立即失效，需要重新安装。确定继续吗？')) return
    try {
      const res = await http.post('/api/discover/regenerate')
      if (res && res.status === 0) {
        showSuccess('嗅探密钥已重新生成')
        fetchData()
      }
    } catch (err) {
      setError('操作失败')
    }
  }

  const handleIgnore = async (ip) => {
    if (!window.confirm(`确定忽略该服务器的推送吗？\n${ip}\n(该服务器下次推送时将重新被自动登记)`)) return
    try {
      const res = await http.post('/api/discover/remove', { ip })
      if (res && res.status === 0) {
        showSuccess('已忽略该节点')
        fetchData()
      } else {
        setError(res?.message || '操作失败')
      }
    } catch (err) {
      setError('操作失败')
    }
  }

  const handleBan = async (ip) => {
    if (!window.confirm(`确定封禁来源 IP ${ip} 吗？\n\n封禁后该服务器将从列表移除，且无法再通过嗅探通道注册或上报。\n如需恢复，可在下方封禁列表中解除封禁。`)) return
    try {
      const res = await http.post('/api/discover/ban', { ip })
      if (res && res.status === 0) {
        showSuccess(`已封禁 ${ip} 并移除其待认领数据`)
        fetchData()
      } else {
        setError(res?.message || '操作失败')
      }
    } catch (err) {
      setError('操作失败')
    }
  }

  const handleUnban = async (ip) => {
    try {
      const res = await http.post('/api/discover/unban', { ip })
      if (res && res.status === 0) {
        showSuccess(`已解除 ${ip} 的封禁，该服务器下次推送时将重新登记`)
        fetchData()
      } else {
        setError(res?.message || '操作失败')
      }
    } catch (err) {
      setError('操作失败')
    }
  }

  const openClaim = (node) => {
    setClaimForm({
      label: node.hostname || node.label || '',
      location: node.location || '',
      isp: node.isp || '',
      price: '',
      expire_date: '',
      update_interval: 5,
      record_interval: 60,
      sync_token: true
    })
    setClaimTarget(node)
  }

  const handleClaim = async (e) => {
    e.preventDefault()
    if (!claimTarget) return
    setClaiming(true)
    try {
      let expireTimestamp = 0
      if (claimForm.expire_date) {
        expireTimestamp = new Date(claimForm.expire_date).getTime()
      }

      const res = await http.post('/api/discover/claim', {
        ip: claimTarget.ip,
        label: claimForm.label,
        location: claimForm.location,
        isp: claimForm.isp,
        price: (claimForm.price || '').trim(),
        expire_time: expireTimestamp,
        update_interval: parseInt(claimForm.update_interval) || 5,
        record_interval: parseInt(claimForm.record_interval) || 60,
        sync_token: claimForm.sync_token
      })
      if (res && res.status === 0) {
        showSuccess(claimForm.sync_token
          ? '认领成功！专属密钥将在探针下次上报时自动同步并切换到托管通道'
          : '认领成功！该服务器将保持推送模式，数据持续按 IP 自动分流入库')
        setClaimTarget(null)
        fetchData()
      } else {
        setError(res?.message || '认领失败')
      }
    } catch (err) {
      setError('网络异常，认领失败')
    } finally {
      setClaiming(false)
    }
  }

  const toggleExpand = (ip) => {
    setExpanded((prev) => ({ ...prev, [ip]: !prev[ip] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span>正在加载自动发现中心...</span>
      </div>
    )
  }

  const nodes = info?.nodes || []

  return (
    <div className="space-y-6">

      {/* 头部 */}
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          自动发现中心 (嗅探接入)
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          零接触批量接入：无需预先创建节点，探针凭嗅探密钥自动推送，按 IP 归档分流，认领后即可纳管
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 接入配置 */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">嗅探接入配置</span>
          </div>
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重置密钥
          </button>
        </div>

        {/* 推送接口 */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">嗅探推送接口 (服务端自动按 IP 分流归档)</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 text-xs bg-background border border-border rounded-lg font-mono text-muted-foreground truncate select-all">
              {info?.push_url || '-'}
            </code>
            <button
              onClick={() => copy(info?.push_url || '', 'push')}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-muted/40 hover:bg-muted transition flex-shrink-0 cursor-pointer"
            >
              {copiedKey === 'push' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* 批量安装命令 */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">批量嗅探安装命令 (在任意多台目标服务器以 root 执行，无需预先创建节点)</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2.5 text-xs bg-background border border-border rounded-lg font-mono text-emerald-600 dark:text-emerald-400 truncate select-all">
              {info?.install_command || '-'}
            </code>
            <button
              onClick={() => copy(info?.install_command || '', 'install')}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-muted/40 hover:bg-muted transition flex-shrink-0 cursor-pointer"
            >
              {copiedKey === 'install' ? <Check className="h-4 w-4 text-emerald-500" /> : <ClipboardPaste className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
          <div className="flex items-start gap-1.5 pt-1">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              批量在 10 台甚至更多服务器执行该命令后，所有服务器将出现在下方列表 (按 IP 区分)。
              认领时可选择「自动同步专属密钥」—— 探针将在下次上报时自动收到正式 Token 并无缝切换到托管通道；
              也可以选择「不同步」，服务器保持推送模式，数据持续按 IP 自动分流到对应节点。
            </p>
          </div>
          <div className="flex items-start gap-1.5">
            <Timer className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-600/90 dark:text-amber-500/90 leading-relaxed">
              安全策略：待认领服务器保留 <span className="font-semibold">{info?.ttl_days ?? 7} 天</span>，
              超时未认领将自动从列表消失，并<b>封禁其来源 IP</b> (该 IP 将无法再通过嗅探通道注册或上报，可在下方封禁列表解除)。
            </p>
          </div>
        </div>
      </div>

      {/* 已发现服务器列表 */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">已发现服务器</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">{nodes.length}</span>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>

        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <Radar className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">尚未发现任何服务器</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">
              将上方的批量安装命令在目标服务器上执行后，探针会自动推送到嗅探接口，
              服务器信息将按 IP 出现在这里等待认领。
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/60">
                  <th className="px-6 py-3 font-medium">主机 / 系统</th>
                  <th className="px-4 py-3 font-medium">IP 地址</th>
                  <th className="px-4 py-3 font-medium">地理位置</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">CPU / 内存</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">最近上报</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-6 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => {
                  const memPct = n.ram_total > 0 ? Math.min(100, Math.round((n.ram_usage / n.ram_total) * 100)) : 0
                  const isExpanded = !!expanded[n.ip]
                  return (
                    <React.Fragment key={n.ip}>
                      <tr className="border-b border-border/40 hover:bg-muted/30 transition">
                        <td className="px-6 py-3.5">
                          <button
                            onClick={() => toggleExpand(n.ip)}
                            className="flex items-center gap-1.5 text-left cursor-pointer group"
                          >
                            {isExpanded
                              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />}
                            <div>
                              <div className="font-medium text-foreground text-[13px] flex items-center gap-2">
                                {n.hostname || n.label || '未知主机'}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {n.os_name ? `${n.os_name} · ${n.os_arch || '-'}` : (n.os_kernel || '-')}
                              </div>
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-foreground">{n.ip}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CountryFlag location={n.location || n.ip} className="h-3 w-4 rounded-[2px] flex-shrink-0" />
                            <span className="truncate max-w-[160px]">{n.location || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {n.cpu_cores || '-'} 核 · {formatByte(n.ram_usage)} / {formatByte(n.ram_total)} ({memPct}%)
                          </div>
                          <div className="h-1.5 w-32 bg-muted rounded-full overflow-hidden mt-1.5">
                            <div
                              className={cn('h-full rounded-full transition-all', memPct > 85 ? 'bg-red-500' : memPct > 65 ? 'bg-amber-500' : 'bg-emerald-500')}
                              style={{ width: `${memPct}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {n.last_seen ? formatDateTime(n.last_seen) : '-'}
                          </div>
                          <div className="text-[10px] text-muted-foreground/70 font-mono">
                            首次: {n.first_seen ? formatDateTime(n.first_seen) : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full border',
                            n.online
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-muted text-muted-foreground border-border')}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', n.online ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50')}></span>
                            {n.online ? '推送中' : '静默'}
                          </span>
                          {n.expire_at && (
                            <div className="text-[10px] font-mono text-amber-600/90 dark:text-amber-500/90 mt-1">
                              {(() => {
                                const left = n.expire_at - Date.now()
                                if (left <= 0) return '即将过期'
                                const days = Math.floor(left / 86400000)
                                const hours = Math.floor((left % 86400000) / 3600000)
                                return days > 0 ? `剩 ${days} 天 ${hours} 时` : `剩 ${hours} 小时`
                              })()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => openClaim(n)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-semibold rounded-lg hover:bg-primary/90 transition shadow-sm cursor-pointer"
                          >
                            <MonitorCheck className="h-3.5 w-3.5" />
                            认领
                          </button>
                          <button
                            onClick={() => handleBan(n.ip)}
                            className="inline-flex items-center justify-center h-7 w-7 ml-1.5 rounded-lg border border-border text-muted-foreground hover:text-orange-500 hover:border-orange-500/30 hover:bg-orange-500/10 transition cursor-pointer"
                            title="封禁该来源 IP (自动移除并禁止再接入)"
                          >
                            <ShieldBan className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleIgnore(n.ip)}
                            className="inline-flex items-center justify-center h-7 w-7 ml-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition cursor-pointer"
                            title="忽略该服务器 (下次推送将重新登记)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border/40 bg-muted/20">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-[11px] font-mono text-muted-foreground">
                              <div><span className="text-foreground/70">内核:</span> {n.os_kernel || '-'}</div>
                              <div><span className="text-foreground/70">CPU:</span> {n.cpu_name || '-'}</div>
                              <div><span className="text-foreground/70">磁盘:</span> {formatByte(n.disk_usage)} / {formatByte(n.disk_total)}</div>
                              <div><span className="text-foreground/70">运行时长:</span> {n.uptime ? parseFloat(n.uptime).toFixed(0) + 's' : '-'}</div>
                              <div><span className="text-foreground/70">运营商:</span> {n.isp || '-'}</div>
                              <div><span className="text-foreground/70">内部 Token:</span> 已隐藏 (认领后自动分配)</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 封禁 IP 列表 */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <ShieldBan className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">封禁 IP 列表</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-mono">{(info?.banned || []).length}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">被封禁 IP 无法通过嗅探通道注册或上报</span>
        </div>

        {(info?.banned || []).length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-muted-foreground">
            暂无封禁记录 · 待认领服务器超过 {info?.ttl_days ?? 7} 天未认领时其来源 IP 将自动进入此列表
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/60">
                  <th className="px-6 py-3 font-medium">IP 地址</th>
                  <th className="px-4 py-3 font-medium">封禁原因</th>
                  <th className="px-4 py-3 font-medium">封禁时间</th>
                  <th className="px-6 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {(info?.banned || []).map((b) => (
                  <tr key={b.ip} className="border-b border-border/40 hover:bg-muted/30 transition">
                    <td className="px-6 py-3 font-mono text-xs text-foreground">{b.ip}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{b.reason || '-'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{b.created_at ? formatDateTime(b.created_at) : '-'}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleUnban(b.ip)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-border text-muted-foreground hover:text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition cursor-pointer"
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                        解除封禁
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 认领弹窗 */}
      {claimTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setClaimTarget(null)}></div>
          <form
            onSubmit={handleClaim}
            className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in-0 zoom-in-95"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <MonitorCheck className="h-5 w-5 text-primary" />
                  认领服务器
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 font-mono">{claimTarget.ip}</p>
              </div>
              <button
                type="button"
                onClick={() => setClaimTarget(null)}
                className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">节点名称</label>
              <input
                type="text"
                required
                placeholder={claimTarget.hostname || '例如：香港 CN2'}
                value={claimForm.label}
                onChange={(e) => setClaimForm({ ...claimForm, label: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">地理位置</label>
                <input
                  type="text"
                  placeholder="如：美国 洛杉矶"
                  value={claimForm.location}
                  onChange={(e) => setClaimForm({ ...claimForm, location: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">运营商</label>
                <input
                  type="text"
                  placeholder="如：ColoCrossing"
                  value={claimForm.isp}
                  onChange={(e) => setClaimForm({ ...claimForm, isp: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">价格 / 周期 (可选)</label>
                <input
                  type="text"
                  placeholder="如：¥35/月 或 $12/年"
                  value={claimForm.price}
                  onChange={(e) => setClaimForm({ ...claimForm, price: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">到期时间 (可选)</label>
                <input
                  type="date"
                  value={claimForm.expire_date}
                  onChange={(e) => setClaimForm({ ...claimForm, expire_date: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">上报间隔 (秒)</label>
                <input
                  type="number"
                  min="1"
                  value={claimForm.update_interval}
                  onChange={(e) => setClaimForm({ ...claimForm, update_interval: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">历史采样间隔 (秒)</label>
                <input
                  type="number"
                  min="1"
                  value={claimForm.record_interval}
                  onChange={(e) => setClaimForm({ ...claimForm, record_interval: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            {/* 密钥同步开关 */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border/60 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-foreground block">自动同步专属密钥到探针</span>
                <span className="text-[11px] text-muted-foreground leading-relaxed">
                  {claimForm.sync_token
                    ? '推荐：探针下次上报时自动收到专属 Token，无缝切换为托管通道'
                    : '不同步：保持推送模式，数据持续按 IP 自动分流到该节点'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={claimForm.sync_token}
                  onChange={(e) => setClaimForm({ ...claimForm, sync_token: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClaimTarget(null)}
                className="px-4 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={claiming}
                className="px-5 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg hover:bg-primary/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {claiming ? '正在认领...' : '确认认领'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}
