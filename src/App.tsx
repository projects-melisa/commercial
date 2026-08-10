import { useState, useEffect } from 'react'
import {
  LayoutDashboard, FileText, AlertTriangle, TrendingUp, Users, BarChart2,
  Bell, Settings, LogOut, ChevronDown, ChevronRight, Search, Filter,
  Download, RefreshCw, Eye, Edit3, Send, CheckCircle, XCircle, Info,
  Clock, ArrowUp, ArrowDown, Minus, MoreHorizontal, Calendar, Building2,
  Shield, DollarSign, Percent, Activity, Target, Award, X, Check,
  ChevronLeft, Menu, Home
} from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// ─── Types ──────────────────────────────────────────────────────────────────

type Page = 'login' | 'dashboard' | 'contract-detail' | 'customer360' | 'simulator' | 'critical' | 'notifications' | 'reports' | 'settings'
type Role = 'Direksi/VP' | 'Commercial' | 'Revenue Management' | 'Customer Service' | 'PIC Cabang'
type StatusKontrak = 'Aman' | 'Perlu Perhatian' | 'Kritis' | 'Nonaktif'
type Segment = 'Champions' | 'Loyalists' | 'Needs Attention' | 'At Risk'

interface Kontrak {
  id: string
  customer: string
  logo: string
  cabang: string
  hub: string
  status: StatusKontrak
  sisaHari: number
  expiryDate: string
  segment: Segment
  tarif: number
  cost: number
  pic: string
  volume: number
  revenue: number
}

// ─── Data ───────────────────────────────────────────────────────────────────

const kontrakData: Kontrak[] = [
  { id: 'K-001', customer: 'Garuda Indonesia', logo: 'GA', cabang: 'Jakarta', hub: 'CGK', status: 'Aman', sisaHari: 145, expiryDate: '10 Des 2025', segment: 'Champions', tarif: 15500000, cost: 11000000, pic: 'Arief Budiman', volume: 4200, revenue: 65100000000 },
  { id: 'K-002', customer: 'Garuda Indonesia', logo: 'GA', cabang: 'Surabaya', hub: 'KJT', status: 'Perlu Perhatian', sisaHari: 68, expiryDate: '22 Sep 2025', segment: 'Loyalists', tarif: 13200000, cost: 10800000, pic: 'Desi Rahayu', volume: 2800, revenue: 36960000000 },
  { id: 'K-003', customer: 'Garuda Indonesia', logo: 'GA', cabang: 'Bali', hub: 'DPS', status: 'Kritis', sisaHari: 28, expiryDate: '12 Agu 2025', segment: 'Needs Attention', tarif: 12800000, cost: 11200000, pic: 'Hendra Wijaya', volume: 1950, revenue: 24960000000 },
  { id: 'K-004', customer: 'Garuda Indonesia', logo: 'GA', cabang: 'Makassar', hub: 'UPG', status: 'Kritis', sisaHari: 14, expiryDate: '29 Jul 2025', segment: 'At Risk', tarif: 11500000, cost: 10400000, pic: 'Rina Santoso', volume: 1200, revenue: 13800000000 },
  { id: 'K-005', customer: 'Batik Air', logo: 'BA', cabang: 'Jakarta', hub: 'HLP', status: 'Aman', sisaHari: 210, expiryDate: '11 Feb 2026', segment: 'Champions', tarif: 14200000, cost: 10500000, pic: 'Fajar Nugroho', volume: 3600, revenue: 51120000000 },
  { id: 'K-006', customer: 'Batik Air', logo: 'BA', cabang: 'Medan', hub: 'KNO', status: 'Perlu Perhatian', sisaHari: 55, expiryDate: '08 Sep 2025', segment: 'Loyalists', tarif: 13800000, cost: 11500000, pic: 'Sari Dewi', volume: 2100, revenue: 28980000000 },
  { id: 'K-007', customer: 'Lion Air', logo: 'LI', cabang: 'Jakarta', hub: 'CGK', status: 'Nonaktif', sisaHari: 0, expiryDate: '01 Jan 2025', segment: 'At Risk', tarif: 12000000, cost: 11000000, pic: 'Bambang S.', volume: 0, revenue: 0 },
]

const notifData = [
  { id: 1, type: 'kritis', title: 'Kontrak Garuda DPS H-28', body: 'Kontrak Garuda Indonesia DPS akan berakhir dalam 28 hari. Segera proses renegosiasi.', time: '2 jam lalu', read: false, kontrakId: 'K-003' },
  { id: 2, type: 'kritis', title: 'Kontrak Garuda UPG H-14', body: 'Kontrak Garuda Indonesia UPG kritis — hanya 14 hari tersisa. Tindakan darurat diperlukan.', time: '4 jam lalu', read: false, kontrakId: 'K-004' },
  { id: 3, type: 'warning', title: 'GPM Rendah — K-006 Batik KNO', body: 'GPM kontrak Batik Air KNO hanya 16.7%, mendekati ambang warning 15%.', time: '1 hari lalu', read: false, kontrakId: 'K-006' },
  { id: 4, type: 'warning', title: 'Kontrak Garuda KJT H-68', body: 'Kontrak Garuda Indonesia KJT akan berakhir dalam 68 hari. Siapkan proposal renewal.', time: '1 hari lalu', read: true, kontrakId: 'K-002' },
  { id: 5, type: 'info', title: 'Laporan GPM Bulanan Siap', body: 'Laporan analitik GPM bulan Juni 2025 telah tersedia. Silakan review di menu Laporan.', time: '2 hari lalu', read: true, kontrakId: null },
  { id: 6, type: 'info', title: 'Kontrak Baru Batik HLP Disetujui', body: 'Skenario simulasi Batik Air HLP telah mendapat persetujuan dari VP Commercial.', time: '3 hari lalu', read: true, kontrakId: 'K-005' },
]

const gpmTrendData = [
  { bulan: 'Jan', gpm: 24.5, revenue: 180, cost: 136 },
  { bulan: 'Feb', gpm: 23.1, revenue: 195, cost: 150 },
  { bulan: 'Mar', gpm: 25.8, revenue: 210, cost: 155.8 },
  { bulan: 'Apr', gpm: 22.4, revenue: 188, cost: 145.8 },
  { bulan: 'Mei', gpm: 26.3, revenue: 225, cost: 165.8 },
  { bulan: 'Jun', gpm: 27.1, revenue: 242, cost: 176.4 },
]

const statusChartData = [
  { name: 'Aman', value: 18, color: '#16a34a' },
  { name: 'Perlu Perhatian', value: 8, color: '#d97706' },
  { name: 'Kritis', value: 4, color: '#dc2626' },
  { name: 'Nonaktif', value: 3, color: '#6b7280' },
]

const segmenData = [
  { name: 'Champions', value: 12, color: '#16a34a' },
  { name: 'Loyalists', value: 9, color: '#2563eb' },
  { name: 'Needs Attention', value: 7, color: '#d97706' },
  { name: 'At Risk', value: 5, color: '#dc2626' },
]

