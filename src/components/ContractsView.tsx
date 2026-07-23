import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, Calendar, FilePlus, Pencil, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import type { Contract, Investor } from '../types'

type FormState = {
  contract_number: string
  investor_id: string
  amount: string
  profit_percentage: string
  start_date: string
  end_date: string
  status: Contract['status']
}

const today = () => new Date().toISOString().split('T')[0]

export default function ContractsView() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [investors, setInvestors] = useState<Investor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [form, setForm] = useState<FormState>({ contract_number: '', investor_id: '', amount: '', profit_percentage: '90', start_date: today(), end_date: '', status: 'active' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [contractsResult, investorsResult] = await Promise.all([
      supabase.from('contracts').select('*, investor:investors(*)').order('created_at', { ascending: false }),
      supabase.from('investors').select('*').order('name'),
    ])
    if (contractsResult.error) toast.error(contractsResult.error.message)
    if (investorsResult.error) toast.error(investorsResult.error.message)
    setContracts((contractsResult.data || []) as Contract[])
    setInvestors((investorsResult.data || []) as Investor[])
    setLoading(false)
  }

  function nextNumber() {
    const max = contracts.reduce((value, contract) => {
      const match = contract.contract_number.match(/(\d+)$/)
      return Math.max(value, Number(match?.[1] || 0))
    }, 0)
    return `CTR-${new Date().getFullYear()}-${String(max + 1).padStart(4, '0')}`
  }

  function openCreate() {
    setEditing(null)
    setForm({ contract_number: nextNumber(), investor_id: '', amount: '', profit_percentage: '90', start_date: today(), end_date: '', status: 'active' })
    setShowModal(true)
  }

  function openEdit(contract: Contract) {
    setEditing(contract)
    setForm({
      contract_number: contract.contract_number,
      investor_id: contract.investor_id,
      amount: String(contract.amount),
      profit_percentage: String(contract.profit_percentage),
      start_date: contract.start_date,
      end_date: contract.end_date,
      status: contract.status,
    })
    setShowModal(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const amount = Number(form.amount)
      const percentage = Number(form.profit_percentage)
      if (!form.contract_number.trim() || !form.investor_id || !form.start_date || !form.end_date) throw new Error('عبّ جميع الحقول المطلوبة')
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('رأس المال غير صحيح')
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new Error('نسبة الربح يجب أن تكون بين 0 و100')
      if (new Date(form.end_date) < new Date(form.start_date)) throw new Error('تاريخ النهاية لا يمكن أن يسبق البداية')

      const payload = { ...form, contract_number: form.contract_number.trim(), amount, profit_percentage: percentage, updated_at: new Date().toISOString() }
      const query = editing
        ? supabase.from('contracts').update(payload).eq('id', editing.id)
        : supabase.from('contracts').insert(payload)
      const { error } = await query
      if (error) throw error
      toast.success(editing ? 'تم تعديل العقد' : 'تم إنشاء العقد')
      setShowModal(false)
      await fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ العقد')
    } finally { setSaving(false) }
  }

  async function remove(contract: Contract) {
    const { count: vouchersCount } = await supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('contract_id', contract.id)
    const { count: distributionsCount } = await supabase.from('profit_distribution_items').select('*', { count: 'exact', head: true }).eq('contract_id', contract.id)
    if ((vouchersCount || 0) > 0 || (distributionsCount || 0) > 0) {
      toast.error('لا يمكن حذف عقد مرتبط بسندات أو توزيعات. غيّر حالته إلى مفسوخ بدلًا من الحذف.')
      return
    }
    if (!window.confirm(`حذف العقد ${contract.contract_number} نهائيًا؟`)) return
    const { error } = await supabase.from('contracts').delete().eq('id', contract.id)
    if (error) return toast.error(error.message)
    toast.success('تم حذف العقد')
    fetchData()
  }

  const filtered = useMemo(() => contracts.filter(contract => {
    const value = search.trim().toLowerCase()
    const matchesSearch = !value || contract.contract_number.toLowerCase().includes(value) || (contract.investor?.name || '').toLowerCase().includes(value)
    return matchesSearch && (statusFilter === 'all' || contract.status === statusFilter)
  }), [contracts, search, statusFilter])

  const currency = (value: number) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(value)

  return (
    <div className="space-y-6 text-slate-100" dir="rtl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-black text-white">العقود والربط الاستثماري</h1><p className="mt-1 text-sm text-slate-400">إضافة وتعديل وإنهاء وحذف العقود الاستثمارية مع حماية السجلات المالية المرتبطة.</p></div><button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400"><FilePlus className="h-4 w-4" /> توقيع عقد استثماري جديد</button></div>
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-[1fr_230px_auto]"><div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث برقم العقد أو اسم المستثمر" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-emerald-500" /></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm"><option value="all">كل حالات التعاقد</option><option value="active">عقد سارٍ</option><option value="completed">مكتمل</option><option value="terminated">مفسوخ</option></select><button onClick={fetchData} className="rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-slate-400 hover:text-white"><RefreshCw className="h-5 w-5" /></button></div>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-right text-xs"><thead className="border-b border-slate-800 bg-slate-950/50 text-slate-400"><tr><th className="p-4">رقم العقد</th><th className="p-4">المستثمر</th><th className="p-4">رأس المال</th><th className="p-4">نسبة الربح</th><th className="p-4">المدة</th><th className="p-4">الحالة</th><th className="p-4">الإجراءات</th></tr></thead><tbody className="divide-y divide-slate-800">{loading ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">جاري التحميل...</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">لا توجد عقود</td></tr> : filtered.map(contract => <tr key={contract.id} className="hover:bg-slate-800/40"><td className="p-4 font-mono font-black text-emerald-400">{contract.contract_number}</td><td className="p-4 font-bold text-white">{contract.investor?.name || 'غير معروف'}</td><td className="p-4 font-bold">{currency(Number(contract.amount))}</td><td className="p-4 font-black text-emerald-400">{contract.profit_percentage}%</td><td className="p-4 text-slate-400"><div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{contract.start_date} — {contract.end_date}</div></td><td className="p-4"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold ${contract.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : contract.status === 'completed' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}><ShieldCheck className="h-3.5 w-3.5" />{contract.status === 'active' ? 'عقد سارٍ' : contract.status === 'completed' ? 'مكتمل' : 'مفسوخ'}</span></td><td className="p-4"><div className="flex gap-2"><button onClick={() => openEdit(contract)} className="rounded-lg bg-blue-500/10 p-2 text-blue-400 hover:bg-blue-500 hover:text-white"><Pencil className="h-4 w-4" /></button><button onClick={() => remove(contract)} className="rounded-lg bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500 hover:text-white"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div></div>
      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"><div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-900"><div className="flex items-center justify-between border-b border-slate-800 p-5"><h3 className="font-black text-white">{editing ? 'تعديل العقد الاستثماري' : 'عقد استثماري جديد'}</h3><button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></div><form onSubmit={save} className="grid gap-4 p-6 md:grid-cols-2"><Field label="رقم العقد"><input required value={form.contract_number} onChange={event => setForm({ ...form, contract_number: event.target.value })} className="input" /></Field><Field label="المستثمر"><select required value={form.investor_id} onChange={event => setForm({ ...form, investor_id: event.target.value })} className="input"><option value="">اختر المستثمر</option>{investors.map(investor => <option key={investor.id} value={investor.id}>{investor.name}</option>)}</select></Field><Field label="رأس المال"><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} className="input" /></Field><Field label="نسبة الربح"><input required type="number" min="0" max="100" step="0.01" value={form.profit_percentage} onChange={event => setForm({ ...form, profit_percentage: event.target.value })} className="input" /></Field><Field label="تاريخ البداية"><input required type="date" value={form.start_date} onChange={event => setForm({ ...form, start_date: event.target.value })} className="input" /></Field><Field label="تاريخ النهاية"><input required type="date" value={form.end_date} onChange={event => setForm({ ...form, end_date: event.target.value })} className="input" /></Field><Field label="الحالة"><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as Contract['status'] })} className="input"><option value="active">سارٍ</option><option value="completed">مكتمل</option><option value="terminated">مفسوخ</option></select></Field><div className="flex items-end"><button disabled={saving} className="w-full rounded-xl bg-emerald-500 py-3 font-black text-slate-950 disabled:opacity-50">{saving ? 'جاري الحفظ...' : 'حفظ العقد'}</button></div></form></div></div>}
      <style>{`.input{width:100%;border-radius:.75rem;border:1px solid rgb(51 65 85);background:rgb(2 6 23);padding:.7rem 1rem;color:white;outline:none}.input:focus{border-color:rgb(16 185 129)}`}</style>
    </div>
  )
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-400">{label}</span>{children}</label> }
