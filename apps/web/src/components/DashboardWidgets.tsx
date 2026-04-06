'use client'

import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Zap,
  BarChart3
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

export function DashboardWidgets() {
  const kpis = [
    {
      title: 'Revenue',
      value: '.4M',
      change: '+12.3%',
      trend: 'up',
      period: 'vs last quarter'
    },
    {
      title: 'Active Projects',
      value: '24',
      change: '+3',
      trend: 'up',
      period: 'this month'
    },
    {
      title: 'Team Utilization',
      value: '87%',
      change: '-2.1%',
      trend: 'down',
      period: 'vs last week'
    },
    {
      title: 'Customer Satisfaction',
      value: '4.8/5',
      change: '+0.2',
      trend: 'up',
      period: 'this quarter'
    }
  ]

  const recentActivities = [
    { action: 'Q4 Board Meeting scheduled', time: '2 hours ago', type: 'calendar' },
    { action: 'Strategic Plan Review completed', time: '4 hours ago', type: 'completed' },
    { action: 'Budget approval pending', time: '6 hours ago', type: 'pending' },
    { action: 'New hire onboarding started', time: '1 day ago', type: 'team' },
  ]

  const upcomingTasks = [
    { task: 'Review Q1 financial reports', due: 'Today, 3:00 PM', priority: 'high' },
    { task: 'Investor call preparation', due: 'Tomorrow, 10:00 AM', priority: 'high' },
    { task: 'Team performance reviews', due: 'This week', priority: 'medium' },
    { task: 'Strategic planning session', due: 'Next week', priority: 'medium' },
  ]

  return (
    <div className="space-y-8">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <div key={index} className="glass-card glow-hover smooth-transition p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </h3>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                {kpi.trend === 'up' ? (
                  <ArrowUpRight className="w-4 h-4 text-green-400" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold gradient-text">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className={kpi.trend === 'up' ? 'text-green-400' : 'text-red-400'}>
                  {kpi.change}
                </span>{' '}
                {kpi.period}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activities */}
        <div className="glass-card glow-hover smooth-transition p-6">
          <div className="pb-6">
            <h3 className="text-xl font-semibold gradient-text">Recent Activities</h3>
            <p className="text-muted-foreground text-sm">Latest updates across your organization</p>
          </div>
          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start space-x-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 mt-2 animate-pulse"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-gradient w-full mt-6 micro-bounce">
            View All Activities
          </button>
        </div>

        {/* Upcoming Tasks */}
        <div className="glass-card glow-hover smooth-transition p-6">
          <div className="pb-6">
            <h3 className="text-xl font-semibold gradient-text">Upcoming Tasks</h3>
            <p className="text-muted-foreground text-sm">Your priority items requiring attention</p>
          </div>
          <div className="space-y-4">
            {upcomingTasks.map((task, index) => (
              <div key={index} className="flex items-start justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="w-2 h-2 rounded-full bg-orange-400 mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-white">{task.task}</p>
                    <p className="text-xs text-muted-foreground">{task.due}</p>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border ${
                  task.priority === 'high'
                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                    : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                }`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
          <button className="btn-gradient w-full mt-6 micro-bounce">
            View All Tasks
          </button>
        </div>
      </div>

      {/* AI Assistant Quick Actions */}
      <div className="glass-card glow-hover smooth-transition p-8">
        <div className="pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold gradient-text">AI Assistant</h3>
              <p className="text-muted-foreground text-sm">Quick actions powered by artificial intelligence</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button className="glass-card glow-hover smooth-transition p-6 h-24 flex flex-col items-center justify-center space-y-3 group">
            <Target className="w-6 h-6 text-purple-400 group-hover:text-cyan-400 transition-colors" />
            <span className="text-sm font-medium text-white">Generate Strategy Brief</span>
          </button>
          <button className="glass-card glow-hover smooth-transition p-6 h-24 flex flex-col items-center justify-center space-y-3 group">
            <BarChart3 className="w-6 h-6 text-purple-400 group-hover:text-cyan-400 transition-colors" />
            <span className="text-sm font-medium text-white">Analyze Market Trends</span>
          </button>
          <button className="glass-card glow-hover smooth-transition p-6 h-24 flex flex-col items-center justify-center space-y-3 group">
            <Users className="w-6 h-6 text-purple-400 group-hover:text-cyan-400 transition-colors" />
            <span className="text-sm font-medium text-white">Team Performance Review</span>
          </button>
        </div>
      </div>
    </div>
  )
}
