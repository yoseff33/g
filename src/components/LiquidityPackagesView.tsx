import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  CheckCircle2,
  ImagePlus,
  PackagePlus,
  Pencil,
  PlayCircle,
  Power,
  RefreshCw,
  Save,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import {
  calculateLiquidityPackage,
  type FirstPaymentMode,
} from '../lib/packages'
import { formatCurrency, formatDate } from '../lib/finance'

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

type PackageOrderRow = {
  id: string
  package_id: string
  package_snapshot: PackageRow
  customer_name: string
  customer_national_id?: string | null
  customer_phone?: string | null
  assigned_investor_id: string
  allocation_reason?: string | null
  capital_used: number
  investor_share: number
  investor_net_profit: number
  collected_amount?: number
  realized_profit?: number
  status: 'draft' | 'approved' | 'completed' | 'cancelled'
  created_at: string
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

const statusLabel: Record<PackageOrderRow['status'], string> = {
  draft: 'بانتظار الاعتماد',
  approved: 'معتمدة وتحت التحصيل',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
}

export default function LiquidityPackagesView() {
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [investors, setInvestors] = useState<InvestorRow[]>([])
  const [orders, setOrders] = useState<PackageOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(emptyPackage)
  const [selectedPackage, setSelectedPackage] = useState<PackageRow | null>(null)
  const [firstPaymentMode, setFirstPaymentMode] =
    useState<FirstPaymentMode>('customer')
  const [sourceType, setSourceType] =
    useState<'fazza' | 'investor_referral'>('fazza')
  const [referringInvestorId, setReferringInvestorId] = useState('')
  const [customer, setCustomer] = useState({
    name: '',
    nationalId: '',
    phone: '',
  })

  useEffect(() => {
    void fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const [packageResult, investorResult, orderResult] = await Promise.all([
      supabase.from('liquidity_packages').select('*').order('base_amount'),
      supabase
        .from('investors')
        .select(
          'id,name,status,capital_total,capital_available,rotation_paused,last_allocation_at',
        )
        .eq('status', 'active')
        .order('last_allocation_at', {
          ascending: true,
          nullsFirst: true,
        }),
      supabase
        .from('liquidity_package_orders')
        .select(
          'id,package_id,package_snapshot,customer_name,customer_national_id,customer_phone,assigned_investor_id,allocation_reason,capital_used,investor_share,investor_net_profit,collected_amount,realized_profit,status,created_at',
        )
        .order('created_at', { ascending: false }),
    ])

    if (packageResult.error) {
      toast.error(`تعذر تحميل الباقات: ${packageResult.error.message}`)
    }
    if (investorResult.error) {
      toast.error(`تعذر تحميل المستثمرين: ${investorResult.error.message}`)
    }
    if (orderResult.error) {
      toast.error(`تعذر تحميل طلبات الباقات: ${orderResult.error.message}`)
    }

    setPackages((packageResult.data || []) as PackageRow[])
    setInvestors(
      (investorResult.data || []).map((item: any) => ({
        ...item,
        name: String(item.name || '').trim(),
      })) as InvestorRow[],
    )
    setOrders((orderResult.data || []) as unknown as PackageOrderRow[])
    setLoading(false)
  }

  const preview = useMemo(() => {
    if (!selectedPackage) return null

    const transfer =
      firstPaymentMode === 'customer'
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
      adjustmentAmount:
        firstPaymentMode === 'platform'
          ? Number(selectedPackage.adjustment_amount)
          : 0,
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
      slug: editingId
        ? form.slug
        : `package-${form.base_amount}-${Date.now()}`,
      name: String(form.name || `باقة ${form.base_amount}`).trim(),
    }

    const percentageTotal =
      Number(payload.investor_percentage) +
      Number(payload.application_percentage) +
      Number(payload.owner_percentage)

    if (percentageTotal !== 100) {
      toast.error('مجموع النسب لازم يساوي 100%')
      return
    }

    const result = editingId
      ? await supabase
          .from('liquidity_packages')
          .update(payload)
          .eq('id', editingId)
      : await supabase.from('liquidity_packages').insert(payload)

    if (result.error) {
      toast.error(result.error.message)
      return
    }

    toast.success(editingId ? 'تم تحديث الباقة' : 'تمت إضافة الباقة')
    setShowEditor(false)
    await fetchData()
  }

  async function togglePackage(item: PackageRow) {
    const { error } = await supabase
      .from('liquidity_packages')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)

    if (error) {
      toast.error(error.message)
      return
    }

    await fetchData()
  }

  function chooseInvestor(capitalNeeded: number) {
    if (sourceType === 'investor_referral' && referringInvestorId) {
      const referred = investors.find(
        (item) => item.id === referringInvestorId,
      )

      if (
        referred &&
        Number(referred.capital_available ?? 0) >= capitalNeeded
      ) {
        return {
          investor: referred,
          reason: 'عميل محال من المستثمر؛ لا يستهلك الدور العام',
        }
      }
    }

    const eligible = investors
      .filter((item) => !item.rotation_paused)
      .filter(
        (item) =>
          Number(item.capital_available ?? 0) >= capitalNeeded,
      )
      .sort(
        (a, b) =>
          new Date(a.last_allocation_at || 0).getTime() -
          new Date(b.last_allocation_at || 0).getTime(),
      )

    return {
      investor: eligible[0],
      reason: 'اختيار تلقائي حسب أقدم دور ورصيد كافٍ',
    }
  }

  async function createOrder() {
    if (!selectedPackage || !preview) return

    if (!customer.name.trim()) {
      toast.error('اكتب اسم العميل')
      return
    }

    if (!preview.isBalanced) {
      toast.error('الحسبة غير متوازنة ولا يمكن إنشاء العملية')
      return
    }

    if (
      sourceType === 'investor_referral' &&
      !referringInvestorId
    ) {
      toast.error('حدد المستثمر اللي جاب العميل')
      return
    }

    const allocation = chooseInvestor(preview.capitalUsed)

    if (!allocation.investor) {
      toast.error('ما فيه مستثمر مؤهل ورصيده يغطي العملية')
      return
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession()

    if (sessionError) {
      toast.error(sessionError.message)
      return
    }

    const payload = {
      package_id: selectedPackage.id,
      package_snapshot: selectedPackage,
      customer_name: customer.name.trim(),
      customer_national_id: customer.nationalId.trim() || null,
      customer_phone: customer.phone.trim() || null,
      first_payment_mode: firstPaymentMode,
      source_type: sourceType,
      referring_investor_id:
        sourceType === 'investor_referral'
          ? referringInvestorId
          : null,
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
      collected_amount: 0,
      realized_profit: 0,
      status: 'draft',
      created_by: sessionData.session?.user.id || null,
      approved_by: null,
    }

    const { error } = await supabase
      .from('liquidity_package_orders')
      .insert(payload)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(
      `تم إنشاء الطلب وإسناده مبدئيًا للمستثمر ${allocation.investor.name}. بانتظار الاعتماد.`,
    )
    setCustomer({ name: '', nationalId: '', phone: '' })
    setSelectedPackage(null)
    await fetchData()
  }

  async function approveOrder(order: PackageOrderRow) {
    const confirmed = window.confirm(
      `اعتماد طلب ${order.customer_name} وخصم ${formatCurrency(
        order.capital_used,
      )} من رصيد المستثمر؟`,
    )

    if (!confirmed) return

    setProcessingId(order.id)

    try {
      const { error } = await supabase.rpc(
        'approve_liquidity_package_order',
        { p_order_id: order.id },
      )

      if (error) throw error

      toast.success('تم اعتماد الطلب وخصم رأس المال بنجاح')
      await fetchData()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'تعذر اعتماد الطلب',
      )
    } finally {
      setProcessingId('')
    }
  }

  async function cancelOrder(order: PackageOrderRow) {
    const confirmed = window.confirm(
      `هل أنت متأكد من إلغاء طلب ${order.customer_name}؟`,
    )

    if (!confirmed) return

    setProcessingId(order.id)

    try {
      const { error } = await supabase.rpc(
        'cancel_liquidity_package_order',
        { p_order_id: order.id },
      )

      if (error) throw error

      toast.success('تم إلغاء الطلب')
      await fetchData()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'تعذر إلغاء الطلب',
      )
    } finally {
      setProcessingId('')
    }
  }

  async function recordCollection(order: PackageOrderRow) {
    const remaining = Math.max(
      0,
      Number(order.investor_share || 0) -
        Number(order.collected_amount || 0),
    )

    if (remaining <= 0) {
      toast.error('اكتمل تحصيل العملية')
      return
    }

    const value = window.prompt(
      `أدخل مبلغ التحصيل. المتبقي ${formatCurrency(remaining)}`,
      String(remaining),
    )

    if (value === null) return

    const amount = Number(value.replace(/,/g, '').trim())

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('أدخل مبلغ تحصيل صحيح')
      return
    }

    setProcessingId(order.id)

    try {
      const { error } = await supabase.rpc(
        'record_liquidity_package_collection',
        {
          p_order_id: order.id,
          p_amount: amount,
        },
      )

      if (error) throw error

      toast.success('تم تسجيل التحصيل وتحديث محفظة المستثمر')
      await fetchData()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'تعذر تسجيل التحصيل',
      )
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div className="space-y-7 text-slate-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">
            باقات السيولة والمنتجات
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            إنشاء الطلب، إسناده، اعتماده، خصم رأس المال ومتابعة
            التحصيل والأرباح.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void fetchData()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-bold text-white"
          >
            <RefreshCw className="h-5 w-5" />
            تحديث
          </button>

          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-black text-slate-950"
          >
            <PackagePlus className="h-5 w-5" />
            إضافة باقة
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-slate-900 p-8 text-center">
          جاري تحميل الباقات...
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {packages.map((item) => (
            <div
              key={item.id}
              className={`overflow-hidden rounded-3xl border bg-slate-900 ${
                item.is_active
                  ? 'border-slate-800'
                  : 'border-rose-500/30 opacity-70'
              }`}
            >
              <div className="h-44 bg-slate-950">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImagePlus className="h-14 w-14 text-slate-700" />
                  </div>
                )}
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white">
                      {item.name}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {item.duration_months} أشهر •{' '}
                      {item.installments_count} دفعات
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-black ${
                      item.is_active
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {item.is_active ? 'فعالة' : 'موقوفة'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-950 p-3">
                    <p className="text-slate-500">قيمة الباقة</p>
                    <p className="font-black text-white">
                      {formatCurrency(item.base_amount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3">
                    <p className="text-slate-500">سعر المنتج</p>
                    <p className="font-black text-white">
                      {formatCurrency(item.total_product_price)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={!item.is_active}
                    onClick={() => {
                      setSelectedPackage(item)
                      setFirstPaymentMode('customer')
                    }}
                    className="flex-1 rounded-xl bg-sky-500 px-3 py-2.5 font-black text-white disabled:opacity-40"
                  >
                    <PlayCircle className="ml-1 inline h-4 w-4" />
                    بدء عملية
                  </button>

                  <button
                    onClick={() => openEdit(item)}
                    className="rounded-xl bg-slate-800 p-3"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => void togglePackage(item)}
                    className="rounded-xl bg-slate-800 p-3"
                  >
                    <Power className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <h2 className="text-xl font-black text-white">
              طلبات الباقات
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              اعتماد الطلبات ومتابعة التحصيل وربح المستثمر.
            </p>
          </div>
          <WalletCards className="h-6 w-6 text-emerald-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-right text-sm">
            <thead className="bg-slate-950/70 text-xs text-slate-400">
              <tr>
                <th className="p-4">الطلب</th>
                <th className="p-4">العميل</th>
                <th className="p-4">المستثمر</th>
                <th className="p-4">رأس المال</th>
                <th className="p-4">حصة المستثمر</th>
                <th className="p-4">الربح المتوقع</th>
                <th className="p-4">المحصل</th>
                <th className="p-4">الربح المحقق</th>
                <th className="p-4">الحالة</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">الإجراءات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="p-4 font-mono font-black text-emerald-400">
                    PKG-{order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="p-4">
                    <p className="font-black text-white">
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.customer_phone || '-'}
                    </p>
                  </td>
                  <td className="p-4 font-bold text-white">
                    {investors.find(
                      (investor) =>
                        investor.id === order.assigned_investor_id,
                    )?.name || '-'}
                  </td>
                  <td className="p-4 font-bold">
                    {formatCurrency(order.capital_used)}
                  </td>
                  <td className="p-4">
                    {formatCurrency(order.investor_share)}
                  </td>
                  <td className="p-4 font-black text-emerald-400">
                    {formatCurrency(order.investor_net_profit)}
                  </td>
                  <td className="p-4">
                    {formatCurrency(order.collected_amount || 0)}
                  </td>
                  <td className="p-4 text-emerald-300">
                    {formatCurrency(order.realized_profit || 0)}
                  </td>
                  <td className="p-4">
                    {statusLabel[order.status] || order.status}
                  </td>
                  <td className="p-4 text-slate-400">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {order.status === 'draft' && (
                        <button
                          disabled={processingId === order.id}
                          onClick={() => void approveOrder(order)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 font-black text-slate-950 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          اعتماد
                        </button>
                      )}

                      {order.status === 'approved' && (
                        <button
                          disabled={processingId === order.id}
                          onClick={() => void recordCollection(order)}
                          className="rounded-lg bg-sky-500 px-3 py-2 font-black text-white disabled:opacity-50"
                        >
                          تسجيل تحصيل
                        </button>
                      )}

                      {['draft', 'approved'].includes(order.status) && (
                        <button
                          disabled={processingId === order.id}
                          onClick={() => void cancelOrder(order)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-3 py-2 font-black text-rose-400 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          إلغاء
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="p-12 text-center font-bold text-slate-500"
                  >
                    لا توجد طلبات باقات.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPackage && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">
                  تنفيذ {selectedPackage.name}
                </h2>
                <p className="text-sm text-slate-400">
                  يتم إنشاء الطلب أولًا ثم اعتماده من جدول الطلبات.
                </p>
              </div>
              <button onClick={() => setSelectedPackage(null)}>
                <X />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label
                className={`cursor-pointer rounded-2xl border p-4 ${
                  firstPaymentMode === 'customer'
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  className="ml-2"
                  checked={firstPaymentMode === 'customer'}
                  onChange={() => setFirstPaymentMode('customer')}
                />
                العميل يدفع الدفعة الأولى
              </label>

              <label
                className={`cursor-pointer rounded-2xl border p-4 ${
                  firstPaymentMode === 'platform'
                    ? 'border-amber-500 bg-amber-500/5'
                    : 'border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  className="ml-2"
                  checked={firstPaymentMode === 'platform'}
                  onChange={() => setFirstPaymentMode('platform')}
                />
                المنصة تسدد الدفعة الأولى
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['التحويل للعميل', preview.customerTransfer],
                ['الدفعة علينا', preview.platformFirstPayment],
                ['رأس المال المستخدم', preview.capitalUsed],
                ['فرق التسوية', preview.adjustmentAmount],
                ['حصة المستثمر', preview.investorShare],
                ['صافي ربح المستثمر', preview.investorNetProfit],
                ['رسوم التطبيق', preview.applicationShare],
                ['حصة المالك', preview.ownerShare],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl bg-slate-950 p-4"
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-black text-white">
                    {formatCurrency(Number(value))}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <input
                value={customer.name}
                onChange={(event) =>
                  setCustomer({ ...customer, name: event.target.value })
                }
                placeholder="اسم العميل"
                className="rounded-xl border border-slate-700 bg-slate-950 p-3"
              />
              <input
                value={customer.nationalId}
                onChange={(event) =>
                  setCustomer({
                    ...customer,
                    nationalId: event.target.value,
                  })
                }
                placeholder="رقم الهوية"
                className="rounded-xl border border-slate-700 bg-slate-950 p-3"
              />
              <input
                value={customer.phone}
                onChange={(event) =>
                  setCustomer({ ...customer, phone: event.target.value })
                }
                placeholder="رقم الجوال"
                className="rounded-xl border border-slate-700 bg-slate-950 p-3"
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <select
                value={sourceType}
                onChange={(event) =>
                  setSourceType(
                    event.target.value as
                      | 'fazza'
                      | 'investor_referral',
                  )
                }
                className="rounded-xl border border-slate-700 bg-slate-950 p-3"
              >
                <option value="fazza">
                  عميل من فزاع — توزيع بالدور
                </option>
                <option value="investor_referral">
                  عميل جابه مستثمر
                </option>
              </select>

              {sourceType === 'investor_referral' && (
                <select
                  value={referringInvestorId}
                  onChange={(event) =>
                    setReferringInvestorId(event.target.value)
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                >
                  <option value="">اختر المستثمر المحيل</option>
                  {investors.map((investor) => (
                    <option key={investor.id} value={investor.id}>
                      {investor.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={() => void createOrder()}
              className="mt-6 w-full rounded-xl bg-emerald-500 px-5 py-4 text-lg font-black text-slate-950"
            >
              <Calculator className="ml-2 inline h-5 w-5" />
              إنشاء الطلب وإرساله للاعتماد
            </button>
          </div>
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6">
            <div className="flex justify-between">
              <h2 className="text-2xl font-black">
                {editingId ? 'تعديل الباقة' : 'إضافة باقة جديدة'}
              </h2>
              <button onClick={() => setShowEditor(false)}>
                <X />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                ['name', 'اسم الباقة', 'text'],
                ['base_amount', 'قيمة الباقة', 'number'],
                ['total_product_price', 'سعر المنتج الإجمالي', 'number'],
                [
                  'customer_transfer_when_customer_pays',
                  'تحويل العميل إذا دفع المقدم',
                  'number',
                ],
                [
                  'customer_transfer_when_platform_pays',
                  'تحويل العميل إذا المنصة دفعت',
                  'number',
                ],
                ['first_payment_amount', 'الدفعة الأولى', 'number'],
                ['adjustment_amount', 'فرق التسوية', 'number'],
                ['duration_months', 'مدة السداد بالشهور', 'number'],
                ['installments_count', 'عدد الأقساط', 'number'],
                ['investor_percentage', 'نسبة المستثمر', 'number'],
                ['application_percentage', 'نسبة التطبيق', 'number'],
                ['owner_percentage', 'نسبة المالك', 'number'],
                ['min_investor_balance', 'أقل رصيد مستثمر', 'number'],
                ['finance_company', 'شركة التمويل', 'text'],
                ['image_url', 'رابط صورة الباقة', 'text'],
              ].map(([key, label, type]) => (
                <label
                  key={key}
                  className="text-sm font-bold text-slate-300"
                >
                  {label}
                  <input
                    type={type}
                    value={form[key] ?? ''}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        [key]:
                          type === 'number'
                            ? Number(event.target.value)
                            : event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex gap-5">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      is_active: event.target.checked,
                    })
                  }
                  className="ml-2"
                />
                فعالة
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.show_to_customers}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      show_to_customers: event.target.checked,
                    })
                  }
                  className="ml-2"
                />
                تظهر للعملاء
              </label>
            </div>

            <button
              onClick={() => void savePackage()}
              className="mt-6 w-full rounded-xl bg-emerald-500 p-4 font-black text-slate-950"
            >
              <Save className="ml-2 inline h-5 w-5" />
              حفظ الباقة
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
