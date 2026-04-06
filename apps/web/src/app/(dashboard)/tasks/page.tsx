'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Filter,
  Search,
  CheckCircle,
  Circle,
  Clock,
  Flag,
  User,
  Calendar
} from 'lucide-react'

interface Task {
  id: number
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'todo' | 'in-progress' | 'completed'
  assignee: string
  dueDate: string
  category: string
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: 'Review Q1 Financial Reports',
      description: 'Comprehensive review of quarterly financial performance and variance analysis',
      priority: 'high',
      status: 'todo',
      assignee: 'CFO Team',
      dueDate: '2024-04-06',
      category: 'Finance'
    },
    {
      id: 2,
      title: 'Prepare Board Presentation',
      description: 'Strategic overview and key metrics presentation for board meeting',
      priority: 'high',
      status: 'in-progress',
      assignee: 'Strategy Team',
      dueDate: '2024-04-08',
      category: 'Strategy'
    },
    {
      id: 3,
      title: 'Team Performance Reviews',
      description: 'Quarterly performance evaluation for department heads',
      priority: 'medium',
      status: 'todo',
      assignee: 'HR Team',
      dueDate: '2024-04-10',
      category: 'HR'
    },
    {
      id: 4,
      title: 'Market Expansion Analysis',
      description: 'Research and analysis for potential new market opportunities',
      priority: 'medium',
      status: 'in-progress',
      assignee: 'Business Dev',
      dueDate: '2024-04-15',
      category: 'Business Development'
    },
    {
      id: 5,
      title: 'Vendor Contract Renewals',
      description: 'Review and negotiate renewal terms for key vendor contracts',
      priority: 'low',
      status: 'completed',
      assignee: 'Procurement',
      dueDate: '2024-04-01',
      category: 'Operations'
    }
  ])

  const [filter, setFilter] = useState<'all' | 'todo' | 'in-progress' | 'completed'>('all')

  const filteredTasks = tasks.filter(task => filter === 'all' || task.status === filter)

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200'
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'in-progress': return <Clock className="w-5 h-5 text-blue-600" />
      default: return <Circle className="w-5 h-5 text-gray-400" />
    }
  }

  const toggleTaskStatus = (taskId: number) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        const statusOrder = ['todo', 'in-progress', 'completed']
        const currentIndex = statusOrder.indexOf(task.status)
        const nextIndex = (currentIndex + 1) % statusOrder.length
        return { ...task, status: statusOrder[nextIndex] as Task['status'] }
      }
      return task
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground">
            Organize and track your executive priorities and team assignments
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <Circle className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'in-progress').length}</p>
              </div>
              <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'completed').length}</p>
              </div>
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.priority === 'high').length}</p>
              </div>
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <Flag className="w-4 h-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Search tasks..."
            className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div className="flex space-x-2">
          {(['all', 'todo', 'in-progress', 'completed'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
            </Button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <button
                    onClick={() => toggleTaskStatus(task.id)}
                    className="mt-1"
                  >
                    {getStatusIcon(task.status)}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold">{task.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>

                    <p className="text-muted-foreground mb-3">{task.description}</p>

                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <User className="w-4 h-4" />
                        <span>{task.assignee}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                      <span className="px-2 py-1 bg-muted rounded text-xs">
                        {task.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
