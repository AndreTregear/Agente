'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Brain,
  Send,
  Mic,
  FileText,
  TrendingUp,
  Users,
  MessageSquare,
  Zap,
  BarChart3
} from 'lucide-react'

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your executive AI assistant. How can I help you today? I can assist with strategic planning, market analysis, team management, and much more.'
    }
  ])
  const [input, setInput] = useState('')

  const quickActions = [
    {
      icon: TrendingUp,
      title: 'Market Analysis',
      description: 'Analyze current market trends and opportunities',
      action: 'Provide a market analysis for our industry this quarter'
    },
    {
      icon: Users,
      title: 'Team Performance',
      description: 'Review team metrics and productivity insights',
      action: 'Generate a team performance report with actionable insights'
    },
    {
      icon: FileText,
      title: 'Strategic Brief',
      description: 'Create executive summary or strategic document',
      action: 'Help me create a strategic brief for the upcoming board meeting'
    },
    {
      icon: BarChart3,
      title: 'Financial Review',
      description: 'Analyze financial performance and forecasts',
      action: 'Analyze our Q4 financial performance and provide recommendations'
    }
  ]

  const handleSend = () => {
    if (!input.trim()) return

    setMessages([...messages, { role: 'user', content: input }])
    setInput('')

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I understand your request. Let me analyze the data and provide you with comprehensive insights. This would typically connect to our AI backend for real analysis.'
      }])
    }, 1000)
  }

  const handleQuickAction = (action: string) => {
    setMessages([...messages, { role: 'user', content: action }])

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m processing your request. In a production environment, this would generate detailed analysis based on your actual business data and AI models.'
      }])
    }, 1000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
          <p className="text-muted-foreground">
            Your intelligent business companion for strategic decision making
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="w-5 h-5" />
                <span>Executive AI Chat</span>
              </CardTitle>
              <CardDescription>
                Ask questions, request analyses, or get strategic insights
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-auto space-y-4 mb-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1 px-3 py-2 bg-muted/50 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <Button size="icon" onClick={handleSend}>
                  <Send className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Mic className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>Quick Actions</span>
              </CardTitle>
              <CardDescription>
                Common executive tasks powered by AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleQuickAction(action.action)}
                >
                  <div className="flex items-start space-x-3">
                    <action.icon className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium">{action.title}</h4>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Capabilities */}
          <Card>
            <CardHeader>
              <CardTitle>AI Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <MessageSquare className="w-4 h-4 text-green-500" />
                <span>Natural Language Processing</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span>Data Analysis & Insights</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <FileText className="w-4 h-4 text-purple-500" />
                <span>Document Generation</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <span>Predictive Analytics</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
