import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clock3, FileCheck2, Filter, RefreshCw, Search, ShieldCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/finance'
import { PageError, PageLoading } from './PageState'

type ApprovalRow = {
  id: string
  request_type: string
  title: string
  description?: string
  amount?: number | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  entity_type?: string
  entity_id?: string
  requested_by?: string
  reviewed_by?: string | null
  review_notes?: string | null
  created_at: string
  profiles?: { full_name?: string; email?: string }
}

const typeLabels: Record<string, string> = {
  investor_withdrawal: 'سحب مستثمر',
  capital_change: 'تعديل رأس المال',
  contract_change: 'تعديل عقد',
  payment_delete: 'إلغاء دفعة',
  profit_distribution: 'توزيع أرباح',
  contract_cancel: 'إلغاء عقد',
  general: 'طلب إداري',
}

const statusStyles: Record<ApprovalRow['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

const statusLabels: Record<ApprovalRow['status'], string> = {
  pending: 'بانتظار الاعتماد',
  approved: 'معتمد',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
}

export default function ApprovalCenterView() {
  const [rows, setRows] = useState<ApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | ApprovalRow['status']>('pending')
  const [processingId, setProcessingId] = useState('')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('approval_requests')
      .select('*, profiles:requested_by(full_name,email)')
      .order('created_at', { ascending: false })
      .limit(300)

    if (fetchError) {
      setError(`${fetchError.message}. لتفعيل دورة الاعتمادات شغّل database/professional_upgrade.sql في Supabase.`)
      setRows([])
    } else {
      setRows((data || []) as unknown as ApprovalRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(row => {
      if (status !== 'all' && row.status !== status) return false
      if (!term) return true
      return [row.title, row.description, row.request_type, row.profiles?.full_name, row.profiles?.email]
        .some(value => String(value || '').toLowerCase().includes(term))
    })
  }, [rows, search, status])

  const pendingTotal = useMemo(
    () => rows.filter(row => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows],
  )

  async function review(row: ApprovalRow, nextStatus: 'approved' | 'rejected') {
    const action = nextStatus === 'approved' ? 'اعتماد' : 'رفض'
    const notes = window.prompt(`ملاحظات ${action} الطلب`, '')
    if (notes === null) return

    setProcessingId(row.id)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { error: updateError } = await supabase
        .from('approval_requests')
        .update({
          status: nextStatus,
          reviewed_by: userData.user?.id || null,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', row.id)
        .eq('status', 'pending')

      if (updateError) throw updateError
      toast.success(nextStatus === 'approved' ? 'تم اعتماد الطلب' : 'تم رفض الطلب')
      await fetchRows()
    } catch (reviewError) {
      toast.error(reviewError instanceof Error ? reviewError.message : 'تعذر تحديث الطلب')
    } finally {
      setProcessingId('')
    }
  }

  if (loading) return <PageLoading label="جاري تحميل طلبات الاعتماد..." />
  if (error) return <PageError message={error} onRetry={fetchRows} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">مركز الاعتمادات</h1>
          <p className="mt-1 text-sm text-slate-400">لا تُنفذ العمليات الحساسة قبل مرورها بالمراجعة والتوثيق.</p>
        </div>
        <button onClick={fetchRows} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-200 hover:border-emerald-500/50">
          <RefreshCw className="w-4 h-4" /> تحديث
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center justify-between text-amber-400"><p className="text-xs font-bold">طلبات تنتظر القرار</p><Clock3 className="w-5 h-5" /></div>
          <p className="mt-3 text-3xl font-black text-white">{rows.filter(row => row.status === 'pending').length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center justify-between text-emerald-400"><p className="text-xs font-bold">قيمة الطلبات المعلقة</p><FileCheck2 className="w-5 h-5" /></div>
          <p className="mt-3 text-2xl font-black text-white">{formatCurrency(pendingTotal)}</p>
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
          <div className="flex items-center justify-between text-sky-400"><p className="text-xs font-bold">طلبات معتمدة</p><ShieldCheck className="w-5 h-5" /></div>
          <p className="mt-3 text-3xl font-black text-white">{rows.filter(row => row.status === 'approved').length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-500" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث في الطلبات ومقدميها" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pr-10 pl-4 text-sm text-white outline-none focus:border-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white outline-none">
              <option value="all">جميع الحالات</option>
              <option value="pending">بانتظار الاعتماد</option>
              <option value="approved">معتمد</option>
              <option value="rejected">مرفوض</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.map(row => (
          <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 hover:border-slate-700">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-emerald-400"><FileCheck2 className="w-5 h-5" /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-white">{row.title}</h3>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${statusStyles[row.status]}`}>{statusLabels[row.status]}</span>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-bold text-slate-400">{typeLabels[row.request_type] || row.request_type}</span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{row.description || 'لا توجد تفاصيل إضافية.'}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                    <span>الطالب: {row.profiles?.full_name || row.profiles?.email || 'مستخدم النظام'}</span>
                    <span>التاريخ: {formatDate(row.created_at.split('T')[0])}</span>
                    {row.amount != null && <span className="font-black text-slate-300">القيمة: {formatCurrency(row.amount)}</span>}
                  </div>
                  {row.review_notes && <div className="mt-3 rounded-xl bg-slate-950/70 p-3 text-xs text-slate-400">ملاحظات المراجع: {row.review_notes}</div>}
                </div>
              </div>
              {row.status === 'pending' && (
                <div className="flex shrink-0 gap-2">
                  <button disabled={processingId === row.id} onClick={() => review(row, 'approved')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"><Check className="w-4 h-4" /> اعتماد</button>
                  <button disabled={processingId === row.id} onClick={() => review(row, 'rejected')} className="inline-flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs font-black text-rose-400 hover:bg-rose-500 hover:text-white disabled:opacity-50"><X className="w-4 h-4" /> رفض</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center font-bold text-slate-500">لا توجد طلبات مطابقة.</div>}
      </div>
    </div>
  )
}
