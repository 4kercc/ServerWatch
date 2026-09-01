import React, { useState, useEffect } from 'react'
import http from '../lib/http'
import {
  Settings, Bell, Save, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff,
  Send, Mail, ShieldAlert, Sliders, Database, Globe2, Layers, Check, Lock
} from 'lucide-react'

export default function Setting() {
  const [activeTab, setActiveTab] = useState('alert') // 默认进入用户重点配置的'上下线告警通知'
  const [form, setForm] = useState({
    username: '',
    password: '',
    port: 51221,
    guest_mode: true,
    alert: {
      fail_count: 3,
      offline_duration: 100,
      silence_duration: 1440,
      tg_enabled: false,
      tg_token: '',
      tg_chat_id: '',
      smtp_enabled: false,
      smtp_host: '',
      smtp_port: 465,
      smtp_user: '',
      smtp_pass: '',
      smtp_to: '',
      has_smtp_pass: false
    }
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [testingTg, setTestingTg] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3500)
  }

  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const res = await http.get('/api/setting')
        if (res && res.data) {
          const d = res.data
          const a = d.alert || {}
          setForm({
            username: d.username || 'admin',
            password: d.password || '',
            port: d.port || 51221,
            guest_mode: d.guest_mode !== false,
            alert: {
              fail_count: a.fail_count ?? 3,
              offline_duration: a.offline_duration ?? 100,
              silence_duration: a.silence_duration ?? 1440,
              tg_enabled: Boolean(a.tg_enabled),
              tg_token: a.tg_token || '',
              tg_chat_id: a.tg_chat_id || '',
              smtp_enabled: Boolean(a.smtp_enabled),
              smtp_host: a.smtp_host || '',
              smtp_port: a.smtp_port ?? 465,
              smtp_user: a.smtp_user || '',
              smtp_pass: '',
              smtp_to: a.smtp_to || '',
              has_smtp_pass: Boolean(a.has_smtp_pass)
            }
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
    if (e) e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await http.post('/api/setting', {
        username: form.username,
        password: form.password,
        port: parseInt(form.port) || 51221,
        guest_mode: form.guest_mode,
        alert: form.alert
      })

      if (res && res.status === 0) {
        showSuccess('系统配置与告警规则已成功保存并即时生效！')
      } else {
        setError(res?.message || '保存设置失败')
      }
    } catch (err) {
      setError('网络异常，保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 发送 Telegram 测试消息
  const handleTestTg = async () => {
    setTestingTg(true)
    setError('')
    try {
      const res = await http.post('/api/notify/test-tg', {
        token: form.alert.tg_token,
        chat_id: form.alert.tg_chat_id
      })
      if (res && res.status === 0) {
        showSuccess(res.message || 'Telegram 测试消息发送成功！')
      } else {
        setError(res?.message || 'Telegram 发送失败')
      }
    } catch (err) {
      setError(err?.response?.data?.message || '网络连接失败，无法发送测试消息')
    } finally {
      setTestingTg(false)
    }
  }

  // 发送 SMTP 测试邮件
  const handleTestSmtp = async () => {
    setTestingSmtp(true)
    setError('')
    try {
      const res = await http.post('/api/notify/test-email', {
        host: form.alert.smtp_host,
        port: form.alert.smtp_port,
        user: form.alert.smtp_user,
        pass: form.alert.smtp_pass,
        to: form.alert.smtp_to
      })
      if (res && res.status === 0) {
        showSuccess(res.message || '测试邮件已发送！请查收')
      } else {
        setError(res?.message || 'SMTP 发送失败')
      }
    } catch (err) {
      setError(err?.response?.data?.message || '邮件发送异常，请检查配置')
    } finally {
      setTestingSmtp(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span>正在读取系统配置与告警参数...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* 顶部通知条 */}
      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2 animate-in fade-in-0">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2 animate-in fade-in-0">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* 左右分栏布局 (对齐图片设计) */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 items-start">
        
        {/* 左侧垂直导航栏 */}
        <div className="bg-card border border-border/80 rounded-2xl p-2.5 space-y-1 shadow-sm">
          
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl transition text-left cursor-pointer ${
              activeTab === 'general'
                ? 'bg-muted text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>常规与安全</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('alert')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl transition text-left cursor-pointer ${
              activeTab === 'alert'
                ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 font-semibold shadow-xs'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>上下线告警通知</span>
          </button>

          <div className="h-[1px] bg-border/40 my-1"></div>

          <button
            type="button"
            disabled
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium rounded-xl text-muted-foreground/40 cursor-not-allowed text-left"
            title="后续演进功能"
          >
            <Database className="h-4 w-4" />
            <span>数据库远端备份</span>
          </button>

          <button
            type="button"
            disabled
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium rounded-xl text-muted-foreground/40 cursor-not-allowed text-left"
            title="后续演进功能"
          >
            <Globe2 className="h-4 w-4" />
            <span>SOCKS5 代理跳板</span>
          </button>

          <button
            type="button"
            disabled
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium rounded-xl text-muted-foreground/40 cursor-not-allowed text-left"
            title="后续演进功能"
          >
            <Layers className="h-4 w-4" />
            <span>分组与快捷命令</span>
          </button>
        </div>

        {/* 右侧主内容区 */}
        <div className="md:col-span-3 lg:col-span-4 space-y-5">
          
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* ================= 选项卡 1：上下线告警通知 (图表重点) ================= */}
            {activeTab === 'alert' && (
              <div className="space-y-5">
                
                {/* 页面主标题区 */}
                <div className="border-b border-border/60 pb-4">
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    机器上线 / 下线告警通知
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    当受控服务器持续断线或恢复连通时，通过 Telegram 机器人或 SMTP 邮件触发即时通知
                  </p>
                </div>

                {/* 1. 告警防抖与判定规则卡片 */}
                <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-rose-500" />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                      告警防抖与判定规则
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 连续检测失败次数 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        连续检测失败次数阈值
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={form.alert.fail_count}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, fail_count: parseInt(e.target.value) || 1 }
                          })}
                          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                        />
                        <span className="absolute right-3 text-xs text-muted-foreground font-medium pointer-events-none">次</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">如 3 次 (连续失败达标才触发)</p>
                    </div>

                    {/* 累计断线时长阈值 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        累计断线时长阈值
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="10"
                          max="3600"
                          value={form.alert.offline_duration}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, offline_duration: parseInt(e.target.value) || 10 }
                          })}
                          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                        />
                        <span className="absolute right-3 text-xs text-muted-foreground font-medium pointer-events-none">秒</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">如 100 秒 (持续离线超此时长)</p>
                    </div>

                    {/* 告警静默/防刷屏冷却 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        告警静默 / 防刷屏冷却
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="1"
                          max="10080"
                          value={form.alert.silence_duration}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, silence_duration: parseInt(e.target.value) || 1 }
                          })}
                          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary pr-12"
                        />
                        <span className="absolute right-3 text-xs text-muted-foreground font-medium pointer-events-none">分钟</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">同一主机未恢复前不重复刷屏</p>
                    </div>
                  </div>
                </div>

                {/* 2. Telegram 机器人通知卡片 */}
                <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-sky-500" />
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                        Telegram 机器人通知
                      </h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTestTg}
                        disabled={testingTg}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="h-3 w-3" />
                        <span>{testingTg ? '正在测试...' : '发送测试消息'}</span>
                      </button>

                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={form.alert.tg_enabled}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, tg_enabled: e.target.checked }
                          })}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <span>开启告警</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Bot Token</label>
                      <input
                        type="text"
                        placeholder="例如: 6062061805:AAHxxxxxxxxxxxxxxxxxxxx"
                        value={form.alert.tg_token}
                        onChange={(e) => setForm({
                          ...form,
                          alert: { ...form.alert, tg_token: e.target.value }
                        })}
                        className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary transition"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Chat ID (频道 / 群组 / 个人 ID)</label>
                      <input
                        type="text"
                        placeholder="例如: -100123456789 或 12345678"
                        value={form.alert.tg_chat_id}
                        onChange={(e) => setForm({
                          ...form,
                          alert: { ...form.alert, tg_chat_id: e.target.value }
                        })}
                        className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary transition"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. SMTP 邮件通知卡片 */}
                <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-emerald-500" />
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                        SMTP 邮件通知
                      </h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTestSmtp}
                        disabled={testingSmtp}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-50 cursor-pointer"
                      >
                        <Mail className="h-3 w-3" />
                        <span>{testingSmtp ? '正在投递...' : '发送测试邮件'}</span>
                      </button>

                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={form.alert.smtp_enabled}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, smtp_enabled: e.target.checked }
                          })}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <span>开启告警</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    {/* 主机 / 端口 / 发件账号 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">SMTP 主机</label>
                        <input
                          type="text"
                          placeholder="smtp.qq.com / smtp.office365.com"
                          value={form.alert.smtp_host}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, smtp_host: e.target.value }
                          })}
                          className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">SMTP 端口 (如 465 / 587)</label>
                        <input
                          type="number"
                          value={form.alert.smtp_port}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, smtp_port: parseInt(e.target.value) || 465 }
                          })}
                          className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary transition"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">发件账号 / 用户名</label>
                        <input
                          type="text"
                          placeholder="admin@example.com"
                          value={form.alert.smtp_user}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, smtp_user: e.target.value }
                          })}
                          className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
                        />
                      </div>
                    </div>

                    {/* 密码 / 接收邮箱 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">SMTP 密码 / 授权码</label>
                        <input
                          type="password"
                          placeholder={form.alert.has_smtp_pass ? "留空则不修改已有授权码" : "请输入 SMTP 授权码或密码"}
                          value={form.alert.smtp_pass}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, smtp_pass: e.target.value }
                          })}
                          className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">接收告警邮箱 (逗号分隔多个)</label>
                        <input
                          type="text"
                          placeholder="ops@company.com, admin@qq.com"
                          value={form.alert.smtp_to}
                          onChange={(e) => setForm({
                            ...form,
                            alert: { ...form.alert, smtp_to: e.target.value }
                          })}
                          className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ================= 选项卡 2：常规与安全 ================= */}
            {activeTab === 'general' && (
              <div className="space-y-5">
                <div className="border-b border-border/60 pb-4">
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    常规与系统安全配置
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    修改 Web 控制台管理员凭据、访客模式与服务监听端口
                  </p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                  
                  {/* 访客模式 */}
                  <div className="bg-muted/30 p-4 rounded-xl border border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {form.guest_mode ? (
                        <Eye className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-amber-500" />
                      )}
                      <div>
                        <span className="text-xs font-semibold text-foreground block">
                          公开访客模式 (Guest Mode)
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {form.guest_mode
                            ? '开启：未登录访客可直接浏览脱敏仪表盘与节点监控'
                            : '关闭：禁止未授权访问，打开系统任意页面将自动跳转登录'}
                        </span>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={form.guest_mode}
                        onChange={(e) => setForm({ ...form, guest_mode: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* 用户名 */}
                  <div className="space-y-1.5">
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">管理员安全密码</label>
                    <input
                      type="password"
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
                    />
                  </div>

                  {/* 端口 */}
                  <div className="space-y-1.5">
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

                </div>
              </div>
            )}

            {/* 底部保存按钮 */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? '正在保存...' : '保存所有设置'}</span>
              </button>
            </div>

          </form>

        </div>

      </div>

    </div>
  )
}
