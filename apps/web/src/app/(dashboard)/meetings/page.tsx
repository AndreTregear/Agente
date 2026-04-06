'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Calendar,
  Clock,
  Users,
  Video,
  FileText,
  ChevronRight,
  MapPin,
  Mic
} from 'lucide-react'

interface Meeting {
  id: number
  title: string
  description: string
  date: string
  time: string
  duration: string
  attendees: string[]
  location: string
  type: 'in-person' | 'virtual' | 'hybrid'
  status: 'upcoming' | 'ongoing' | 'completed'
  hasRecording?: boolean
  hasTranscript?: boolean
  agenda?: string[]
  summary?: string
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([
    {
      id: 1,
      title: 'Board of Directors Meeting',
      description: 'Quarterly board meeting to review financial performance and strategic initiatives',
      date: '2024-04-08',
      time: '10:00 AM',
      duration: '2 hours',
      attendees: ['Board Members', 'CEO', 'CFO', 'COO'],
      location: 'Executive Conference Room',
      type: 'in-person',
      status: 'upcoming',
      agenda: [
        'Financial Performance Review',
        'Strategic Initiative Updates',
        'Market Expansion Discussion',
        'Budget Approval for Q2'
      ]
    },
    {
      id: 2,
      title: 'Leadership Team Sync',
      description: 'Weekly alignment meeting with executive team',
      date: '2024-04-05',
      time: '9:00 AM',
      duration: '1 hour',
      attendees: ['CEO', 'CTO', 'CFO', 'VP Marketing', 'VP Sales'],
      location: 'Virtual',
      type: 'virtual',
      status: 'completed',
      hasRecording: true,
      hasTranscript: true,
      summary: 'Discussed Q1 results, upcoming product launches, and resource allocation for Q2. Key decisions made on marketing budget and engineering priorities.'
    },
    {
      id: 3,
      title: 'Investor Relations Call',
      description: 'Monthly update call with key investors and stakeholders',
      date: '2024-04-10',
      time: '2:00 PM',
      duration: '90 minutes',
      attendees: ['CEO', 'CFO', 'Investors', 'IR Team'],
      location: 'Virtual',
      type: 'virtual',
      status: 'upcoming',
      agenda: [
        'Company Performance Update',
        'Market Position Analysis',
        'Future Outlook & Roadmap',
        'Q&A Session'
      ]
    },
    {
      id: 4,
      title: 'Strategic Planning Workshop',
      description: '2025 strategic planning session with department heads',
      date: '2024-04-15',
      time: '1:00 PM',
      duration: '4 hours',
      attendees: ['Executive Team', 'Department Heads', 'Strategy Consultants'],
      location: 'Conference Center',
      type: 'in-person',
      status: 'upcoming',
      agenda: [
        'Market Analysis Review',
        'Competitive Landscape',
        '2025 Goal Setting',
        'Resource Planning',
        'Implementation Roadmap'
      ]
    }
  ])

  const upcomingMeetings = meetings.filter(m => m.status === 'upcoming')
  const todaysMeetings = meetings.filter(m =>
    m.date === '2024-04-05' && m.status !== 'completed'
  )

  const getMeetingTypeIcon = (type: string) => {
    switch (type) {
      case 'virtual': return <Video className="w-4 h-4 text-blue-600" />
      case 'in-person': return <MapPin className="w-4 h-4 text-green-600" />
      case 'hybrid': return <Users className="w-4 h-4 text-purple-600" />
      default: return <Calendar className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meeting Center</h1>
          <p className="text-muted-foreground">
            Manage your meetings, access recordings, and view summaries
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Schedule Meeting
        </Button>
      </div>

      {/* Today's Meetings */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Schedule</CardTitle>
          <CardDescription>Your meetings for today</CardDescription>
        </CardHeader>
        <CardContent>
          {todaysMeetings.length > 0 ? (
            <div className="space-y-4">
              {todaysMeetings.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    {getMeetingTypeIcon(meeting.type)}
                    <div>
                      <h4 className="font-medium">{meeting.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {meeting.time} &bull; {meeting.duration}
                      </p>
                    </div>
                  </div>
                  <Button size="sm">
                    Join
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              No meetings scheduled for today
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Meetings */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Meetings</CardTitle>
              <CardDescription>Your scheduled meetings and appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-semibold">{meeting.title}</h4>
                          {getMeetingTypeIcon(meeting.type)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {meeting.description}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(meeting.date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{meeting.time}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>{meeting.attendees.length} attendees</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    {meeting.agenda && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Agenda:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {meeting.agenda.slice(0, 3).map((item, index) => (
                            <li key={index} className="flex items-center space-x-2">
                              <div className="w-1 h-1 rounded-full bg-muted-foreground"></div>
                              <span>{item}</span>
                            </li>
                          ))}
                          {meeting.agenda.length > 3 && (
                            <li className="text-xs">+{meeting.agenda.length - 3} more items</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Video className="w-4 h-4 mr-2" />
                Start Instant Meeting
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="w-4 h-4 mr-2" />
                Meeting Templates
              </Button>
            </CardContent>
          </Card>

          {/* Recent Meeting Recordings */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Recordings</CardTitle>
              <CardDescription>Access past meeting recordings and transcripts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {meetings
                .filter(m => m.hasRecording)
                .slice(0, 3)
                .map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium truncate">{meeting.title}</h5>
                    <p className="text-xs text-muted-foreground">
                      {new Date(meeting.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm">
                      <Video className="w-3 h-3" />
                    </Button>
                    {meeting.hasTranscript && (
                      <Button variant="ghost" size="sm">
                        <Mic className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Meeting Insights */}
          <Card>
            <CardHeader>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>Meeting analytics and trends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <div className="text-2xl font-bold">8.2h</div>
                <div className="text-xs text-muted-foreground">Meeting time this week</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">94%</div>
                <div className="text-xs text-muted-foreground">Attendance rate</div>
              </div>
              <Button variant="outline" className="w-full text-xs">
                View Full Analytics
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
