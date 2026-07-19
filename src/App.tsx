import React, { useEffect, useState, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import {
  LayoutDashboard, Users, FileText, FolderTree, Receipt, DollarSign, Percent,
  BarChart3, ShieldCheck, Settings, LogOut, ArrowLeft, ArrowRight, Menu, X, UserCheck,
  Bell, Sun, Moon
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast, { Toaster } from 'react-hot-toast'

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

// ⭐ Theme Context
const ThemeContext = createContext()
export const useTheme = () => useContext(ThemeContext)

function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')

  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarMini, setSidebarMini] = useState(false) // للوضع المصغر

  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const { dark, toggle: toggleTheme } = useTheme()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setAuthLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
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

  async function handleAuthSubmit(e) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    setFormLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        })
        if (error) throw error
        setAuthSuccess('تم إنشاء حسابك بنجاح! الرجاء مراجعة بريدك الإلكتروني لتأكيده.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setAuthError(err.message || 'فشل تنفيذ الإجراء. يرجى التحقق من المدخلات.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleLogOut() {
    await supabase.auth.signOut()
    toast.success('تم إنهاء الجلسة بنجاح')
  }

  // محرك عرض المكونات مع الحركات
  function renderActiveView() {
    const views = {
      dashboard: DashboardView,
      accountant_dashboard: AccountantDashboard,
      custom_reports: CustomReports,
      investors: InvestorsView,
      contracts: ContractsView,
      contracts_report: ContractsReport,
      chart_of_accounts: ChartOfAccountsView,
      journal_entries: JournalEntriesView,
      vouchers: ReceiptsPaymentsView,
      distributions: ProfitDistributionView,
      reports: FinancialReportsView,
      audit_logs: AuditLogsView,
      settings: SettingsView,
      users: UsersView,
    }
    const ViewComponent = views[activeView] || DashboardView

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <ViewComponent />
        </motion.div>
      </AnimatePresence>
    )
  }

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

  // شاشة التحميل
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center font-black text-2xl text-slate-950 mb-4"
        >
          ف
        </motion.div>
        <p className="text-sm font-semibold tracking-wider text-slate-400">جاري التحقق من الجلسة...</p>
      </div>
    )
  }

  // واجهة المصادقة
  if (!session) {
    return (
      <ThemeProvider>
        <Toaster position="top-left" reverseOrder={false} />
        <div className={`min-h-screen flex items-center justify-center p-4 ${dark ? 'bg-slate-900' : 'bg-gray-100'}`} dir="rtl">
          <div className={`backdrop-blur border rounded-3xl max-w-md w-full p-8 space-y-6 shadow-2xl ${dark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-gray-200'}`}>
            <div className="text-center space-y-2">
              <h1 className={`text-3xl font-black ${dark ? 'text-white' : 'text-gray-800'}`}>نظام فزاع المالي ERP</h1>
              <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>منصة تدقيق الحسابات وإدارة عوائد الشركاء الاستثمارية</p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-xl border border-red-200 flex items-start gap-1.5">
                  <X className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}
              {authSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-xl border border-emerald-200 flex items-start gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {isSignUp && (
                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${dark ? 'text-slate-400' : 'text-gray-600'}`}>الاسم بالكامل *</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="محمد أحمد الراجحي"
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 ${dark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-gray-50 border-gray-300 text-gray-800'}`}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className={`text-xs font-semibold ${dark ? 'text-slate-400' : 'text-gray-600'}`}>البريد الإلكتروني للعمل *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@fazza.com"
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 font-mono text-left ${dark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-gray-50 border-gray-300 text-gray-800'}`}
                />
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-semibold ${dark ? 'text-slate-400' : 'text-gray-600'}`}>كلمة المرور المشفرة *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 ${dark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-gray-50 border-gray-300 text-gray-800'}`}
                />
              </div>

              <button type="submit" disabled={formLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                {formLoading ? 'جاري الاتصال...' : isSignUp ? 'تسجيل حساب جديد' : 'تسجيل الدخول الآمن'}
              </button>
            </form>

            <div className="text-center">
              <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); setAuthSuccess('') }}
                className={`text-xs font-semibold underline ${dark ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {isSignUp ? 'هل تملك حساباً بالفعل؟ سجل دخولك' : 'هل أنت محاسب جديد؟ أنشئ حساباً'}
              </button>
            </div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  // واجهة التطبيق الرئيسية
  return (
    <ThemeProvider>
      <Toaster position="top-left" reverseOrder={false} toastOptions={{ style: { fontFamily: 'Tajawal, sans-serif' } }} />
      <div className={`min-h-screen flex font-sans select-none ${dark ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-gray-800'}`} dir="rtl">

        {/* ⭐ القائمة الجانبية */}
        <aside className={`fixed inset-y-0 right-0 z-40 flex flex-col border-l transition-all duration-300 backdrop-blur-md
          ${dark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-gray-200'}
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          ${sidebarMini ? 'w-20' : 'w-64'}`}>

          {/* رأس ثابت */}
          <div className="p-4 flex items-center justify-between shrink-0">
            {!sidebarMini ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-950">ف</div>
                <div>
                  <span className="font-black text-lg block tracking-tight text-emerald-400">فزاع ERP</span>
                  <span className="text-[10px] text-slate-400 block">للاستثمار والمحاسبة</span>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-950">ف</div>
            )}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-800 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ⭐ عناصر القائمة قابلة للتمرير */}
          <nav className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveView(item.id); setSidebarOpen(false) }}
                  title={sidebarMini ? item.label : ''}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all
                    ${isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : dark
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'}
                    ${sidebarMini ? 'justify-center' : ''}`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-400' : ''}`} />
                  {!sidebarMini && <span>{item.label}</span>}
                </button>
              )
            })}
          </nav>

          {/* أسفل ثابت */}
          <div className={`p-3 border-t shrink-0 space-y-2 ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
            <button
              onClick={() => setSidebarMini(!sidebarMini)}
              className={`w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg transition ${dark ? 'text-slate-400 hover:text-white hover:bg-slate-800/40' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
            >
              {sidebarMini ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              {!sidebarMini && <span>تصغير القائمة</span>}
            </button>
            <button
              onClick={handleLogOut}
              className={`w-full flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-xl text-xs font-bold transition ${sidebarMini ? 'justify-center' : ''}`}
            >
              <LogOut className="w-4 h-4" />
              {!sidebarMini && <span>إنهاء الجلسة</span>}
            </button>
          </div>
        </aside>

        {/* ⭐ المحتوى الرئيسي */}
        <div className={`flex-1 flex flex-col min-h-screen transition-all ${sidebarMini ? 'lg:mr-20' : 'lg:mr-64'}`}>
          {/* الشريط العلوي */}
          <header className={`h-16 px-6 flex items-center justify-between sticky top-0 z-30 border-b backdrop-blur-md
            ${dark ? 'bg-slate-900/40 border-slate-800' : 'bg-white/70 border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-800 text-slate-400 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="font-black text-sm tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {menuItems.find(m => m.id === activeView)?.label || 'الرئيسية'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <button className="relative p-2 hover:bg-slate-800 rounded-lg transition">
                <Bell className={`w-5 h-5 ${dark ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`} />
                <span className="absolute -top-1 -right-1 bg-rose-500 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center text-white">3</span>
              </button>
              <button onClick={toggleTheme} className={`p-2 rounded-lg transition ${dark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}>
                {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </header>

          {/* محتوى الصفحة */}
          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto pb-24">
            {renderActiveView()}
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}