const hubData = [
  { hub: 'CGK', revenue: 95.2, cost: 71.4, gpm: 25.0 },
  { hub: 'HLP', revenue: 51.1, cost: 37.6, gpm: 26.4 },
  { hub: 'KJT', revenue: 37.0, cost: 29.3, gpm: 20.8 },
  { hub: 'DPS', revenue: 25.0, cost: 21.3, gpm: 14.8 },
  { hub: 'UPG', revenue: 13.8, cost: 12.5, gpm: 9.4 },
  { hub: 'KNO', revenue: 29.0, cost: 23.4, gpm: 19.3 },
]

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmtRupiah = (v: number) => {
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}jt`
  return `Rp ${v.toLocaleString('id-ID')}`
}

const fmtRupiahFull = (v: number) =>
  `Rp ${v.toLocaleString('id-ID')}`

const calcGPM = (tarif: number, cost: number) =>
  tarif > 0 ? ((tarif - cost) / tarif) * 100 : 0

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StatusKontrak }) {
  const cls = {
    Aman: 'badge-aman',
    'Perlu Perhatian': 'badge-warning',
    Kritis: 'badge-kritis',
    Nonaktif: 'badge-nonaktif',
  }[status]
  const dot = {
    Aman: 'bg-green-500',
    'Perlu Perhatian': 'bg-amber-500',
    Kritis: 'bg-red-500',
    Nonaktif: 'bg-gray-400',
  }[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  )
}

function SegmentBadge({ segment }: { segment: Segment }) {
  const styles: Record<Segment, string> = {
    Champions: 'bg-green-100 text-green-700',
    Loyalists: 'bg-blue-100 text-blue-700',
    'Needs Attention': 'bg-amber-100 text-amber-700',
    'At Risk': 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-500 ${styles[segment]}`}>
      {segment}
    </span>
  )
}

function GPMIndicator({ gpm }: { gpm: number }) {
  const color = gpm >= 15 ? 'text-green-600' : gpm >= 10 ? 'text-amber-600' : 'text-red-600'
  const bg = gpm >= 15 ? 'bg-green-100' : gpm >= 10 ? 'bg-amber-100' : 'bg-red-100'
  const icon = gpm >= 15 ? <ArrowUp size={10} /> : gpm >= 10 ? <Minus size={10} /> : <ArrowDown size={10} />
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-700 ${color} ${bg}`}>
      {icon}{gpm.toFixed(1)}%
    </span>
  )
}

function ProgressBar({ sisaHari, max = 180 }: { sisaHari: number; max?: number }) {
  const pct = Math.min((sisaHari / max) * 100, 100)
  const color = sisaHari <= 30 ? 'bg-red-500' : sisaHari <= 90 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full progress-bar ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-600 ${sisaHari <= 30 ? 'text-red-600' : sisaHari <= 90 ? 'text-amber-600' : 'text-green-600'}`}>
        {sisaHari === 0 ? 'Expired' : `H-${sisaHari}`}
      </span>
    </div>
  )
}

