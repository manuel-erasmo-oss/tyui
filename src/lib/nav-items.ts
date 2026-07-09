import {
  LayoutDashboard,
  UserMinus,
  TrendingUp,
  Users,
  Calculator,
  Gift,
  CalendarDays,
  FileBarChart2,
  Settings,
  HandCoins,
  Percent,
  FileClock,
  BarChart2,
  Landmark,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  /** Términos adicionales para el buscador del Cmd+K, no visibles en el Sidebar. */
  keywords?: string
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/',                icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/empleados',       icon: Users,           label: 'Empleados' },
  { href: '/nomina',          icon: Calculator,      label: 'Procesar Nómina', keywords: 'periodo payroll' },
  { href: '/regalia-pascual', icon: Gift,            label: 'Regalía Pascual' },
  { href: '/vacaciones',      icon: CalendarDays,    label: 'Vacaciones' },
  { href: '/prestamos',       icon: HandCoins,       label: 'Préstamos', keywords: 'avance de salario' },
  { href: '/licencias',       icon: FileClock,       label: 'Licencias' },
  { href: '/bonificacion',    icon: Percent,         label: 'Bonificación Utilidades' },
  { href: '/retribuciones-complementarias', icon: Landmark, label: 'Retribuciones Complementarias' },
  { href: '/liquidacion',     icon: UserMinus,       label: 'Liquidación' },
  { href: '/aumentos',        icon: TrendingUp,      label: 'Aumentos Salariales' },
  { href: '/bandas-salariales', icon: BarChart2,     label: 'Bandas Salariales' },
  { href: '/reportes',        icon: FileBarChart2,   label: 'Reportería', keywords: 'pdf excel conciliacion' },
]

export const CONFIGURACION_ITEM: NavItem = {
  href: '/configuracion', icon: Settings, label: 'Configuración', keywords: 'ajustes empresa feriados',
}
