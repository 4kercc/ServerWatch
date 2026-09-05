import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import http from '../lib/http'
import { Server, ArrowLeft, Plus, Clock, Database, HardDrive, CheckCircle2, AlertCircle, DollarSign, Calendar } from 'lucide-react'

export default function ServerCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    label: '',
    price: '',
    expire_date: '',
    update_interval: 5,
    recordable: '1',
    record_interval: 60,
    record_limit: 200,
    remark: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.label.trim()) {
      setError('请输入服务器显示名称')
      return
    }

    setLoading(true)
    setError('')

    try {
      let expireTimestamp = 0
      if (form.expire_date) {
        expireTimestamp = new Date(form.expire_date).getTime()
      }

      const payload = {
        label: form.label.trim(),
        price: form.price.trim(),
        expire_time: expireTimestamp,
        update_interval: parseInt(form.update_interval) || 5,
        recordable: form.recordable === '1' ? 1 : 0,
        record_interval: parseInt(form.record_interval) || 60,
        record_limit: parseInt(form.record_limit) || 200,
        remark: form.remark
      }

      const res = await http.post('/api/node/create', payload)
      if (res && (res.status === 0 || res.data)) {
        const routeId = res.data?.index_id || res.data?.id || res.id
        navigate(`/server/${routeId}`)
      } else {
        setError(res?.message || '创建主机失败')
      }
    } catch (err) {
      setError('网络请求失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* 头部 */}
      <div className="flex items-center gap-3 border-b border-border/60 pb-5">
        <Link
          to="/servers"
          className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">添加监控节点</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            配置采集频率、续费周期与历史入库策略，生成自动化安装探针脚本
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
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
            placeholder="例如：Web-Production-01 / 香港核心网关"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
        </div>

        {/* 价格与到期时间配置 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              服务器价格 / 周期 (可选)
            </label>
            <input
              type="text"
              placeholder="例如：¥35/月 或 $12/年"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              到期时间 (提前 7天/3天 自动通知)
            </label>
            <input
              type="date"
              value={form.expire_date}
              onChange={(e) => setForm({ ...form, expire_date: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition"
            />
          </div>
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
            <option value="1">每 1 秒 (超高频实时)</option>
            <option value="2">每 2 秒 (高频)</option>
            <option value="5">每 5 秒 (推荐，平衡负载)</option>
            <option value="10">每 10 秒</option>
            <option value="30">每 30 秒</option>
            <option value="60">每 60 秒 (轻量节能)</option>
          </select>
          <p className="text-[11px] text-muted-foreground">客户端 Cron 探针以该时间间隔向服务端推送最新指标快照。</p>
        </div>

        {/* 是否开启历史记录 */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            历史监控数据入库与保留
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
              <span>开启时序入库</span>
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
              <span>仅保留实时快照 (不记录历史)</span>
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
              <p className="text-[11px] text-muted-foreground">每隔该秒数将一条快照归档到 SQLite 历史时序表中。</p>
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
                超出上限将自动 FIFO 滑动清理，当前预计保留时长：
                <strong className="text-foreground">
                  {Math.round(((form.record_limit || 200) * (form.record_interval || 60)) / 60)} 分钟
                </strong>
              </p>
            </div>
          </div>
        )}

        {/* 备注 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">节点备注信息 (可选)</label>
          <input
            type="text"
            placeholder="例如：主数据库集群、负载均衡器等"
            value={form.remark}
            onChange={(e) => setForm({ ...form, remark: e.target.value })}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
          <Link
            to="/servers"
            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {loading ? '正在创建...' : '确定添加'}
          </button>
        </div>

      </form>

    </div>
  )
}
