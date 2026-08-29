import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import http from '../lib/http'
import { Trash2, ArrowLeft, Terminal, Copy, Check, AlertTriangle, RefreshCw } from 'lucide-react'

export default function ServerRemove() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchBase = async () => {
      try {
        const res = await http.get(`/api/node/${id}/base`)
        if (res && (res.status === 0 || res.data)) {
          setData(res.data)
        }
      } catch (err) {
        console.error('Fetch base error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBase()
  }, [id])

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

  const handleConfirmDelete = async () => {
    setRemoving(true)
    try {
      const res = await http.post(`/api/node/${id}/remove`)
      if (res && res.status === 0) {
        navigate('/servers')
      } else {
        alert(res?.message || '删除失败')
      }
    } catch (err) {
      alert('网络异常，删除失败')
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span>正在读取节点信息...</span>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      
      {/* 头部 */}
      <div className="flex items-center gap-3 border-b border-border/60 pb-5">
        <Link
          to={`/server/${id}`}
          className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-red-500 flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            移除监控节点
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            从系统库中注销并销毁所有关联历史监控数据
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
        
        {data?.installed ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold">
              <Terminal className="h-4 w-4" />
              <span>推荐操作：先在主机上执行卸载脚本清理 Cron 探针</span>
            </div>
            <div className="relative">
              <pre className="bg-zinc-950 dark:bg-zinc-950 bg-slate-900 border border-border rounded-lg p-3.5 font-mono text-xs text-zinc-300 overflow-x-auto">
                {data.uninstall_script || `wget --no-check-certificate -qO- ${window.location.origin}/client/uninstall/${id} | bash`}
              </pre>
              <button
                onClick={() => copyScript(data.uninstall_script || `wget --no-check-certificate -qO- ${window.location.origin}/client/uninstall/${id} | bash`)}
                className="absolute right-2.5 top-2.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-xs flex items-center gap-1 transition cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              若该服务器已被销毁或无法登录，可直接点击下方【确认删除】强制从控制台清除。
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-foreground">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <p>确定要删除该未安装的监控节点吗？此操作无法撤销。</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
          <Link
            to={`/server/${id}`}
            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition"
          >
            取消
          </Link>
          <button
            onClick={handleConfirmDelete}
            disabled={removing}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition shadow-sm disabled:opacity-50"
          >
            {removing ? '正在删除...' : '确定删除'}
          </button>
        </div>

      </div>

    </div>
  )
}
