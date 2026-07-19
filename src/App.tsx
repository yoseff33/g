import React, { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { 
  LayoutDashboard, Users, FileText, FolderTree, Receipt, DollarSign, Percent, 
  BarChart3, ShieldCheck, Settings, LogOut, ArrowLeft, ArrowRight, Menu, X, UserCheck, Filter
} from 'lucide-react'

// Import All 12 Modules + CustomReports
import DashboardView from './components/DashboardView'
import InvestorsView from './components/InvestorsView'
import ContractsView from './components/ContractsView'
import ChartOfAccountsView from './components/ChartOfAccountsView'
import JournalEntriesView from './components/JournalEntriesView'
import ReceiptsPaymentsView from './components/ReceiptsPaymentsView'
import ProfitDistributionView from './components/ProfitDistributionView'
import FinancialReportsView from './components/FinancialReportsView'
import AuditLogsView from './components/AuditLogsView'
import SettingsView from './components/SettingsView'
import UsersView from './components/UsersView'
import ContractsReport from './ContractsReport'
import AccountantDashboard from './AccountantDashboard'
import CustomReports from './CustomReports'
import { Profile } from './types'

type ActiveView = 
  | 'dashboard' | 'investors' | 'contracts' | 'contracts_report' | 'chart_of_accounts' 
  | 'journal_entries' | 'vouchers' | 'distributions' | 'reports' 
  | 'audit_logs' | 'settings' | 'users' | 'accountant_dashboard' | 'custom_reports'

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Navigation states
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Authentication Forms states
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    // 1. Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setAuthLoading(false)
      }
    })

    // 2. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setAuthLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('Error fetching user profile:', err)
    } finally {
      setAuthLoading(false)
    }
  }

  // Auth Submit Handlers
  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    setFormLoading(true)

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName
            }
          }
        })
        if (error) throw error
        
        setAuthSuccess('تم إنشاء حسابك بنجاح! الرجاء مراجعة بريدك الإلكتروني لتأكيده.')
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: any) {
      console.error(err)
      setAuthError(err.message || 'فشل تنفيذ الإجراء. يرجى التحقق من المدخلات.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleLogOut() {
    await supabase.auth.signOut()
  }

  // Active View Render Engine
  function renderActiveView() {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />
      case 'accountant_dashboard':
        return <AccountantDashboard />
      case 'custom_reports':
        return <CustomReports />
      case 'investors':
        return <InvestorsView />
      case 'contracts':
        return <ContractsView />
      case 'contracts_report':
        return <ContractsReport />
      case 'chart_of_accounts':
        return <ChartOfAccountsView />
      case 'journal_entries':
        return <JournalEntriesView />
      case 'vouchers':
        return <ReceiptsPaymentsView />
      case 'distributions':
        return <ProfitDistributionView />
      case 'reports':
        return <FinancialReportsView />
      case 'audit_logs':
        return <AuditLogsView />
      case 'settings':
        return <SettingsView />
      case 'users':
        return <UsersView />
      default:
        return <DashboardView />
    }
  }

  // Sidebar Menu Config
  const menuItems = [
    { id: 'dashboard', label: 'لوحة التحكم العامة', icon: LayoutDashboard },
    { id: 'accountant_dashboard', label: 'لوحة المحاسب', icon: BarChart3 },
    { id: 'custom_reports', label: 'التقارير المخصصة', icon: BarChart3 },
    { id: 'investors', label: 'شؤون المستثمرين', icon: Users },
    { id: 'contracts', label: 'العقود الاستثمارية', icon: FileText },
    { id: 'contracts_report', label: 'تقرير عقود التقسيط', icon: FileText },
    { id: 'chart_of_accounts', label: 'شجرة الحسابات', icon: FolderTree },
    { id: 'journal_entries', label: 'قيود اليومية العامة', icon: Receipt },
    { id: 'vouchers', label: 'الخزينة والسندات', icon: DollarSign },
    { id: 'distributions', label: 'توزيع الأرباح', icon: Percent },
    { id: 'reports', label: 'التقارير والميزانية', icon: BarChart3 },
    { id: 'audit_logs', label: 'سجلات التدقيق الأمني', icon: ShieldCheck },
    { id: 'users', label: 'صلاحيات المستخدمين', icon: UserCheck },
    { id: 'settings', label: 'إعدادات النظام والربط', icon: Settings },
  ]

  // Auth Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white" id="root_loader">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold tracking-wider text-slate-400">جاري تشخيص الاتصال والتحقق من الجلسة الأمنية...</p>
      </div>
    )
  }

  // Auth Portal Layout (RTL & Tajawal Styling)
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" dir="rtl" id="auth_portal">
        <div className="bg-slate-950/80 backdrop-blur border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black text-white tracking-tight">نظام فزاع المالي ERP</h1>
            <p className="text-slate-400 text-xs">منصة تدقيق الحسابات وإدارة عوائد الشركاء الاستثمارية</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authError && (
              <div className="p-3 bg-red-950/50 text-red-400 text-xs font-semibold rounded-xl border border-red-900/50 flex items-start gap-1.5 leading-normal">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className="p-3 bg-emerald-950/50 text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-900/50 flex items-start gap-1.5 leading-normal">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authSuccess}</span>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-1">
                <label className="text-slate-400 text-xs font-semibold">الاسم بالكامل *</label>
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="محمد أحمد الراجحي"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-slate-400 text-xs font-semibold">البريد الإلكتروني للعمل *</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@fazza.com"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-left"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-xs font-semibold">كلمة المرور المشفرة *</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button 
              type="submit" 
              disabled={formLoading}
              className="w-full bg-slate-200 text-slate-950 hover:bg-white font-bold py-3 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              {formLoading ? 'جاري الاتصال بقاعدة البيانات...' : isSignUp ? 'تسجيل كحساب محاسبي جديد' : 'تسجيل الدخول الآمن'}
            </button>
          </form>

          <div className="text-center">
            <button 
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); setAuthSuccess(''); }}
              className="text-slate-400 hover:text-white text-xs font-semibold underline"
            >
              {isSignUp ? 'هل تملك حساباً بالفعل؟ سجل دخولك هنا' : 'هل أنت محاسب جديد؟ أنشئ حساباً هاهنا'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Logged-In ERP Application Workspace (RTL)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans select-none" dir="rtl" id="fazza_workspace">
      
      {/* Sidebar - Desktop Layout */}
      <aside className={`fixed inset-y-0 right-0 z-40 w-64 bg-slate-900/85 backdrop-blur-md text-white p-6 flex flex-col justify-between border-l border-slate-800 transition-transform duration-350 no-print ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      }`}>
        <div className="space-y-8">
          {/* Brand Logo & Name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-lg text-slate-950">ف</div>
              <div>
                <span className="font-black text-lg block tracking-tight text-emerald-400">فزاع ERP</span>
                <span className="text-[10px] text-slate-400 font-medium block">للإدارة الاستثمارية والمحاسبة</span>
              </div>
            </div>
            {/* Close button on Mobile */}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Status Card */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold font-mono border border-slate-700">
              {profile?.email?.substring(0, 2).toUpperCase() || 'SU'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate text-slate-200">{profile?.email || 'تحميل...'}</div>
              <div className="text-[9px] font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>دوره: {profile?.role === 'admin' ? 'مدير نظام' : profile?.role === 'accountant' ? 'محاسب مسؤول' : 'مراقب عام'}</span>
              </div>
            </div>
          </div>

          {/* Main Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const IconComp = item.icon
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveView(item.id as ActiveView); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <IconComp className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Log Out Button */}
        <button 
          onClick={handleLogOut}
          className="flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>إنهاء الجلسة الآمنة</span>
        </button>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 lg:mr-64 flex flex-col min-h-screen bg-slate-950">
        {/* Top Header Rail */}
        <header className="bg-slate-900/40 backdrop-blur-md border-b border-slate-800 h-16 px-6 flex items-center justify-between sticky top-0 z-30 no-print">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-800 text-slate-400 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-white font-black text-sm tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {menuItems.find(m => m.id === activeView)?.label || 'الرئيسية'}
            </h2>
          </div>
          <div className="text-xs text-slate-400 font-medium hidden md:block">
            آخر تحديث للأرصدة: <span className="font-mono text-emerald-400 font-bold">{new Date().toLocaleTimeString('ar-SA')}</span>
          </div>
        </header>

        {/* Dynamic Inner Panel View with padding */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto pb-24">
          {renderActiveView()}
        </main>
      </div>
    </div>
  )
}
