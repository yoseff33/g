import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import {
  formatCurrency,
  formatDate,
  getDaysDifference,
  getPaymentStatus,
  openWhatsApp,
  statusMeta,
  type PaymentStatus,
} from '../lib/finance'
import { PageError, PageLoading } from './PageState'

type PaymentRow = {
  id: string
  contract_id: string
  due_date: string
  amount_due: number
  amount_paid: number | null
  status: string
  payment_date: string | null
  payment_method: string | null
  installment_contracts?: {
    serial_number?: number | string
    total_amount?: number
    investor_id?: string
    customers?: { name?: string; phone?: string; national_id?: string }
    investors?: { name?: string }
  }
}

type FilterKey = 'all' | PaymentStatus

type PayForm = {
  amount: string
  method: 'cash' | 'bank_transfer' | 'card' | 'payment_link'
  reference: string
  notes: string
}

const paymentMethods: Record<PayForm['method'], string> = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  card: 'شبكة',
  payment_link: 'رابط دفع',
}

export default function CollectionCenterView() {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selected, setSelected] = useState<PaymentRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [payForm, setPayForm] = useState<PayForm>({
    amount: '',
    method: 'bank_transfer',
    reference: '',
    notes: '',
  })

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('contract_payments')
      .select(`
        id,
        contract_id,
        due_date,
        amount_due,
        amount_paid,
        status,
        payment_date,
        payment_method,
        installment_contracts (
          serial_number,
          total_amount,
          investor_id,
          customers (name, phone, national_id),
          investors (name)
        )
      `)
      .order('due_date', { ascending: true })
      .limit(500)

    if (fetchError) {
      setError(`${fetchError.message}. شغّل ملف database/professional_upgrade.sql في Supabase إذا لم تكن جداول التقسيط مهيأة.`)
      setRows([])
    } else {
      setRows((data || []) as unknown as PaymentRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const enrichedRows = useMemo(
    () => rows.map(row => ({ ...row, calculatedStatus: getPaymentStatus(row) })),
    [rows],
  )

  const summary = useMemo(() => {
    const unpaid = enrichedRows.filter(row => row.calculatedStatus !== 'paid')
    return {
      overdue: unpaid.filter(row => row.calculatedStatus === 'overdue').reduce((sum, row) => sum + Math.max(0, Number(row.amount_due) - Number(row.amount_paid || 0)), 0),
      today: unpaid.filter(row => row.calculatedStatus === 'due_today').reduce((sum, row) => sum + Math.max(0, Number(row.amount_due) - Number(row.amount_paid || 0)), 0),
      upcoming: unpaid.filter(row => row.calculatedStatus === 'upcoming').reduce((sum, row) => sum + Math.max(0, Number(row.amount_due) - Number(row.amount_paid || 0)), 0),
      paidCount: enrichedRows.filter(row => row.calculatedStatus === 'paid').length,
    }
  }, [enrichedRows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return enrichedRows.filter(row => {
      if (filter !== 'all' && row.calculatedStatus !== filter) return false
      if (!term) return true
      const contract = row.installment_contracts
      return [
        contract?.customers?.name,
        contract?.customers?.phone,
        contract?.customers?.national_id,
        contract?.investors?.name,
        String(contract?.serial_number || ''),
      ].some(value => String(value || '').toLowerCase().includes(term))
    })
  }, [enrichedRows, filter, search])

  function openPayment(row: PaymentRow) {
    const remaining = Math.max(0, Number(row.amount_due) - Number(row.amount_paid || 0))
    setSelected(row)
    setPayForm({ amount: String(remaining), method: 'bank_transfer', reference: '', notes: '' })
  }

  async function logActivity(row: PaymentRow, activityType: string, notes: string) {
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('collection_activities').insert({
      contract_id: row.contract_id,
      payment_id: row.id,
      activity_type: activityType,
      notes,
      created_by: userData.user?.id || null,
    })
  }

  async function submitPayment(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return

    const amount = Number(payForm.amount)
    const remaining = Math.max(0, Number(selected.amount_due) - Number(selected.amount_paid || 0))
    if (!amount || amount <= 0 || amount > remaining) {
      toast.error('أدخل مبلغًا صحيحًا لا يتجاوز المتبقي')
      return
    }

    setSaving(true)
    try {
      const { error: rpcError } = await supabase.rpc('register_installment_payment', {
        p_payment_id: selected.id,
        p_amount: amount,
        p_method: payForm.method,
        p_reference: payForm.reference || null,
        p_notes: payForm.notes || null,
      })

      if (rpcError) {
        const newPaid = Number(selected.amount_paid || 0) + amount
        const isPaid = newPaid >= Number(selected.amount_due)
        const { error: fallbackError } = await supabase
          .from('contract_payments')
          .update({
            amount_paid: newPaid,
            status: isPaid ? 'paid' : 'partial',
            payment_method: payForm.method,
            payment_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', selected.id)
        if (fallbackError) throw fallbackError
      }

      await logActivity(selected, 'payment', `تسجيل دفعة ${amount} ريال عبر ${paymentMethods[payForm.method]}${payForm.reference ? ` - مرجع ${payForm.reference}` : ''}`)
      toast.success('تم تسجيل الدفعة وتحديث رصيد العميل')
      setSelected(null)
      await fetchPayments()
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'تعذر تسجيل الدفعة'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function sendReminder(row: PaymentRow) {
    const customer = row.installment_contracts?.customers
    const remaining = Math.max(0, Number(row.amount_due) - Number(row.amount_paid || 0))
    const days = getDaysDifference(row.due_date)
    const message = days < 0
      ? `السلام عليكم أستاذ/ة ${customer?.name || ''}، نذكركم بوجود دفعة متأخرة بقيمة ${remaining} ريال، كان موعدها ${formatDate(row.due_date)}. نأمل المبادرة بالسداد، وشكرًا لتعاونكم.`
      : `السلام عليكم أستاذ/ة ${customer?.name || ''}، نذكركم بأن دفعتكم القادمة بقيمة ${remaining} ريال تستحق بتاريخ ${formatDate(row.due_date)}. نشكر لكم التزامكم.`

    if (!openWhatsApp(customer?.phone, message)) {
      toast.error('لا يوجد رقم جوال صالح للعميل')
      return
    }
    await logActivity(row, 'whatsapp', `إرسال تذكير واتساب بخصوص دفعة ${formatDate(row.due_date)}`)
    toast.success('تم فتح رسالة واتساب وحفظ النشاط')
  }

  async function recordPromise(row: PaymentRow) {
    const promisedDate = window.prompt('أدخل تاريخ وعد السداد بصيغة YYYY-MM-DD')
    if (!promisedDate) return
    await logActivity(row, 'promise_to_pay', `وعد بالسداد بتاريخ ${promisedDate}`)
    toast.success('تم تسجيل وعد السداد')
  }

  if (loading) return <PageLoading label="جاري تجهيز مركز التحصيل..." />
  if (error) return <PageError message={error} onRetry={fetchPayments} />

  const cards = [
    { label: 'المبالغ المتأخرة', value: formatCurrency(summary.overdue), icon: AlertTriangle, tone: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    { label: 'مستحق اليوم', value: formatCurrency(summary.today), icon: CalendarClock, tone: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { label: 'المبالغ القادمة', value: formatCurrency(summary.upcoming), icon: Clock3, tone: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    { label: 'أقساط مسددة', value: String(summary.paidCount), icon: CheckCircle2, tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">مركز التحصيل والسداد</h1>
          <p className="mt-1 text-sm text-slate-400">متابعة الاستحقاقات، السداد الجزئي، الوعود، ورسائل واتساب من شاشة واحدة.</p>
        </div>
        <button onClick={fetchPayments} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-200 hover:border-emerald-500/50">
          <RefreshCw className="w-4 h-4" /> تحديث البيانات
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`rounded-2xl border p-5 ${card.tone}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold opacity-80">{card.label}</p>
                  <p className="mt-3 text-2xl font-black text-white">{card.value}</p>
                </div>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="ابحث بالعميل، الجوال، الهوية، المستثمر أو رقم العقد"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pr-10 pl-4 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'الكل'],
              ['overdue', 'متأخر'],
              ['due_today', 'اليوم'],
              ['upcoming', 'قادم'],
              ['paid', 'مسدد'],
            ] as Array<[FilterKey, string]>).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-xl px-3 py-2 text-xs font-black transition ${filter === key ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-right text-sm">
            <thead className="bg-slate-800/80 text-xs text-slate-400">
              <tr>
                <th className="p-4">العميل والعقد</th>
                <th className="p-4">المستثمر</th>
                <th className="p-4">الاستحقاق</th>
                <th className="p-4">المبلغ</th>
                <th className="p-4">المتبقي</th>
                <th className="p-4">الحالة</th>
                <th className="p-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(row => {
                const status = getPaymentStatus(row)
                const meta = statusMeta[status]
                const customer = row.installment_contracts?.customers
                const remaining = Math.max(0, Number(row.amount_due) - Number(row.amount_paid || 0))
                const days = getDaysDifference(row.due_date)
                return (
                  <tr key={row.id} className="hover:bg-slate-800/40">
                    <td className="p-4">
                      <p className="font-black text-white">{customer?.name || 'عميل غير معروف'}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                        <span>عقد #{row.installment_contracts?.serial_number || '-'}</span>
                        {customer?.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-slate-300">{row.installment_contracts?.investors?.name || '-'}</td>
                    <td className="p-4">
                      <p className="font-bold text-slate-200">{formatDate(row.due_date)}</p>
                      <p className={`mt-1 text-xs ${days < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                        {days < 0 ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? 'اليوم' : `متبقي ${days} يوم`}
                      </p>
                    </td>
                    <td className="p-4 font-black text-slate-200">{formatCurrency(row.amount_due)}</td>
                    <td className="p-4 font-black text-rose-300">{formatCurrency(remaining)}</td>
                    <td className="p-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>{meta.label}</span></td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {status !== 'paid' && (
                          <button onClick={() => openPayment(row)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400">
                            <CreditCard className="w-4 h-4" /> سداد
                          </button>
                        )}
                        <button onClick={() => sendReminder(row)} className="rounded-lg bg-sky-500/10 p-2 text-sky-400 hover:bg-sky-500 hover:text-white" title="واتساب">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        {status !== 'paid' && (
                          <button onClick={() => recordPromise(row)} className="rounded-lg bg-amber-500/10 p-2 text-amber-400 hover:bg-amber-500 hover:text-slate-950" title="وعد بالسداد">
                            <CalendarClock className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center font-bold text-slate-500">لا توجد نتائج مطابقة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <form onSubmit={submitPayment} className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div>
                <h3 className="font-black text-white">تسجيل دفعة</h3>
                <p className="mt-1 text-xs text-slate-400">{selected.installment_contracts?.customers?.name} — عقد #{selected.installment_contracts?.serial_number}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs font-bold text-emerald-400">المتبقي على القسط</p>
                <p className="mt-2 text-2xl font-black text-white">{formatCurrency(Math.max(0, Number(selected.amount_due) - Number(selected.amount_paid || 0)))}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-400">مبلغ الدفعة</label>
                <input required min="0.01" step="0.01" type="number" value={payForm.amount} onChange={event => setPayForm({ ...payForm, amount: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-400">طريقة الدفع</label>
                <select value={payForm.method} onChange={event => setPayForm({ ...payForm, method: event.target.value as PayForm['method'] })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500">
                  {Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-400">المرجع البنكي أو رقم العملية</label>
                <input value={payForm.reference} onChange={event => setPayForm({ ...payForm, reference: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-400">ملاحظات</label>
                <textarea rows={3} value={payForm.notes} onChange={event => setPayForm({ ...payForm, notes: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="flex gap-3 border-t border-slate-800 p-5">
              <button disabled={saving} type="submit" className="flex-1 rounded-xl bg-emerald-500 py-3 font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
                {saving ? 'جاري التسجيل...' : 'اعتماد الدفعة'}
              </button>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-slate-800 px-5 py-3 font-bold text-slate-300 hover:bg-slate-700">إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
