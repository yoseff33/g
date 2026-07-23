import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { supabase } from './lib/supabase'
import {
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  FileText,
  MessageCircle,
  Plus,
  Printer,
  Search,
  Wallet,
  X,
} from 'lucide-react'

type SaleType = 'deferred' | 'finance'
type PersonKind = 'customer' | 'investor' | 'guarantor'

type ReportRow = Record<string, any> & {
  contract_id?: string | number
  serial_number?: string | number
  customer_id?: string | number
  investor_id?: string | number
  customer_name?: string
  customer_id_num?: string
  phone?: string
  investor_name?: string
  guarantor_name?: string
  guarantor_id_number?: string
  guarantor_phone?: string
  total_amount?: string | number
  total_paid?: string | number
  discount_amount?: string | number
  remaining_amount?: string | number
  late_amount?: string | number
  installment_amount?: string | number
  last_payment_date?: string
  sale_type?: SaleType
  finance_company?: string
}

type PersonModalState = {
  kind: PersonKind
  title: string
  contractSerial?: string | number
  data: Record<string, any>
}

const DAY_IN_MS = 1000 * 60 * 60 * 24

function getTodayInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateOnly(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function addMonthsToDateString(dateString: string, monthsToAdd: number) {
  const [year, month, day] = dateString.split('-').map(Number)
  const targetMonthStart = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1))
  const targetYear = targetMonthStart.getUTCFullYear()
  const targetMonth = targetMonthStart.getUTCMonth()
  const lastDayInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const safeDay = Math.min(day, lastDayInTargetMonth)
  const targetDate = new Date(Date.UTC(targetYear, targetMonth, safeDay))
  return targetDate.toISOString().split('T')[0]
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: unknown) {
  return toNumber(value).toLocaleString('ar-SA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = parseDateOnly(value)
  if (!date) return value
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function normalizeArabicDigits(value: string) {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹'

  return value
    .replace(/[٠-٩]/g, digit => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(persianDigits.indexOf(digit)))
}

function digitsOnly(value: string) {
  return normalizeArabicDigits(value).replace(/\D/g, '')
}

function normalizeSaudiWhatsAppNumber(phone: string) {
  const digits = digitsOnly(phone)
  if (digits.startsWith('00966')) return digits.slice(2)
  if (digits.startsWith('966')) return digits
  if (digits.startsWith('05')) return `966${digits.slice(1)}`
  if (digits.startsWith('5') && digits.length === 9) return `966${digits}`
  return digits
}

function getSaleTypeLabel(report: ReportRow) {
  if (report.sale_type === 'finance') {
    return report.finance_company ? `تمويل - ${report.finance_company}` : 'شركة تمويل'
  }
  if (report.sale_type === 'deferred') return 'بيع آجل'
  return 'غير محدد'
}

function escapeCsvCell(value: unknown) {
  const stringValue = value === null || value === undefined ? '' : String(value)
  const protectedValue = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue
  return `"${protectedValue.replace(/"/g, '""')}"`
}

export default function ContractsReport() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [investors, setInvestors] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [contractToPrint, setContractToPrint] = useState<ReportRow | null>(null)

  const [viewClient, setViewClient] = useState<ReportRow | null>(null)
  const [installments, setInstallments] = useState<any[]>([])
  const [payData, setPayData] = useState({ id: '', method: 'cash', amount: '' })

  const [personModal, setPersonModal] = useState<PersonModalState | null>(null)
  const [personLoading, setPersonLoading] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInvestor, setSelectedInvestor] = useState('')
  const [selectedSaleType, setSelectedSaleType] = useState('')

  const [contractPayments, setContractPayments] = useState<Record<string, any[]>>({})

  const [formData, setFormData] = useState({
    investor_id: '',
    customer_name: '',
    national_id: '',
    phone: '',
    guarantor_name: '',
    guarantor_id_number: '',
    guarantor_phone: '',
    total_amount: '',
    installment_amount: '',
    discount_amount: '0',
    start_date: getTodayInputValue(),
    sale_type: 'deferred' as SaleType,
    finance_company: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setFetching(true)
    setFetchError('')

    try {
      const [reportResult, investorResult] = await Promise.all([
        supabase.from('vw_contracts_report').select('*').order('serial_number', { ascending: true }),
        supabase.from('investors').select('*').order('name', { ascending: true }),
      ])

      if (reportResult.error) throw reportResult.error
      if (investorResult.error) throw investorResult.error

      const reportRows = (reportResult.data || []) as ReportRow[]
      const investorRows = investorResult.data || []
      setInvestors(investorRows)

      const contractIds = Array.from(
        new Set(
          reportRows
            .map(row => row.contract_id)
            .filter((id): id is string | number => id !== null && id !== undefined && id !== ''),
        ),
      )

      let contractRows: any[] = []
      if (contractIds.length > 0) {
        const contractResult = await supabase
          .from('installment_contracts')
          .select(
            'id, customer_id, investor_id, guarantor_name, guarantor_id_number, guarantor_phone, total_amount, installment_amount, discount_amount, start_date, sale_type, finance_company',
          )
          .in('id', contractIds)

        if (contractResult.error) throw contractResult.error
        contractRows = contractResult.data || []
      }

      const contractMap = new Map(contractRows.map(contract => [String(contract.id), contract]))
      const customerIds = Array.from(
        new Set(
          contractRows
            .map(contract => contract.customer_id)
            .filter((id): id is string | number => id !== null && id !== undefined && id !== ''),
        ),
      )

      let customerRows: any[] = []
      if (customerIds.length > 0) {
        const customerResult = await supabase
          .from('customers')
          .select('id, name, national_id, phone')
          .in('id', customerIds)

        if (customerResult.error) throw customerResult.error
        customerRows = customerResult.data || []
      }

      const customerMap = new Map(customerRows.map(customer => [String(customer.id), customer]))
      const investorMap = new Map(investorRows.map((investor: any) => [String(investor.id), investor]))

      const mergedReports = reportRows.map(row => {
        const contract = row.contract_id ? contractMap.get(String(row.contract_id)) : null
        const customerId = row.customer_id ?? contract?.customer_id
        const investorId = row.investor_id ?? contract?.investor_id
        const customer = customerId ? customerMap.get(String(customerId)) : null
        const investor = investorId ? investorMap.get(String(investorId)) : null

        return {
          ...row,
          contract_id: row.contract_id ?? contract?.id,
          customer_id: customerId,
          investor_id: investorId,
          customer_name: row.customer_name ?? customer?.name,
          customer_id_num: row.customer_id_num ?? row.national_id ?? customer?.national_id,
          phone: row.phone ?? customer?.phone,
          investor_name: row.investor_name ?? investor?.name,
          guarantor_name: row.guarantor_name ?? contract?.guarantor_name,
          guarantor_id_number: row.guarantor_id_number ?? contract?.guarantor_id_number,
          guarantor_phone: row.guarantor_phone ?? contract?.guarantor_phone,
          total_amount: row.total_amount ?? contract?.total_amount,
          installment_amount: row.installment_amount ?? contract?.installment_amount,
          discount_amount: row.discount_amount ?? contract?.discount_amount,
          sale_type: row.sale_type ?? contract?.sale_type,
          finance_company: row.finance_company ?? contract?.finance_company,
          start_date: row.start_date ?? contract?.start_date,
        } as ReportRow
      })

      setReports(mergedReports)
    } catch (error: any) {
      console.error('Failed to load contracts report:', error)
      setFetchError(error?.message || 'تعذر تحميل بيانات العقود')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    async function fetchAllPayments() {
      const contractIds = Array.from(
        new Set(
          reports
            .map(report => report.contract_id)
            .filter((id): id is string | number => id !== null && id !== undefined && id !== ''),
        ),
      )

      if (contractIds.length === 0) {
        setContractPayments({})
        return
      }

      const { data, error } = await supabase
        .from('contract_payments')
        .select('*')
        .in('contract_id', contractIds)
        .order('due_date', { ascending: true })

      if (error) {
        console.error('Failed to load contract payments:', error)
        return
      }

      const paymentMap: Record<string, any[]> = {}
      ;(data || []).forEach(payment => {
        const key = String(payment.contract_id)
        if (!paymentMap[key]) paymentMap[key] = []
        paymentMap[key].push(payment)
      })

      setContractPayments(paymentMap)
    }

    fetchAllPayments()
  }, [reports])

  const sendWhatsApp = (
    phone: string,
    type: 'reminder' | 'today' | 'late' | 'thanks' | 'contact',
    name: string,
    amount: string | number,
    date = '',
  ) => {
    const messages = {
      reminder: `السلام عليكم أستاذ/ة ${name}، نود تذكيركم بأن موعد استحقاق دفعتكم القادمة سيكون بتاريخ ${formatDate(date)} بمبلغ ${formatMoney(amount)} ريال. نأمل التكرم بسدادها في موعدها، ونشكركم على ثقتكم بنا.`,
      today: `السلام عليكم أستاذ/ة ${name}، نفيدكم بأن دفعتكم المستحقة اليوم بتاريخ ${formatDate(date)} بقيمة ${formatMoney(amount)} ريال أصبحت مستحقة. نرجو المبادرة بالسداد، وشكراً لكم.`,
      late: `السلام عليكم أستاذ/ة ${name}، تشير سجلاتنا إلى وجود قسط مستحق لم يتم سداده حتى الآن، وقيمته ${formatMoney(amount)} ريال، وكان تاريخ استحقاقه ${formatDate(date)}. نرجو سرعة السداد لتجنب أي إجراءات أو رسوم وفقاً للعقد. شكراً لتعاونكم.`,
      thanks: `السلام عليكم أستاذ/ة ${name}، تم استلام دفعتكم بنجاح، ونشكركم على التزامكم بالسداد. نسعد بخدمتكم دائماً.`,
      contact: `السلام عليكم أستاذ/ة ${name}، معك فريق فزاع.`,
    }

    const normalizedPhone = normalizeSaudiWhatsAppNumber(phone || '')
    if (!normalizedPhone) {
      alert('لا يوجد رقم جوال مسجل لهذا العميل')
      return
    }

    window.open(
      `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(messages[type])}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  async function handleAddContract(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    let createdCustomerId: string | number | null = null
    let createdContractId: string | number | null = null

    try {
      const nationalId = digitsOnly(formData.national_id)
      const customerPhone = digitsOnly(formData.phone)
      const guarantorNationalId = digitsOnly(formData.guarantor_id_number)
      const guarantorPhone = digitsOnly(formData.guarantor_phone)
      const totalAmount = toNumber(formData.total_amount)
      const discountAmount = toNumber(formData.discount_amount)
      const installmentAmount = toNumber(formData.installment_amount)
      const netAmount = totalAmount - discountAmount

      if (nationalId.length !== 10) throw new Error('رقم هوية العميل لازم يكون 10 أرقام')
      if (customerPhone.length < 9 || customerPhone.length > 12) throw new Error('رقم جوال العميل غير صحيح')
      if (guarantorNationalId && guarantorNationalId.length !== 10) throw new Error('رقم هوية الكفيل لازم يكون 10 أرقام')
      if (guarantorPhone && (guarantorPhone.length < 9 || guarantorPhone.length > 12)) throw new Error('رقم جوال الكفيل غير صحيح')
      if (totalAmount <= 0) throw new Error('إجمالي العقد لازم يكون أكبر من صفر')
      if (discountAmount < 0 || discountAmount >= totalAmount) throw new Error('قيمة الخصم غير صحيحة')
      if (installmentAmount <= 0) throw new Error('قيمة القسط لازم تكون أكبر من صفر')
      if (formData.sale_type === 'finance' && !formData.finance_company.trim()) throw new Error('حدد اسم شركة التمويل')

      const existingCustomerResult = await supabase
        .from('customers')
        .select('id')
        .eq('national_id', nationalId)
        .maybeSingle()

      if (existingCustomerResult.error) throw existingCustomerResult.error

      let customerId: string | number
      if (existingCustomerResult.data) {
        customerId = existingCustomerResult.data.id

        const updateCustomerResult = await supabase
          .from('customers')
          .update({
            name: formData.customer_name.trim(),
            phone: customerPhone,
          })
          .eq('id', customerId)

        if (updateCustomerResult.error) throw updateCustomerResult.error
      } else {
        const newCustomerResult = await supabase
          .from('customers')
          .insert([
            {
              name: formData.customer_name.trim(),
              national_id: nationalId,
              phone: customerPhone,
            },
          ])
          .select('id')
          .single()

        if (newCustomerResult.error) throw newCustomerResult.error
        customerId = newCustomerResult.data.id
        createdCustomerId = customerId
      }

      const newContractResult = await supabase
        .from('installment_contracts')
        .insert([
          {
            customer_id: customerId,
            investor_id: formData.investor_id,
            guarantor_name: formData.guarantor_name.trim() || null,
            guarantor_id_number: guarantorNationalId || null,
            guarantor_phone: guarantorPhone || null,
            total_amount: totalAmount,
            installment_amount: installmentAmount,
            discount_amount: discountAmount,
            start_date: formData.start_date,
            sale_type: formData.sale_type,
            finance_company: formData.sale_type === 'finance' ? formData.finance_company.trim() : null,
          },
        ])
        .select('id')
        .single()

      if (newContractResult.error) throw newContractResult.error
      createdContractId = newContractResult.data.id

      const months = Math.ceil(netAmount / installmentAmount)
      const payments: any[] = []

      for (let index = 0; index < months; index += 1) {
        const amountDue = index === months - 1 ? netAmount - installmentAmount * index : installmentAmount

        payments.push({
          contract_id: createdContractId,
          due_date: addMonthsToDateString(formData.start_date, index),
          amount_due: Number(amountDue.toFixed(2)),
          amount_paid: 0,
          status: 'unpaid',
        })
      }

      const paymentResult = await supabase.from('contract_payments').insert(payments)
      if (paymentResult.error) throw paymentResult.error

      setShowModal(false)
      setFormData({
        investor_id: '',
        customer_name: '',
        national_id: '',
        phone: '',
        guarantor_name: '',
        guarantor_id_number: '',
        guarantor_phone: '',
        total_amount: '',
        installment_amount: '',
        discount_amount: '0',
        start_date: getTodayInputValue(),
        sale_type: 'deferred',
        finance_company: '',
      })

      await fetchData()
      alert('تم إنشاء العقد وجدول الأقساط بنجاح')
    } catch (error: any) {
      if (createdContractId) {
        await supabase.from('contract_payments').delete().eq('contract_id', createdContractId)
        await supabase.from('installment_contracts').delete().eq('id', createdContractId)
      }

      if (createdCustomerId) {
        await supabase.from('customers').delete().eq('id', createdCustomerId)
      }

      alert(`صار خطأ، تأكد من البيانات: ${error?.message || 'خطأ غير معروف'}`)
    } finally {
      setLoading(false)
    }
  }

  async function fetchExactContract(report: ReportRow) {
    if (!report.contract_id) throw new Error('معرف العقد غير موجود')

    const { data, error } = await supabase
      .from('installment_contracts')
      .select('*')
      .eq('id', report.contract_id)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('لم يتم العثور على العقد المحدد')
    return data
  }

  async function openPersonDetails(kind: PersonKind, report: ReportRow) {
    setPersonLoading(true)

    try {
      const exactContract = await fetchExactContract(report)

      if (kind === 'customer') {
        if (!exactContract.customer_id) throw new Error('معرف العميل غير موجود داخل العقد')

        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', exactContract.customer_id)
          .maybeSingle()

        if (error) throw error
        if (!data) throw new Error('لم يتم العثور على بيانات العميل')

        setPersonModal({
          kind,
          title: 'بيانات العميل',
          contractSerial: report.serial_number,
          data,
        })
        return
      }

      if (kind === 'investor') {
        if (!exactContract.investor_id) throw new Error('معرف المستثمر غير موجود داخل العقد')

        const { data, error } = await supabase
          .from('investors')
          .select('*')
          .eq('id', exactContract.investor_id)
          .maybeSingle()

        if (error) throw error
        if (!data) throw new Error('لم يتم العثور على بيانات المستثمر')

        setPersonModal({
          kind,
          title: 'بيانات المستثمر',
          contractSerial: report.serial_number,
          data,
        })
        return
      }

      if (!exactContract.guarantor_name) throw new Error('لا يوجد كفيل مسجل لهذا العقد')

      setPersonModal({
        kind,
        title: 'بيانات الكفيل',
        contractSerial: report.serial_number,
        data: {
          contract_id: exactContract.id,
          name: exactContract.guarantor_name,
          national_id: exactContract.guarantor_id_number,
          phone: exactContract.guarantor_phone,
        },
      })
    } catch (error: any) {
      alert(`تعذر فتح البيانات: ${error?.message || 'خطأ غير معروف'}`)
    } finally {
      setPersonLoading(false)
    }
  }

  async function openClientFile(report: ReportRow) {
    setPersonLoading(true)

    try {
      const exactContract = await fetchExactContract(report)
      let exactCustomer: any = null

      if (exactContract.customer_id) {
        const customerResult = await supabase
          .from('customers')
          .select('*')
          .eq('id', exactContract.customer_id)
          .maybeSingle()

        if (customerResult.error) throw customerResult.error
        exactCustomer = customerResult.data
      }

      const paymentResult = await supabase
        .from('contract_payments')
        .select('*')
        .eq('contract_id', exactContract.id)
        .order('due_date', { ascending: true })

      if (paymentResult.error) throw paymentResult.error

      setViewClient({
        ...report,
        ...exactContract,
        contract_id: exactContract.id,
        customer_id: exactContract.customer_id,
        investor_id: exactContract.investor_id,
        customer_name: exactCustomer?.name ?? report.customer_name,
        customer_id_num: exactCustomer?.national_id ?? report.customer_id_num,
        phone: exactCustomer?.phone ?? report.phone,
        investor_name: report.investor_name,
      })
      setInstallments(paymentResult.data || [])
    } catch (error: any) {
      alert(`تعذر فتح ملف العميل: ${error?.message || 'خطأ غير معروف'}`)
    } finally {
      setPersonLoading(false)
    }
  }

  async function handlePaySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      const selectedInstallment = installments.find(installment => String(installment.id) === String(payData.id))
      if (!selectedInstallment) throw new Error('القسط المحدد غير موجود')

      const amount = toNumber(payData.amount)
      const alreadyPaid = toNumber(selectedInstallment.amount_paid)
      const remainingDue = Math.max(0, toNumber(selectedInstallment.amount_due) - alreadyPaid)

      if (amount <= 0) throw new Error('أدخل مبلغ سداد صحيح')
      if (Math.abs(amount - remainingDue) > 0.01) {
        throw new Error(`لا يمكن إغلاق القسط إلا بسداد المتبقي كاملًا: ${formatMoney(remainingDue)} ريال`)
      }

      const { error } = await supabase
        .from('contract_payments')
        .update({
          status: 'paid',
          payment_method: payData.method,
          amount_paid: toNumber(selectedInstallment.amount_due),
          payment_date: getTodayInputValue(),
        })
        .eq('id', payData.id)
        .eq('contract_id', viewClient?.contract_id)

      if (error) throw error

      alert('تم تسجيل السداد بنجاح')
      setPayData({ id: '', method: 'cash', amount: '' })

      if (viewClient) await openClientFile(viewClient)
      await fetchData()
    } catch (error: any) {
      alert(`فشل تسجيل السداد: ${error?.message || 'خطأ غير معروف'}`)
    }
  }

  function getFinancialSummary(report: ReportRow) {
    const payments = report.contract_id ? contractPayments[String(report.contract_id)] || [] : []
    const totalAmount = toNumber(report.total_amount)
    const discountAmount = toNumber(report.discount_amount)

    if (payments.length === 0) {
      return {
        totalAmount,
        totalPaid: toNumber(report.total_paid),
        discountAmount,
        remainingAmount: toNumber(report.remaining_amount),
        lateAmount: toNumber(report.late_amount),
        lastPaymentDate: report.last_payment_date || report.last_paid_date || '',
      }
    }

    const today = parseDateOnly(getTodayInputValue()) as Date
    let totalPaid = 0
    let lateAmount = 0
    let lastPaymentDate = ''

    payments.forEach(payment => {
      const amountDue = toNumber(payment.amount_due)
      const amountPaid = payment.status === 'paid' && toNumber(payment.amount_paid) === 0
        ? amountDue
        : toNumber(payment.amount_paid)

      totalPaid += Math.min(amountPaid, amountDue)

      if (payment.status !== 'paid') {
        const dueDate = parseDateOnly(payment.due_date)
        if (dueDate && dueDate.getTime() < today.getTime()) {
          lateAmount += Math.max(0, amountDue - amountPaid)
        }
      }

      if (payment.payment_date && (!lastPaymentDate || payment.payment_date > lastPaymentDate)) {
        lastPaymentDate = payment.payment_date
      }
    })

    return {
      totalAmount,
      totalPaid,
      discountAmount,
      remainingAmount: Math.max(0, totalAmount - discountAmount - totalPaid),
      lateAmount,
      lastPaymentDate: lastPaymentDate || report.last_payment_date || report.last_paid_date || '',
    }
  }

  function getClientStatusDisplay(contractId?: string | number) {
    const payments = contractId ? contractPayments[String(contractId)] || [] : []

    if (payments.length === 0) {
      return {
        status: 'غير متاح',
        color: 'text-slate-400 bg-slate-800 border-slate-700',
        days: '-',
        dueDate: '',
      }
    }

    const unpaid = payments.filter(payment => payment.status !== 'paid')
    if (unpaid.length === 0) {
      return {
        status: 'مكتمل السداد',
        color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
        days: 'تم السداد',
        dueDate: '',
      }
    }

    const nextPayment = unpaid[0]
    const dueDate = parseDateOnly(nextPayment.due_date)
    const today = parseDateOnly(getTodayInputValue())

    if (!dueDate || !today) {
      return {
        status: 'غير متاح',
        color: 'text-slate-400 bg-slate-800 border-slate-700',
        days: '-',
        dueDate: nextPayment.due_date || '',
      }
    }

    const differenceInDays = Math.round((dueDate.getTime() - today.getTime()) / DAY_IN_MS)

    if (differenceInDays < 0) {
      return {
        status: 'متأخر',
        color: 'text-red-400 bg-red-400/10 border-red-400/20',
        days: `متأخر ${Math.abs(differenceInDays)} يوم`,
        dueDate: nextPayment.due_date,
      }
    }

    if (differenceInDays === 0) {
      return {
        status: 'مستحق اليوم',
        color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
        days: 'اليوم',
        dueDate: nextPayment.due_date,
      }
    }

    if (differenceInDays === 1) {
      return {
        status: 'مستحق غداً',
        color: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
        days: 'غداً',
        dueDate: nextPayment.due_date,
      }
    }

    return {
      status: 'غير مستحق',
      color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      days: `${differenceInDays} يوم`,
      dueDate: nextPayment.due_date,
    }
  }

  const filteredReports = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return reports.filter(report => {
      const matchesSearch = !normalizedSearch || [
        report.serial_number,
        report.investor_name,
        report.customer_name,
        report.customer_id_num,
        report.guarantor_name,
        report.finance_company,
      ].some(value => String(value || '').toLowerCase().includes(normalizedSearch))

      const matchesInvestor = !selectedInvestor || String(report.investor_id || '') === selectedInvestor
      const matchesSaleType = !selectedSaleType || report.sale_type === selectedSaleType

      return matchesSearch && matchesInvestor && matchesSaleType
    })
  }, [reports, searchTerm, selectedInvestor, selectedSaleType])

  const visibleTotals = useMemo(() => {
    return filteredReports.reduce(
      (totals, report) => {
        const financial = getFinancialSummary(report)
        totals.totalAmount += financial.totalAmount
        totals.totalPaid += financial.totalPaid
        totals.discountAmount += financial.discountAmount
        totals.remainingAmount += financial.remainingAmount
        totals.lateAmount += financial.lateAmount
        return totals
      },
      {
        totalAmount: 0,
        totalPaid: 0,
        discountAmount: 0,
        remainingAmount: 0,
        lateAmount: 0,
      },
    )
  }, [filteredReports, contractPayments])

  const exportToExcel = () => {
    const headers = [
      'رقم العقد',
      'المستثمر',
      'العميل',
      'هوية العميل',
      'الكفيل',
      'هوية الكفيل',
      'نوع العقد',
      'إجمالي العقد',
      'المدفوع',
      'المخصوم',
      'المتبقي',
      'المتأخر',
      'قيمة القسط',
      'تاريخ آخر سداد',
      'تاريخ الاستحقاق القادم',
      'حالة العقد',
    ]

    const rows = filteredReports.map(report => {
      const financial = getFinancialSummary(report)
      const status = getClientStatusDisplay(report.contract_id)

      return [
        report.serial_number,
        report.investor_name || 'غير محدد',
        report.customer_name || 'غير محدد',
        report.customer_id_num || 'غير مسجل',
        report.guarantor_name || 'لا يوجد',
        report.guarantor_id_number || 'غير مسجل',
        getSaleTypeLabel(report),
        financial.totalAmount,
        financial.totalPaid,
        financial.discountAmount,
        financial.remainingAmount,
        financial.lateAmount,
        report.installment_amount || 0,
        financial.lastPaymentDate || '',
        status.dueDate || '',
        status.status,
      ]
    })

    const csvContent = `\uFEFF${[headers, ...rows]
      .map(row => row.map(escapeCsvCell).join(','))
      .join('\n')}`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `تقرير_العقود_${getTodayInputValue()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (contractToPrint) {
    const financial = getFinancialSummary(contractToPrint)
    const status = getClientStatusDisplay(contractToPrint.contract_id)

    return (
      <div className="min-h-screen bg-white p-8 font-sans text-slate-900" dir="rtl">
        <div className="relative mx-auto max-w-4xl rounded-xl border-2 border-slate-900 p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="no-print absolute left-8 top-8 flex gap-4">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 font-bold text-white hover:bg-emerald-700"
            >
              <Printer className="h-5 w-5" /> طباعة / حفظ PDF
            </button>
            <button
              onClick={() => setContractToPrint(null)}
              className="rounded-lg bg-slate-200 px-6 py-2 font-bold text-slate-800 hover:bg-slate-300"
            >
              رجوع
            </button>
          </div>

          <div className="mb-8 mt-12 border-b-2 border-slate-900 pb-6 text-center print:mt-0">
            <h1 className="mb-2 text-3xl font-black">بيانات العقد</h1>
            <p className="text-lg font-bold text-slate-600">رقم العقد: {contractToPrint.serial_number || '-'}</p>
            <p className="mt-1 font-bold text-slate-600">نوع العقد: {getSaleTypeLabel(contractToPrint)}</p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-8 text-lg">
            <div className="space-y-4">
              <p>
                <span className="font-bold text-slate-500">المستثمر:</span>{' '}
                <span className="font-black">{contractToPrint.investor_name || 'غير محدد'}</span>
              </p>
              <p>
                <span className="font-bold text-slate-500">العميل:</span>{' '}
                <span className="font-black">{contractToPrint.customer_name || 'غير محدد'}</span>
              </p>
              <p>
                <span className="font-bold text-slate-500">هوية العميل:</span>{' '}
                <span className="font-black">{contractToPrint.customer_id_num || 'غير مسجل'}</span>
              </p>
              <p>
                <span className="font-bold text-slate-500">جوال العميل:</span>{' '}
                <span className="font-black">{contractToPrint.phone || 'غير مسجل'}</span>
              </p>
            </div>

            <div className="space-y-4">
              <p>
                <span className="font-bold text-slate-500">الكفيل:</span>{' '}
                <span className="font-black">{contractToPrint.guarantor_name || 'لا يوجد'}</span>
              </p>
              <p>
                <span className="font-bold text-slate-500">هوية الكفيل:</span>{' '}
                <span className="font-black">{contractToPrint.guarantor_id_number || 'غير مسجل'}</span>
              </p>
              <p>
                <span className="font-bold text-slate-500">جوال الكفيل:</span>{' '}
                <span className="font-black">{contractToPrint.guarantor_phone || 'غير مسجل'}</span>
              </p>
              <p>
                <span className="font-bold text-slate-500">حالة العقد:</span>{' '}
                <span className="font-black">{status.status}</span>
              </p>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-3 gap-5 border-t-2 border-slate-900 pt-6 text-center">
            <div className="rounded-lg border border-slate-300 p-4">
              <p className="text-sm font-bold text-slate-500">إجمالي العقد</p>
              <p className="mt-1 text-xl font-black">{formatMoney(financial.totalAmount)} ريال</p>
            </div>
            <div className="rounded-lg border border-slate-300 p-4">
              <p className="text-sm font-bold text-slate-500">المدفوع</p>
              <p className="mt-1 text-xl font-black">{formatMoney(financial.totalPaid)} ريال</p>
            </div>
            <div className="rounded-lg border border-slate-300 p-4">
              <p className="text-sm font-bold text-slate-500">المتبقي</p>
              <p className="mt-1 text-xl font-black">{formatMoney(financial.remainingAmount)} ريال</p>
            </div>
            <div className="rounded-lg border border-slate-300 p-4">
              <p className="text-sm font-bold text-slate-500">المخصوم</p>
              <p className="mt-1 text-xl font-black">{formatMoney(financial.discountAmount)} ريال</p>
            </div>
            <div className="rounded-lg border border-slate-300 p-4">
              <p className="text-sm font-bold text-slate-500">المتأخر</p>
              <p className="mt-1 text-xl font-black">{formatMoney(financial.lateAmount)} ريال</p>
            </div>
            <div className="rounded-lg border border-slate-300 p-4">
              <p className="text-sm font-bold text-slate-500">قيمة القسط</p>
              <p className="mt-1 text-xl font-black">{formatMoney(contractToPrint.installment_amount)} ريال</p>
            </div>
          </div>

          <div className="mb-8 rounded-lg bg-slate-100 p-6">
            <h3 className="mb-4 border-b border-slate-300 pb-2 text-xl font-bold">معلومات السداد</h3>
            <div className="grid grid-cols-2 gap-4 font-bold">
              <p>آخر سداد: {formatDate(financial.lastPaymentDate)}</p>
              <p>الاستحقاق القادم: {formatDate(status.dueDate)}</p>
              <p>عداد الأيام: {status.days}</p>
              <p>نوع العقد: {getSaleTypeLabel(contractToPrint)}</p>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8 border-t-2 border-slate-900 pt-8 text-center">
            <div>
              <p className="mb-8 font-bold">توقيع المستثمر</p>
              <div className="mx-8 border-b-2 border-dashed border-slate-400" />
            </div>
            <div>
              <p className="mb-8 font-bold">توقيع العميل</p>
              <div className="mx-8 border-b-2 border-dashed border-slate-400" />
            </div>
            <div>
              <p className="mb-8 font-bold">توقيع الكفيل</p>
              <div className="mx-8 border-b-2 border-dashed border-slate-400" />
            </div>
          </div>
        </div>

        <style>{`
          @page { size: A4 portrait; margin: 12mm; }
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            #fazza_workspace aside,
            #fazza_workspace header { display: none !important; }
            #fazza_workspace {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              background: white !important;
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="print-container relative p-4" dir="rtl">
      <style>{`
        @page { size: A4 landscape; margin: 7mm; }
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-container { margin: 0 !important; padding: 0 !important; }
          .report-table { width: 100% !important; border-collapse: collapse !important; font-size: 7px !important; }
          .report-table th,
          .report-table td {
            border: 1px solid #000 !important;
            padding: 3px !important;
            color: black !important;
            background: white !important;
            text-align: center !important;
            white-space: nowrap !important;
          }
          #fazza_workspace aside,
          #fazza_workspace header { display: none !important; }
          #fazza_workspace {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          .hide-in-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">تقرير العقود السارية</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">
            اضغط على اسم المستثمر أو العميل أو الكفيل لفتح السجل الصحيح المرتبط بمعرف العقد.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 font-bold text-white hover:bg-slate-600"
          >
            <Printer className="h-5 w-5" /> طباعة / PDF
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-400"
          >
            <Download className="h-5 w-5" /> تصدير Excel
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 font-bold text-slate-950 hover:bg-emerald-400"
          >
            <Plus className="h-5 w-5" /> عقد جديد
          </button>
        </div>
      </div>

      <div className="no-print mb-5 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_180px]">
        <div className="relative">
          <input
            type="text"
            placeholder="بحث برقم العقد، المستثمر، العميل، الهوية، الكفيل أو شركة التمويل..."
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-4 text-white outline-none focus:border-emerald-500"
          />
          <Search className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
        </div>

        <select
          value={selectedInvestor}
          onChange={event => setSelectedInvestor(event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 font-bold text-white outline-none focus:border-emerald-500"
        >
          <option value="">كل المستثمرين</option>
          {investors.map(investor => (
            <option key={investor.id} value={String(investor.id)}>
              {investor.name}
            </option>
          ))}
        </select>

        <select
          value={selectedSaleType}
          onChange={event => setSelectedSaleType(event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 font-bold text-white outline-none focus:border-emerald-500"
        >
          <option value="">كل أنواع العقود</option>
          <option value="deferred">بيع آجل</option>
          <option value="finance">شركة تمويل</option>
        </select>
      </div>

      <div className="no-print mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="إجمالي العقود" value={`${filteredReports.length} عقد`} />
        <SummaryCard label="إجمالي القيمة" value={`${formatMoney(visibleTotals.totalAmount)} ريال`} />
        <SummaryCard label="إجمالي المدفوع" value={`${formatMoney(visibleTotals.totalPaid)} ريال`} />
        <SummaryCard label="إجمالي المتبقي" value={`${formatMoney(visibleTotals.remainingAmount)} ريال`} />
        <SummaryCard label="إجمالي المتأخر" value={`${formatMoney(visibleTotals.lateAmount)} ريال`} />
      </div>

      <div className="print-only mb-5 hidden border-b-2 border-black pb-3 text-center text-xl font-black">
        تقرير العقود السارية
        <div className="mt-1 text-xs font-bold">تاريخ التقرير: {formatDate(getTodayInputValue())}</div>
      </div>

      {fetchError && (
        <div className="no-print mb-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          <span className="font-bold">{fetchError}</span>
          <button onClick={fetchData} className="rounded-lg bg-red-500 px-4 py-2 font-bold text-white">
            إعادة المحاولة
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 print:overflow-visible print:rounded-none print:border-0 print:bg-transparent">
        <table className="report-table w-full min-w-[2100px] text-center text-xs print:min-w-0">
          <thead className="bg-slate-800 text-slate-300 print:bg-transparent print:text-black">
            <tr>
              <th className="p-3">رقم العقد</th>
              <th className="p-3">المستثمر</th>
              <th className="p-3">العميل</th>
              <th className="p-3">الكفيل</th>
              <th className="p-3">نوع العقد</th>
              <th className="p-3">إجمالي العقد</th>
              <th className="p-3">المدفوع</th>
              <th className="p-3">المخصوم</th>
              <th className="p-3">المتبقي</th>
              <th className="p-3">المتأخر</th>
              <th className="p-3">قيمة القسط</th>
              <th className="p-3">تاريخ آخر سداد</th>
              <th className="p-3">الاستحقاق القادم</th>
              <th className="p-3">عداد الأيام</th>
              <th className="p-3">الحالة</th>
              <th className="hide-in-print p-3">واتساب</th>
              <th className="hide-in-print p-3">ملف العميل</th>
              <th className="hide-in-print p-3">طباعة</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800 print:divide-black">
            {fetching && reports.length === 0 && (
              <tr>
                <td colSpan={18} className="p-10 font-bold text-slate-400 print:text-black">
                  جاري تحميل العقود...
                </td>
              </tr>
            )}

            {!fetching && filteredReports.length === 0 && (
              <tr>
                <td colSpan={18} className="p-10 font-bold text-slate-500 print:text-black">
                  لا توجد نتائج تطابق البحث والفلاتر المحددة
                </td>
              </tr>
            )}

            {filteredReports.map(report => {
              const financial = getFinancialSummary(report)
              const status = getClientStatusDisplay(report.contract_id)

              return (
                <tr key={String(report.contract_id || report.serial_number)} className="hover:bg-slate-800/50 print:hover:bg-transparent">
                  <td className="p-3 font-mono font-black text-emerald-400 print:text-black">
                    {report.serial_number || '-'}
                  </td>

                  <td className="p-3">
                    <PersonButton
                      label={report.investor_name || 'غير محدد'}
                      disabled={!report.investor_name || personLoading}
                      onClick={() => openPersonDetails('investor', report)}
                    />
                  </td>

                  <td className="p-3">
                    <PersonButton
                      label={report.customer_name || 'غير محدد'}
                      disabled={!report.customer_name || personLoading}
                      onClick={() => openPersonDetails('customer', report)}
                    />
                  </td>

                  <td className="p-3">
                    {report.guarantor_name ? (
                      <PersonButton
                        label={report.guarantor_name}
                        disabled={personLoading}
                        onClick={() => openPersonDetails('guarantor', report)}
                      />
                    ) : (
                      <span className="text-slate-500 print:text-black">لا يوجد</span>
                    )}
                  </td>

                  <td className="p-3 font-bold text-violet-300 print:text-black">{getSaleTypeLabel(report)}</td>
                  <td className="p-3 font-bold text-blue-300 print:text-black">{formatMoney(financial.totalAmount)}</td>
                  <td className="p-3 font-bold text-emerald-300 print:text-black">{formatMoney(financial.totalPaid)}</td>
                  <td className="p-3 font-bold text-amber-300 print:text-black">{formatMoney(financial.discountAmount)}</td>
                  <td className="p-3 font-bold text-rose-300 print:text-black">{formatMoney(financial.remainingAmount)}</td>
                  <td className="p-3 font-bold text-red-400 print:text-black">{formatMoney(financial.lateAmount)}</td>
                  <td className="p-3 font-bold text-slate-200 print:text-black">{formatMoney(report.installment_amount)}</td>
                  <td className="p-3 font-mono text-slate-300 print:text-black">{formatDate(financial.lastPaymentDate)}</td>
                  <td className="p-3 font-mono text-slate-300 print:text-black">{formatDate(status.dueDate)}</td>
                  <td className="p-3 font-bold text-slate-200 print:text-black">{status.days}</td>
                  <td className="p-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${status.color} print:border-black print:bg-white print:text-black`}>
                      {status.status}
                    </span>
                  </td>

                  <td className="hide-in-print p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => sendWhatsApp(report.phone || '', 'reminder', report.customer_name || '', report.installment_amount || 0, status.dueDate)}
                        className="rounded bg-blue-500/10 p-1.5 text-blue-400 hover:bg-blue-500 hover:text-white"
                        title="تذكير قبل الاستحقاق"
                      >
                        <MessageCircle size={16} />
                      </button>
                      <button
                        onClick={() => sendWhatsApp(report.phone || '', 'today', report.customer_name || '', report.installment_amount || 0, status.dueDate)}
                        className="rounded bg-yellow-500/10 p-1.5 text-yellow-400 hover:bg-yellow-500 hover:text-white"
                        title="مستحق اليوم"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={() => sendWhatsApp(report.phone || '', 'late', report.customer_name || '', financial.lateAmount || report.installment_amount || 0, status.dueDate)}
                        className="rounded bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500 hover:text-white"
                        title="متأخر"
                      >
                        <AlertCircle size={16} />
                      </button>
                    </div>
                  </td>

                  <td className="hide-in-print p-3">
                    <button
                      onClick={() => openClientFile(report)}
                      disabled={personLoading}
                      className="mx-auto flex items-center justify-center gap-1 rounded-lg bg-emerald-500/10 p-2 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Eye size={16} /> فتح السجل
                    </button>
                  </td>

                  <td className="hide-in-print p-3">
                    <button
                      onClick={() => setContractToPrint(report)}
                      className="rounded-lg bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-slate-700"
                      title="طباعة العقد أو حفظه PDF"
                    >
                      <Printer size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}

            {filteredReports.length > 0 && (
              <tr className="bg-slate-950 font-black print:bg-transparent print:text-black">
                <td className="p-3 text-right" colSpan={5}>إجمالي النتائج المعروضة</td>
                <td className="p-3 text-blue-300 print:text-black">{formatMoney(visibleTotals.totalAmount)}</td>
                <td className="p-3 text-emerald-300 print:text-black">{formatMoney(visibleTotals.totalPaid)}</td>
                <td className="p-3 text-amber-300 print:text-black">{formatMoney(visibleTotals.discountAmount)}</td>
                <td className="p-3 text-rose-300 print:text-black">{formatMoney(visibleTotals.remainingAmount)}</td>
                <td className="p-3 text-red-400 print:text-black">{formatMoney(visibleTotals.lateAmount)}</td>
                <td colSpan={8} className="p-3" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 p-6">
              <h3 className="flex items-center gap-2 text-xl font-black text-white">
                <FileText className="h-6 w-6 text-emerald-500" /> إصدار عقد جديد
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg bg-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddContract} className="p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="border-b border-slate-800 pb-2 font-bold text-emerald-400">بيانات الارتباط والعميل</h4>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-400">نوع العقد *</label>
                    <select
                      required
                      value={formData.sale_type}
                      onChange={event => setFormData({
                        ...formData,
                        sale_type: event.target.value as SaleType,
                        finance_company: event.target.value === 'finance' ? formData.finance_company : '',
                      })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white outline-none"
                    >
                      <option value="deferred">بيع آجل (سند أمر)</option>
                      <option value="finance">شركة تمويل</option>
                    </select>
                  </div>

                  {formData.sale_type === 'finance' && (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-400">اسم شركة التمويل *</label>
                      <input
                        required
                        list="finance-companies"
                        value={formData.finance_company}
                        onChange={event => setFormData({ ...formData, finance_company: event.target.value })}
                        placeholder="اختر أو اكتب اسم شركة التمويل"
                        className="w-full rounded-lg border border-emerald-700 bg-slate-950 px-4 py-2.5 text-emerald-100 outline-none"
                      />
                      <datalist id="finance-companies">
                        <option value="إمكان" />
                        <option value="تمارا" />
                        <option value="تابي" />
                        <option value="مورا" />
                        <option value="كوارا" />
                        <option value="تمام" />
                      </datalist>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-400">المستثمر الممول *</label>
                    <select
                      required
                      value={formData.investor_id}
                      onChange={event => setFormData({ ...formData, investor_id: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white outline-none"
                    >
                      <option value="">اختر المستثمر من القائمة</option>
                      {investors.map(investor => (
                        <option key={investor.id} value={investor.id}>{investor.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-400">اسم العميل *</label>
                    <input
                      required
                      value={formData.customer_name}
                      onChange={event => setFormData({ ...formData, customer_name: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-400">رقم الهوية *</label>
                      <input
                        required
                        inputMode="numeric"
                        maxLength={10}
                        value={formData.national_id}
                        onChange={event => setFormData({ ...formData, national_id: normalizeArabicDigits(event.target.value) })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-400">رقم الجوال *</label>
                      <input
                        required
                        inputMode="tel"
                        value={formData.phone}
                        onChange={event => setFormData({ ...formData, phone: normalizeArabicDigits(event.target.value) })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="border-b border-slate-800 pb-2 font-bold text-blue-400">بيانات العقد والكفيل</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-bold text-slate-400">اسم الكفيل</label>
                      <input
                        value={formData.guarantor_name}
                        onChange={event => setFormData({ ...formData, guarantor_name: event.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-400">هوية الكفيل</label>
                      <input
                        inputMode="numeric"
                        maxLength={10}
                        value={formData.guarantor_id_number}
                        onChange={event => setFormData({ ...formData, guarantor_id_number: normalizeArabicDigits(event.target.value) })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-400">جوال الكفيل</label>
                      <input
                        inputMode="tel"
                        value={formData.guarantor_phone}
                        onChange={event => setFormData({ ...formData, guarantor_phone: normalizeArabicDigits(event.target.value) })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-400">إجمالي العقد *</label>
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formData.total_amount}
                        onChange={event => setFormData({ ...formData, total_amount: event.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono font-bold text-blue-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-400">المخصوم</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.discount_amount}
                        onChange={event => setFormData({ ...formData, discount_amount: event.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-400">قيمة القسط *</label>
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formData.installment_amount}
                        onChange={event => setFormData({ ...formData, installment_amount: event.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono font-bold text-emerald-400 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-400">تاريخ أول قسط *</label>
                    <input
                      required
                      type="date"
                      value={formData.start_date}
                      onChange={event => setFormData({ ...formData, start_date: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-4 border-t border-slate-800 pt-6">
                <button
                  disabled={loading}
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-500 py-3 font-black text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'جاري إنشاء العقد...' : 'اعتماد العقد'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl bg-slate-800 px-6 font-bold text-white hover:bg-slate-700"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {personModal && (
        <PersonDetailsModal
          modal={personModal}
          onClose={() => setPersonModal(null)}
          onWhatsApp={(phone, name) => sendWhatsApp(phone, 'contact', name, '', '')}
        />
      )}

      {viewClient && (
        <ClientFileModal
          client={viewClient}
          installments={installments}
          payData={payData}
          setPayData={setPayData}
          onClose={() => {
            setViewClient(null)
            setInstallments([])
            setPayData({ id: '', method: 'cash', amount: '' })
          }}
          onPaySubmit={handlePaySubmit}
          onThanks={() => sendWhatsApp(viewClient.phone || '', 'thanks', viewClient.customer_name || '', '')}
          onOpenPerson={kind => openPersonDetails(kind, viewClient)}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  )
}

function PersonButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-bold text-slate-200 underline decoration-slate-600 underline-offset-4 hover:text-emerald-400 hover:decoration-emerald-400 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60 print:text-black print:no-underline"
    >
      {label}
    </button>
  )
}

function DetailItem({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="mb-1 text-xs font-bold text-slate-500">{label}</p>
      <p className="break-words font-black text-white">{value === null || value === undefined || value === '' ? 'غير مسجل' : String(value)}</p>
    </div>
  )
}

function PersonDetailsModal({
  modal,
  onClose,
  onWhatsApp,
}: {
  modal: PersonModalState
  onClose: () => void
  onWhatsApp: (phone: string, name: string) => void
}) {
  const data = modal.data || {}
  const name = data.name || data.full_name || data.investor_name || 'غير مسجل'
  const nationalId = data.national_id || data.identity_number || data.id_number
  const phone = data.phone || data.mobile || data.phone_number
  const email = data.email
  const capital = data.capital || data.capital_amount || data.total_capital

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div>
            <h3 className="text-2xl font-black text-white">{modal.title}</h3>
            <p className="mt-1 text-sm font-bold text-slate-400">العقد المرتبط: {modal.contractSerial || '-'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-slate-800 p-2 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <DetailItem label="الاسم" value={name} />
          <DetailItem label="رقم الهوية" value={nationalId} />
          <DetailItem label="رقم الجوال" value={phone} />
          <DetailItem label="البريد الإلكتروني" value={email} />
          {modal.kind === 'investor' && <DetailItem label="رأس المال" value={capital ? `${formatMoney(capital)} ريال` : ''} />}
          <DetailItem label="المعرف الداخلي" value={data.id || data.contract_id} />
        </div>

        {phone && (
          <div className="border-t border-slate-800 p-6">
            <button
              onClick={() => onWhatsApp(String(phone), String(name))}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-black text-slate-950 hover:bg-emerald-400"
            >
              <MessageCircle size={18} /> فتح واتساب
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ClientFileModal({
  client,
  installments,
  payData,
  setPayData,
  onClose,
  onPaySubmit,
  onThanks,
  onOpenPerson,
}: {
  client: ReportRow
  installments: any[]
  payData: { id: string; method: string; amount: string }
  setPayData: Dispatch<SetStateAction<{ id: string; method: string; amount: string }>>
  onClose: () => void
  onPaySubmit: (event: FormEvent<HTMLFormElement>) => void
  onThanks: () => void
  onOpenPerson: (kind: PersonKind) => void
}) {
  const unpaidInstallments = installments.filter(installment => installment.status !== 'paid')
  const nextInstallment = unpaidInstallments[0]
  const status = (() => {
    if (installments.length === 0) {
      return { label: 'غير متاح', className: 'text-slate-400 bg-slate-400/10 border-slate-400/20', days: '-' }
    }
    if (!nextInstallment) {
      return { label: 'مكتمل السداد', className: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', days: 'تم السداد' }
    }

    const dueDate = parseDateOnly(nextInstallment.due_date)
    const today = parseDateOnly(getTodayInputValue())
    if (!dueDate || !today) {
      return { label: 'غير متاح', className: 'text-slate-400 bg-slate-400/10 border-slate-400/20', days: '-' }
    }

    const differenceInDays = Math.round((dueDate.getTime() - today.getTime()) / DAY_IN_MS)
    if (differenceInDays < 0) {
      return { label: 'متأخر', className: 'text-red-400 bg-red-400/10 border-red-400/20', days: `متأخر ${Math.abs(differenceInDays)} يوم` }
    }
    if (differenceInDays === 0) {
      return { label: 'مستحق اليوم', className: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', days: 'اليوم' }
    }
    if (differenceInDays === 1) {
      return { label: 'مستحق غداً', className: 'text-orange-400 bg-orange-400/10 border-orange-400/20', days: 'غداً' }
    }
    return { label: 'غير مستحق', className: 'text-blue-400 bg-blue-400/10 border-blue-400/20', days: `${differenceInDays} يوم` }
  })()

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm" dir="rtl">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-800 bg-slate-800/50 p-6">
          <div>
            <button
              type="button"
              onClick={() => onOpenPerson('customer')}
              className="text-2xl font-black text-white underline decoration-slate-600 underline-offset-4 hover:text-emerald-400"
            >
              {client.customer_name || 'العميل'}
            </button>
            <div className="mt-2 flex flex-wrap gap-4 text-sm font-bold text-slate-400">
              <span>العقد: <span className="font-mono text-emerald-400">{client.serial_number || '-'}</span></span>
              <span>الهوية: <span className="font-mono text-white">{client.customer_id_num || 'غير مسجل'}</span></span>
              <span>الجوال: <span className="font-mono text-white">{client.phone || 'غير مسجل'}</span></span>
              <span>النوع: <span className="text-violet-300">{getSaleTypeLabel(client)}</span></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onThanks}
              className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500 hover:text-slate-900"
            >
              <MessageCircle size={16} /> شكر بعد السداد
            </button>
            <button onClick={onClose} className="rounded-lg bg-slate-800 p-2 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-800 bg-slate-950 p-4 md:grid-cols-4">
          <StatusCard label="تاريخ أول قسط" value={installments[0]?.due_date ? formatDate(installments[0].due_date) : '-'} />
          <StatusCard label="القسط القادم" value={nextInstallment?.due_date ? formatDate(nextInstallment.due_date) : '-'} />
          <StatusCard label="عداد الأيام" value={status.days} />
          <div className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center ${status.className}`}>
            <span className="mb-1 text-xs font-bold opacity-80">حالة العميل</span>
            <span className="text-lg font-black">{status.label}</span>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-800 p-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => onOpenPerson('investor')}
            className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-right hover:border-emerald-500"
          >
            <span className="block text-xs font-bold text-slate-500">المستثمر المرتبط</span>
            <span className="mt-1 block font-black text-white">{client.investor_name || 'غير محدد'}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenPerson('guarantor')}
            disabled={!client.guarantor_name}
            className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-right hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="block text-xs font-bold text-slate-500">الكفيل المرتبط</span>
            <span className="mt-1 block font-black text-white">{client.guarantor_name || 'لا يوجد'}</span>
          </button>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <span className="block text-xs font-bold text-slate-500">قيمة القسط</span>
            <span className="mt-1 block font-black text-white">{formatMoney(client.installment_amount)} ريال</span>
          </div>
        </div>

        <div className="overflow-y-auto p-6">
          <table className="w-full text-center text-sm">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                <th className="p-3">رقم القسط</th>
                <th className="p-3">الاستحقاق</th>
                <th className="p-3">المبلغ</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">طريقة الدفع</th>
                <th className="p-3">تاريخ السداد</th>
                <th className="p-3">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {installments.map((installment, index) => {
                const isPaid = installment.status === 'paid'
                const today = getTodayInputValue()
                const isLate = !isPaid && installment.due_date < today
                const isToday = !isPaid && installment.due_date === today
                const remainingDue = Math.max(0, toNumber(installment.amount_due) - toNumber(installment.amount_paid))

                return (
                  <tr key={installment.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono">{index + 1}</td>
                    <td className="p-3 font-mono text-slate-300">{formatDate(installment.due_date)}</td>
                    <td className="p-3 font-bold text-blue-400">{formatMoney(installment.amount_due)} ريال</td>
                    <td className="p-3">
                      {isPaid ? (
                        <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-400">مسدد</span>
                      ) : isLate ? (
                        <span className="rounded bg-rose-400/10 px-2 py-1 text-xs font-bold text-rose-400">متأخر</span>
                      ) : isToday ? (
                        <span className="rounded bg-yellow-400/10 px-2 py-1 text-xs font-bold text-yellow-400">مستحق اليوم</span>
                      ) : (
                        <span className="text-slate-400">غير مستحق</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-400">
                      {installment.payment_method === 'cash'
                        ? 'كاش'
                        : installment.payment_method === 'transfer'
                          ? 'تحويل'
                          : '-'}
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-400">{formatDate(installment.payment_date)}</td>
                    <td className="p-3">
                      {!isPaid ? (
                        String(payData.id) === String(installment.id) ? (
                          <form onSubmit={onPaySubmit} className="flex flex-col items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 p-2">
                            <input
                              required
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="المبلغ"
                              value={payData.amount}
                              onChange={event => setPayData({ ...payData, amount: event.target.value })}
                              className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white outline-none"
                            />
                            <select
                              value={payData.method}
                              onChange={event => setPayData({ ...payData, method: event.target.value })}
                              className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white outline-none"
                            >
                              <option value="cash">كاش</option>
                              <option value="transfer">تحويل</option>
                            </select>
                            <div className="flex w-full gap-1">
                              <button type="submit" className="flex-1 rounded bg-emerald-500 py-1 text-xs font-bold text-slate-900">تأكيد</button>
                              <button
                                type="button"
                                onClick={() => setPayData({ id: '', method: 'cash', amount: '' })}
                                className="flex-1 rounded bg-slate-700 py-1 text-xs text-white"
                              >
                                إلغاء
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            onClick={() => setPayData({ id: String(installment.id), method: 'cash', amount: String(remainingDue) })}
                            className="mx-auto flex items-center justify-center gap-1 rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-bold text-blue-400 hover:bg-blue-500 hover:text-white"
                          >
                            <Wallet size={14} /> تسجيل سداد
                          </button>
                        )
                      ) : (
                        <span className="flex items-center justify-center gap-1 text-xs font-bold text-emerald-500">
                          <CheckCircle size={14} /> مكتمل
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {installments.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 font-bold text-slate-500">لا يوجد جدول أقساط لهذا العقد</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
      <span className="mb-1 text-xs font-bold text-slate-500">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  )
}
