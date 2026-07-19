import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { 
  Printer, Download, RotateCcw, Eye, Edit, FileText, MessageCircle,
  BarChart3, DollarSign, Calendar, Clock, CheckCircle, AlertCircle, XCircle
} from 'lucide-react'

type ReportFilters = {
  customer_name: string
  contract_number: string
  national_id: string
  investor_id: string
  accountant_id: string
  finance_company: string
  sale_type: string
  client_status: string
  date_from: string
  date_to: string
}

type SortOption = 
  | 'newest' | 'oldest' | 'highest_value' | 'lowest_value' 
  | 'nearest_due' | 'most_late' | 'by_investor' | 'by_accountant'

export default function CustomReports() {
  const [reports, setReports] = useState<any[]>([])
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState<ReportFilters>({
    customer_name: '',
    contract_number: '',
    national_id: '',
    investor_id: '',
    accountant_id: '',
    finance_company: '',
    sale_type: '',
    client_status: '',
    date_from: '',
    date_to: ''
  })

  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [investors, setInvestors] = useState<any[]>([])
  const [accountants, setAccountants] = useState<any[]>([])

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    setLoading(true)
    try {
      // استخدم start_date للترتيب
      const { data: contracts, error } = await supabase
        .from('vw_contracts_report')
        .select('*')
        .order('start_date', { ascending: false })
      
      if (error) throw error
      
      const [invRes, accRes] = await Promise.all([
        supabase.from('investors').select('id, name'),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'accountant')
      ])
      
      if (invRes.data) setInvestors(invRes.data)
      if (accRes.data) setAccountants(accRes.data)
      
      // جلب الأقساط لحساب الحالات
      const contractIds = contracts.map((c: any) => c.contract_id)
      const { data: payments } = await supabase
        .from('contract_payments')
        .select('*')
        .in('contract_id', contractIds)
        .order('due_date', { ascending: true })
      
      const enriched = contracts.map((contract: any) => {
        const contractPayments = payments?.filter((p: any) => p.contract_id === contract.contract_id) || []
        const unpaid = contractPayments.filter((p: any) => p.status !== 'paid')
        const nextDue = unpaid.length > 0 ? unpaid[0] : null
        
        let status = 'مكتمل'
        let days = 0
        if (nextDue) {
          const dueDate = new Date(nextDue.due_date)
          const today = new Date()
          today.setHours(0,0,0,0)
          const diff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000*60*60*24))
          days = diff
          if (diff < 0) status = 'متأخر'
          else if (diff === 0) status = 'مستحق اليوم'
          else if (diff === 1) status = 'مستحق غداً'
          else status = 'غير مستحق'
        } else {
          status = 'مكتمل السداد'
        }
        
        return {
          ...contract,
          payments: contractPayments,
          next_due: nextDue,
          status,
          days_remaining: days,
          is_paid: unpaid.length === 0
        }
      })
      
      setReports(enriched)
      setFilteredData(enriched)
    } catch (err) {
      console.error('Error fetching reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    applyFiltersAndSort()
  }, [filters, sortBy, reports])

  function applyFiltersAndSort() {
    let data = [...reports]
    
    if (filters.customer_name) {
      data = data.filter(r => r.customer_name?.includes(filters.customer_name))
    }
    if (filters.contract_number) {
      data = data.filter(r => r.serial_number?.toString().includes(filters.contract_number))
    }
    if (filters.national_id) {
      data = data.filter(r => r.customer_id_num?.includes(filters.national_id))
    }
    if (filters.investor_id) {
      data = data.filter(r => r.investor_id === filters.investor_id)
    }
    if (filters.accountant_id) {
      data = data.filter(r => r.accountant_id === filters.accountant_id)
    }
    if (filters.finance_company) {
      data = data.filter(r => r.finance_company === filters.finance_company)
    }
    if (filters.sale_type) {
      data = data.filter(r => r.sale_type === filters.sale_type)
    }
    if (filters.client_status) {
      data = data.filter(r => r.status === filters.client_status)
    }
    if (filters.date_from) {
      data = data.filter(r => r.start_date >= filters.date_from)
    }
    if (filters.date_to) {
      data = data.filter(r => r.start_date <= filters.date_to)
    }
    
    switch (sortBy) {
      case 'newest':
        data.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
        break
      case 'oldest':
        data.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
        break
      case 'highest_value':
        data.sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
        break
      case 'lowest_value':
        data.sort((a, b) => Number(a.total_amount) - Number(b.total_amount))
        break
      case 'nearest_due':
        data.sort((a, b) => a.days_remaining - b.days_remaining)
        break
      case 'most_late':
        data.sort((a, b) => b.days_remaining - a.days_remaining)
        break
      case 'by_investor':
        data.sort((a, b) => (a.investor_name || '').localeCompare(b.investor_name || ''))
        break
      case 'by_accountant':
        data.sort((a, b) => (a.accountant_name || '').localeCompare(b.accountant_name || ''))
        break
      default:
        break
    }
    
    setFilteredData(data)
  }

  function resetFilters() {
    setFilters({
      customer_name: '',
      contract_number: '',
      national_id: '',
      investor_id: '',
      accountant_id: '',
      finance_company: '',
      sale_type: '',
      client_status: '',
      date_from: '',
      date_to: ''
    })
    setSortBy('newest')
  }

  const stats = {
    totalContracts: filteredData.length,
    totalValue: filteredData.reduce((sum, r) => sum + Number(r.total_amount), 0),
    totalDue: filteredData.reduce((sum, r) => {
      const unpaid = r.payments?.filter((p: any) => p.status !== 'paid') || []
      return sum + unpaid.reduce((s, p) => s + Number(p.amount_due), 0)
    }, 0),
    lateCount: filteredData.filter(r => r.status === 'متأخر').length,
    todayDueCount: filteredData.filter(r => r.status === 'مستحق اليوم').length,
    paidCount: filteredData.filter(r => r.is_paid).length,
    completedCount: filteredData.filter(r => r.status === 'مكتمل السداد').length,
  }

  function exportExcel() {
    let csv = "\uFEFF"
    csv += "رقم العقد,العميل,الهوية,المستثمر,المحاسب,شركة التمويل,نوع العملية,قيمة العقد,القسط,تاريخ الاستحقاق,الأيام المتبقية,الحالة\n"
    filteredData.forEach(r => {
      const row = [
        r.serial_number,
        r.customer_name,
        r.customer_id_num || '',
        r.investor_name || '',
        r.accountant_name || '',
        r.finance_company || '',
        r.sale_type === 'finance' ? 'تمويل' : 'بيع آجل',
        r.total_amount,
        r.installment_amount,
        r.next_due?.due_date || '',
        r.days_remaining,
        r.status
      ].join(',')
      csv += row + '\n'
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `التقارير_المخصصة_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    window.print()
  }

  function handleView(contract: any) {
    alert(`عرض تفاصيل العقد رقم ${contract.serial_number}`)
  }

  function handleEdit(contract: any) {
    alert(`تعديل العقد رقم ${contract.serial_number}`)
  }

  function handlePrint(contract: any) {
    alert(`طباعة العقد رقم ${contract.serial_number}`)
  }

  function handleWhatsApp(contract: any) {
    const phone = contract.phone
    if (!phone) return alert('لا يوجد رقم جوال')
    const msg = `السلام عليكم أستاذ/ة ${contract.customer_name}، هذه رسالة تذكير بالقسط المستحق.`
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
        <span className="mr-3 text-slate-400">جاري تحميل التقارير...</span>
      </div>
    )
  }

  return (
    <div className="p-4" dir="rtl">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 6px; text-align: right; }
        }
      `}</style>

      {/* العنوان والأزرار */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6 no-print">
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-emerald-400" />
          التقارير المخصصة
        </h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportExcel} className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> إكسل
          </button>
          <button onClick={exportPDF} className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
            <Printer className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
            <Printer className="w-4 h-4" /> طباعة
          </button>
          <button onClick={resetFilters} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4" /> إعادة تعيين
          </button>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6 no-print">
        <StatCard label="إجمالي العقود" value={stats.totalContracts} icon={<FileText className="w-5 h-5" />} color="blue" />
        <StatCard label="قيمة العقود" value={stats.totalValue.toFixed(2)} icon={<DollarSign className="w-5 h-5" />} color="emerald" />
        <StatCard label="الأقساط المستحقة" value={stats.totalDue.toFixed(2)} icon={<Calendar className="w-5 h-5" />} color="yellow" />
        <StatCard label="متأخرون" value={stats.lateCount} icon={<AlertCircle className="w-5 h-5" />} color="red" />
        <StatCard label="مستحق اليوم" value={stats.todayDueCount} icon={<Clock className="w-5 h-5" />} color="orange" />
        <StatCard label="مسددون" value={stats.paidCount} icon={<CheckCircle className="w-5 h-5" />} color="green" />
        <StatCard label="مكتملون" value={stats.completedCount} icon={<XCircle className="w-5 h-5" />} color="purple" />
      </div>

      {/* الفلاتر */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FilterInput label="اسم العميل" value={filters.customer_name} onChange={v => setFilters({...filters, customer_name: v})} placeholder="بحث بالاسم" />
          <FilterInput label="رقم العقد" value={filters.contract_number} onChange={v => setFilters({...filters, contract_number: v})} placeholder="رقم العقد" />
          <FilterInput label="رقم الهوية" value={filters.national_id} onChange={v => setFilters({...filters, national_id: v})} placeholder="الهوية" />
          <FilterSelect label="المستثمر" value={filters.investor_id} onChange={v => setFilters({...filters, investor_id: v})} options={investors.map(i => ({ value: i.id, label: i.name }))} placeholder="جميع المستثمرين" />
          <FilterSelect label="المحاسب" value={filters.accountant_id} onChange={v => setFilters({...filters, accountant_id: v})} options={accountants.map(a => ({ value: a.id, label: a.full_name || a.email }))} placeholder="جميع المحاسبين" />
          <FilterSelect label="شركة التمويل" value={filters.finance_company} onChange={v => setFilters({...filters, finance_company: v})} options={[{ value: 'إمكان', label: 'إمكان' }, { value: 'تمارا', label: 'تمارا' }, { value: 'تابي', label: 'تابي' }, { value: 'مورا', label: 'مورا' }, { value: 'كوارا', label: 'كوارا' }, { value: 'تمام', label: 'تمام' }]} placeholder="جميع الشركات" />
          <FilterSelect label="نوع العملية" value={filters.sale_type} onChange={v => setFilters({...filters, sale_type: v})} options={[{ value: 'deferred', label: 'بيع آجل' }, { value: 'finance', label: 'تمويل' }]} placeholder="الكل" />
          <FilterSelect label="حالة العميل" value={filters.client_status} onChange={v => setFilters({...filters, client_status: v})} options={[{ value: 'غير مستحق', label: 'غير مستحق' }, { value: 'مستحق اليوم', label: 'مستحق اليوم' }, { value: 'مستحق غداً', label: 'مستحق غداً' }, { value: 'متأخر', label: 'متأخر' }, { value: 'مكتمل السداد', label: 'مكتمل' }]} placeholder="الكل" />
          <FilterInput label="من تاريخ" value={filters.date_from} onChange={v => setFilters({...filters, date_from: v})} type="date" />
          <FilterInput label="إلى تاريخ" value={filters.date_to} onChange={v => setFilters({...filters, date_to: v})} type="date" />
          <div className="flex items-end">
            <FilterSelect label="الفرز حسب" value={sortBy} onChange={v => setSortBy(v as SortOption)} options={[{ value: 'newest', label: 'الأحدث أولاً' }, { value: 'oldest', label: 'الأقدم أولاً' }, { value: 'highest_value', label: 'الأعلى قيمة' }, { value: 'lowest_value', label: 'الأقل قيمة' }, { value: 'nearest_due', label: 'الأقرب استحقاقاً' }, { value: 'most_late', label: 'الأكثر تأخيراً' }, { value: 'by_investor', label: 'حسب المستثمر' }, { value: 'by_accountant', label: 'حسب المحاسب' }]} />
          </div>
        </div>
      </div>

      {/* الجدول */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="w-full text-sm text-center">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="p-3">رقم العقد</th>
              <th className="p-3">العميل</th>
              <th className="p-3">الهوية</th>
              <th className="p-3">المستثمر</th>
              <th className="p-3">المحاسب</th>
              <th className="p-3">شركة التمويل</th>
              <th className="p-3">نوع العملية</th>
              <th className="p-3">قيمة العقد</th>
              <th className="p-3">القسط</th>
              <th className="p-3">تاريخ الاستحقاق</th>
              <th className="p-3">الأيام المتبقية</th>
              <th className="p-3">الحالة</th>
              <th className="p-3 no-print">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredData.length === 0 ? (
              <tr><td colSpan={13} className="p-8 text-slate-500">لا توجد نتائج</td></tr>
            ) : (
              filteredData.map((r, i) => {
                const statusColor = {
                  'متأخر': 'text-red-400 bg-red-400/10 border-red-400/20',
                  'مستحق اليوم': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
                  'مستحق غداً': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
                  'غير مستحق': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
                  'مكتمل السداد': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                }[r.status] || 'text-slate-400 bg-slate-800/50 border-slate-700'
                return (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono text-emerald-400">{r.serial_number}</td>
                    <td className="p-3 font-bold text-white">{r.customer_name}</td>
                    <td className="p-3 font-mono text-slate-300">{r.customer_id_num || '-'}</td>
                    <td className="p-3 text-slate-400">{r.investor_name || '-'}</td>
                    <td className="p-3 text-slate-400">{r.accountant_name || '-'}</td>
                    <td className="p-3 text-slate-400">{r.finance_company || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${r.sale_type === 'finance' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-300'}`}>
                        {r.sale_type === 'finance' ? 'تمويل' : 'بيع آجل'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-blue-400">{r.total_amount}</td>
                    <td className="p-3 font-bold text-emerald-400">{r.installment_amount}</td>
                    <td className="p-3 font-mono text-slate-300">{r.next_due?.due_date || '-'}</td>
                    <td className="p-3 font-bold">{r.days_remaining !== undefined ? r.days_remaining : '-'}</td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 no-print">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleView(r)} className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded" title="عرض"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handleEdit(r)} className="p-1.5 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500 hover:text-white rounded" title="تعديل"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handlePrint(r)} className="p-1.5 bg-slate-600/30 text-slate-400 hover:bg-slate-600 hover:text-white rounded" title="طباعة"><Printer className="w-4 h-4" /></button>
                        <button onClick={() => handleWhatsApp(r)} className="p-1.5 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white rounded" title="واتساب"><MessageCircle className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-slate-500">إجمالي النتائج: {filteredData.length} عقد</div>
    </div>
  )
}

// المكونات المساعدة (StatCard, FilterInput, FilterSelect) نفس الكود السابق
function StatCard({ label, value, icon, color }: any) {
  const colors = {
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    red: 'border-red-500/30 bg-red-500/10 text-red-400',
    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    green: 'border-green-500/30 bg-green-500/10 text-green-400',
    purple: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  }
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${colors[color] || colors.blue}`}>
      <div className="p-2 rounded-lg bg-black/20">{icon}</div>
      <div>
        <div className="text-xs font-bold opacity-70">{label}</div>
        <div className="text-lg font-black">{value}</div>
      </div>
    </div>
  )
}

function FilterInput({ label, value, onChange, placeholder, type = 'text' }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
      />
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, placeholder }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-slate-400">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
      >
        <option value="">{placeholder || 'الكل'}</option>
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