function LogoAvatar({ logo, size = 'md' }: { logo: string; size?: 'sm' | 'md' }) {
  const bg = logo === 'GA' ? 'from-blue-600 to-blue-800' : logo === 'BA' ? 'from-orange-500 to-red-600' : 'from-purple-600 to-purple-800'
  const s = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${s} rounded-lg bg-gradient-to-br ${bg} flex items-center justify-center text-white font-700 flex-shrink-0`}>
      {logo}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-700 text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SuccessModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Modal title="Berhasil" onClose={onClose}>
      <div className="flex flex-col items-center py-4 gap-3">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <p className="text-gray-700 text-center">{message}</p>
        <button onClick={onClose} className="mt-2 px-6 py-2.5 bg-green-700 text-white rounded-xl font-600 hover:bg-green-800 transition-colors">
          Tutup
        </button>
      </div>
    </Modal>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'contract-detail', label: 'Kontrak Aktif', icon: FileText },
  { id: 'critical', label: 'Kontrak Kritis', icon: AlertTriangle, badge: 4 },
  { id: 'simulator', label: 'Simulasi Harga', icon: TrendingUp },
  { id: 'customer360', label: 'Customer Insight', icon: Users },
  { id: 'reports', label: 'Laporan & Analitik', icon: BarChart2 },
  { id: 'notifications', label: 'Notifikasi', icon: Bell, badge: 3 },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
]

function Sidebar({ activePage, onNav, role, unreadCount }: {
  activePage: Page
  onNav: (p: Page) => void
  role: Role
  unreadCount: number
}) {
  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-full sidebar-scroll overflow-y-auto" style={{
      background: 'linear-gradient(170deg, #0d3d25 0%, #1a5c3a 50%, #0f4a2e 100%)'
    }}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <div className="text-white font-800 text-sm leading-tight">G-CME</div>
            <div className="text-green-300 text-[10px] leading-tight font-400">Contract & Margin Engine</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon
          const active = activePage === item.id
          const badgeCount = item.id === 'notifications' ? unreadCount : item.badge
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id as Page)}
              className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 ${
                active
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-green-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={17} className={active ? 'text-white' : 'text-green-300'} />
              <span className="flex-1 text-left">{item.label}</span>
              {badgeCount && badgeCount > 0 ? (
                <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded-full ${
                  item.id === 'critical' ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'
                }`}>{badgeCount}</span>
              ) : null}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 pb-5 pt-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-700 text-sm">
            {role.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-600 truncate">Budi Santoso</div>
            <div className="text-green-300 text-[10px] truncate">{role}</div>
          </div>
          <button className="text-green-300 hover:text-white transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── Top Bar ─────────────────────────────────────────────────────────────────

function TopBar({ title, subtitle, role, unreadCount, onNotif }: {
  title: string; subtitle?: string; role: Role; unreadCount: number; onNotif: () => void
}) {
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-100 flex-shrink-0">
      <div>
        <h1 className="text-base font-700 text-gray-900">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>DB Online</span>
        </div>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-500">15 Jul 2025</span>
        <span className="text-gray-300">|</span>
        <span className="text-xs font-500 text-green-700 bg-green-50 px-2 py-1 rounded-lg">{role}</span>
        <button onClick={onNotif} className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors">
          <Bell size={18} className="text-gray-500" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-700 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon, trend }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType; trend?: number
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 card-hover flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-800 text-gray-900">{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
      {trend !== undefined && (
        <div className={`text-xs font-600 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: (role: Role) => void }) {
  const [selectedRole, setSelectedRole] = useState<Role>('Commercial')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const roles: Role[] = ['Direksi/VP', 'Commercial', 'Revenue Management', 'Customer Service', 'PIC Cabang']

  const handleLogin = () => {
    if (!pass) { setError('Password diperlukan'); return }
    setLoading(true)
    setTimeout(() => { setLoading(false); onLogin(selectedRole) }, 1200)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0d3d25 0%, #1a5c3a 60%, #0f4a2e 100%)' }}>
      {/* Left branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 text-white">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
            <Shield size={28} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-800">G-CME</div>
            <div className="text-green-300 text-sm">Contract & Margin Engine</div>
          </div>
        </div>
        <h2 className="text-4xl font-800 leading-tight mb-4">
          Commercial Contract<br />Monitoring & Dynamic<br />P&L Simulator
        </h2>
        <p className="text-green-200 text-base leading-relaxed max-w-sm">
          Single panel view untuk monitoring kontrak customer, simulasi tarif–cost–profit–GPM secara real-time, dan kontrol akses berbasis peran.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-4 max-w-sm">
          {[
            { label: 'Kontrak Aktif', value: '33' },
            { label: 'Average GPM', value: '24.8%' },
            { label: 'Total Revenue', value: 'Rp 220M' },
            { label: 'Customer Aktif', value: '12' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3">
              <div className="text-xl font-800">{s.value}</div>
              <div className="text-green-300 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="w-full lg:w-[440px] flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="mb-6">
              <h3 className="text-xl font-800 text-gray-900">Selamat Datang</h3>
              <p className="text-gray-500 text-sm mt-1">Masuk ke sistem G-CME</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-600 text-gray-600 mb-1.5 block">Email / Username</label>
                <input
                  type="text"
                  defaultValue="budi.santoso@gapura.id"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-600 text-gray-600 mb-1.5 block">Password</label>
                <input
                  type="password"
                  value={pass}
                  onChange={e => { setPass(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
                {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
              </div>

              <div>
                <label className="text-xs font-600 text-gray-600 mb-1.5 block">Role Akses</label>
                <div className="relative">
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value as Role)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 appearance-none bg-white transition-all"
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-green-700 text-white font-700 text-sm hover:bg-green-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Memuat...
                  </>
                ) : 'Masuk ke Sistem'}
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 text-center">
                G-CME v2.1 · Gapura Angkasa · Data dienkripsi end-to-end
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

function DashboardPage({ onNav, kontrakList }: {
  onNav: (p: Page, id?: string) => void
  kontrakList: Kontrak[]
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('Semua')
  const [filterHub, setFilterHub] = useState<string>('Semua')
  const [page, setPage] = useState(0)
  const perPage = 5

  const filtered = kontrakList.filter(k => {
    const matchSearch = k.customer.toLowerCase().includes(search.toLowerCase()) ||
      k.hub.toLowerCase().includes(search.toLowerCase()) ||
      k.id.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'Semua' || k.status === filterStatus
    const matchHub = filterHub === 'Semua' || k.hub === filterHub
    return matchSearch && matchStatus && matchHub
  })

  const paginated = filtered.slice(page * perPage, (page + 1) * perPage)
  const totalPages = Math.ceil(filtered.length / perPage)
  const hubs = ['Semua', ...Array.from(new Set(kontrakList.map(k => k.hub)))]

  const totalAktif = kontrakList.filter(k => k.status !== 'Nonaktif').length
  const totalKritis = kontrakList.filter(k => k.status === 'Kritis').length
  const avgGPM = kontrakList.filter(k => k.status !== 'Nonaktif')
    .reduce((s, k) => s + calcGPM(k.tarif, k.cost), 0) / kontrakList.filter(k => k.status !== 'Nonaktif').length
  const nonaktif = kontrakList.filter(k => k.status === 'Nonaktif').length

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5 animate-fade-in">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total Kontrak Aktif" value={String(totalAktif)} sub="Per 15 Jul 2025" color="bg-green-600" icon={FileText} trend={3.2} />
        <KpiCard label="Kontrak Kritis" value={String(totalKritis)} sub="Perlu tindakan segera" color="bg-red-500" icon={AlertTriangle} trend={-8.1} />
        <KpiCard label="Average GPM" value={`${avgGPM.toFixed(1)}%`} sub="Weighted avg all contracts" color="bg-blue-600" icon={Percent} trend={1.4} />
        <KpiCard label="Kontrak Nonaktif" value={String(nonaktif)} sub="Perlu evaluasi ulang" color="bg-gray-400" icon={XCircle} />
      </div>

      {/* Contract table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-700 text-gray-900 flex-1">Daftar Kontrak Customer</h2>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Cari kontrak..."
              className="pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-green-400 w-44 transition-all"
            />
          </div>
          {/* Status filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(0) }}
              className="pl-3 pr-7 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-green-400 appearance-none bg-white"
            >
              {['Semua', 'Aman', 'Perlu Perhatian', 'Kritis', 'Nonaktif'].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {/* Hub filter */}
          <div className="relative">
            <select
              value={filterHub}
              onChange={e => { setFilterHub(e.target.value); setPage(0) }}
              className="pl-3 pr-7 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-green-400 appearance-none bg-white"
            >
              {hubs.map(h => <option key={h}>{h}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600">
            <Download size={13} />Export
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Customer / Hub', 'Cabang', 'Status', 'Sisa Masa', 'Expiry Date', 'Segmentasi RFM', 'Tarif Saat Ini', 'GPM', 'Next Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-600 text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">
                    Tidak ada kontrak ditemukan
                  </td>
                </tr>
              ) : paginated.map(k => {
                const gpm = calcGPM(k.tarif, k.cost)
                return (
                  <tr
                    key={k.id}
                    className="table-row border-b border-gray-50 cursor-pointer"
                    onClick={() => onNav('contract-detail', k.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <LogoAvatar logo={k.logo} size="sm" />
                        <div>
                          <div className="font-600 text-gray-900 text-xs">{k.customer}</div>
                          <div className="text-[10px] text-gray-400">{k.hub} · {k.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{k.cabang}</td>
                    <td className="px-4 py-3"><StatusBadge status={k.status} /></td>
                    <td className="px-4 py-3"><ProgressBar sisaHari={k.sisaHari} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{k.expiryDate}</td>
                    <td className="px-4 py-3"><SegmentBadge segment={k.segment} /></td>
                    <td className="px-4 py-3 text-xs font-600 text-gray-900">{fmtRupiah(k.tarif)}/bln</td>
                    <td className="px-4 py-3"><GPMIndicator gpm={gpm} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {k.status === 'Kritis' || k.status === 'Perlu Perhatian' ? (
                          <button
                            onClick={e => { e.stopPropagation(); onNav('critical') }}
                            className="px-2 py-1 text-[10px] font-600 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
                          >Renegosiasi</button>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); onNav('simulator') }}
                            className="px-2 py-1 text-[10px] font-600 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap"
                          >Simulasi</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {filtered.length === 0 ? '0' : `${page * perPage + 1}–${Math.min((page + 1) * perPage, filtered.length)}`} dari {filtered.length} kontrak
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-7 h-7 rounded-lg text-xs font-600 transition-colors ${i === page ? 'bg-green-700 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-5">
        {/* GPM mini chart */}
        <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-700 text-gray-900">Tren Revenue, Cost & GPM (6 Bulan)</h3>
            <button onClick={() => onNav('reports')} className="text-xs text-green-600 font-600 hover:underline">Lihat Laporan</button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={gpmTrendData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                formatter={(v: number, name: string) => [
                  name === 'gpm' ? `${v}%` : `Rp ${v}M`,
                  name === 'gpm' ? 'GPM' : name.charAt(0).toUpperCase() + name.slice(1)
                ]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="#eff6ff" strokeWidth={2} name="revenue" />
              <Area type="monotone" dataKey="cost" stroke="#dc2626" fill="#fef2f2" strokeWidth={2} name="cost" />
              <Line type="monotone" dataKey="gpm" stroke="#16a34a" strokeWidth={2.5} dot={{ fill: '#16a34a', r: 3 }} name="gpm" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Segment */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-700 text-gray-900">Segmentasi Customer</h3>
            <button onClick={() => onNav('customer360')} className="text-xs text-green-600 font-600 hover:underline">360 View</button>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={segmenData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value">
                {segmenData.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {segmenData.map(s => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-gray-600">{s.name}</span>
                </div>
                <span className="font-700 text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Contract Detail Page ─────────────────────────────────────────────────────

function ContractDetailPage({ kontrak, onNav }: { kontrak: Kontrak; onNav: (p: Page, id?: string) => void }) {
  const [activeTab, setActiveTab] = useState<'info' | 'histori' | 'dokumen'>('info')
  const gpm = calcGPM(kontrak.tarif, kontrak.cost)
  const laba = kontrak.tarif - kontrak.cost

  const histori = [
    { tanggal: '10 Jan 2025', aksi: 'Kontrak Diperpanjang', user: 'Arief Budiman', note: 'Perpanjangan 12 bulan, tarif naik 3%' },
    { tanggal: '10 Jan 2024', aksi: 'Renegosiasi Tarif', user: 'Desi Rahayu', note: 'Penyesuaian tarif karena kenaikan BBM' },
    { tanggal: '10 Jan 2023', aksi: 'Kontrak Baru', user: 'System', note: 'Onboarding customer baru' },
  ]

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <LogoAvatar logo={kontrak.logo} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-800 text-gray-900">{kontrak.customer}</h2>
                <StatusBadge status={kontrak.status} />
              </div>
              <div className="text-sm text-gray-500 mt-0.5">
                {kontrak.id} · Hub {kontrak.hub} · {kontrak.cabang} · PIC: {kontrak.pic}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNav('customer360', kontrak.id)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-500 text-gray-700">
              Customer 360
            </button>
            <button onClick={() => onNav('simulator')} className="px-4 py-2 text-sm bg-green-700 text-white rounded-xl hover:bg-green-800 transition-colors font-600">
              Buka Simulasi
            </button>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Tarif / Bulan</div>
          <div className="text-xl font-800 text-gray-900">{fmtRupiahFull(kontrak.tarif)}</div>
          <div className="text-xs text-gray-400 mt-0.5">Termasuk semua layanan</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Cost / Bulan</div>
          <div className="text-xl font-800 text-gray-900">{fmtRupiahFull(kontrak.cost)}</div>
          <div className="text-xs text-gray-400 mt-0.5">Direct cost operasional</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Laba / Bulan</div>
          <div className={`text-xl font-800 ${laba > 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtRupiahFull(laba)}</div>
          <div className="text-xs text-gray-400 mt-0.5">Tarif dikurangi Cost</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Gross Profit Margin</div>
          <div className={`text-xl font-800 ${gpm >= 15 ? 'text-green-700' : gpm >= 10 ? 'text-amber-600' : 'text-red-700'}`}>
            {gpm.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{gpm >= 15 ? '✓ Aman' : gpm >= 10 ? '⚠ Warning' : '✗ Kritis'}</div>
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 px-4">
          {[
            { id: 'info', label: 'Informasi Kontrak' },
            { id: 'histori', label: 'Histori Perubahan' },
            { id: 'dokumen', label: 'Dokumen & Link' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3.5 text-sm font-600 border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'info' && (
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-3">
                {[
                  ['ID Kontrak', kontrak.id],
                  ['Customer', kontrak.customer],
                  ['Cabang / Hub', `${kontrak.cabang} / ${kontrak.hub}`],
                  ['PIC', kontrak.pic],
                  ['Status', kontrak.status],
                  ['Segmentasi RFM', kontrak.segment],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start gap-3">
                    <span className="text-xs font-500 text-gray-500 w-36 flex-shrink-0">{k}</span>
                    <span className="text-xs text-gray-900 font-600">{v}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  ['Periode', '01 Jan 2025 – ' + kontrak.expiryDate],
                  ['Sisa Hari', kontrak.sisaHari === 0 ? 'Expired' : `${kontrak.sisaHari} hari (H-${kontrak.sisaHari})`],
                  ['Volume / Bulan', `${kontrak.volume.toLocaleString('id-ID')} unit`],
                  ['Revenue Kontrak', fmtRupiahFull(kontrak.revenue)],
                  ['Renewal Timeline', 'H-90: Draft, H-60: Presentasi, H-30: TTD'],
                  ['Last Updated', '10 Jul 2025'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start gap-3">
                    <span className="text-xs font-500 text-gray-500 w-36 flex-shrink-0">{k}</span>
                    <span className="text-xs text-gray-900 font-600">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'histori' && (
            <div className="space-y-3">
              {histori.map((h, i) => (
                <div key={i} className="flex gap-4 pb-3 border-b border-gray-50 last:border-0">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Activity size={16} className="text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-600 text-gray-900">{h.aksi}</span>
                      <span className="text-xs text-gray-400">{h.tanggal}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{h.note}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">oleh {h.user}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'dokumen' && (
            <div className="space-y-3">
              {[
                { nama: 'Kontrak Induk 2025', tipe: 'PDF', ukuran: '2.4 MB', tanggal: '10 Jan 2025' },
                { nama: 'Addendum Tarif Q2', tipe: 'PDF', ukuran: '1.1 MB', tanggal: '01 Apr 2025' },
                { nama: 'SLA Service Level Agreement', tipe: 'DOCX', ukuran: '0.8 MB', tanggal: '10 Jan 2025' },
              ].map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-red-600 text-[10px] font-700">{d.tipe}</div>
                  <div className="flex-1">
                    <div className="text-sm font-600 text-gray-900">{d.nama}</div>
                    <div className="text-xs text-gray-400">{d.ukuran} · {d.tanggal}</div>
                  </div>
                  <Download size={15} className="text-gray-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Customer 360 Page ────────────────────────────────────────────────────────

function Customer360Page({ kontrak, onNav }: { kontrak: Kontrak; onNav: (p: Page) => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'irregularity' | 'rekomendasi'>('overview')

  const complaints = [
    { bulan: 'Jan', jumlah: 2 }, { bulan: 'Feb', jumlah: 5 }, { bulan: 'Mar', jumlah: 3 },
    { bulan: 'Apr', jumlah: 7 }, { bulan: 'Mei', jumlah: 4 }, { bulan: 'Jun', jumlah: 2 },
  ]

  const issues = [
    { tanggal: '12 Jun 2025', jenis: 'Delay Pengiriman', severity: 'warning', status: 'Resolved', recovery: 'Kompensasi 5% tarif' },
    { tanggal: '03 Mei 2025', jenis: 'Mishandling Kargo', severity: 'kritis', status: 'Resolved', recovery: 'Ganti rugi + SOP baru' },
    { tanggal: '19 Mar 2025', jenis: 'Invoice Error', severity: 'warning', status: 'Closed', recovery: 'Koreksi invoice' },
  ]

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5 animate-fade-in">
      {/* Profile header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start gap-5">
          <LogoAvatar logo={kontrak.logo} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-800 text-gray-900">{kontrak.customer}</h2>
              <SegmentBadge segment={kontrak.segment} />
              <StatusBadge status={kontrak.status} />
            </div>
            <div className="text-sm text-gray-500 mt-1">Hub {kontrak.hub} · {kontrak.cabang} · PIC: {kontrak.pic}</div>
            <div className="flex items-center gap-6 mt-3">
              <div>
                <div className="text-xs text-gray-400">Nilai Kontrak</div>
                <div className="text-sm font-700 text-gray-900">{fmtRupiah(kontrak.revenue)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">GPM</div>
                <div className="text-sm font-700 text-green-700">{calcGPM(kontrak.tarif, kontrak.cost).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Sisa Kontrak</div>
                <div className="text-sm font-700 text-gray-900">{kontrak.sisaHari} hari</div>
              </div>
            </div>
          </div>
          <button onClick={() => onNav('simulator')} className="px-4 py-2 text-sm bg-green-700 text-white rounded-xl font-600 hover:bg-green-800 transition-colors">
            Buka Simulasi
          </button>
        </div>
      </div>

      {/* Segment explanation */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Frequency Score', value: '4.2/5', color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Monetary Score', value: '3.8/5', color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Recency Score', value: '4.5/5', color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Churn Risk', value: kontrak.segment === 'At Risk' ? 'Tinggi' : kontrak.segment === 'Needs Attention' ? 'Sedang' : 'Rendah', color: kontrak.segment === 'At Risk' ? 'text-red-700' : 'text-green-700', bg: kontrak.segment === 'At Risk' ? 'bg-red-50' : 'bg-green-50' },
        ].map(m => (
          <div key={m.label} className={`${m.bg} rounded-2xl p-4 border border-transparent`}>
            <div className="text-xs text-gray-500 mb-1">{m.label}</div>
            <div className={`text-xl font-800 ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 px-4">
          {[
            { id: 'overview', label: 'Overview & Complaint' },
            { id: 'irregularity', label: 'Irregularity & Mishandling' },
            { id: 'rekomendasi', label: 'Rekomendasi' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3.5 text-sm font-600 border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <h4 className="text-sm font-700 text-gray-700 mb-3">Trend Complaint (6 Bulan)</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={complaints} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                    <Bar dataKey="jumlah" fill="#dc2626" radius={[4, 4, 0, 0]} name="Complaint" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-sm font-700 text-gray-700 mb-3">Service Issues Terakhir</h4>
                <div className="space-y-2">
                  {issues.map((issue, i) => (
                    <div key={i} className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-600 text-gray-900">{issue.jenis}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-600 ${
                          issue.severity === 'kritis' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>{issue.severity}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{issue.tanggal} · Recovery: {issue.recovery}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'irregularity' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-800 text-red-700">3</div>
                  <div className="text-xs text-red-600">Total Mishandling</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-800 text-amber-700">18</div>
                  <div className="text-xs text-amber-600">Total Complaint</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-800 text-green-700">95%</div>
                  <div className="text-xs text-green-600">Resolution Rate</div>
                </div>
              </div>
              {issues.map((issue, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl border border-gray-100">
                  <div className={`w-2 rounded-full flex-shrink-0 ${issue.severity === 'kritis' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-600 text-gray-900">{issue.jenis}</span>
                      <span className="text-xs text-gray-400">{issue.tanggal}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Recovery Action: {issue.recovery}</div>
                    <div className="text-[11px] text-green-600 font-500 mt-0.5">Status: {issue.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'rekomendasi' && (
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-700 text-blue-900">Rekomendasi Renegosiasi</div>
                    <div className="text-xs text-blue-700 mt-1 leading-relaxed">
                      Berdasarkan profil RFM dan histori complaint, rekomendasikan pendekatan renegosiasi dengan proposal nilai tambah layanan daripada sekadar penyesuaian tarif. Customer berada dalam segmen <strong>{kontrak.segment}</strong> — perlu {kontrak.segment === 'At Risk' ? 'tindakan retensi segera' : 'pemeliharaan hubungan aktif'}.
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="text-sm font-700 text-green-900 mb-2">Langkah Tindakan</div>
                <div className="space-y-1.5">
                  {[
                    'Jadwalkan pertemuan executive dengan customer dalam 2 minggu',
                    'Siapkan proposal nilai tambah: SLA improvement, dedicated account manager',
                    'Gunakan simulasi GPM untuk batas bawah tarif yang masih menguntungkan',
                    'Koordinasi dengan PIC Cabang untuk data operasional terkini',
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-green-800">
                      <Check size={13} className="text-green-600 mt-0.5 flex-shrink-0" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => onNav('simulator')} className="w-full py-3 bg-green-700 text-white rounded-xl font-600 text-sm hover:bg-green-800 transition-colors">
                Buka P&L Simulator →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── P&L Simulator Page ───────────────────────────────────────────────────────

function SimulatorPage({ kontrak }: { kontrak: Kontrak }) {
  const [tarifUsulan, setTarifUsulan] = useState(kontrak.tarif)
  const [costUsulan, setCostUsulan] = useState(kontrak.cost)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [scenarios, setScenarios] = useState<Array<{ nama: string; tarif: number; cost: number }>>([])

  const labaExisting = kontrak.tarif - kontrak.cost
  const gpmExisting = calcGPM(kontrak.tarif, kontrak.cost)

  const labaUsulan = tarifUsulan - costUsulan
  const gpmUsulan = calcGPM(tarifUsulan, costUsulan)

  const deltaLaba = labaUsulan - labaExisting
  const deltaGPM = gpmUsulan - gpmExisting

  const gpmStatus = (gpm: number) => gpm >= 15 ? { label: 'Aman', color: 'text-green-700', bg: 'bg-green-100' }
    : gpm >= 10 ? { label: 'Warning', color: 'text-amber-700', bg: 'bg-amber-100' }
    : { label: 'Kritis', color: 'text-red-700', bg: 'bg-red-100' }

  const statusUsulan = gpmStatus(gpmUsulan)

  const handleReset = () => {
    setTarifUsulan(kontrak.tarif)
    setCostUsulan(kontrak.cost)
  }

  const handleSimpan = () => {
    setScenarios(s => [...s, { nama: `Skenario ${s.length + 1}`, tarif: tarifUsulan, cost: costUsulan }])
    setSuccessMsg('Skenario berhasil disimpan! Tersedia di daftar perbandingan.')
    setShowSuccess(true)
  }

  const handleApproval = () => {
    setSuccessMsg('Skenario telah diajukan ke VP Commercial untuk review dan persetujuan.')
    setShowSuccess(true)
  }

  const tarifMin = Math.round(kontrak.tarif * 0.7)
  const tarifMax = Math.round(kontrak.tarif * 1.3)
  const costMin = Math.round(kontrak.cost * 0.8)
  const costMax = Math.round(kontrak.cost * 1.2)

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5 animate-fade-in">
      {showSuccess && (
        <SuccessModal message={successMsg} onClose={() => setShowSuccess(false)} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-800 text-gray-900">Dynamic P&L Simulator</h2>
          <p className="text-xs text-gray-500 mt-0.5">{kontrak.customer} · Hub {kontrak.hub} · {kontrak.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600">
            <RefreshCw size={13} />Reset
          </button>
          <button onClick={handleSimpan} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-600">
            <Download size={13} />Simpan Skenario
          </button>
          <button onClick={handleApproval} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-green-700 text-white rounded-xl hover:bg-green-800 transition-colors font-600">
            <Send size={13} />Ajukan Approval
          </button>
        </div>
      </div>

      {/* Main simulator */}
      <div className="grid grid-cols-2 gap-5">
        {/* Existing / Baseline */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            <h3 className="text-sm font-700 text-gray-700">Existing / Baseline</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-500 font-500">Tarif (Rp/bulan)</span>
                <span className="font-700 text-gray-900">{fmtRupiahFull(kontrak.tarif)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-full bg-gray-400 rounded-full" style={{ width: '65%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-500 font-500">Cost (Rp/bulan)</span>
                <span className="font-700 text-gray-900">{fmtRupiahFull(kontrak.cost)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-full bg-red-300 rounded-full" style={{ width: `${(kontrak.cost / kontrak.tarif) * 100}%` }} />
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Laba / Bulan</span>
                <span className="font-700 text-green-700">{fmtRupiahFull(labaExisting)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Gross Profit Margin</span>
                <span className={`font-800 text-lg ${gpmExisting >= 15 ? 'text-green-700' : gpmExisting >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                  {gpmExisting.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Status Margin</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-700 ${gpmStatus(gpmExisting).bg} ${gpmStatus(gpmExisting).color}`}>
                  {gpmStatus(gpmExisting).label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Usulan interaktif */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <h3 className="text-sm font-700 text-green-800">Usulan (Interaktif)</h3>
          </div>
          <div className="space-y-5">
            {/* Tarif slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-500 font-500">Tarif Usulan (Rp/bulan)</span>
                <span className="font-800 text-gray-900">{fmtRupiahFull(tarifUsulan)}</span>
              </div>
              <input
                type="range"
                min={tarifMin}
                max={tarifMax}
                step={100000}
                value={tarifUsulan}
                onChange={e => setTarifUsulan(Number(e.target.value))}
                className="w-full"
                style={{ background: `linear-gradient(to right, #16a34a ${((tarifUsulan - tarifMin) / (tarifMax - tarifMin)) * 100}%, #e5e7eb ${((tarifUsulan - tarifMin) / (tarifMax - tarifMin)) * 100}%)` }}
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>{fmtRupiah(tarifMin)}</span>
                <span>{fmtRupiah(tarifMax)}</span>
              </div>
            </div>

            {/* Cost slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-500 font-500">Cost Usulan (Rp/bulan)</span>
                <span className="font-800 text-gray-900">{fmtRupiahFull(costUsulan)}</span>
              </div>
              <input
                type="range"
                min={costMin}
                max={costMax}
                step={100000}
                value={costUsulan}
                onChange={e => setCostUsulan(Number(e.target.value))}
                className="w-full"
                style={{ background: `linear-gradient(to right, #dc2626 ${((costUsulan - costMin) / (costMax - costMin)) * 100}%, #e5e7eb ${((costUsulan - costMin) / (costMax - costMin)) * 100}%)` }}
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>{fmtRupiah(costMin)}</span>
                <span>{fmtRupiah(costMax)}</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Laba / Bulan</span>
                <div className="flex items-center gap-2">
                  <span className={`font-700 ${labaUsulan > 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtRupiahFull(labaUsulan)}</span>
                  <span className={`text-[11px] ${deltaLaba >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {deltaLaba >= 0 ? '▲' : '▼'} {fmtRupiah(Math.abs(deltaLaba))}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Gross Profit Margin</span>
                <div className="flex items-center gap-2">
                  <span className={`font-800 text-lg ${gpmUsulan >= 15 ? 'text-green-700' : gpmUsulan >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                    {gpmUsulan.toFixed(1)}%
                  </span>
                  <span className={`text-[11px] ${deltaGPM >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {deltaGPM >= 0 ? '+' : ''}{deltaGPM.toFixed(1)} pp
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Status Margin</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-700 ${statusUsulan.bg} ${statusUsulan.color}`}>
                  {statusUsulan.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick insight note */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-xs font-700 text-amber-800">Quick Insight — </span>
          <span className="text-xs text-amber-700">
            Simulasi ini bersifat indikatif. Keputusan final tetap melalui review manusia dan proses approval komersial yang berlaku. GPM minimum yang disarankan adalah 15% (Aman). Perubahan tarif di bawah cost akan menghasilkan margin negatif.
          </span>
        </div>
      </div>

      {/* Threshold legend */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h4 className="text-xs font-700 text-gray-700 mb-3">Threshold Status Margin</h4>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-400" />
            <span className="text-xs text-gray-600"><strong className="text-green-700">Aman</strong> — GPM ≥ 15%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-100 border border-amber-400" />
            <span className="text-xs text-gray-600"><strong className="text-amber-700">Warning</strong> — GPM 10–14.9%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-400" />
            <span className="text-xs text-gray-600"><strong className="text-red-700">Kritis</strong> — GPM &lt; 10%</span>
          </div>
        </div>
      </div>

      {/* Saved scenarios */}
      {scenarios.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h4 className="text-xs font-700 text-gray-700 mb-3">Skenario Tersimpan</h4>
          <div className="space-y-2">
            {scenarios.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 text-xs">
                <span className="font-600 text-gray-900 w-24">{s.nama}</span>
                <span className="text-gray-600">Tarif: {fmtRupiah(s.tarif)}</span>
                <span className="text-gray-600">Cost: {fmtRupiah(s.cost)}</span>
                <span className={`font-700 ${calcGPM(s.tarif, s.cost) >= 15 ? 'text-green-700' : 'text-amber-700'}`}>
                  GPM: {calcGPM(s.tarif, s.cost).toFixed(1)}%
                </span>
                <button onClick={() => { setTarifUsulan(s.tarif); setCostUsulan(s.cost) }} className="ml-auto text-green-600 hover:underline">Load</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Contract Critical Page ───────────────────────────────────────────────────

function CriticalPage({ kontrakList, onNav }: { kontrakList: Kontrak[]; onNav: (p: Page, id?: string) => void }) {
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderTarget, setReminderTarget] = useState<string>('')
  const [showSuccess, setShowSuccess] = useState(false)

  const kritisData = [
    { horizon: 'H-180', label: '91–180 hari', items: kontrakList.filter(k => k.sisaHari > 90 && k.sisaHari <= 180), color: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
    { horizon: 'H-90', label: '61–90 hari', items: kontrakList.filter(k => k.sisaHari > 60 && k.sisaHari <= 90), color: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
    { horizon: 'H-60', label: '31–60 hari', items: kontrakList.filter(k => k.sisaHari > 30 && k.sisaHari <= 60), color: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
    { horizon: 'H-30', label: '1–30 hari', items: kontrakList.filter(k => k.sisaHari > 0 && k.sisaHari <= 30), color: 'bg-red-100 text-red-700', border: 'border-red-200' },
    { horizon: 'Expired', label: 'Sudah berakhir', items: kontrakList.filter(k => k.sisaHari === 0), color: 'bg-gray-100 text-gray-700', border: 'border-gray-200' },
  ]

  const alasan = (k: Kontrak) => {
    if (k.sisaHari === 0) return 'Kontrak telah berakhir, perlu pembaruan segera'
    if (k.sisaHari <= 30) return `Masa berlaku kritis, sisa ${k.sisaHari} hari saja`
    if (k.sisaHari <= 60) return `GPM ${calcGPM(k.tarif, k.cost).toFixed(1)}% mendekati threshold warning`
    return `Jatuh tempo dalam ${k.sisaHari} hari, persiapkan proposal renewal`
  }

  const rekomendasi = (k: Kontrak) => {
    if (k.sisaHari === 0) return 'Susun kontrak baru atau nonaktifkan customer'
    if (k.sisaHari <= 30) return 'Telepon PIC customer hari ini, percepat TTD'
    if (k.sisaHari <= 60) return 'Kirim proposal renewal, jadwalkan meeting'
    return 'Siapkan draft renewal, koordinasi internal'
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5 animate-fade-in">
      {showSuccess && (
        <SuccessModal
          message={`Reminder berhasil dikirim ke PIC untuk kontrak ${reminderTarget}.`}
          onClose={() => setShowSuccess(false)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-800 text-gray-900">Kontrak Kritis & Mendekati Expiry</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pantau dan ambil tindakan sebelum kontrak berakhir</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            Total kritis: <strong className="text-red-600">{kontrakList.filter(k => k.sisaHari <= 60 && k.sisaHari > 0).length} kontrak</strong>
          </div>
        </div>
      </div>

      {kritisData.map(group => group.items.length > 0 && (
        <div key={group.horizon} className={`bg-white rounded-2xl shadow-sm border ${group.border} overflow-hidden`}>
          <div className={`px-4 py-3 ${group.color.split(' ')[0]} border-b ${group.border} flex items-center gap-2`}>
            <span className={`text-xs font-700 ${group.color.split(' ')[1]}`}>{group.horizon}</span>
            <span className="text-xs text-gray-600">· {group.label}</span>
            <span className={`ml-auto text-xs font-600 ${group.color.split(' ')[1]}`}>{group.items.length} kontrak</span>
          </div>
          <div className="divide-y divide-gray-50">
            {group.items.map(k => (
              <div key={k.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                <LogoAvatar logo={k.logo} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-700 text-gray-900">{k.customer}</span>
                    <span className="text-xs text-gray-400">{k.hub} · {k.id}</span>
                    <SegmentBadge segment={k.segment} />
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <ProgressBar sisaHari={k.sisaHari} />
                    <span className="text-xs text-gray-500">Expiry: {k.expiryDate}</span>
                    <span className="text-xs text-gray-500">PIC: {k.pic}</span>
                    <GPMIndicator gpm={calcGPM(k.tarif, k.cost)} />
                  </div>
                  <div className="mt-1.5 text-xs text-red-600 font-500">⚠ {alasan(k)}</div>
                  <div className="mt-0.5 text-xs text-gray-500">→ {rekomendasi(k)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setReminderTarget(`${k.customer} ${k.hub}`); setShowSuccess(true) }}
                    className="px-3 py-1.5 text-xs font-600 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors flex items-center gap-1"
                  >
                    <Bell size={12} />Reminder
                  </button>
                  <button
                    onClick={() => onNav('contract-detail', k.id)}
                    className="px-3 py-1.5 text-xs font-600 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
                  >
                    Renegosiasi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Notification Center Page ─────────────────────────────────────────────────

function NotificationsPage({ onNav }: { onNav: (p: Page, id?: string) => void }) {
  const [notifs, setNotifs] = useState(notifData)
  const [filter, setFilter] = useState<string>('Semua')

  const filtered = filter === 'Semua' ? notifs
    : filter === 'Belum Dibaca' ? notifs.filter(n => !n.read)
    : notifs.filter(n => n.type === filter.toLowerCase())

  const markRead = (id: number) => setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x))
  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })))

  const typeIcon = (type: string) => ({
    kritis: <AlertTriangle size={16} className="text-red-600" />,
    warning: <Info size={16} className="text-amber-600" />,
    info: <CheckCircle size={16} className="text-blue-600" />,
  }[type] || <Bell size={16} />)

  const typeBg = (type: string) => ({
    kritis: 'bg-red-50',
    warning: 'bg-amber-50',
    info: 'bg-blue-50',
  }[type] || 'bg-gray-50')

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-800 text-gray-900">Notification Center</h2>
          <p className="text-xs text-gray-500 mt-0.5">{notifs.filter(n => !n.read).length} notifikasi belum dibaca</p>
        </div>
        <button onClick={markAllRead} className="text-xs text-green-600 hover:underline font-600">Tandai Semua Dibaca</button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {['Semua', 'Belum Dibaca', 'Kritis', 'Warning', 'Info'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-600 rounded-lg transition-colors ${
              filter === f ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm border border-gray-100">
            Tidak ada notifikasi
          </div>
        ) : filtered.map(n => (
          <div
            key={n.id}
            onClick={() => { markRead(n.id); if (n.kontrakId) onNav('contract-detail', n.kontrakId) }}
            className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-green-200 transition-all card-hover ${!n.read ? 'border-l-4 border-l-green-500' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl ${typeBg(n.type)} flex items-center justify-center flex-shrink-0`}>
                {typeIcon(n.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-${n.read ? '600' : '700'} text-gray-900`}>{n.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">{n.time}</span>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-green-500" />}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Reports & Analytics Page ─────────────────────────────────────────────────

function ReportsPage() {
  const [period, setPeriod] = useState('6-bulan')
  const [activeChart, setActiveChart] = useState<'status' | 'hub' | 'trend' | 'segment'>('trend')

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-800 text-gray-900">Laporan & Analitik</h2>
          <p className="text-xs text-gray-500 mt-0.5">Overview performa kontrak, revenue, dan GPM</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="pl-3 pr-7 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-green-400 appearance-none bg-white"
            >
              <option value="3-bulan">3 Bulan</option>
              <option value="6-bulan">6 Bulan</option>
              <option value="1-tahun">1 Tahun</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
            <Download size={13} />PDF
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs bg-green-700 text-white rounded-xl hover:bg-green-800 font-600">
            <Download size={13} />Excel
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-2xl font-800 text-green-700">Rp 1.25T</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Revenue YTD</div>
          <div className="text-[11px] text-green-600 mt-0.5">▲ 8.4% vs tahun lalu</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-2xl font-800 text-gray-900">Rp 947M</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Cost YTD</div>
          <div className="text-[11px] text-amber-600 mt-0.5">▲ 6.1% vs tahun lalu</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-2xl font-800 text-blue-700">Rp 303M</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Laba YTD</div>
          <div className="text-[11px] text-green-600 mt-0.5">▲ 14.2% vs tahun lalu</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-2xl font-800 text-purple-700">24.2%</div>
          <div className="text-xs text-gray-500 mt-0.5">Avg GPM YTD</div>
          <div className="text-[11px] text-green-600 mt-0.5">▲ 1.6 pp vs tahun lalu</div>
        </div>
      </div>

      {/* Chart selector */}
      <div className="flex items-center gap-2">
        {[
          { id: 'trend', label: 'Tren GPM & Revenue' },
          { id: 'hub', label: 'Per Hub' },
          { id: 'status', label: 'Status Kontrak' },
          { id: 'segment', label: 'Segmentasi' },
        ].map(c => (
          <button
            key={c.id}
            onClick={() => setActiveChart(c.id as any)}
            className={`px-3 py-1.5 text-xs font-600 rounded-lg transition-colors ${
              activeChart === c.id ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        {activeChart === 'trend' && (
          <>
            <h3 className="text-sm font-700 text-gray-900 mb-4">Tren Revenue, Cost, dan GPM (6 Bulan)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={gpmTrendData} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="#eff6ff" strokeWidth={2} name="Revenue (Rp M)" />
                <Area type="monotone" dataKey="cost" stroke="#dc2626" fill="#fef2f2" strokeWidth={2} name="Cost (Rp M)" />
                <Line type="monotone" dataKey="gpm" stroke="#16a34a" strokeWidth={3} dot={{ fill: '#16a34a', r: 4 }} name="GPM %" yAxisId={0} />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
        {activeChart === 'hub' && (
          <>
            <h3 className="text-sm font-700 text-gray-900 mb-4">Revenue, Cost & GPM per Hub</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hubData} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="hub" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} name="Revenue (Rp M)" />
                <Bar dataKey="cost" fill="#dc2626" radius={[4, 4, 0, 0]} name="Cost (Rp M)" />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
        {activeChart === 'status' && (
          <>
            <h3 className="text-sm font-700 text-gray-900 mb-4">Distribusi Status Kontrak</h3>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie data={statusChartData} cx="50%" cy="50%" outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusChartData.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {statusChartData.map(s => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-sm text-gray-700 flex-1">{s.name}</span>
                    <span className="text-sm font-700 text-gray-900">{s.value} kontrak</span>
                    <span className="text-xs text-gray-400">{((s.value / 33) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {activeChart === 'segment' && (
          <>
            <h3 className="text-sm font-700 text-gray-900 mb-4">Segmentasi RFM Customer</h3>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie data={segmenData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                    {segmenData.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {segmenData.map(s => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-sm text-gray-700 flex-1">{s.name}</span>
                    <span className="text-sm font-700 text-gray-900">{s.value} customer</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage() {
  return (
    <div className="flex-1 overflow-auto p-6 space-y-5 animate-fade-in">
      <div>
        <h2 className="text-base font-800 text-gray-900">Pengaturan Sistem</h2>
        <p className="text-xs text-gray-500 mt-0.5">Konfigurasi G-CME dan preferensi akun</p>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {[
          { title: 'Profil & Akun', items: ['Nama Lengkap: Budi Santoso', 'Email: budi.santoso@gapura.id', 'Role: Commercial', 'Cabang: Jakarta Pusat'] },
          { title: 'Notifikasi', items: ['Email reminder H-180: ✓ Aktif', 'Push notif kritis H-30: ✓ Aktif', 'Digest harian GPM: ✓ Aktif', 'Alert margin kritis: ✓ Aktif'] },
          { title: 'Threshold GPM', items: ['GPM Aman: ≥ 15%', 'GPM Warning: 10–14.9%', 'GPM Kritis: < 10%', 'Alert otomatis: ✓ Aktif'] },
          { title: 'Sistem & Database', items: ['DB Status: Online', 'Last sync: 15 Jul 2025 08:00', 'Version: G-CME v2.1', 'Environment: Production'] },
        ].map(s => (
          <div key={s.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-700 text-gray-900 mb-3">{s.title}</h3>
            <div className="space-y-2">
              {s.items.map((item, i) => (
                <div key={i} className="text-xs text-gray-600 py-1.5 border-b border-gray-50 last:border-0 flex items-center justify-between">
                  <span>{item.split(':')[0]}</span>
                  <span className="font-600 text-gray-900">{item.split(':').slice(1).join(':').trim()}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>('login')
  const [role, setRole] = useState<Role>('Commercial')
  const [selectedKontrakId, setSelectedKontrakId] = useState<string>('K-001')
  const [unreadCount, setUnreadCount] = useState(notifData.filter(n => !n.read).length)

  const selectedKontrak = kontrakData.find(k => k.id === selectedKontrakId) || kontrakData[0]

  const handleLogin = (r: Role) => {
    setRole(r)
    setPage('dashboard')
  }

  const handleNav = (p: Page, id?: string) => {
    if (id) setSelectedKontrakId(id)
    setPage(p)
    if (p === 'notifications') setUnreadCount(0)
  }

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} />
  }

  const pageTitle: Record<Page, { title: string; subtitle?: string }> = {
    login: { title: '' },
    dashboard: { title: 'Dashboard', subtitle: 'Commercial Contract Monitoring & Dynamic P&L Simulator' },
    'contract-detail': { title: 'Detail Kontrak', subtitle: `${selectedKontrak.customer} · ${selectedKontrak.hub}` },
    customer360: { title: 'Customer 360 Insight', subtitle: selectedKontrak.customer },
    simulator: { title: 'Dynamic P&L Simulator', subtitle: 'Simulasi Tarif – Cost – Profit – GPM Real-time' },
    critical: { title: 'Kontrak Kritis', subtitle: 'Daftar kontrak mendekati expiry & perlu tindakan' },
    notifications: { title: 'Notification Center', subtitle: 'Alert dan reminder otomatis sistem' },
    reports: { title: 'Laporan & Analitik', subtitle: 'Overview performa kontrak, revenue, dan GPM' },
    settings: { title: 'Pengaturan', subtitle: 'Konfigurasi G-CME dan preferensi akun' },
  }

  const { title, subtitle } = pageTitle[page]

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar activePage={page} onNav={p => handleNav(p)} role={role} unreadCount={unreadCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={title}
          subtitle={subtitle}
          role={role}
          unreadCount={unreadCount}
          onNotif={() => handleNav('notifications')}
        />
        <main className="flex-1 overflow-auto">
          {page === 'dashboard' && (
            <DashboardPage onNav={handleNav} kontrakList={kontrakData} />
          )}
          {page === 'contract-detail' && (
            <ContractDetailPage kontrak={selectedKontrak} onNav={handleNav} />
          )}
          {page === 'customer360' && (
            <Customer360Page kontrak={selectedKontrak} onNav={handleNav} />
          )}
          {page === 'simulator' && (
            <SimulatorPage kontrak={selectedKontrak} />
          )}
          {page === 'critical' && (
            <CriticalPage kontrakList={kontrakData} onNav={handleNav} />
          )}
          {page === 'notifications' && (
            <NotificationsPage onNav={handleNav} />
          )}
          {page === 'reports' && (
            <ReportsPage />
          )}
          {page === 'settings' && (
            <SettingsPage />
          )}
        </main>
      </div>
    </div>
  )
}
