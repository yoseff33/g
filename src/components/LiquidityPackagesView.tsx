import { useEffect, useMemo, useState } from 'react'
import { Calculator, ImagePlus, PackagePlus, Pencil, PlayCircle, Power, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { calculateLiquidityPackage, type FirstPaymentMode } from '../lib/packages'
import { formatCurrency } from '../lib/finance'

type PackageRow = {
  id: string
  name: string
  slug: string
  image_url?: string | null
  base_amount: number
  total_product_price: number
  customer_transfer_when_customer_pays: number
  customer_transfer_when_platform_pays: number
  first_payment_amount: number
  adjustment_amount: number
  duration_months: number
  installments_count: number
  investor_percentage: number
  application_percentage: number
  owner_percentage: number
  finance_company?: string | null
  min_investor_balance: number
  is_active: boolean
  show_to_customers: boolean
}

type InvestorRow = {
  id: string
  name: string
  status: string
  capital_total?: number
  capital_available?: number
  rotation_paused?: boolean
  last_allocation_at?: string | null
}

const emptyPackage = {
  name: '',
  base_amount: 1000,
  total_product_price: 2500,
  customer_transfer_when_customer_pays: 1000,
  customer_transfer_when_platform_pays: 650,
  first_payment_amount: 338,
  adjustment_amount: 12,
  duration_months: 4,
  installments_count: 4,
  investor_percentage: 70,
  application_percentage: 20,
  owner_percentage: 10,
  finance_company: '',
  min_investor_balance: 1000,
  image_url: '',
  show_to_customers: false,
  is_active: true,
}

export default function LiquidityPackagesView() {
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [investors, setInvestors] = useState<InvestorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(emptyPackage)
  const [selectedPackage, setSelectedPackage] = useState<PackageRow | null>(null)
  const [firstPaymentMode, setFirstPaymentMode] = useState<FirstPaymentMode>('customer')
  const [sourceType, setSourceType] = useState<'fazza' | 'investor_referral'>('fazza')
  const [referringInvestorId, setReferringInvestorId] = useState('')
  const [customer, setCustomer] = useState({ name: '', nationalId: '', phone: '' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [packageResult, investorResult] = await Promise.all([
      supabase.from('liquidity_packages').select('*').order('base_amount'),
      supabase.from('investors').select('*').eq('status', 'active').order('last_allocation_at', { ascending: true, nullsFirst: true }),
    ])
    if (packageResult.error) toast.error(`تعذر تحميل الباقات: ${packageResult.error.message}`)
    if (investorResult.error) toast.error(`تعذر تحميل المستثمرين: ${investorResult.error.message}`)
    setPackages((packageResult.data || []) as PackageRow[])
    setInvestors((investorResult.data || []) as InvestorRow[])
    setLoading(false)
  }

  const preview = useMemo(() => {
    if (!selectedPackage) return null
    const transfer = firstPaymentMode === 'customer'
      ? Number(selectedPackage.customer_transfer_when_customer_pays)
      : Number(selectedPackage.customer_transfer_when_platform_pays)
    return calculateLiquidityPackage({
      totalProductPrice: Number(selectedPackage.total_product_price),
      customerTransfer: transfer,
      firstPayment: Number(selectedPackage.first_payment_amount),
      firstPaymentMode,
      investorPercentage: Number(selectedPackage.investor_percentage),
      applicationPercentage: Number(selectedPackage.application_percentage),
      ownerPercentage: Number(selectedPackage.owner_percentage),
      adjustmentAmount: firstPaymentMode === 'platform' ? Number(selectedPackage.adjustment_amount) : 0,
    })
  }, [selectedPackage, firstPaymentMode])

  function openCreate() {
    setEditingId(null)
    setForm(emptyPackage)
    setShowEditor(true)
  }

  function openEdit(item: PackageRow) {
    setEditingId(item.id)
    setForm({ ...item })
    setShowEditor(true)
  }

  async function savePackage() {
    const payload = {
      ...form,
      slug: editingId ? form.slug : `package-${form.base_amount}-${Date.now()}`,
      name: form.name || `باقة ${form.base_amount}`,
    }
    if (Number(payload.investor_percentage) + Number(payload.application_percentage) + Number(payload.owner_percentage) !== 100) {
      toast.error('مجموع النسب لازم يساوي 100%')
      return
    }
    const result = editingId
      ? await supabase.from('liquidity_packages').update(payload).eq('id', editingId)
      : await supabase.from('liquidity_packages').insert(payload)
    if (result.error) return toast.error(result.error.message)
    toast.success(editingId ? 'تم تحديث الباقة' : 'تمت إضافة الباقة')
    setShowEditor(false)
    fetchData()
  }

  async function togglePackage(item: PackageRow) {
    const { error } = await supabase.from('liquidity_packages').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) return toast.error(error.message)
    fetchData()
  }

  function chooseInvestor(capitalNeeded: number) {
    if (sourceType === 'investor_referral' && referringInvestorId) {
      const referred = investors.find(item => item.id === referringInvestorId)
      if (referred && Number(referred.capital_available ?? referred.capital_total ?? 0) >= capitalNeeded) {
        return { investor: referred, reason: 'عميل محال من المستثمر؛ لا يستهلك الدور العام' }
      }
    }
    const eligible = investors
      .filter(item => !item.rotation_paused)
      .filter(item => Number(item.capital_available ?? item.capital_total ?? 0) >= capitalNeeded)
      .sort((a, b) => new Date(a.last_allocation_at || 0).getTime() - new Date(b.last_allocation_at || 0).getTime())
    return { investor: eligible[0], reason: 'اختيار تلقائي حسب أقدم دور ورصيد كافٍ' }
  }

  async function createOrder() {
    if (!selectedPackage || !preview) return
    if (!customer.name.trim()) return toast.error('اكتب اسم العميل')
    if (!preview.isBalanced) return toast.error('الحسبة غير متوازنة ولا يمكن اعتماد العملية')
    if (sourceType === 'investor_referral' && !referringInvestorId) return toast.error('حدد المستثمر اللي جاب العميل')

    const allocation = chooseInvestor(preview.capitalUsed)
    if (!allocation.investor) return toast.error('ما فيه مستثمر مؤهل ورصيده يغطي العملية')

    const { data: sessionData } = await supabase.auth.getSession()
    const payload = {
      package_id: selectedPackage.id,
      package_snapshot: selectedPackage,
      customer_name: customer.name,
      customer_national_id: customer.nationalId || null,
      customer_phone: customer.phone || null,
      first_payment_mode: firstPaymentMode,
      source_type: sourceType,
      referring_investor_id: sourceType === 'investor_referral' ? referringInvestorId : null,
      assigned_investor_id: allocation.investor.id,
      allocation_reason: allocation.reason,
      total_product_price: selectedPackage.total_product_price,
      customer_transfer: preview.customerTransfer,
      first_payment_amount: preview.platformFirstPayment,
      capital_used: preview.capitalUsed,
      investor_share: preview.investorShare,
      application_share: preview.applicationShare,
      owner_share: preview.ownerShare,
      investor_net_profit: preview.investorNetProfit,
      adjustment_amount: preview.adjustmentAmount,
      status: 'approved',
      created_by: sessionData.session?.user.id || null,
      approved_by: sessionData.session?.user.id || null,
    }

    const { error } = await supabase.from('liquidity_package_orders').insert(payload)
    if (error) return toast.error(error.message)
    await supabase.from('investors').update({ last_allocation_at: new Date().toISOString() }).eq('id', allocation.investor.id)
    toast.success(`تم اعتماد العملية وإسنادها للمستثمر ${allocation.investor.name}`)
    setCustomer({ name: '', nationalId: '', phone: '' })
    setSelectedPackage(null)
  }

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><h1 className="text-2xl font-black text-white">باقات السيولة والمنتجات</h1><p className="mt-1 text-sm text-slate-400">المحاسب يختار الباقة فقط، والنظام يحسب التحويل والأرباح ويختار المستثمر بالدور.</p></div>
        <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-black text-slate-950"><PackagePlus className="h-5 w-5" /> إضافة باقة</button>
      </div>

      {loading ? <div className="rounded-2xl bg-slate-900 p-8 text-center">جاري تحميل الباقات...</div> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {packages.map(item => (
            <div key={item.id} className={`overflow-hidden rounded-3xl border bg-slate-900 ${item.is_active ? 'border-slate-800' : 'border-rose-500/30 opacity-70'}`}>
              <div className="h-44 bg-slate-950">{item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImagePlus className="h-14 w-14 text-slate-700" /></div>}</div>
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between"><div><h2 className="text-xl font-black text-white">{item.name}</h2><p className="text-sm text-slate-400">{item.duration_months} أشهر • {item.installments_count} دفعات</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{item.is_active ? 'فعالة' : 'موقوفة'}</span></div>
                <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-950 p-3"><p className="text-slate-500">قيمة الباقة</p><p className="font-black text-white">{formatCurrency(item.base_amount)}</p></div><div className="rounded-xl bg-slate-950 p-3"><p className="text-slate-500">سعر المنتج</p><p className="font-black text-white">{formatCurrency(item.total_product_price)}</p></div></div>
                <div className="flex gap-2"><button disabled={!item.is_active} onClick={() => { setSelectedPackage(item); setFirstPaymentMode('customer') }} className="flex-1 rounded-xl bg-sky-500 px-3 py-2.5 font-black text-white disabled:opacity-40"><PlayCircle className="ml-1 inline h-4 w-4" /> بدء عملية</button><button onClick={() => openEdit(item)} className="rounded-xl bg-slate-800 p-3"><Pencil className="h-4 w-4" /></button><button onClick={() => togglePackage(item)} className="rounded-xl bg-slate-800 p-3"><Power className="h-4 w-4" /></button></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPackage && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6">
          <div className="flex items-center justify-between"><div><h2 className="text-2xl font-black">تنفيذ {selectedPackage.name}</h2><p className="text-sm text-slate-400">المعاينة تتغير مباشرة حسب طريقة الدفعة الأولى.</p></div><button onClick={() => setSelectedPackage(null)}><X /></button></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className={`cursor-pointer rounded-2xl border p-4 ${firstPaymentMode === 'customer' ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700'}`}><input type="radio" className="ml-2" checked={firstPaymentMode === 'customer'} onChange={() => setFirstPaymentMode('customer')} /> العميل يدفع الدفعة الأولى</label>
            <label className={`cursor-pointer rounded-2xl border p-4 ${firstPaymentMode === 'platform' ? 'border-amber-500 bg-amber-500/5' : 'border-slate-700'}`}><input type="radio" className="ml-2" checked={firstPaymentMode === 'platform'} onChange={() => setFirstPaymentMode('platform')} /> المنصة تسدد الدفعة الأولى</label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
            ['التحويل للعميل', preview.customerTransfer], ['الدفعة علينا', preview.platformFirstPayment], ['رأس المال المستخدم', preview.capitalUsed], ['فرق التسوية', preview.adjustmentAmount], ['حصة المستثمر', preview.investorShare], ['صافي ربح المستثمر', preview.investorNetProfit], ['رسوم التطبيق', preview.applicationShare], ['حصة المالك', preview.ownerShare],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-950 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-white">{formatCurrency(Number(value))}</p></div>)}</div>
          <div className="mt-6 grid gap-4 md:grid-cols-3"><input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} placeholder="اسم العميل" className="rounded-xl border border-slate-700 bg-slate-950 p-3" /><input value={customer.nationalId} onChange={e => setCustomer({ ...customer, nationalId: e.target.value })} placeholder="رقم الهوية" className="rounded-xl border border-slate-700 bg-slate-950 p-3" /><input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} placeholder="رقم الجوال" className="rounded-xl border border-slate-700 bg-slate-950 p-3" /></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2"><select value={sourceType} onChange={e => setSourceType(e.target.value as any)} className="rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="fazza">عميل من فزاع — توزيع بالدور</option><option value="investor_referral">عميل جابه مستثمر</option></select>{sourceType === 'investor_referral' && <select value={referringInvestorId} onChange={e => setReferringInvestorId(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">اختر المستثمر المحيل</option>{investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</div>
          <button onClick={createOrder} className="mt-6 w-full rounded-xl bg-emerald-500 px-5 py-4 text-lg font-black text-slate-950"><Calculator className="ml-2 inline h-5 w-5" /> اعتماد العملية بالحسبة التلقائية</button>
        </div></div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6">
          <div className="flex justify-between"><h2 className="text-2xl font-black">{editingId ? 'تعديل الباقة' : 'إضافة باقة جديدة'}</h2><button onClick={() => setShowEditor(false)}><X /></button></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[
            ['name','اسم الباقة','text'], ['base_amount','قيمة الباقة','number'], ['total_product_price','سعر المنتج الإجمالي','number'], ['customer_transfer_when_customer_pays','تحويل العميل إذا دفع المقدم','number'], ['customer_transfer_when_platform_pays','تحويل العميل إذا المنصة دفعت','number'], ['first_payment_amount','الدفعة الأولى','number'], ['adjustment_amount','فرق التسوية','number'], ['duration_months','مدة السداد بالشهور','number'], ['installments_count','عدد الأقساط','number'], ['investor_percentage','نسبة المستثمر','number'], ['application_percentage','نسبة التطبيق','number'], ['owner_percentage','نسبة المالك','number'], ['min_investor_balance','أقل رصيد مستثمر','number'], ['finance_company','شركة التمويل','text'], ['image_url','رابط صورة الباقة','text'],
          ].map(([key,label,type]) => <label key={key} className="text-sm font-bold text-slate-300">{label}<input type={type} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>)}</div>
          <div className="mt-5 flex gap-5"><label><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="ml-2" /> فعالة</label><label><input type="checkbox" checked={form.show_to_customers} onChange={e => setForm({ ...form, show_to_customers: e.target.checked })} className="ml-2" /> تظهر للعملاء</label></div>
          <button onClick={savePackage} className="mt-6 w-full rounded-xl bg-emerald-500 p-4 font-black text-slate-950"><Save className="ml-2 inline h-5 w-5" /> حفظ الباقة</button>
        </div></div>
      )}
    </div>
  )
}
