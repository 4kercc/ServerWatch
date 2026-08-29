import React, { useState, useEffect } from 'react'
import http from '../lib/http'
import { Settings, Save, Shield, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

export default function Setting() {
  const [form, setForm] = useState({
    username: '',
    password: '',
    port: 51221
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const res = await http.get('/api/setting')
        if (res && res.data) {
          setForm({
            username: res.data.username || 'admin',
            password: res.data.password || '',
            port: res.data.port || 51221
          })
        }
      } catch (err) {
        setError('获取系统设置失败')
      } finally {
        setLoading(false)
      }
    }
    fetchSetting()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const res = await http.post('/api/setting', {
        username: form.username,
        password: form.password,
        port: parseInt(form.port) || 51221
      })

      if (res && res.status === 0) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(res?.message || '保存设置失败')
      }
    } catch (err) {
      setError('网络异常，保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span>正在读取系统配置...</span>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      
      {/* 头部 */}
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          系统安全与运行设置
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          修改 Web 控制台登录凭据与服务端口
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>系统配置已成功更新并生效！</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-5 shadow-sm">
        
        {/* 用户名 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">管理员用户名</label>
          <input
            type="text"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
        </div>

        {/* 密码 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">管理员密码</label>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
        </div>

        {/* 端口 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">Web 监听端口</label>
          <input
            type="number"
            required
            min="1024"
            max="65535"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 51221 })}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
          <p className="text-[11px] text-muted-foreground">更改端口后服务端监听器将自动重启绑定新端口。</p>
        </div>

        {/* 提交按钮 */}
        <div className="pt-4 border-t border-border/60 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? '正在保存...' : '保���配置'}
          </button>
        </div>

      </form>

    </div>
  )
}
