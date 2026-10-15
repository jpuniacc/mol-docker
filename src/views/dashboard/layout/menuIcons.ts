import type { Component } from 'vue'
import {
  Accessibility,
  Briefcase,
  Calendar,
  CircleDot,
  DollarSign,
  FileCheck,
  FileSignature,
  FlaskConical,
  Gift,
  GraduationCap,
  Hand,
  Handshake,
  Home,
  LayoutDashboard,
  ListOrdered,
  Menu,
  PenLine,
  Percent,
  School,
  Settings,
  Unlock,
  Users,
  Wallet,
} from 'lucide-vue-next'

const ICON_MAP: Record<string, Component> = {
  Home,
  GraduationCap,
  Users,
  FlaskConical,
  FileSignature,
  School,
  Menu,
  Briefcase,
  Wallet,
  Calendar,
  Settings,
  Unlock,
  DollarSign,
  Handshake,
  Gift,
  Hand,
  Accessibility,
  FileCheck,
  Percent,
  PenLine,
  LayoutDashboard,
  ListOrdered,
}

export function menuIconFromKey(iconKey: string | null | undefined): Component {
  if (iconKey && ICON_MAP[iconKey]) return ICON_MAP[iconKey]
  return CircleDot
}
