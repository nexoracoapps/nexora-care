'use client';

/**
 * Unified icon system for Nexora Care.
 * All icons sourced from lucide-react at a consistent size/stroke.
 * Usage: <Icon name="edit" /> or <Icon name="delete" size={14} />
 */

import {
  Pencil, Trash2, Plus, Search, Calendar, Bell, User, Users,
  Settings, LogOut, LayoutDashboard, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, X, Check, Save, Eye, EyeOff,
  Upload, Download, RefreshCw, Filter, MoreVertical, MoreHorizontal,
  Phone, Mail, MapPin, Clock, Star, AlertCircle, Info, CheckCircle,
  XCircle, Loader2, Lock, Unlock, Shield, Copy, ExternalLink,
  FileText, Image, Paperclip, Send, Archive, Tag, Hash,
  Building2, GitBranch, BarChart2, DollarSign, CreditCard,
  Stethoscope, Pill, Syringe, ClipboardList, CalendarOff,
  UserPlus, UserMinus, UserCheck, Activity, TrendingUp,
  Wifi, WifiOff, Maximize2,
} from 'lucide-react';

export type IconName =
  | 'edit' | 'delete' | 'add' | 'search' | 'calendar' | 'notification'
  | 'user' | 'users' | 'settings' | 'logout' | 'dashboard'
  | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right'
  | 'close' | 'check' | 'save' | 'eye' | 'eye-off'
  | 'upload' | 'download' | 'refresh' | 'filter' | 'more-v' | 'more-h'
  | 'phone' | 'mail' | 'location' | 'clock' | 'star' | 'alert' | 'info'
  | 'success' | 'error' | 'loading' | 'lock' | 'unlock' | 'shield'
  | 'copy' | 'external' | 'file' | 'image' | 'attach' | 'send'
  | 'archive' | 'tag' | 'hash' | 'branch' | 'chart' | 'revenue'
  | 'payment' | 'provider' | 'prescription' | 'medicine' | 'service'
  | 'appointment' | 'calendar-off' | 'user-add' | 'user-remove'
  | 'user-check' | 'activity' | 'trending' | 'online' | 'offline'
  | 'building' | 'permissions' | 'backup' | 'expand';

const MAP: Record<IconName, React.ElementType> = {
  edit:         Pencil,
  delete:       Trash2,
  add:          Plus,
  search:       Search,
  calendar:     Calendar,
  notification: Bell,
  user:         User,
  users:        Users,
  settings:     Settings,
  logout:       LogOut,
  dashboard:    LayoutDashboard,
  'chevron-down':  ChevronDown,
  'chevron-up':    ChevronUp,
  'chevron-left':  ChevronLeft,
  'chevron-right': ChevronRight,
  close:        X,
  check:        Check,
  save:         Save,
  eye:          Eye,
  'eye-off':    EyeOff,
  upload:       Upload,
  download:     Download,
  refresh:      RefreshCw,
  filter:       Filter,
  'more-v':     MoreVertical,
  'more-h':     MoreHorizontal,
  phone:        Phone,
  mail:         Mail,
  location:     MapPin,
  clock:        Clock,
  star:         Star,
  alert:        AlertCircle,
  info:         Info,
  success:      CheckCircle,
  error:        XCircle,
  loading:      Loader2,
  lock:         Lock,
  unlock:       Unlock,
  shield:       Shield,
  copy:         Copy,
  external:     ExternalLink,
  file:         FileText,
  image:        Image,
  attach:       Paperclip,
  send:         Send,
  archive:      Archive,
  tag:          Tag,
  hash:         Hash,
  branch:       GitBranch,
  chart:        BarChart2,
  revenue:      TrendingUp,
  payment:      CreditCard,
  provider:     Stethoscope,
  prescription: ClipboardList,
  medicine:     Pill,
  service:      Syringe,
  appointment:  Calendar,
  'calendar-off': CalendarOff,
  'user-add':   UserPlus,
  'user-remove': UserMinus,
  'user-check': UserCheck,
  activity:     Activity,
  trending:     TrendingUp,
  online:       Wifi,
  offline:      WifiOff,
  building:     Building2,
  permissions:  Shield,
  backup:       Lock,
  expand:       Maximize2,
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

export function Icon({ name, size = 16, className, style, strokeWidth = 2 }: IconProps) {
  const Component = MAP[name];
  if (!Component) return null;
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={{ flexShrink: 0, ...style }}
    />
  );
}

export default Icon;
