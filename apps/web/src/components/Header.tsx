'use client'

import { Sun, Moon, Bell, User, Search } from 'lucide-react'
import { Button } from './ui/button'
import { useTheme } from './ThemeProvider'

export function Header() {
  const { theme, setTheme } = useTheme()

  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-6">
        {/* Search */}
        <div className="flex items-center flex-1 max-w-lg">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="h-9 w-9"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>

          {/* User menu */}
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <User className="h-4 w-4" />
            <span className="sr-only">User menu</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
