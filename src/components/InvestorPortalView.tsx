import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CircleDollarSign,
  Download,
  FileText,
  Landmark,
  PieChart,
  Printer,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/finance'
import { PageError, PageLoading } from './PageState'

type InvestorRow = {
  id: string
  name: string
  national_id?: string
  phone?: string
  email?: string
  capital_total?: number
  capital_available?: number
  status?: string
}

type InvestorContract = {
  id: string
  serial_number?: number | string
  total_amount: number
  start_date?: string
  status?: string
  sale_type?: string
  finance_company?: string | null
  customers?: { name?: string; phone?: string }
  contract_payments?: Array<{
    amount_due?: number
    amount_paid?: number
    status?: string
    due_date?: string
  }>
}

type PackageOrder = {
  id: string
  customer_name: string
  customer_phone?: string | null
  capital_used: number
  investor_share: number
  investor_net_profit: number
  collected_amount?: number
  realized_profit?: number
  status: 'draft' | 'approved' | 'completed' | 'cancelled'
  created_at: string
  package_snapshot?: {
    name?: string
    finance_company?: string | null
  }
}

type InvestorOperation = {
  id: string
  reference: string
  customerName: string
  customerPhone?: string
  typeLabel: string
  fundedAmount: number
  dueAmount: number
  collectedAmount: number
  remainingAmount: number
  expectedProfit: number
  realizedProfit: number
  startDate?: string
  status: string
  source: 'installment_contracts' | 'liquidity_package_orders'
}

const packageStatusLabels: Record<string, string> = {
  draft: 'بانتظار الاعتماد',
  approved: 'معتمدة',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
}

