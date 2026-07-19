import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
export default function ContractsReport() {
  const [reports, setReports] = useState([])

  useEffect(() => {
    fetchReport()
  }, [])

  async function fetchReport() {
    const { data, error } = await supabase
      .from('vw_contracts_report')
      .select('*')
      .order('serial_number', { ascending: true })
    
    if (data) setReports(data)
  }

  const totalAmount = reports.reduce((sum, r) => sum + Number(r.total_amount), 0)
  const totalPaid = reports.reduce((sum, r) => sum + Number(r.total_paid), 0)
  const totalDiscount = reports.reduce((sum, r) => sum + Number(r.discount_amount), 0)
  const totalRemaining = reports.reduce((sum, r) => sum + Number(r.remaining_amount), 0)
  const totalLate = reports.reduce((sum, r) => sum + Number(r.late_amount), 0)

  return (
    <div className="p-4" dir="rtl">
      <h2 className="text-2xl font-bold mb-4">تقرير العقود</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 shadow-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">تسلسل العقد</th>
              <th className="border p-2">اسم العميل</th>
              <th className="border p-2">الكفيل</th>
              <th className="border p-2">إجمالي العقد</th>
              <th className="border p-2">المدفوع</th>
              <th className="border p-2">المخصوم</th>
              <th className="border p-2">الباقي</th>
              <th className="border p-2">المتأخر</th>
              <th className="border p-2">قيمة القسط</th>
              <th className="border p-2">تاريخ آخر سداد</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={i} className="text-center hover:bg-gray-50">
                <td className="border p-2">{r.serial_number}</td>
                <td className="border p-2">{r.customer_name}</td>
                <td className="border p-2">{r.guarantor_name}</td>
                <td className="border p-2 text-blue-600 font-semibold">{r.total_amount}</td>
                <td className="border p-2 text-green-600">{r.total_paid}</td>
                <td className="border p-2">{r.discount_amount}</td>
                <td className="border p-2 font-bold">{r.remaining_amount}</td>
                <td className="border p-2 text-red-500 font-bold">{r.late_amount}</td>
                <td className="border p-2">{r.installment_amount}</td>
                <td className="border p-2">{r.last_payment_date || 'لم يسدد'}</td>
              </tr>
            ))}
            <tr className="bg-gray-800 text-white font-bold text-center">
              <td className="border p-2" colSpan={3}>الإجمالي الكلي</td>
              <td className="border p-2">{totalAmount}</td>
              <td className="border p-2 text-green-400">{totalPaid}</td>
              <td className="border p-2">{totalDiscount}</td>
              <td className="border p-2">{totalRemaining}</td>
              <td className="border p-2 text-red-400">{totalLate}</td>
              <td className="border p-2" colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
