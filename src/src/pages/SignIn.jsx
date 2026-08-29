import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import http from '../lib/http'
import { Activity, Shield, Lock, User, AlertCircle, ArrowRight } from 'lucide-react'

export default function SignIn() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await http.post('/api/signin', form)
      // 兼容两种返回格式：{ status: 0, data: { token: '...' } } 或直接 { token: '...' }
      const token = res?.data?.token || res?.token
      if ((res?.status === 0 || !res?.status) && token) {
        localStorage.setItem('token', token)
        navigate('/servers')
      } else {
        setError(res?.message || '用户名或密码错误')
      }
    } catch (err) {
      setError('用户名或密码错误，或服务端连接超时')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 relative overflow-hidden">
      
      {/* 渐变背景光效 */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 space-y-6">
        
        {/* Logo 区域 */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-xl bg-primary text-primary-foreground items-center justify-center shadow-lg mb-2">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            ServerWatch
          </h1>
          <p className="text-xs text-muted-foreground">
            企业级分布式服务器实时监控平台
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 登录卡片 */}
        <form onSubmit={handleSubmit} className="bg-card border border-border/80 rounded-xl p-6 shadow-xl space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">用户名</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                placeholder="admin"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            {loading ? '正在登录...' : (
              <>
                <span>登录控制台</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

        </form>

        <p className="text-center text-[11px] text-muted-foreground">
          凭据保存在服务端 config.json 中
        </p>

      </div>

    </div>
  )
}
