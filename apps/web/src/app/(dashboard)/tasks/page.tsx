'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  CheckCircle,
  Circle,
  Clock,
  Flag,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react'

// ── Types (match API response) ──────────────────────────────────────────

interface Task {
  id: string
  description: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  template?: string
  progress?: string
  progressHistory?: string[]
  result?: string
  error?: string
  elapsed: string
  startedAt: number
  completedAt?: number
  blockedBy?: string
}

interface TaskSummary {
  total: number
  running: number
  pending: number
  completed: number
  failed: number
}

interface Template {
  id: string
  description: string
  priority: string
}

// ── API helpers ─────────────────────────────────────────────────────────

async function fetchTasks(status?: string): Promise<{ tasks: Task[]; summary: TaskSummary }> {
  const params = status && status !== 'all' ? `?status=${status}` : ''
  const res = await fetch(`/api/tasks${params}`)
  if (res.status === 402) throw new Error('subscription_required')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch('/api/tasks?action=templates')
  if (!res.ok) return []
  const data = await res.json()
  return data.templates || []
}

async function createTask(body: {
  action: 'create'
  description: string
  priority?: string
  template?: string
}): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.task
}

async function cancelTaskAPI(taskId: string): Promise<void> {
  await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', taskId }),
  })
}

// ── Component ───────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [summary, setSummary] = useState<TaskSummary>({ total: 0, running: 0, pending: 0, completed: 0, failed: 0 })
  const [templates, setTemplates] = useState<Template[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  // Create form state
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<string>('normal')
  const [newTemplate, setNewTemplate] = useState<string>('')
  const [creating, setCreating] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasks(filter)
      setTasks(data.tasks)
      setSummary(data.summary)
      setError(null)
    } catch (e: any) {
      if (e.message === 'subscription_required') {
        setError('Suscripcion requerida para acceder a las tareas.')
      } else {
        setError('Error al cargar tareas')
      }
    } finally {
      setLoading(false)
    }
  }, [filter])

  // Initial load + templates
  useEffect(() => {
    loadTasks()
    fetchTemplates().then(setTemplates)
  }, [loadTasks])

  // Poll every 3s when there are running/pending tasks
  useEffect(() => {
    const hasActive = tasks.some(t => t.status === 'running' || t.status === 'pending')
    if (hasActive) {
      pollRef.current = setInterval(loadTasks, 3000)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [tasks, loadTasks])

  const handleCreate = async () => {
    if (!newDesc.trim() && !newTemplate) return
    setCreating(true)
    try {
      await createTask({
        action: 'create',
        description: newDesc.trim() || undefined as any,
        priority: newPriority,
        template: newTemplate || undefined,
      })
      setNewDesc('')
      setNewTemplate('')
      setNewPriority('normal')
      setShowCreate(false)
      await loadTasks()
    } catch {
      // ignore
    } finally {
      setCreating(false)
    }
  }

  const handleCancel = async (taskId: string) => {
    await cancelTaskAPI(taskId)
    await loadTasks()
  }

  const priorityConfig: Record<string, { label: string; color: string; icon: typeof Flag }> = {
    urgent: { label: 'Urgente', color: 'text-red-400 bg-red-500/20', icon: Zap },
    high: { label: 'Alta', color: 'text-orange-400 bg-orange-500/20', icon: AlertTriangle },
    normal: { label: 'Normal', color: 'text-blue-400 bg-blue-500/20', icon: Flag },
    low: { label: 'Baja', color: 'text-gray-400 bg-gray-500/20', icon: Flag },
  }

  const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    pending: { label: 'Pendiente', icon: <Clock className="w-4 h-4" />, color: 'text-yellow-400' },
    running: { label: 'Ejecutando', icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-blue-400' },
    completed: { label: 'Completada', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400' },
    failed: { label: 'Fallida', icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
    cancelled: { label: 'Cancelada', icon: <X className="w-4 h-4" />, color: 'text-gray-400' },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <XCircle className="w-12 h-12 text-red-400" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => { setError(null); setLoading(true); loadTasks() }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion de Tareas</h1>
          <p className="text-muted-foreground">
            Tareas de IA ejecutadas por tus agentes especializados
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="border-primary/30">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-lg">Crear nueva tarea</h3>

            {/* Template selector */}
            {templates.length > 0 && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Plantilla (opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setNewTemplate(newTemplate === t.id ? '' : t.id)
                        if (newTemplate !== t.id) setNewDesc(t.description)
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        newTemplate === t.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 border-border hover:bg-muted'
                      }`}
                    >
                      {t.description.slice(0, 40)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Descripcion</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Describe la tarea que quieres que el agente ejecute..."
                className="w-full px-3 py-2 bg-muted/50 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Prioridad</label>
              <div className="flex gap-2">
                {(['urgent', 'high', 'normal', 'low'] as const).map(p => {
                  const cfg = priorityConfig[p]
                  return (
                    <button
                      key={p}
                      onClick={() => setNewPriority(p)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        newPriority === p
                          ? `${cfg.color} border-current`
                          : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} disabled={creating || (!newDesc.trim() && !newTemplate)}>
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Ejecutar tarea
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'total', label: 'Total', value: summary.total, icon: <Circle className="w-4 h-4 text-blue-400" />, bg: 'bg-blue-500/10' },
          { key: 'running', label: 'Ejecutando', value: summary.running, icon: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />, bg: 'bg-blue-500/10' },
          { key: 'pending', label: 'Pendientes', value: summary.pending, icon: <Clock className="w-4 h-4 text-yellow-400" />, bg: 'bg-yellow-500/10' },
          { key: 'completed', label: 'Completadas', value: summary.completed, icon: <CheckCircle className="w-4 h-4 text-green-400" />, bg: 'bg-green-500/10' },
          { key: 'failed', label: 'Fallidas', value: summary.failed, icon: <XCircle className="w-4 h-4 text-red-400" />, bg: 'bg-red-500/10' },
        ].map(card => (
          <Card key={card.key}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-xl font-bold">{card.value}</p>
                </div>
                <div className={`w-8 h-8 ${card.bg} rounded-full flex items-center justify-center`}>
                  {card.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'running', label: 'Ejecutando' },
          { key: 'pending', label: 'Pendientes' },
          { key: 'completed', label: 'Completadas' },
          { key: 'failed', label: 'Fallidas' },
        ].map(f => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Circle className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg">No hay tareas</p>
          <p className="text-sm">Crea una tarea para que tus agentes la ejecuten</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const status = statusConfig[task.status] || statusConfig.pending
            const priority = priorityConfig[task.priority] || priorityConfig.normal
            const PriorityIcon = priority.icon
            const isExpanded = expandedTask === task.id

            return (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Main row */}
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className={`mt-0.5 ${status.color}`}>
                      {status.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-sm">{task.description}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${priority.color}`}>
                          <PriorityIcon className="w-3 h-3 inline mr-0.5" />
                          {priority.label}
                        </span>
                        {task.template && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                            {task.template}
                          </span>
                        )}
                      </div>

                      {/* Progress indicator for running tasks */}
                      {task.status === 'running' && task.progress && (
                        <p className="text-xs text-blue-400 mt-1">{task.progress}</p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{status.label}</span>
                        <span>{task.elapsed}</span>
                        <span className="font-mono text-[10px]">{task.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {(task.status === 'running' || task.status === 'pending') && (
                        <Button variant="ghost" size="sm" onClick={() => handleCancel(task.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-border/50 space-y-3">
                      {/* Progress history */}
                      {task.progressHistory && task.progressHistory.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Progreso</p>
                          <div className="space-y-1">
                            {task.progressHistory.map((step, i) => (
                              <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-border">
                                {step}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Result */}
                      {task.result && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Resultado</p>
                          <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {task.result}
                          </pre>
                        </div>
                      )}

                      {/* Error */}
                      {task.error && (
                        <div>
                          <p className="text-xs font-medium text-red-400 mb-1">Error</p>
                          <pre className="text-xs bg-red-500/10 rounded-lg p-3 text-red-300 overflow-x-auto">
                            {task.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
