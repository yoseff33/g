import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Plus, Printer, X, FileText, MessageCircle, AlertCircle, CheckCircle, Eye, Wallet, Download, Search } from 'lucide-react'

export default function ContractsReport() {
  const [reports, setReports] = useState([])
  const [investors, setInvestors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [contractToPrint, setContractToPrint] = useState<any>(null)
  
  const [viewClient, setViewClient] = useState<any>(null)
  const [installments, setInstallments] = useState<any[]>([])
  const [payData, setPayData] = useState({ id: '', method: 'cash', amount: '' })
  
  // حقل البحث والتصفية
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    investor_id: '',
    customer_name: '',
    national_id: '',
    phone: '',
    guarantor_name: '',
    guarantor_id_number: '', // تم إضافة هوية الكفيل هنا
    guarantor_phone: '',
    total_amount: '',
    installment_amount: '',
    discount_amount: '0',
    start_date: new Date().toISOString().split('T')[0],
    sale_type: 'deferred',
    finance_company: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: repData } = await supabase.from('vw_contracts_report').select('*').order('serial_number', { ascending: true })
    if (repData) setReports(repData)

    const { data: invData } = await supabase.from('investors').select('id, name')
    if (invData) setInvestors(invData)
  }

  const sendWhatsApp = (phone: string, type: 'reminder' | 'today' | 'late' | 'thanks', name: string, amount: string | number, date: string = '') => {
    const messages = {
      reminder: `السلام عليكم أستاذ/ة ${name}، نود تذكيركم بأن موعد استحقاق دفعتكم القادمة سيكون بتاريخ ${date} بمبلغ ${amount} ريال. نأمل التكرم بسدادها في موعدها، ونشكركم على ثقتكم بنا.`,
      today: `السلام عليكم أستاذ/ة ${name}، نفيدكم بأن دفعتكم المستحقة اليوم بتاريخ ${date} بقيمة ${amount} ريال أصبحت مستحقة. نرجو المبادرة بالسداد، وشكراً لكم.`,
      late: `السلام عليكم أستاذ/ة ${name}، تشير سجلاتنا إلى وجود قسط مستحق لم يتم سداده حتى الآن، وقيمته ${amount} ريال، وكان تاريخ استحقاقه ${date}. نرجو سرعة السداد لتجنب أي إجراءات أو رسوم وفقاً للعقد. شكراً لتعاونكم.`,
      thanks: `السلام عليكم أستاذ/ة ${name}، تم استلام دفعتكم بنجاح، ونشكركم على التزامكم بالسداد. نسعد بخدمتكم دائماً.`
    };
    
    if(phone) {
       window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(messages[type])}`, '_blank');
    } else {
       alert("لا يوجد رقم جوال مسجل لهذا العميل");
    }
  }

  async function handleAddContract(e: any) {
    e.preventDefault()
    setLoading(true)

    try {
      let customerId = ''
      
      const { data: existingCust } = await supabase.from('customers').select('id').eq('national_id', formData.national_id).single()

      if (existingCust) {
        customerId = existingCust.id
      } else {
        const { data: newCust, error: custErr } = await supabase.from('customers')
          .insert([{ name: formData.customer_name, national_id: formData.national_id, phone: formData.phone }])
          .select('id').single()
        if (custErr) throw custErr
        customerId = newCust.id
      }

      const { data: newContract, error: contractErr } = await supabase.from('installment_contracts')
        .insert([{
          customer_id: customerId,
          investor_id: formData.investor_id,
          guarantor_name: formData.guarantor_name,
          guarantor_id_number: formData.guarantor_id_number, // تم التمرير هنا
          guarantor_phone: formData.guarantor_phone,
          total_amount: formData.total_amount,
          installment_amount: formData.installment_amount,
          discount_amount: formData.discount_amount,
          start_date: formData.start_date,
          sale_type: formData.sale_type,
          finance_company: formData.sale_type === 'finance' ? formData.finance_company : null
        }])
        .select().single()

      if (contractErr) throw contractErr

      const netAmount = Number(formData.total_amount) - Number(formData.discount_amount)
      const instAmount = Number(formData.installment_amount)
      const months = Math.ceil(netAmount / instAmount)
      
      let payments = []
      let currentDate = new Date(formData.start_date)

      for(let i = 1; i <= months; i++) {
        let amount = instAmount
        if (i === months && (netAmount % instAmount !== 0)) {
          amount = netAmount % instAmount
        }

        payments.push({
          contract_id: newContract.id,
          due_date: currentDate.toISOString().split('T')[0],
          amount_due: amount,
          status: 'unpaid'
        })
        currentDate.setMonth(currentDate.getMonth() + 1)
      }

      const { error: paymentsErr } = await supabase.from('contract_payments').insert(payments)
      if (paymentsErr) throw paymentsErr

      setShowModal(false)
      fetchData()
      setFormData({
        investor_id: '', customer_name: '', national_id: '', phone: '', guarantor_name: '', guarantor_id_number: '', guarantor_phone: '', 
        total_amount: '', installment_amount: '', discount_amount: '0', start_date: new Date().toISOString().split('T')[0],
        sale_type: 'deferred', finance_company: ''
      })
    } catch (err: any) {
      alert('صار خطأ تأكد من البيانات ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openClientFile(clientObj: any) {
    setViewClient(clientObj)
    const { data } = await supabase.from('contract_payments')
      .select('*')
      .eq('contract_id', clientObj.contract_id)
      .order('due_date', { ascending: true })
    if(data) setInstallments(data)
  }

  async function handlePaySubmit(e: any) {
    e.preventDefault()
    try {
      const { error } = await supabase.from('contract_payments').update({
        status: 'paid',
        payment_method: payData.method,
        amount_paid: payData.amount,
        payment_date: new Date().toISOString().split('T')[0]
      }).eq('id', payData.id)

      if(error) throw error
      
      alert('تم تسجيل السداد بنجاح')
      setPayData({ id: '', method: 'cash', amount: '' })
      openClientFile(viewClient)
      fetchData()
    } catch(err: any) {
      alert('فشل تسجيل السداد: ' + err.message)
    }
  }

  // تصفية البيانات بناءً على شريط البحث
  const filteredReports = reports.filter((r: any) => 
    r.investor_name?.includes(searchTerm) || 
    r.customer_name?.includes(searchTerm) || 
    r.serial_number?.toString().includes(searchTerm)
  )

  // دالة استخراج التقرير للإكسل
  const exportToExcel = () => {
    let csvContent = "\uFEFF"; 
    csvContent += "رقم العقد,المستثمر,العميل,هوية العميل,الكفيل,هوية الكفيل,إجمالي العقد,المدفوع,المتبقي,المتأخر,نوع البيع\n";
    
    filteredReports.forEach((r: any) => {
      const row = [
        r.serial_number,
        r.investor_name || 'غير محدد',
        r.customer_name,
        r.customer_id_num || 'غير مسجل',
        r.guarantor_name || 'لا يوجد',
        r.guarantor_id_number || 'غير مسجل',
        r.total_amount,
        r.total_paid,
        r.remaining_amount,
        r.late_amount,
        r.sale_type === 'finance' ? `تمويل (${r.finance_company})` : 'بيع آجل'
      ].join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_العقود_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (contractToPrint) {
    return (
      <div className="p-8 bg-white text-slate-900 min-h-screen font-sans" dir="rtl">
        <div className="max-w-4xl mx-auto border-2 border-slate-900 p-8 rounded-xl shadow-sm relative">
          <div className="absolute top-8 left-8 no-print flex gap-4">
            <button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700">
              <Printer className="w-5 h-5" /> طباعة العقد
            </button>
            <button onClick={() => setContractToPrint(null)} className="bg-slate-200 text-slate-800 px-6 py-2 rounded-lg font-bold hover:bg-slate-300">
              رجوع
            </button>
          </div>

          <div className="text-center border-b-2 border-slate-900 pb-6 mb-8 mt-12">
            <h1 className="text-3xl font-black mb-2">عقد مبيعات بالتقسيط</h1>
            <p className="text-lg font-bold text-slate-600">رقم العقد: {contractToPrint.serial_number}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 text-lg">
            <div className="space-y-4">
              <p><span className="font-bold text-slate-500">الطرف الأول (المستثمر):</span> <span className="font-black">{contractToPrint.investor_name}</span></p>
              <p><span className="font-bold text-slate-500">الطرف الثاني (العميل):</span> <span className="font-black">{contractToPrint.customer_name}</span></p>
              <p><span className="font-bold text-slate-500">رقم الهوية:</span> <span className="font-black">{contractToPrint.customer_id_num || 'غير مسجل'}</span></p>
            </div>
            <div className="space-y-4">
              <p><span className="font-bold text-slate-500">الكفيل الغارم:</span> <span className="font-black">{contractToPrint.guarantor_name || 'لا يوجد'}</span></p>
              <p><span className="font-bold text-slate-500">هوية الكفيل:</span> <span className="font-black">{contractToPrint.guarantor_id_number || 'لا يوجد'}</span></p>
              <p><span className="font-bold text-slate-500">نوع البيع:</span> <span className="font-black">{contractToPrint.sale_type === 'finance' ? `تمويل (${contractToPrint.finance_company})` : 'بيع آجل'}</span></p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-8 mb-8 text-lg border-t-2 border-slate-900 pt-6">
            <div className="space-y-4">
              <p><span className="font-bold text-slate-500">إجمالي قيمة العقد:</span> <span className="font-black text-blue-600">{contractToPrint.total_amount} ريال</span></p>
              <p><span className="font-bold text-slate-500">الرصيد المتبقي:</span> <span className="font-black text-rose-600">{contractToPrint.remaining_amount} ريال</span></p>
            </div>
            <div className="space-y-4">
              <p><span className="font-bold text-slate-500">قيمة القسط الشهري:</span> <span className="font-black text-emerald-600">{contractToPrint.installment_amount} ريال</span></p>
            </div>
          </div>

          <div className="bg-slate-100 p-6 rounded-lg mb-8">
            <h3 className="font-bold mb-4 text-xl border-b border-slate-300 pb-2">إقرار الطرفين</h3>
            <p className="leading-relaxed font-medium">
              أقر أنا الطرف الثاني باستلامي للبضاعة المحددة بهذا العقد بحالة ممتازة وبكامل الرضا وألتزم بسداد الأقساط المحددة بالتواريخ المتفق عليها للطرف الأول وفي حال التأخر عن السداد يحق للطرف الأول اتخاذ الإجراءات النظامية
            </p>
          </div>

          <div className="grid grid-cols-3 gap-8 text-center mt-16 pt-8 border-t-2 border-slate-900">
            <div>
              <p className="font-bold mb-8">توقيع المستثمر</p>
              <div className="border-b-2 border-dashed border-slate-400 mx-8"></div>
            </div>
            <div>
              <p className="font-bold mb-8">توقيع العميل</p>
              <div className="border-b-2 border-dashed border-slate-400 mx-8"></div>
            </div>
            <div>
              <p className="font-bold mb-8">توقيع الكفيل</p>
              <div className="border-b-2 border-dashed border-slate-400 mx-8"></div>
            </div>
          </div>
        </div>

        <style>{`
          @media print {
            body { background: white; }
            .no-print { display: none !important; }
            #fazza_workspace aside, #fazza_workspace header { display: none !important; }
            #fazza_workspace { margin: 0 !important; padding: 0 !important; width: 100% !important; background: white !important;}
          }
        `}</style>
      </div>
    )
  }

  const totalAmount = filteredReports.reduce((sum, r: any) => sum + Number(r.total_amount), 0)
  const totalPaid = filteredReports.reduce((sum, r: any) => sum + Number(r.total_paid), 0)
  const totalRemaining = filteredReports.reduce((sum, r: any) => sum + Number(r.remaining_amount), 0)

  return (
    <div className="p-4 relative" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-white">إدارة تقارير العقود وملفات العملاء</h2>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="بحث باسم العميل، المستثمر، أو رقم العقد..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-xl outline-none focus:border-emerald-500 w-72"
            />
            <Search className="absolute left-3 top-2.5 text-slate-500 w-5 h-5" />
          </div>
          <button onClick={exportToExcel} className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2">
            <Download className="w-5 h-5" /> تصدير التقرير
          </button>
          <button onClick={() => setShowModal(true)} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl flex items-center gap-2">
            <Plus className="w-5 h-5" /> عقد جديد
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="w-full text-sm text-center">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="p-4">رقم العقد</th>
              <th className="p-4">المستثمر</th>
              <th className="p-4">العميل</th>
              <th className="p-4">الهوية</th>
              <th className="p-4">الإجمالي</th>
              <th className="p-4">المتبقي</th>
              <th className="p-4">واتساب</th>
              <th className="p-4">ملف العميل</th>
              <th className="p-4">طباعة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredReports.map((r: any, i) => (
              <tr key={i} className="hover:bg-slate-800/50">
                <td className="p-4 font-mono text-emerald-400">{r.serial_number}</td>
                <td className="p-4 font-bold text-slate-400">{r.investor_name || '-'}</td>
                <td className="p-4 font-bold text-slate-200">{r.customer_name}</td>
                <td className="p-4 text-slate-300 font-mono">{r.customer_id_num || '-'}</td>
                <td className="p-4 font-bold text-blue-400">{r.total_amount}</td>
                <td className="p-4 font-bold text-rose-300">{r.remaining_amount}</td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => sendWhatsApp(r.phone, 'reminder', r.customer_name, r.installment_amount, r.last_payment_date)} className="p-1.5 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500 hover:text-white" title="تذكير"><MessageCircle size={16}/></button>
                    <button onClick={() => sendWhatsApp(r.phone, 'today', r.customer_name, r.installment_amount, r.last_payment_date)} className="p-1.5 bg-yellow-500/10 text-yellow-400 rounded hover:bg-yellow-500 hover:text-white" title="اليوم"><CheckCircle size={16}/></button>
                    <button onClick={() => sendWhatsApp(r.phone, 'late', r.customer_name, r.installment_amount, r.last_payment_date)} className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500 hover:text-white" title="تأخير"><AlertCircle size={16}/></button>
                  </div>
                </td>
                <td className="p-4">
                  <button onClick={() => openClientFile(r)} className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 rounded-lg flex items-center justify-center gap-1 mx-auto font-bold text-xs transition-colors">
                    <Eye size={16} /> فتح السجل
                  </button>
                </td>
                <td className="p-4">
                  <button onClick={() => setContractToPrint(r)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
                    <Printer size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredReports.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-slate-500 font-bold">لا يوجد نتائج تطابق بحثك</td>
              </tr>
            )}
            <tr className="bg-slate-950 font-black">
              <td className="p-4 text-left" colSpan={4}>إجمالي النتائج المعروضة</td>
              <td className="p-4 text-blue-400">{totalAmount}</td>
              <td className="p-4 text-rose-300">{totalRemaining}</td>
              <td className="p-4" colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <FileText className="text-emerald-500 w-6 h-6" /> إصدار عقد تقسيط جديد
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddContract} className="p-6">
              <div className="grid grid-cols-2 gap-6">
                
                <div className="space-y-4">
                  <h4 className="font-bold text-emerald-400 border-b border-slate-800 pb-2">بيانات الارتباط</h4>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">نوع عملية البيع *</label>
                    <select required value={formData.sale_type} onChange={e => setFormData({...formData, sale_type: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none">
                      <option value="deferred">بيع آجل (سند أمر)</option>
                      <option value="finance">تطبيق تمويل</option>
                    </select>
                  </div>
                  {formData.sale_type === 'finance' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">جهة التمويل *</label>
                      <select required value={formData.finance_company} onChange={e => setFormData({...formData, finance_company: e.target.value})} className="w-full bg-slate-950 border border-emerald-700 rounded-lg px-4 py-2.5 text-emerald-100 outline-none">
                        <option value="">اختر شركة التمويل</option>
                        <option value="إمكان">إمكان</option>
                        <option value="تمارا">تمارا</option>
                        <option value="تابي">تابي</option>
                        <option value="مورا">مورا</option>
                        <option value="كوارا">كوارا</option>
                        <option value="تمام">تمام</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">المستثمر الممول *</label>
                    <select required value={formData.investor_id} onChange={e => setFormData({...formData, investor_id: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none">
                      <option value="">اختر المستثمر من القائمة</option>
                      {investors.map((inv: any) => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">اسم العميل *</label>
                    <input required value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">رقم الهوية *</label>
                      <input required value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">رقم الجوال *</label>
                      <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none font-mono" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-blue-400 border-b border-slate-800 pb-2">بيانات العقد والكفيل</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-400 mb-1">اسم الكفيل</label>
                      <input value={formData.guarantor_name} onChange={e => setFormData({...formData, guarantor_name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">هوية الكفيل</label>
                      <input value={formData.guarantor_id_number} onChange={e => setFormData({...formData, guarantor_id_number: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">جوال الكفيل</label>
                      <input value={formData.guarantor_phone} onChange={e => setFormData({...formData, guarantor_phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">إجمالي العقد *</label>
                      <input required type="number" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none font-mono text-blue-400 font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">خصم</label>
                      <input type="number" value={formData.discount_amount} onChange={e => setFormData({...formData, discount_amount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">القسط *</label>
                      <input required type="number" value={formData.installment_amount} onChange={e => setFormData({...formData, installment_amount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none font-mono text-emerald-400 font-bold" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">تاريخ أول قسط *</label>
                    <input required type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none font-mono" />
                  </div>
                </div>

              </div>
              
              <div className="mt-8 flex gap-4 pt-6 border-t border-slate-800">
                <button disabled={loading} type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl">
                  {loading ? 'جاري التنفيذ...' : 'اعتماد العقد'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewClient && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-black text-white">{viewClient.customer_name}</h3>
                <div className="flex gap-4 mt-2 text-sm text-slate-400 font-bold">
                  <span>العقد: <span className="text-emerald-400 font-mono">{viewClient.serial_number}</span></span>
                  <span>المتبقي: <span className="text-rose-400">{viewClient.remaining_amount} ريال</span></span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => sendWhatsApp(viewClient.phone, 'thanks', viewClient.customer_name, '')} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                  <MessageCircle size={16}/> شكر بعد السداد
                </button>
                <button onClick={() => setViewClient(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg"><X size={20}/></button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              <table className="w-full text-sm text-center">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="p-3">رقم القسط</th>
                    <th className="p-3">الاستحقاق</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">طريقة الدفع</th>
                    <th className="p-3">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {installments.map((inst, idx) => {
                    const isPaid = inst.status === 'paid'
                    const todayDate = new Date().toISOString().split('T')[0]
                    const isLate = !isPaid && inst.due_date < todayDate
                    const isToday = !isPaid && inst.due_date === todayDate
                    
                    return (
                      <tr key={inst.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono">{idx + 1}</td>
                        <td className="p-3 font-mono text-slate-300">{inst.due_date}</td>
                        <td className="p-3 font-bold text-blue-400">{inst.amount_due}</td>
                        <td className="p-3">
                          {isPaid ? <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-bold">مسدد</span> : 
                           isLate ? <span className="text-rose-400 bg-rose-400/10 px-2 py-1 rounded text-xs font-bold">متأخر</span> :
                           isToday ? <span className="text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded text-xs font-bold">مستحق اليوم</span> :
                           <span className="text-slate-400">غير مستحق</span>}
                        </td>
                        <td className="p-3 text-xs text-slate-400">{inst.payment_method === 'cash' ? 'كاش' : inst.payment_method === 'transfer' ? 'تحويل' : '-'}</td>
                        <td className="p-3">
                          {!isPaid ? (
                            payData.id === inst.id ? (
                              <form onSubmit={handlePaySubmit} className="flex flex-col gap-2 items-center bg-slate-800 p-2 rounded-lg border border-slate-600">
                                <input required type="number" placeholder="المبلغ" value={payData.amount} onChange={e=>setPayData({...payData, amount: e.target.value})} className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none"/>
                                <select value={payData.method} onChange={e=>setPayData({...payData, method: e.target.value})} className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none">
                                  <option value="cash">كاش</option>
                                  <option value="transfer">تحويل</option>
                                </select>
                                <div className="flex gap-1 w-full">
                                  <button type="submit" className="flex-1 bg-emerald-500 text-slate-900 text-xs font-bold py-1 rounded">تأكيد</button>
                                  <button type="button" onClick={()=>setPayData({id:'', method:'cash', amount:''})} className="flex-1 bg-slate-700 text-white text-xs py-1 rounded">إلغاء</button>
                                </div>
                              </form>
                            ) : (
                              <button onClick={() => setPayData({id: inst.id, method: 'cash', amount: inst.amount_due})} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 mx-auto">
                                <Wallet size={14}/> تسجيل سداد
                              </button>
                            )
                          ) : <span className="text-emerald-500 text-xs font-bold flex items-center justify-center gap-1"><CheckCircle size={14}/> مكتمل</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