export default function InvestorPortalView() {
  const [investors, setInvestors] = useState<InvestorRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [contracts, setContracts] = useState<InvestorContract[]>([])
  const [packageOrders, setPackageOrders] = useState<PackageOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [operationsLoading, setOperationsLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] =
    useState<'withdrawal' | 'capital' | ''>('')

  const fetchInvestors = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: investorsError } = await supabase
      .from('investors')
      .select(
        'id,name,national_id,phone,email,status,capital_total,capital_available',
      )
      .eq('status', 'active')
      .order('name')

    if (investorsError) {
      const fallback = await supabase
        .from('investors')
        .select('id,name,national_id,phone,email,status')
        .eq('status', 'active')
        .order('name')

      if (fallback.error) {
        setError(fallback.error.message)
        setLoading(false)
        return
      }

      const rows = (fallback.data || []).map((item: any) => ({
        ...item,
        name: String(item.name || '').trim(),
      }))

      setInvestors(rows as InvestorRow[])

      if (!selectedId && rows[0]?.id) {
        setSelectedId(rows[0].id)
      }
    } else {
      const rows = (data || []).map((item: any) => ({
        ...item,
        name: String(item.name || '').trim(),
      }))

      setInvestors(rows as InvestorRow[])

      if (!selectedId && rows[0]?.id) {
        setSelectedId(rows[0].id)
      }
    }

    setLoading(false)
  }, [selectedId])

  const fetchOperations = useCallback(async () => {
    if (!selectedId) {
      setContracts([])
      setPackageOrders([])
      return
    }

    setOperationsLoading(true)
    setError('')

    const [contractsResult, packagesResult] = await Promise.all([
      supabase
        .from('installment_contracts')
        .select(`
          id,
          serial_number,
          total_amount,
          start_date,
          status,
          sale_type,
          finance_company,
          customers (name, phone),
          contract_payments (
            amount_due,
            amount_paid,
            status,
            due_date
          )
        `)
        .eq('investor_id', selectedId)
        .order('created_at', { ascending: false }),

      supabase
        .from('liquidity_package_orders')
        .select(`
          id,
          customer_name,
          customer_phone,
          capital_used,
          investor_share,
          investor_net_profit,
          collected_amount,
          realized_profit,
          status,
          created_at,
          package_snapshot
        `)
        .eq('assigned_investor_id', selectedId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
    ])

    if (contractsResult.error) {
      setError(
        `${contractsResult.error.message}. تعذر تحميل عقود البيع الآجل.`,
      )
      setContracts([])
    } else {
      setContracts(
        (contractsResult.data || []) as unknown as InvestorContract[],
      )
    }

    if (packagesResult.error) {
      setError(
        (current) =>
          `${current ? `${current} ` : ''}${packagesResult.error.message}. شغّل ملف database/liquidity_packages.sql.`,
      )
      setPackageOrders([])
    } else {
      setPackageOrders(
        (packagesResult.data || []) as unknown as PackageOrder[],
      )
    }

    setOperationsLoading(false)
  }, [selectedId])

  useEffect(() => {
    void fetchInvestors()
  }, [fetchInvestors])

  useEffect(() => {
    void fetchOperations()
  }, [fetchOperations])

  const investor = investors.find((item) => item.id === selectedId)

  const operations = useMemo<InvestorOperation[]>(() => {
    const contractRows: InvestorOperation[] = contracts.map((contract) => {
      const payments = contract.contract_payments || []
      const due = payments.reduce(
        (sum, payment) => sum + Number(payment.amount_due || 0),
        0,
      )
      const paid = payments.reduce(
        (sum, payment) => sum + Number(payment.amount_paid || 0),
        0,
      )

      return {
        id: contract.id,
        reference: `#${contract.serial_number || '-'}`,
        customerName: contract.customers?.name || '-',
        customerPhone: contract.customers?.phone,
        typeLabel:
          contract.sale_type === 'finance'
            ? contract.finance_company || 'تطبيق تمويل'
            : 'بيع آجل',
        fundedAmount: Number(contract.total_amount || 0),
        dueAmount: due || Number(contract.total_amount || 0),
        collectedAmount: paid,
        remainingAmount: Math.max(
          0,
          (due || Number(contract.total_amount || 0)) - paid,
        ),
        expectedProfit: 0,
        realizedProfit: 0,
        startDate: contract.start_date,
        status: contract.status || 'active',
        source: 'installment_contracts',
      }
    })

    const packageRows: InvestorOperation[] = packageOrders.map((order) => ({
      id: order.id,
      reference: `PKG-${order.id.slice(0, 8).toUpperCase()}`,
      customerName: order.customer_name,
      customerPhone: order.customer_phone || undefined,
      typeLabel:
        order.package_snapshot?.name?.trim() || 'باقة سيولة',
      fundedAmount: Number(order.capital_used || 0),
      dueAmount: Number(order.investor_share || 0),
      collectedAmount: Number(order.collected_amount || 0),
      remainingAmount: Math.max(
        0,
        Number(order.investor_share || 0) -
          Number(order.collected_amount || 0),
      ),
      expectedProfit: Number(order.investor_net_profit || 0),
      realizedProfit: Number(order.realized_profit || 0),
      startDate: order.created_at,
      status: packageStatusLabels[order.status] || order.status,
      source: 'liquidity_package_orders',
    }))

    return [...packageRows, ...contractRows].sort(
      (a, b) =>
        new Date(b.startDate || 0).getTime() -
        new Date(a.startDate || 0).getTime(),
    )
  }, [contracts, packageOrders])

  const stats = useMemo(() => {
    const funded = operations.reduce(
      (sum, operation) => sum + operation.fundedAmount,
      0,
    )
    const due = operations.reduce(
      (sum, operation) => sum + operation.dueAmount,
      0,
    )
    const collected = operations.reduce(
      (sum, operation) => sum + operation.collectedAmount,
      0,
    )
    const outstanding = operations.reduce(
      (sum, operation) => sum + operation.remainingAmount,
      0,
    )
    const expectedProfit = operations.reduce(
      (sum, operation) => sum + operation.expectedProfit,
      0,
    )
    const realizedProfit = operations.reduce(
      (sum, operation) => sum + operation.realizedProfit,
      0,
    )
    const active = operations.filter(
      (operation) =>
        !['completed', 'closed', 'terminated', 'مكتملة'].includes(
          operation.status,
        ),
    ).length
    const collectionRate =
      due > 0 ? Math.round((collected / due) * 100) : 0

    return {
      funded,
      due,
      collected,
      outstanding,
      expectedProfit,
      realizedProfit,
      active,
      collectionRate,
    }
  }, [operations])

  async function createApprovalRequest(
    requestType: 'investor_withdrawal' | 'capital_change',
    amount: number,
    description: string,
  ) {
    if (!investor) throw new Error('اختر المستثمر أولًا')

    const { data: userData, error: userError } =
      await supabase.auth.getUser()

    if (userError) throw userError
    if (!userData.user) {
      throw new Error('الجلسة غير صالحة، سجّل الدخول من جديد')
    }

    const { error: insertError } = await supabase
      .from('approval_requests')
      .insert({
        request_type: requestType,
        title:
          requestType === 'capital_change'
            ? `طلب زيادة رأس مال — ${investor.name}`
            : `طلب سحب مستثمر — ${investor.name}`,
        description,
        amount,
        entity_type: 'investor',
        entity_id: investor.id,
        payload: {
          investor_id: investor.id,
          investor_name: investor.name,
          operation:
            requestType === 'capital_change'
              ? 'increase'
              : 'withdrawal',
          amount,
        },
        status: 'pending',
        requested_by: userData.user.id,
      })

    if (insertError) throw insertError
  }

  async function requestCapitalIncrease() {
    if (!investor) return

    const value = window.prompt(
      `أدخل مبلغ زيادة رأس المال للمستثمر ${investor.name}`,
      '',
    )

    if (value === null) return

    const amount = Number(value.replace(/,/g, '').trim())

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('أدخل مبلغًا صحيحًا أكبر من صفر')
      return
    }

    const notes = window.prompt(
      'اكتب ملاحظة أو مصدر التحويل (اختياري)',
      '',
    )

    if (notes === null) return

    setActionLoading('capital')

    try {
      await createApprovalRequest(
        'capital_change',
        amount,
        `طلب زيادة رأس مال بقيمة ${formatCurrency(
          amount,
        )} للمستثمر ${investor.name}.${
          notes.trim() ? ` الملاحظة: ${notes.trim()}` : ''
        }`,
      )
      toast.success('تم إرسال طلب زيادة رأس المال إلى مركز الاعتمادات')
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر إنشاء طلب زيادة رأس المال',
      )
    } finally {
      setActionLoading('')
    }
  }

  async function requestWithdrawal() {
    if (!investor) return

    const available = Number(investor.capital_available || 0)

    if (available <= 0) {
      toast.error('لا يوجد رأس مال متاح للسحب حاليًا')
      return
    }

    const value = window.prompt(
      `أدخل مبلغ السحب — المتاح ${formatCurrency(available)}`,
      '',
    )

    if (value === null) return

    const amount = Number(value.replace(/,/g, '').trim())

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('أدخل مبلغًا صحيحًا أكبر من صفر')
      return
    }

    if (amount > available) {
      toast.error(
        `المبلغ يتجاوز الرصيد المتاح: ${formatCurrency(available)}`,
      )
      return
    }

    const notes = window.prompt(
      'اكتب سبب السحب أو بيانات التحويل (اختياري)',
      '',
    )

    if (notes === null) return

    setActionLoading('withdrawal')

    try {
      await createApprovalRequest(
        'investor_withdrawal',
        amount,
        `طلب سحب بقيمة ${formatCurrency(
          amount,
        )} من محفظة المستثمر ${investor.name}.${
          notes.trim() ? ` الملاحظة: ${notes.trim()}` : ''
        }`,
      )
      toast.success('تم إرسال طلب السحب إلى مركز الاعتمادات')
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر إنشاء طلب السحب',
      )
    } finally {
      setActionLoading('')
    }
  }

  function openDocuments() {
    const section = document.getElementById('investor-operations')

    if (!section) {
      toast.error('تعذر الوصول إلى جدول العمليات')
      return
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function exportCsv() {
    const header = [
      'المرجع',
      'العميل',
      'نوع العملية',
      'رأس المال المستخدم',
      'المطلوب تحصيله',
      'المحصل',
      'المتبقي',
      'الربح المتوقع',
      'الربح المحقق',
      'الحالة',
    ]

    const lines = operations.map((operation) =>
      [
        operation.reference,
        operation.customerName,
        operation.typeLabel,
        operation.fundedAmount,
        operation.dueAmount,
        operation.collectedAmount,
        operation.remainingAmount,
        operation.expectedProfit,
        operation.realizedProfit,
        operation.status,
      ]
        .map(
          (value) =>
            `"${String(value).replace(/"/g, '""')}"`,
        )
        .join(','),
    )

    const blob = new Blob(
      [`\uFEFF${header.join(',')}\n${lines.join('\n')}`],
      { type: 'text/csv;charset=utf-8' },
    )

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `كشف_المستثمر_${
      investor?.name || 'فزاع'
    }.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function refreshAll() {
    await fetchInvestors()
    await fetchOperations()
  }

  if (loading) {
    return <PageLoading label="جاري تجهيز بوابة المستثمر..." />
  }

  if (error && investors.length === 0) {
    return <PageError message={error} onRetry={fetchInvestors} />
  }

  const cards = [
    {
      label: 'إجمالي العمليات الممولة',
      value: formatCurrency(stats.funded),
      icon: Landmark,
    },
    {
      label: 'إجمالي المحصل',
      value: formatCurrency(stats.collected),
      icon: CircleDollarSign,
    },
    {
      label: 'المبالغ القائمة',
      value: formatCurrency(stats.outstanding),
      icon: Wallet,
    },
    {
      label: 'نسبة التحصيل',
      value: `${stats.collectionRate}%`,
      icon: TrendingUp,
    },
    {
      label: 'الربح المتوقع',
      value: formatCurrency(stats.expectedProfit),
      icon: TrendingUp,
    },
    {
      label: 'الربح المحقق',
      value: formatCurrency(stats.realizedProfit),
      icon: CircleDollarSign,
    },
  ]

  return (
    <div className="space-y-6 print:text-black">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between no-print">
        <div>
          <h1 className="text-2xl font-black text-white">
            بوابة المستثمر
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            كشف لحظي للعقود وباقات السيولة والتحصيلات والأرباح.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-200"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                operationsLoading ? 'animate-spin' : ''
              }`}
            />
            تحديث
          </button>

          <button
            onClick={exportCsv}
            disabled={!investor}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>

          <button
            onClick={() => window.print()}
            disabled={!investor}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            طباعة الكشف
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-300 no-print">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 no-print">
        <label className="mb-2 block text-xs font-black text-slate-400">
          معاينة حساب المستثمر
        </label>

        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-bold text-white outline-none focus:border-emerald-500"
        >
          <option value="">اختر المستثمر</option>
          {investors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {investor ? (
        <>
          <div className="mb-6 hidden border-b-2 border-black pb-4 text-center print:block">
            <h1 className="text-2xl font-black">
              نظام فزاع المالي — كشف مستثمر
            </h1>
            <p className="mt-2">
              تاريخ الإصدار:{' '}
              {formatDate(new Date().toISOString().split('T')[0])}
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-l from-emerald-500/10 to-slate-900 p-6 print:border-black print:bg-white">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950">
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white print:text-black">
                    {investor.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400 print:text-black">
                    هوية: {investor.national_id || '-'} • جوال:{' '}
                    {investor.phone || '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="rounded-xl bg-slate-950/50 px-5 py-3 print:border print:border-black print:bg-white">
                  <p className="text-xs text-slate-400 print:text-black">
                    العمليات النشطة
                  </p>
                  <p className="mt-1 text-xl font-black text-white print:text-black">
                    {stats.active}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/50 px-5 py-3 print:border print:border-black print:bg-white">
                  <p className="text-xs text-slate-400 print:text-black">
                    رأس المال المتاح
                  </p>
                  <p className="mt-1 text-xl font-black text-emerald-400 print:text-black">
                    {formatCurrency(investor.capital_available || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const Icon = card.icon

              return (
                <div
                  key={card.label}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 print:border-black print:bg-white"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 print:text-black">
                      {card.label}
                    </p>
                    <Icon className="h-5 w-5 text-emerald-400 print:text-black" />
                  </div>
                  <p className="mt-4 text-2xl font-black text-white print:text-black">
                    {card.value}
                  </p>
                </div>
              )
            })}
          </div>

          <div
            id="investor-operations"
            className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 print:border-black print:bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-800 p-5 print:border-black">
              <div>
                <h3 className="font-black text-white print:text-black">
                  عمليات المستثمر
                </h3>
                <p className="mt-1 text-xs text-slate-500 print:text-black">
                  عقود البيع الآجل وباقات السيولة في كشف واحد.
                </p>
              </div>
              <PieChart className="h-5 w-5 text-emerald-400 print:text-black" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-right text-sm">
                <thead className="bg-slate-800/70 text-xs text-slate-400 print:bg-white print:text-black">
                  <tr>
                    <th className="p-4">المرجع</th>
                    <th className="p-4">العميل</th>
                    <th className="p-4">النوع</th>
                    <th className="p-4">رأس المال</th>
                    <th className="p-4">المطلوب</th>
                    <th className="p-4">المحصل</th>
                    <th className="p-4">المتبقي</th>
                    <th className="p-4">الربح المتوقع</th>
                    <th className="p-4">الربح المحقق</th>
                    <th className="p-4">البداية</th>
                    <th className="p-4">الحالة</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 print:divide-black">
                  {operations.map((operation) => (
                    <tr key={`${operation.source}-${operation.id}`}>
                      <td className="p-4 font-mono font-black text-emerald-400 print:text-black">
                        {operation.reference}
                      </td>
                      <td className="p-4">
                        <p className="font-black text-white print:text-black">
                          {operation.customerName}
                        </p>
                        <p className="text-xs text-slate-500 print:text-black">
                          {operation.customerPhone || '-'}
                        </p>
                      </td>
                      <td className="p-4 text-slate-300 print:text-black">
                        {operation.typeLabel}
                      </td>
                      <td className="p-4 font-bold text-slate-200 print:text-black">
                        {formatCurrency(operation.fundedAmount)}
                      </td>
                      <td className="p-4 font-bold text-slate-200 print:text-black">
                        {formatCurrency(operation.dueAmount)}
                      </td>
                      <td className="p-4 font-bold text-emerald-400 print:text-black">
                        {formatCurrency(operation.collectedAmount)}
                      </td>
                      <td className="p-4 font-bold text-rose-300 print:text-black">
                        {formatCurrency(operation.remainingAmount)}
                      </td>
                      <td className="p-4 font-bold text-emerald-300 print:text-black">
                        {formatCurrency(operation.expectedProfit)}
                      </td>
                      <td className="p-4 font-bold text-emerald-400 print:text-black">
                        {formatCurrency(operation.realizedProfit)}
                      </td>
                      <td className="p-4 text-slate-400 print:text-black">
                        {formatDate(operation.startDate)}
                      </td>
                      <td className="p-4">
                        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-black text-sky-400 print:border-black print:text-black">
                          {operation.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {operations.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="p-12 text-center font-bold text-slate-500"
                      >
                        لا توجد عمليات مرتبطة بالمستثمر.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 no-print">
            <button
              type="button"
              onClick={openDocuments}
              className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-right transition hover:border-emerald-500/40"
            >
              <FileText className="h-6 w-6 text-emerald-400" />
              <span>
                <strong className="block text-white">
                  العقود والمستندات
                </strong>
                <small className="text-slate-500">
                  الوصول إلى جميع عمليات المستثمر
                </small>
              </span>
            </button>

            <button
              type="button"
              onClick={() => void requestWithdrawal()}
              disabled={
                actionLoading !== '' ||
                Number(investor.capital_available || 0) <= 0
              }
              className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-right transition hover:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wallet className="h-6 w-6 text-emerald-400" />
              <span>
                <strong className="block text-white">
                  {actionLoading === 'withdrawal'
                    ? 'جاري إرسال الطلب...'
                    : 'طلب سحب'}
                </strong>
                <small className="text-slate-500">
                  يُحوّل إلى مركز الاعتمادات ويخصم بعد الموافقة
                </small>
              </span>
            </button>

            <button
              type="button"
              onClick={() => void requestCapitalIncrease()}
              disabled={actionLoading !== ''}
              className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-right transition hover:border-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Landmark className="h-6 w-6 text-emerald-400" />
              <span>
                <strong className="block text-white">
                  {actionLoading === 'capital'
                    ? 'جاري إرسال الطلب...'
                    : 'زيادة رأس المال'}
                </strong>
                <small className="text-slate-500">
                  إنشاء طلب زيادة وتحديث المحفظة بعد الاعتماد
                </small>
              </span>
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-500">
          اختر مستثمرًا لعرض بوابته.
        </div>
      )}
    </div>
  )
}
