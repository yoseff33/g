import React, {
  Component,
  Suspense,
  createContext,
  lazy,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { ErrorInfo, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  CircleDollarSign,
  FileCheck2,
  FileText,
  FolderTree,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageOpen,
  Percent,
  Receipt,
  RefreshCw,
  Scale,
  Settings,
  ShieldCheck,
  Sun,
  UserCheck,
  Users,
  WalletCards,
  X,
} from 'lucide-react'

import { AnimatePresence, motion } from 'framer-motion'
import toast, { Toaster } from 'react-hot-toast'

import { supabase } from './lib/supabase'
import type { Profile } from './types'
import { PageLoading } from './components/PageState'

const DashboardView = lazy(() => import('./components/DashboardView'))
const AccountantDashboard = lazy(() => import('./AccountantDashboard'))
const CollectionCenterView = lazy(
  () => import('./components/CollectionCenterView'),
)
const InvestorPortalView = lazy(
  () => import('./components/InvestorPortalView'),
)
const FairDistributionView = lazy(
  () => import('./components/FairDistributionView'),
)
const ApprovalCenterView = lazy(
  () => import('./components/ApprovalCenterView'),
)
const CustomReports = lazy(() => import('./CustomReports'))
const InvestorsView = lazy(() => import('./components/InvestorsView'))
const ContractsView = lazy(() => import('./components/ContractsView'))
const ContractsReport = lazy(() => import('./ContractsReport'))

/**
 * شاشة الباقات الجديدة.
 * تأكد أن الملف موجود هنا:
 * src/components/LiquidityPackagesView.tsx
 */
const LiquidityPackagesView = lazy(
  () => import('./components/LiquidityPackagesView'),
)

const ChartOfAccountsView = lazy(
  () => import('./components/ChartOfAccountsView'),
)
const JournalEntriesView = lazy(
  () => import('./components/JournalEntriesView'),
)
const ReceiptsPaymentsView = lazy(
  () => import('./components/ReceiptsPaymentsView'),
)
const ProfitDistributionView = lazy(
  () => import('./components/ProfitDistributionView'),
)
const FinancialReportsView = lazy(
  () => import('./components/FinancialReportsView'),
)
const AuditLogsView = lazy(() => import('./components/AuditLogsView'))
const UsersView = lazy(() => import('./components/UsersView'))
const SettingsView = lazy(() => import('./components/SettingsView'))

type ActiveView =
  | 'dashboard'
  | 'accountant_dashboard'
  | 'collection_center'
  | 'liquidity_packages'
  | 'investor_portal'
  | 'fair_distribution'
  | 'approvals'
  | 'custom_reports'
  | 'investors'
  | 'contracts'
  | 'contracts_report'
  | 'chart_of_accounts'
  | 'journal_entries'
  | 'vouchers'
  | 'distributions'
  | 'reports'
  | 'audit_logs'
  | 'users'
  | 'settings'

type ThemeContextValue = {
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return context
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(
    () => localStorage.getItem('theme') !== 'light',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <ThemeContext.Provider
      value={{
        dark,
        toggle: () => setDark(value => !value),
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

class ScreenErrorBoundary extends Component<
  {
    children: ReactNode
    viewKey: string
  },
  {
    hasError: boolean
  }
> {
  state = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen render error:', error, info)
  }

  componentDidUpdate(previousProps: { viewKey: string }) {
    if (
      previousProps.viewKey !== this.props.viewKey &&
      this.state.hasError
    ) {
      this.setState({
        hasError: false,
      })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-rose-400" />

          <div>
            <h3 className="text-lg font-black text-white">
              حدث خطأ داخل هذه الشاشة
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              بقية النظام ما زالت تعمل. حدّث الشاشة أو راجع بيانات
              Supabase الخاصة بهذه الوحدة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث الصفحة
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

const views: Record<
  ActiveView,
  React.LazyExoticComponent<React.ComponentType>
> = {
  dashboard: DashboardView,
  accountant_dashboard: AccountantDashboard,
  collection_center: CollectionCenterView,
  liquidity_packages: LiquidityPackagesView,
  investor_portal: InvestorPortalView,
  fair_distribution: FairDistributionView,
  approvals: ApprovalCenterView,
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
  users: UsersView,
  settings: SettingsView,
}

const menuItems: Array<{
  id: ActiveView
  label: string
  icon: React.ElementType
  section: 'الرئيسية' | 'العمليات' | 'المالية' | 'الإدارة'
}> = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم العامة',
    icon: LayoutDashboard,
    section: 'الرئيسية',
  },
  {
    id: 'accountant_dashboard',
    label: 'لوحة المحاسب',
    icon: BarChart3,
    section: 'الرئيسية',
  },
  {
    id: 'liquidity_packages',
    label: 'باقات السيولة والمنتجات',
    icon: PackageOpen,
    section: 'العمليات',
  },
  {
    id: 'collection_center',
    label: 'مركز التحصيل والسداد',
    icon: HandCoins,
    section: 'العمليات',
  },
  {
    id: 'contracts_report',
    label: 'عقود العملاء والأقساط',
    icon: FileText,
    section: 'العمليات',
  },
  {
    id: 'fair_distribution',
    label: 'التوزيع العادل',
    icon: Scale,
    section: 'العمليات',
  },
  {
    id: 'approvals',
    label: 'مركز الاعتمادات',
    icon: FileCheck2,
    section: 'العمليات',
  },
  {
    id: 'investor_portal',
    label: 'بوابة المستثمر',
    icon: WalletCards,
    section: 'العمليات',
  },
  {
    id: 'investors',
    label: 'شؤون المستثمرين',
    icon: Users,
    section: 'العمليات',
  },
  {
    id: 'contracts',
    label: 'العقود الاستثمارية',
    icon: FileText,
    section: 'العمليات',
  },
  {
    id: 'vouchers',
    label: 'الخزينة والسندات',
    icon: CircleDollarSign,
    section: 'المالية',
  },
  {
    id: 'journal_entries',
    label: 'قيود اليومية العامة',
    icon: Receipt,
    section: 'المالية',
  },
  {
    id: 'chart_of_accounts',
    label: 'شجرة الحسابات',
    icon: FolderTree,
    section: 'المالية',
  },
  {
    id: 'distributions',
    label: 'توزيع الأرباح',
    icon: Percent,
    section: 'المالية',
  },
  {
    id: 'reports',
    label: 'التقارير والميزانية',
    icon: BarChart3,
    section: 'المالية',
  },
  {
    id: 'custom_reports',
    label: 'التقارير المخصصة',
    icon: BarChart3,
    section: 'المالية',
  },
  {
    id: 'audit_logs',
    label: 'سجلات التدقيق',
    icon: ShieldCheck,
    section: 'الإدارة',
  },
  {
    id: 'users',
    label: 'المستخدمون والصلاحيات',
    icon: UserCheck,
    section: 'الإدارة',
  },
  {
    id: 'settings',
    label: 'إعدادات النظام والربط',
    icon: Settings,
    section: 'الإدارة',
  },
]

const roleLabels: Record<string, string> = {
  admin: 'المدير العام',
  manager: 'مدير النظام',
  accountant: 'المحاسب',
  viewer: 'مستخدم عرض',
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [activeView, setActiveView] =
    useState<ActiveView>('dashboard')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarMini, setSidebarMini] = useState(false)
  const [alertCount, setAlertCount] = useState(0)

  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const { dark, toggle: toggleTheme } = useTheme()

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        setSession(currentSession)

        if (currentSession) {
          fetchProfile(currentSession.user.id)
        } else {
          setAuthLoading(false)
        }
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)

      if (currentSession) {
        fetchProfile(currentSession.user.id)
      } else {
        setProfile(null)
        setAuthLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    const loadAlerts = async () => {
      const today = new Date().toISOString().split('T')[0]

      const [paymentsResult, approvalsResult] = await Promise.all([
        supabase
          .from('contract_payments')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .neq('status', 'paid')
          .lte('due_date', today),

        supabase
          .from('approval_requests')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('status', 'pending'),
      ])

      setAlertCount(
        (paymentsResult.count || 0) +
          (approvalsResult.count || 0),
      )
    }

    loadAlerts()
  }, [session, activeView])

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        throw error
      }

      setProfile(data)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleAuthSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setAuthError('')
    setAuthSuccess('')
    setFormLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })

        if (error) {
          throw error
        }

        setAuthSuccess(
          'تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيده.',
        )
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          })

        if (error) {
          throw error
        }
      }
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'فشل تسجيل الدخول. تحقق من البيانات.',
      )
    } finally {
      setFormLoading(false)
    }
  }

  async function handleLogOut() {
    await supabase.auth.signOut()
    toast.success('تم إنهاء الجلسة بنجاح')
  }

  const groupedMenu = useMemo(() => {
    const sections = [
      'الرئيسية',
      'العمليات',
      'المالية',
      'الإدارة',
    ] as const

    return sections.map(section => ({
      section,
      items: menuItems.filter(item => item.section === section),
    }))
  }, [])

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
          }}
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-black text-slate-950"
        >
          ف
        </motion.div>

        <p className="text-sm font-semibold tracking-wider text-slate-400">
          جاري التحقق من الجلسة...
        </p>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <Toaster position="top-left" reverseOrder={false} />

        <div
          className={`flex min-h-screen items-center justify-center p-4 ${
            dark ? 'bg-slate-950' : 'bg-gray-100'
          }`}
          dir="rtl"
        >
          <div
            className={`w-full max-w-md space-y-6 rounded-3xl border p-8 shadow-2xl backdrop-blur ${
              dark
                ? 'border-slate-800 bg-slate-900/85'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-xl font-black text-slate-950">
                ف
              </div>

              <h1
                className={`text-3xl font-black ${
                  dark ? 'text-white' : 'text-gray-800'
                }`}
              >
                فزاع ERP
              </h1>

              <p
                className={`mt-2 text-xs ${
                  dark ? 'text-slate-400' : 'text-gray-500'
                }`}
              >
                منصة إدارة الاستثمار والمحاسبة والتحصيل
              </p>
            </div>

            <form
              onSubmit={handleAuthSubmit}
              className="space-y-4"
            >
              {authError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-600">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {isSignUp && (
                <div>
                  <label
                    className={`mb-1 block text-xs font-semibold ${
                      dark ? 'text-slate-400' : 'text-gray-600'
                    }`}
                  >
                    الاسم بالكامل
                  </label>

                  <input
                    value={fullName}
                    onChange={event =>
                      setFullName(event.target.value)
                    }
                    required
                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-emerald-500 ${
                      dark
                        ? 'border-slate-700 bg-slate-950 text-white'
                        : 'border-gray-300 bg-gray-50 text-gray-800'
                    }`}
                  />
                </div>
              )}

              <div>
                <label
                  className={`mb-1 block text-xs font-semibold ${
                    dark ? 'text-slate-400' : 'text-gray-600'
                  }`}
                >
                  البريد الإلكتروني
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-emerald-500 ${
                    dark
                      ? 'border-slate-700 bg-slate-950 text-white'
                      : 'border-gray-300 bg-gray-50 text-gray-800'
                  }`}
                />
              </div>

              <div>
                <label
                  className={`mb-1 block text-xs font-semibold ${
                    dark ? 'text-slate-400' : 'text-gray-600'
                  }`}
                >
                  كلمة المرور
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={event =>
                    setPassword(event.target.value)
                  }
                  required
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-emerald-500 ${
                    dark
                      ? 'border-slate-700 bg-slate-950 text-white'
                      : 'border-gray-300 bg-gray-50 text-gray-800'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full rounded-xl bg-emerald-500 py-3 font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {formLoading
                  ? 'جاري الاتصال...'
                  : isSignUp
                    ? 'إنشاء حساب'
                    : 'تسجيل الدخول'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(value => !value)
                setAuthError('')
                setAuthSuccess('')
              }}
              className={`w-full text-center text-xs font-semibold underline ${
                dark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {isSignUp
                ? 'لديك حساب؟ سجل الدخول'
                : 'إنشاء حساب موظف جديد'}
            </button>
          </div>
        </div>
      </>
    )
  }

  const ViewComponent = views[activeView]

  const currentLabel =
    menuItems.find(item => item.id === activeView)?.label ||
    'الرئيسية'

  return (
    <>
      <Toaster
        position="top-left"
        reverseOrder={false}
        toastOptions={{
          style: {
            fontFamily: 'Tajawal, sans-serif',
          },
        }}
      />

      <div
        className={`min-h-screen font-sans ${
          dark
            ? 'bg-slate-950 text-slate-100'
            : 'bg-gray-50 text-gray-800'
        }`}
        dir="rtl"
      >
        {sidebarOpen && (
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden"
          />
        )}

        <aside
          className={`fixed inset-y-0 right-0 z-40 flex flex-col border-l backdrop-blur-xl transition-all duration-300 ${
            dark
              ? 'border-slate-800 bg-slate-900/95'
              : 'border-gray-200 bg-white/95'
          } ${
            sidebarOpen
              ? 'translate-x-0'
              : 'translate-x-full lg:translate-x-0'
          } ${sidebarMini ? 'w-20' : 'w-72'}`}
        >
          <div className="flex items-center justify-between p-4">
            {!sidebarMini ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-black text-slate-950">
                  ف
                </div>

                <div>
                  <span className="block text-lg font-black text-emerald-400">
                    فزاع ERP
                  </span>

                  <span className="block text-[10px] text-slate-500">
                    إدارة مالية وتشغيلية متكاملة
                  </span>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-black text-slate-950">
                ف
              </div>
            )}

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!sidebarMini && profile && (
            <div className="mx-3 mb-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="truncate text-xs font-black text-white">
                {profile.full_name || profile.email}
              </p>

              <p className="mt-1 text-[10px] font-bold text-emerald-400">
                {roleLabels[profile.role] || profile.role}
              </p>
            </div>
          )}

          <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
            {groupedMenu.map(group => (
              <div
                key={group.section}
                className="mb-4"
              >
                {!sidebarMini && (
                  <p className="mb-1 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    {group.section}
                  </p>
                )}

                <div className="space-y-1">
                  {group.items.map(item => {
                    const Icon = item.icon
                    const isActive = activeView === item.id

                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setActiveView(item.id)
                          setSidebarOpen(false)
                        }}
                        title={sidebarMini ? item.label : ''}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
                          isActive
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : dark
                              ? 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-white'
                              : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        } ${sidebarMini ? 'justify-center' : ''}`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />

                        {!sidebarMini && (
                          <span>{item.label}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div
            className={`space-y-2 border-t p-3 ${
              dark ? 'border-slate-800' : 'border-gray-200'
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setSidebarMini(value => !value)
              }
              className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs transition ${
                dark
                  ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {sidebarMini ? (
                <ArrowLeft className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}

              {!sidebarMini && <span>تصغير القائمة</span>}
            </button>

            <button
              type="button"
              onClick={handleLogOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" />

              {!sidebarMini && <span>إنهاء الجلسة</span>}
            </button>
          </div>
        </aside>

        <div
          className={`flex min-h-screen flex-col transition-all ${
            sidebarMini ? 'lg:mr-20' : 'lg:mr-72'
          }`}
        >
          <header
            className={`sticky top-0 z-20 flex h-16 items-center justify-between border-b px-4 backdrop-blur-xl md:px-6 ${
              dark
                ? 'border-slate-800 bg-slate-900/75'
                : 'border-gray-200 bg-white/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <h2 className="flex items-center gap-2 text-sm font-black">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {currentLabel}
                </h2>

                <p className="mt-0.5 hidden text-[10px] text-slate-500 sm:block">
                  فزاع للاستثمار والمحاسبة والتحصيل
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('approvals')}
                className="relative rounded-xl p-2.5 transition hover:bg-slate-800"
                title="التنبيهات والاعتمادات"
              >
                <Bell
                  className={`h-5 w-5 ${
                    dark ? 'text-slate-400' : 'text-gray-500'
                  }`}
                />

                {alertCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className={`rounded-xl p-2.5 transition ${
                  dark
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                {dark ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
            </div>
          </header>

          <main
            id="fazza_workspace"
            className="mx-auto w-full max-w-[1600px] flex-1 p-4 pb-24 md:p-7"
          >
            <ScreenErrorBoundary viewKey={activeView}>
              <Suspense fallback={<PageLoading />}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeView}
                    initial={{
                      opacity: 0,
                      y: 8,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: -8,
                    }}
                    transition={{
                      duration: 0.18,
                    }}
                  >
                    <ViewComponent />
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </ScreenErrorBoundary>
          </main>
        </div>
      </div>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
