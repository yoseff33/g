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

export default function InvestorPortalView() {
  const [investors, setInvestors] = useState<InvestorRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [contracts, setContracts] = useState<InvestorContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchInvestors = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: investorsError } = await supabase
      .from('investors')
      .select('id,name,national_id,phone,email,status,capital_total,capital_available')
      .eq('status', 'active')
      .order('name')

    if (investorsError) {
      const fallback = await supabase.from('investors').select('id,name,national_id,phone,email,status').eq('status', 'active').order('name')
      if (fallback.error) {
        setError(fallback.error.message)
        setLoading(false)
        return
      }
      setInvestors((fallback.data || []) as InvestorRow[])
      if (!selectedId && fallback.data?.[0]?.id) setSelectedId(fallback.data[0].id)
    } else {
      setInvestors((data || []) as InvestorRow[])
      if (!selectedId && data?.[0]?.id) setSelectedId(data[0].id)
    }
    setLoading(false)
  }, [selectedId])

  const fetchContracts = useCallback(async () => {
    if (!selectedId) {
      setContracts([])
      return
    }
    const { data, error: contractsError } = await supabase
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
        contract_payments (amount_due, amount_paid, status, due_date)
      `)
      .eq('investor_id', selectedId)
      .order('created_at', { ascending: false })

    if (contractsError) {
      setError(`${contractsError.message}. شغّل ملف database/professional_upgrade.sql إذا لم تكن جداول بوابة المستثمر جاهزة.`)
      setContracts([])
      return
    }
    setContracts((data || []) as unknown as InvestorContract[])
  }, [selectedId])

  useEffect(() => {
    fetchInvestors()
  }, [fetchInvestors])

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  const investor = investors.find(item => item.id === selectedId)

  const stats = useMemo(() => {
    const funded = contracts.reduce((sum, contract) => sum + Number(contract.total_amount || 0), 0)
    const due = contracts.flatMap(contract => contract.contract_payments || []).reduce((sum, payment) => sum + Number(payment.amount_due || 0), 0)
    const collected = contracts.flatMap(contract => contract.contract_payments || []).reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0)
    const outstanding = Math.max(0, due - collected)
    const active = contracts.filter(contract => !['completed', 'closed', 'terminated'].includes(contract.status || '')).length
    const collectionRate = due > 0 ? Math.round((collected / due) * 100) : 0
    return { funded, due, collected, outstanding, active, collectionRate }
  }, [contracts])

  function exportCsv() {
    const header = ['رقم العقد', 'العميل', 'نوع العملية', 'قيمة العقد', 'المحصل', 'المتبقي', 'الحالة']
    const lines = contracts.map(contract => {
      const paid = (contract.contract_payments || []).reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0)
      const due = (contract.contract_payments || []).reduce((sum, payment) => sum + Number(payment.amount_due || 0), 0)
      return [
        contract.serial_number || '',
        contract.customers?.name || '',
        contract.sale_type === 'finance' ? contract.finance_company || 'تطبيق تمويل' : 'بيع آجل',
        contract.total_amount,
        paid,
        Math.max(0, due - paid),
        contract.status || '',
      ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
    })
    const blob = new Blob([`\uFEFF${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `كشف_المستثمر_${investor?.name || 'فزاع'}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (loading) return <PageLoading label="جاري تجهيز بوابة المستثمر..." />
  if (error && investors.length === 0) return <PageError message={error} onRetry={fetchInvestors} />

  const cards = [
    { label: 'إجمالي العمليات الممولة', value: formatCurrency(stats.funded), icon: Landmark },
    { label: 'إجمالي المحصل', value: formatCurrency(stats.collected), icon: CircleDollarSign },
    { label: 'المبالغ القائمة', value: formatCurrency(stats.outstanding), icon: Wallet },
    { label: 'نسبة التحصيل', value: `${stats.collectionRate}%`, icon: TrendingUp },
  ]

  return (
    <div className="space-y-6 print:text-black">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between no-print">
        <div>
          <h1 className="text-2xl font-black text-white">بوابة المستثمر</h1>
          <p className="mt-1 text-sm text-slate-400">كشف لحظي لرأس المال والعمليات والتحصيلات الخاصة بكل مستثمر.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { fetchInvestors(); fetchContracts() }} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-200"><RefreshCw className="w-4 h-4" /> تحديث</button>
          <button onClick={exportCsv} disabled={!investor} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={() => window.print()} disabled={!investor} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50"><Printer className="w-4 h-4" /> طباعة الكشف</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 no-print">
        <label className="mb-2 block text-xs font-black text-slate-400">معاينة حساب المستثمر</label>
        <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-bold text-white outline-none focus:border-emerald-500">
          <option value="">اختر المستثمر</option>
          {investors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      {investor ? (
        <>
          <div className="hidden print:block mb-6 border-b-2 border-black pb-4 text-center">
            <h1 className="text-2xl font-black">نظام فزاع المالي — كشف مستثمر</h1>
            <p className="mt-2">تاريخ الإصدار: {formatDate(new Date().toISOString().split('T')[0])}</p>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-l from-emerald-500/10 to-slate-900 p-6 print:border-black print:bg-white">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950"><Building2 className="w-7 h-7" /></div>
                <div>
                  <h2 className="text-2xl font-black text-white print:text-black">{investor.name}</h2>
                  <p className="mt-1 text-sm text-slate-400 print:text-black">هوية: {investor.national_id || '-'} • جوال: {investor.phone || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="rounded-xl bg-slate-950/50 px-5 py-3 print:border print:border-black print:bg-white">
                  <p className="text-xs text-slate-400 print:text-black">العقود النشطة</p>
                  <p className="mt-1 text-xl font-black text-white print:text-black">{stats.active}</p>
                </div>
                <div className="rounded-xl bg-slate-950/50 px-5 py-3 print:border print:border-black print:bg-white">
                  <p className="text-xs text-slate-400 print:text-black">رأس المال المتاح</p>
                  <p className="mt-1 text-xl font-black text-emerald-400 print:text-black">{formatCurrency(investor.capital_available || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(card => {
              const Icon = card.icon
              return (
                <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 print:border-black print:bg-white">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 print:text-black">{card.label}</p>
                    <Icon className="w-5 h-5 text-emerald-400 print:text-black" />
                  </div>
                  <p className="mt-4 text-2xl font-black text-white print:text-black">{card.value}</p>
                </div>
              )
            })}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 print:border-black print:bg-white">
            <div className="flex items-center justify-between border-b border-slate-800 p-5 print:border-black">
              <div>
                <h3 className="font-black text-white print:text-black">عمليات المستثمر</h3>
                <p className="mt-1 text-xs text-slate-500 print:text-black">كل مبلغ مرتبط بعقد وسجل تحصيل واضح.</p>
              </div>
              <PieChart className="w-5 h-5 text-emerald-400 print:text-black" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-right text-sm">
                <thead className="bg-slate-800/70 text-xs text-slate-400 print:bg-white print:text-black">
                  <tr>
                    <th className="p-4">العقد</th>
                    <th className="p-4">العميل</th>
                    <th className="p-4">النوع</th>
                    <th className="p-4">قيمة العملية</th>
                    <th className="p-4">المحصل</th>
                    <th className="p-4">المتبقي</th>
                    <th className="p-4">البداية</th>
                    <th className="p-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-black">
                  {contracts.map(contract => {
                    const paid = (contract.contract_payments || []).reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0)
                    const due = (contract.contract_payments || []).reduce((sum, payment) => sum + Number(payment.amount_due || 0), 0)
                    return (
                      <tr key={contract.id}>
                        <td className="p-4 font-mono font-black text-emerald-400 print:text-black">#{contract.serial_number || '-'}</td>
                        <td className="p-4 font-black text-white print:text-black">{contract.customers?.name || '-'}</td>
                        <td className="p-4 text-slate-300 print:text-black">{contract.sale_type === 'finance' ? contract.finance_company || 'تمويل' : 'بيع آجل'}</td>
                        <td className="p-4 font-bold text-slate-200 print:text-black">{formatCurrency(contract.total_amount)}</td>
                        <td className="p-4 font-bold text-emerald-400 print:text-black">{formatCurrency(paid)}</td>
                        <td className="p-4 font-bold text-rose-300 print:text-black">{formatCurrency(Math.max(0, due - paid))}</td>
                        <td className="p-4 text-slate-400 print:text-black">{formatDate(contract.start_date)}</td>
                        <td className="p-4"><span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-black text-sky-400 print:border-black print:text-black">{contract.status || 'نشط'}</span></td>
                      </tr>
                    )
                  })}
                  {contracts.length === 0 && <tr><td colSpan={8} className="p-12 text-center font-bold text-slate-500">لا توجد عمليات مرتبطة بالمستثمر.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 no-print">
            <button className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-right hover:border-emerald-500/40">
              <FileText className="w-6 h-6 text-emerald-400" />
              <span><strong className="block text-white">العقود والمستندات</strong><small className="text-slate-500">الوصول إلى نسخ العقود والإيصالات</small></span>
            </button>
            <button className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-right hover:border-emerald-500/40">
              <Wallet className="w-6 h-6 text-emerald-400" />
              <span><strong className="block text-white">طلب سحب</strong><small className="text-slate-500">يُحوّل إلى مركز الاعتمادات</small></span>
            </button>
            <button className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-right hover:border-emerald-500/40">
              <Landmark className="w-6 h-6 text-emerald-400" />
              <span><strong className="block text-white">زيادة رأس المال</strong><small className="text-slate-500">إنشاء طلب تمويل إضافي</small></span>
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-500">اختر مستثمرًا لعرض بوابته.</div>
      )}
    </div>
  )
}
