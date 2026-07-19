import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Plus, Printer, X, FileText } from 'lucide-react'

export default function ContractsReport() {
  const [reports, setReports] = useState([])
  const [investors, setInvestors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [contractToPrint, setContractToPrint] = useState<any>(null)

  const [formData, setFormData] = useState({
    investor_id: '',
    customer_name: '',
    national_id: '',
    phone: '',
    guarantor_name: '',
    guarantor_phone: '',
    total_amount: '',
    installment_amount: '',
    discount_amount: '0',
    start_date: new Date().toISOString().split('T')[0]
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

  async function handleAddContract(e: any) {
    e.preventDefault()
    setLoading(true)

    try {
      let customerId = ''
      
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('national_id', formData.national_id)
        .single()

      if (existingCust) {
        customerId = existingCust.id
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert([{ 
            name: formData.customer_name, 
            national_id: formData.national_id, 
            phone: formData.phone 
          }])
          .select('id')
          .single()
        
        if (custErr) throw custErr
        customerId = newCust.id
      }

      const { data: newContract, error: contractErr } = await supabase
        .from('installment_contracts')
        .insert([{
          customer_id: customerId,
          investor_id: formData.investor_id,
          guarantor_name: formData.guarantor_name,
          guarantor_phone: formData.guarantor_phone,
          total_amount: formData.total_amount,
          installment_amount: formData.installment_amount,
          discount_amount: formData.discount_amount,
          start_date: formData.start_date
        }])
        .select()
        .single()

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
        investor_id: '', customer_name: '', national_id: '', phone: '',
        guarantor_name: '', guarantor_phone: '', total_amount: '',
        installment_amount: '', discount_amount: '0', start_date: new Date().toISOString().split('T')[0]
      })
    } catch (err: any) {
      alert('صار خطأ تأكد من البيانات ' + err.message)
    } finally {
      setLoading(false)
    }
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
              <p><span className="font-bold text-slate-500">الكفيل الغارم:</span> <span className="font-black">{contractToPrint.guarantor_name || 'لا يوجد'}</span></p>
            </div>
            <div className="space-y-4">
              <p><span className="font-bold text-slate-500">إجمالي قيمة العقد:</span> <span className="font-black">{contractToPrint.total_amount} ريال</span></p>
              <p><span className="font-bold text-slate-500">قيمة القسط الشهري:</span> <span className="font-black">{contractToPrint.installment_amount} ريال</span></p>
              <p><span className="font-bold text-slate-500">الرصيد المتبقي:</span> <span className="font-black">{contractToPrint.remaining_amount} ريال</span></p>
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

  const totalAmount = reports.reduce((sum, r: any) => sum + Number(r.total_amount), 0)
  const totalPaid = reports.reduce((sum, r: any) => sum + Number(r.total_paid), 0)
  const totalDiscount = reports.reduce((sum, r: any) => sum + Number(r.discount_amount), 0)
  const totalRemaining = reports.reduce((sum, r: any) => sum + Number(r.remaining_amount), 0)
  const totalLate = reports.reduce((sum, r: any) => sum + Number(r.late_amount), 0)

  return (
    <div className="p-4 relative" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-white">إدارة تقارير العقود</h2>
          <p className="text-slate-400 text-sm mt-1">تابع إجمالي العقود واربطها بالمستثمرين وأصدر السندات</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
        >
          <Plus className="w-5 h-5" /> إنشاء عقد تقسيط جديد
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-xl bg-slate-900/50">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="p-4 text-right">رقم العقد</th>
              <th className="p-4 text-right">المستثمر המمول</th>
              <th className="p-4 text-right">اسم العميل</th>
              <th className="p-4 text-right">الكفيل</th>
              <th className="p-4 text-right">إجمالي العقد</th>
              <th className="p-4 text-right">المدفوع</th>
              <th className="p-4 text-right">المتبقي</th>
              <th className="p-4 text-right">المتأخر</th>
              <th className="p-4 text-right">قيمة القسط</th>
              <th className="p-4 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {reports.map((r: any, i) => (
              <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                <td className="p-4 font-mono text-emerald-400">{r.serial_number}</td>
                <td className="p-4 font-bold text-slate-200">{r.investor_name || 'غير محدد'}</td>
                <td className="p-4 font-bold text-slate-200">{r.customer_name}</td>
                <td className="p-4 text-slate-400">{r.guarantor_name || '-'}</td>
                <td className="p-4 font-bold text-blue-400">{r.total_amount}</td>
                <td className="p-4 font-bold text-emerald-400">{r.total_paid}</td>
                <td className="p-4 font-black text-rose-300">{r.remaining_amount}</td>
                <td className="p-4 font-bold text-red-500">{r.late_amount}</td>
                <td className="p-4 text-slate-300">{r.installment_amount}</td>
                <td className="p-4 text-center">
                  <button onClick={() => setContractToPrint(r)} className="p-2 bg-slate-800 hover:bg-emerald-500 hover:text-slate-900 text-slate-400 rounded-lg transition-colors" title="طباعة العقد">
                    <Printer className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-950 font-black">
              <td className="p-4 text-left" colSpan={4}>الإجمالي الكلي للسوق</td>
              <td className="p-4 text-blue-400">{totalAmount}</td>
              <td className="p-4 text-emerald-400">{totalPaid}</td>
              <td className="p-4 text-rose-300">{totalRemaining}</td>
              <td className="p-4 text-red-500">{totalLate}</td>
              <td className="p-4" colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
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
                    <label className="block text-xs font-bold text-slate-400 mb-1">المستثمر الممول للعملية *</label>
                    <select required value={formData.investor_id} onChange={e => setFormData({...formData, investor_id: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none">
                      <option value="">اختر المستثمر من القائمة</option>
                      {investors.map((inv: any) => (
                        <option key={inv.id} value={inv.id}>{inv.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">اسم العميل الثلاثي *</label>
                    <input required type="text" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none" placeholder="محمد صالح العتيبي" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">رقم الهوية *</label>
                      <input required type="text" value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none font-mono" placeholder="1000000000" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">رقم الجوال *</label>
                      <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none font-mono" placeholder="0500000000" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-blue-400 border-b border-slate-800 pb-2">بيانات العقد والكفيل</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">اسم الكفيل الغارم</label>
                      <input type="text" value={formData.guarantor_name} onChange={e => setFormData({...formData, guarantor_name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">جوال الكفيل</label>
                      <input type="text" value={formData.guarantor_phone} onChange={e => setFormData({...formData, guarantor_phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">إجمالي العقد *</label>
                      <input required type="number" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none font-mono text-blue-400 font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">الخصم المقدم</label>
                      <input type="number" value={formData.discount_amount} onChange={e => setFormData({...formData, discount_amount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">القسط الشهري *</label>
                      <input required type="number" value={formData.installment_amount} onChange={e => setFormData({...formData, installment_amount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none font-mono text-emerald-400 font-bold" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">تاريخ بداية أول قسط *</label>
                    <input required type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none font-mono" />
                  </div>
                </div>

              </div>
              
              <div className="mt-8 flex gap-4 pt-6 border-t border-slate-800">
                <button disabled={loading} type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl transition-colors">
                  {loading ? 'جاري تأسيس العقد والجدولة...' : 'اعتماد العقد وإصدار الدفعات'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
