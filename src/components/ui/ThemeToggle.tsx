'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="rounded p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-[#1a1d2e] transition-colors"
    >
      {dark
        ? <Sun  className="h-4 w-4 text-amber-400" />
        : <Moon className="h-4 w-4" />
      }
    </button>
  )
}
