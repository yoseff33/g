import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { MessageCircle, AlertCircle, CheckCircle, Clock, CalendarDays } from 'lucide-react'

export default function AccountantDashboard() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contract_payments')
      .select(`
        id,
        due_date,
        amount_due,
        status,
        payment_date,
        installment_contracts (
          serial_number,
          customers (
            name,
            phone
          )
        )
      `)
    
    if (data) {
      setPayments(data)
    }
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const tomorrowDate = new Date(Date.now() + 86400000)
  const tomorrow = tomorrowDate.toISOString().split('T')[0]

  const dueToday = payments.filter(p => p.status === 'unpaid' && p.due_date === today)
  const dueTomorrow = payments.filter(p => p.status === 'unpaid' && p.due_date === tomorrow)
  const late = payments.filter(p => p.status === 'unpaid' && p.due_date < today)
  const paidToday = payments.filter(p => p.status === 'paid' && p.payment_date === today)

  const sendWhatsApp = (phone: string, type: 'today' | 'tomorrow' | 'late' | 'thanks', name: string, amount: number, date: string) => {
  if (!phone) {
    alert("لا يوجد رقم جوال مسجل لهذا العميل")
    return
  }

  // تنظيف وتنسيق الرقم
  let cleanPhone = phone.replace(/[^0-9]/g, '')
  
  // تحويل الصيغة المحلية (05...) إلى الدولية (9665...)
  if (cleanPhone.startsWith('05')) {
    cleanPhone = '966' + cleanPhone.substring(1)
  } else if (cleanPhone.startsWith('5') && cleanPhone.length === 9) {
    cleanPhone = '966' + cleanPhone
  }

  const messages = {
    tomorrow: `السلام عليكم أستاذ/ة ${name}، نود تذكيركم بأن موعد استحقاق دفعتكم القادمة سيكون بتاريخ ${date} بمبلغ ${amount} ريال. نأمل التكرم بسدادها في موعدها، ونشكركم على ثقتكم بنا.`,
    today: `السلام عليكم أستاذ/ة ${name}، نفيدكم بأن دفعتكم المستحقة اليوم بتاريخ ${date} بقيمة ${amount} ريال أصبحت مستحقة. نرجو المبادرة بالسداد، وشكراً لكم.`,
    late: `السلام عليكم أستاذ/ة ${name}، تشير سجلاتنا إلى وجود قسط مستحق لم يتم سداده حتى الآن، وقيمته ${amount} ريال، وكان تاريخ استحقاقه ${date}. نرجو سرعة السداد لتجنب أي إجراءات أو رسوم وفقاً للعقد. شكراً لتعاونكم.`,
    thanks: `السلام عليكم أستاذ/ة ${name}، تم استلام دفعتكم بنجاح، ونشكركم على التزامكم بالسداد. نسعد بخدمتكم دائماً.`
  }
  
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messages[type])}`
  const newWindow = window.open(url, '_blank')
  
  if (!newWindow) {
    alert("يرجى السماح بفتح النوافذ المنبثقة لاستخدام خدمة الواتساب")
  }
}

if (loading) return (
  <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white font-bold text-xl" dir="rtl">
    جاري تجهيز بيانات المحاسب...
  </div>
)

return (
  <div className="min-h-screen bg-slate-950 p-6 text-white" dir="rtl">
    <div className="mb-8 border-b border-slate-800 pb-6">
      <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">لوحة متابعة المحاسب</h1>
      <p className="text-slate-400">تحكم كامل في الاستحقاقات وتواصل لحظي مع العملاء</p>
    </div>
    {/* باقي الكود يكمل هنا */}


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-lg shadow-red-900/10">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <div className="bg-red-500/20 p-3 rounded-lg text-red-500"><AlertCircle size={24} /></div>
            <h2 className="text-xl font-bold text-red-400">عملاء متأخرين ({late.length})</h2>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {late.length === 0 ? <p className="text-slate-500 text-center py-4 font-bold">لا يوجد متأخرات الحمدلله</p> : 
              late.map(p => (
                <div key={p.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center hover:border-red-500/50 transition-colors">
                  <div>
                    <p className="font-bold text-slate-200">{p.installment_contracts?.customers?.name || 'غير معروف'}</p>
                    <div className="flex gap-3 text-xs mt-2 font-mono">
                      <span className="text-slate-400">عقد: {p.installment_contracts?.serial_number}</span>
                      <span className="text-red-400">تأخير من: {p.due_date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-lg text-blue-400">{p.amount_due}</span>
                    <button onClick={() => sendWhatsApp(p.installment_contracts?.customers?.phone, 'late', p.installment_contracts?.customers?.name, p.amount_due, p.due_date)} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg" title="إشعار تأخير">
                      <MessageCircle size={20} />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="bg-slate-900 border border-yellow-500/30 rounded-2xl p-6 shadow-lg shadow-yellow-900/10">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <div className="bg-yellow-500/20 p-3 rounded-lg text-yellow-500"><Clock size={24} /></div>
            <h2 className="text-xl font-bold text-yellow-400">مستحق اليوم ({dueToday.length})</h2>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {dueToday.length === 0 ? <p className="text-slate-500 text-center py-4 font-bold">لا يوجد استحقاقات لليوم</p> : 
              dueToday.map(p => (
                <div key={p.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center hover:border-yellow-500/50 transition-colors">
                  <div>
                    <p className="font-bold text-slate-200">{p.installment_contracts?.customers?.name || 'غير معروف'}</p>
                    <div className="flex gap-3 text-xs mt-2 font-mono">
                      <span className="text-slate-400">عقد: {p.installment_contracts?.serial_number}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-lg text-blue-400">{p.amount_due}</span>
                    <button onClick={() => sendWhatsApp(p.installment_contracts?.customers?.phone, 'today', p.installment_contracts?.customers?.name, p.amount_due, p.due_date)} className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 p-2 rounded-lg font-bold" title="إشعار اليوم">
                      <MessageCircle size={20} />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-lg shadow-blue-900/10">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <div className="bg-blue-500/20 p-3 rounded-lg text-blue-500"><CalendarDays size={24} /></div>
            <h2 className="text-xl font-bold text-blue-400">مستحق غداً ({dueTomorrow.length})</h2>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {dueTomorrow.length === 0 ? <p className="text-slate-500 text-center py-4 font-bold">لا يوجد استحقاقات لبكرة</p> : 
              dueTomorrow.map(p => (
                <div key={p.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center hover:border-blue-500/50 transition-colors">
                  <div>
                    <p className="font-bold text-slate-200">{p.installment_contracts?.customers?.name || 'غير معروف'}</p>
                    <div className="flex gap-3 text-xs mt-2 font-mono">
                      <span className="text-slate-400">عقد: {p.installment_contracts?.serial_number}</span>
                      <span className="text-blue-400">{p.due_date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-lg text-blue-400">{p.amount_due}</span>
                    <button onClick={() => sendWhatsApp(p.installment_contracts?.customers?.phone, 'tomorrow', p.installment_contracts?.customers?.name, p.amount_due, p.due_date)} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg" title="تذكير مسبق">
                      <MessageCircle size={20} />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-lg shadow-emerald-900/10">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <div className="bg-emerald-500/20 p-3 rounded-lg text-emerald-500"><CheckCircle size={24} /></div>
            <h2 className="text-xl font-bold text-emerald-400">مسددين اليوم ({paidToday.length})</h2>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {paidToday.length === 0 ? <p className="text-slate-500 text-center py-4 font-bold">مافي سدادات مسجلة اليوم</p> : 
              paidToday.map(p => (
                <div key={p.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center hover:border-emerald-500/50 transition-colors">
                  <div>
                    <p className="font-bold text-slate-200">{p.installment_contracts?.customers?.name || 'غير معروف'}</p>
                    <div className="flex gap-3 text-xs mt-2 font-mono">
                      <span className="text-slate-400">عقد: {p.installment_contracts?.serial_number}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-lg text-emerald-400">{p.amount_due}</span>
                    <button onClick={() => sendWhatsApp(p.installment_contracts?.customers?.phone, 'thanks', p.installment_contracts?.customers?.name, p.amount_due, '')} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 p-2 rounded-lg font-bold" title="رسالة شكر">
                      <MessageCircle size={20} />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

      </div>
    </div>
  )
}
