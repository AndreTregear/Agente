'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Target,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  Lightbulb,
  Globe,
  Zap,
  ArrowUpRight,
  CheckCircle
} from 'lucide-react'

export default function StrategyPage() {
  const strategicPillars = [
    {
      title: 'Market Expansion',
      description: 'Enter 3 new markets by end of 2024',
      progress: 65,
      icon: Globe,
      status: 'On Track',
      initiatives: ['Latin America Research', 'Partnership Development', 'Regulatory Compliance']
    },
    {
      title: 'Digital Transformation',
      description: 'Modernize all core business processes',
      progress: 78,
      icon: Zap,
      status: 'Ahead',
      initiatives: ['Cloud Migration', 'AI Implementation', 'Process Automation']
    },
    {
      title: 'Customer Experience',
      description: 'Achieve 95% customer satisfaction',
      progress: 42,
      icon: Users,
      status: 'Behind',
      initiatives: ['Service Platform Upgrade', 'Training Programs', 'Feedback Systems']
    },
    {
      title: 'Innovation Pipeline',
      description: 'Launch 5 new products/features',
      progress: 55,
      icon: Lightbulb,
      status: 'On Track',
      initiatives: ['R&D Investment', 'Innovation Labs', 'Partnership Program']
    }
  ]

  const kpiMetrics = [
    { label: 'Revenue Growth', value: '+23%', target: '+25%', status: 'good' },
    { label: 'Market Share', value: '18.5%', target: '20%', status: 'warning' },
    { label: 'Customer Retention', value: '94%', target: '95%', status: 'good' },
    { label: 'EBITDA Margin', value: '28%', target: '30%', status: 'warning' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Strategic Planning</h1>
          <p className="text-muted-foreground">
            Monitor strategic initiatives, track progress, and drive business outcomes
          </p>
        </div>
        <Button>
          <Target className="w-4 h-4 mr-2" />
          Update Strategy
        </Button>
      </div>

      {/* Strategic Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {kpiMetrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">Target: {metric.target}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  metric.status === 'good' ? 'bg-green-500' : 'bg-yellow-500'
                }`}></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Strategic Pillars */}
      <Card>
        <CardHeader>
          <CardTitle>Strategic Pillars - 2024</CardTitle>
          <CardDescription>Key focus areas driving our business forward</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {strategicPillars.map((pillar, index) => (
              <div key={index} className="border rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <pillar.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{pillar.title}</h3>
                      <p className="text-sm text-muted-foreground">{pillar.description}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    pillar.status === 'On Track' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    pillar.status === 'Ahead' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {pillar.status}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>{pillar.progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${pillar.progress}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Key Initiatives:</p>
                  <ul className="space-y-1">
                    {pillar.initiatives.map((initiative, i) => (
                      <li key={i} className="flex items-center space-x-2 text-sm">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span>{initiative}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Market Analysis</CardTitle>
            <CardDescription>Current market position and competitive landscape</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                <span className="text-sm font-medium">Market Position</span>
                <span className="text-sm font-bold">#3 Globally</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                <span className="text-sm font-medium">Competitive Advantage</span>
                <span className="text-sm font-bold text-green-600">Strong</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                <span className="text-sm font-medium">Market Growth Rate</span>
                <span className="text-sm font-bold">+15% YoY</span>
              </div>
              <Button variant="outline" className="w-full">
                <BarChart3 className="w-4 h-4 mr-2" />
                View Full Analysis
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Strategic Initiatives */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Initiatives</CardTitle>
            <CardDescription>Next quarter strategic priorities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-3 border rounded">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                <div>
                  <h4 className="font-medium">AI Integration Project</h4>
                  <p className="text-sm text-muted-foreground">Q2 2024 &bull; Technology</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                <div>
                  <h4 className="font-medium">European Market Entry</h4>
                  <p className="text-sm text-muted-foreground">Q2 2024 &bull; Growth</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded">
                <div className="w-2 h-2 rounded-full bg-orange-500 mt-2"></div>
                <div>
                  <h4 className="font-medium">Sustainability Program</h4>
                  <p className="text-sm text-muted-foreground">Q3 2024 &bull; Operations</p>
                </div>
              </div>
              <Button variant="outline" className="w-full">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                View All Initiatives
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
