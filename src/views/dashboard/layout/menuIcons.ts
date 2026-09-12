import type { Component } from 'vue'
import {
  Briefcase,
  Calendar,
  CircleDot,
  DollarSign,
  FileCheck,
  FileSignature,
  FlaskConical,
  Gift,
  GraduationCap,
  Handshake,
  Home,
  Menu,
  PenLine,
  Percent,
  School,
  Settings,
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
  DollarSign,
  Handshake,
  Gift,
  FileCheck,
  Percent,
  PenLine,
}

export function menuIconFromKey(iconKey: string | null | undefined): Component {
  if (iconKey && ICON_MAP[iconKey]) return ICON_MAP[iconKey]
  return CircleDot
}
