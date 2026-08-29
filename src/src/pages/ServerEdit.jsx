import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import http from '../lib/http'
import { Server, ArrowLeft, Save, Database, Clock, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function ServerEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    label: '',
    update_interval: 5,
    recordable: '1',
    record_interval: 60,
    record_limit: 200,
    remark: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchBase = async () => {
      try {
        const res = await http.get(`/api/node/${id}/base`)
        if (res && (res.status === 0 || res.data)) {
          const d = res.data || {}
          setForm({
            label: d.label || '',
            update_interval: d.update_interval || 5,
            recordable: d.recordable ? '1' : '0',
            record_interval: d.record_interval || 60,
            record_limit: d.record_limit || 200,
            remark: d.remark || ''
          })
        }
      } catch (err) {
        setError('获取节点基础配置失败')
      } finally {
        setLoading(false)
      }
    }
    fetchBase()
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.label.trim()) {
      setError('显示名称不能为空')
      return
    }

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const payload = {
        label: form.label.trim(),
        update_interval: parseInt(form.update_interval) || 5,
        recordable: form.recordable === '1' ? 1 : 0,
        record_interval: parseInt(form.record_interval) || 60,
        record_limit: parseInt(form.record_limit) || 200,
        remark: form.remark
      }

      const res = await http.post(`/api/node/${id}`, payload)
      if (res && res.status === 0) {
        setSuccess(true)
        setTimeout(() => {
          navigate(`/server/${id}`)
        }, 1200)
      } else {
        setError(res?.message || '保存配置失败')
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
        <span>正在读取节点配置...</span>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* 头部 */}
      <div className="flex items-center gap-3 border-b border-border/60 pb-5">
        <Link
          to={`/server/${id}`}
          className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">修改节点配置</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            更新主机名称、采集频率与历史入库策略
          </p>
        </div>
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
          <span>配置已成功更新，正在返回详情页...</span>
        </div>
      )}

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
        
        {/* 显示名称 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            主机显示名称 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
        </div>

        {/* 探针采集频率 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            数据采集脚本执行间隔
          </label>
          <select
            value={form.update_interval}
            onChange={(e) => setForm({ ...form, update_interval: parseInt(e.target.value) })}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
          >
            <option value="1">每 1 秒 (超高频)</option>
            <option value="2">每 2 秒 (高频)</option>
            <option value="5">每 5 秒 (推荐)</option>
            <option value="10">每 10 秒</option>
            <option value="30">每 30 秒</option>
            <option value="60">每 60 秒</option>
          </select>
        </div>

        {/* 是否开启历史记录 */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            保存历史记录 (设置为“否”时将清除既往历史)
          </label>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="recordable"
                value="1"
                checked={form.recordable === '1'}
                onChange={(e) => setForm({ ...form, recordable: e.target.value })}
                className="text-primary focus:ring-primary"
              />
              <span>是 (记录历史时序)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="recordable"
                value="0"
                checked={form.recordable === '0'}
                onChange={(e) => setForm({ ...form, recordable: e.target.value })}
                className="text-primary focus:ring-primary"
              />
              <span>否 (不记录)</span>
            </label>
          </div>
        </div>

        {/* 历史记录入库细节 */}
        {form.recordable === '1' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-border/60 text-xs">
            <div className="space-y-2">
              <label className="font-medium text-foreground">入库采样间隔 (秒)</label>
              <input
                type="number"
                min="5"
                max="3600"
                value={form.record_interval}
                onChange={(e) => setForm({ ...form, record_interval: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="font-medium text-foreground">历史记录条数上限</label>
              <input
                type="number"
                min="50"
                max="10000"
                value={form.record_limit}
                onChange={(e) => setForm({ ...form, record_limit: parseInt(e.target.value) || 200 })}
                className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                预计可回溯历史时长：
                <strong className="text-foreground">
                  {Math.round(((form.record_limit || 200) * (form.record_interval || 60)) / 60)} 分钟
                </strong>
              </p>
            </div>
          </div>
        )}

        {/* 备注 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">节点备注 (可选)</label>
          <input
            type="text"
            value={form.remark}
            onChange={(e) => setForm({ ...form, remark: e.target.value })}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
          <Link
            to={`/server/${id}`}
            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? '正在保存...' : '保存更改'}
          </button>
        </div>

      </form>

    </div>
  )
}
