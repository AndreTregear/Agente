'use client'

import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { ThemeProvider } from '@/components/ThemeProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="agente-theme">
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}
