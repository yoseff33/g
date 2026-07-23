import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Pencil, Plus, RefreshCw, Search, Shield, Trash2, UserCog, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types'

type UserForm = {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
}

const emptyForm: UserForm = {
  id: '',
  email: '',
  full_name: '',
  role: 'viewer',
  is_active: true,
}

const roleLabels: Record<UserRole, string> = {
  admin: 'المدير العام',
  manager: 'مدير النظام',
  accountant: 'المحاسب',
  viewer: 'مستخدم عرض',
}

export default function UsersView() {
  const [rows, setRows] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)

  useEffect(() => {
    fetchRows()
  }, [])

  async function fetchRows() {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setRows((data || []) as Profile[])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(row: Profile) {
    setEditing(row)
    setForm({
      id: row.id,
      email: row.email,
      full_name: row.full_name || '',
      role: row.role,
      is_active: row.is_active,
    })
    setShowModal(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      if (!form.email.trim() || !form.full_name.trim()) throw new Error('الاسم والبريد الإلكتروني مطلوبان')

      if (editing) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name.trim(),
            email: form.email.trim().toLowerCase(),
            role: form.role,
            is_active: form.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editing.id)
        if (error) throw error
        toast.success('تم تحديث المستخدم والصلاحية')
      } else {
        if (!form.id.trim()) {
          throw new Error('أدخل User ID من صفحة Authentication في Supabase')
        }
        const { error } = await supabase.from('profiles').insert({
          id: form.id.trim(),
          email: form.email.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          role: form.role,
          is_active: form.is_active,
        })
        if (error) throw error
        toast.success('تم ربط المستخدم بالنظام')
      }

      setShowModal(false)
      await fetchRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ المستخدم')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: Profile) {
    const next = !row.is_active
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) return toast.error(error.message)
    toast.success(next ? 'تم تفعيل المستخدم' : 'تم إيقاف المستخدم')
    fetchRows()
  }

  async function deleteProfile(row: Profile) {
    const confirmed = window.confirm(`حذف ملف المستخدم ${row.full_name || row.email} من النظام؟\nلن يتم حذف حساب Authentication نفسه.`)
    if (!confirmed) return
    const { error } = await supabase.from('profiles').delete().eq('id', row.id)
    if (error) return toast.error(error.message)
    toast.success('تم حذف ملف المستخدم من النظام')
    fetchRows()
  }

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase()
    return rows.filter(row => {
      const matchesSearch = !value || [row.full_name, row.email, row.id].some(item => String(item || '').toLowerCase().includes(value))
      const matchesRole = roleFilter === 'all' || row.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [rows, search, roleFilter])

  return (
    <div className="space-y-6 text-slate-100" dir="rtl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">المستخدمون والصلاحيات</h1>
          <p className="mt-1 text-sm text-slate-400">إدارة ملفات الموظفين وأدوارهم وحالة الوصول للنظام.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400">
          <Plus className="h-4 w-4" /> ربط مستخدم جديد
        </button>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
        <div className="flex items-start gap-2"><KeyRound className="mt-0.5 h-4 w-4 shrink-0" /><p>إنشاء حساب الدخول نفسه يتم من Supabase → Authentication → Users. بعدها انسخ User ID واربطه من زر «ربط مستخدم جديد». هذا يمنع وضع مفتاح Service Role داخل المتصفح.</p></div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-[1fr_220px_auto]">
        <div className="relative">
          <Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث بالاسم أو البريد أو User ID" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-emerald-500" />
        </div>
        <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm">
          <option value="all">كل الصلاحيات</option>
          {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button onClick={fetchRows} className="rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-slate-400 hover:text-white"><RefreshCw className="h-5 w-5" /></button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-slate-400"><tr><th className="p-4">المستخدم</th><th className="p-4">البريد</th><th className="p-4">الصلاحية</th><th className="p-4">الحالة</th><th className="p-4">تاريخ الإنشاء</th><th className="p-4">الإجراءات</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">جاري التحميل...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">لا توجد نتائج</td></tr> : filtered.map(row => (
                <tr key={row.id} className="hover:bg-slate-800/40">
                  <td className="p-4"><div className="font-black text-white">{row.full_name || 'بدون اسم'}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{row.id}</div></td>
                  <td className="p-4 text-slate-300">{row.email}</td>
                  <td className="p-4"><span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 font-bold text-violet-300"><Shield className="h-3.5 w-3.5" />{roleLabels[row.role]}</span></td>
                  <td className="p-4"><button onClick={() => toggleActive(row)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold ${row.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{row.is_active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}{row.is_active ? 'نشط' : 'موقوف'}</button></td>
                  <td className="p-4 text-slate-400">{new Date(row.created_at).toLocaleDateString('ar-SA')}</td>
                  <td className="p-4"><div className="flex gap-2"><button onClick={() => openEdit(row)} className="rounded-lg bg-blue-500/10 p-2 text-blue-400 hover:bg-blue-500 hover:text-white" title="تعديل"><Pencil className="h-4 w-4" /></button><button onClick={() => deleteProfile(row)} className="rounded-lg bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500 hover:text-white" title="حذف الملف"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-5"><h3 className="flex items-center gap-2 font-black text-white"><UserCog className="h-5 w-5 text-emerald-400" />{editing ? 'تعديل المستخدم' : 'ربط مستخدم جديد'}</h3><button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
            <form onSubmit={submit} className="space-y-4 p-6">
              {!editing && <Field label="User ID من Authentication"><input required value={form.id} onChange={event => setForm({ ...form, id: event.target.value })} className="input" placeholder="UUID" /></Field>}
              <Field label="الاسم الكامل"><input required value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} className="input" /></Field>
              <Field label="البريد الإلكتروني"><input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="input" /></Field>
              <Field label="الصلاحية"><select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as UserRole })} className="input">{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} /> حساب نشط</label>
              <button disabled={saving} className="w-full rounded-xl bg-emerald-500 py-3 font-black text-slate-950 disabled:opacity-50">{saving ? 'جاري الحفظ...' : 'حفظ البيانات'}</button>
            </form>
          </div>
        </div>
      )}
      <style>{`.input{width:100%;border-radius:.75rem;border:1px solid rgb(51 65 85);background:rgb(2 6 23);padding:.7rem 1rem;color:white;outline:none}.input:focus{border-color:rgb(16 185 129)}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-400">{label}</span>{children}</label>
}
