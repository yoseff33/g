import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Percent, RefreshCw, X, Play, ShieldAlert, CheckCircle, Calculator, AlertCircle } from 'lucide-react';
import { ProfitDistribution, Contract, Investor } from '../types';

interface DistributionItemDraft {
  investor_id: string;
  contract_id: string;
  investor_name: string;
  contract_number: string;
  contract_amount: number;
  profit_percentage: number;
  calculated_amount: number;
  final_amount: number;
}

export default function ProfitDistributionView() {
  const [distributions, setDistributions] = useState<ProfitDistribution[]>([]);
  const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form states
  const [formDistributionNumber, setFormDistributionNumber] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTotalAmount, setFormTotalAmount] = useState('');
  const [draftItems, setDraftItems] = useState<DistributionItemDraft[]>([]);

  useEffect(() => {
    fetchDistributionsAndContracts();
  }, []);

  async function fetchDistributionsAndContracts() {
    setLoading(true);
    try {
      // 1. Fetch Profit Distributions with items
      const { data: dData, error: dErr } = await supabase
        .from('profit_distributions')
        .select('*, items:profit_distribution_items(*, investor:investors(name), contract:contracts(contract_number))')
        .order('date', { ascending: false });
      if (dErr) throw dErr;
      setDistributions(dData || []);

      // 2. Fetch Active Contracts with investor details
      const { data: conData, error: conErr } = await supabase
        .from('contracts')
        .select('*, investor:investors(name, status)')
        .eq('status', 'active');
      if (conErr) throw conErr;
      
      const activeCons = conData?.filter(c => c.investor?.status === 'active') || [];
      setActiveContracts(activeCons);

      // Suggest cycle number
      const nextNum = `DIS-${new Date().getFullYear()}-${String((dData?.length || 0) + 1).padStart(3, '0')}`;
      setFormDistributionNumber(nextNum);

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate Weighted shares of the total pool amount
  function runDistributionCalculation() {
    const pool = Number(formTotalAmount);
    if (isNaN(pool) || pool <= 0) {
      alert('الرجاء إدخال مبلغ توزيع صحيح أكبر من الصفر.');
      return;
    }

    if (activeContracts.length === 0) {
      alert('لا توجد عقود استثمارية جارية لنشر التوزيع عليها.');
      return;
    }

    // Relative weight = contract_amount * (profit_percentage / 100)
    const weights = activeContracts.map(c => ({
      contractId: c.id,
      weight: Number(c.amount) * (Number(c.profit_percentage) / 100)
    }));

    const totalWeightSum = weights.reduce((sum, w) => sum + w.weight, 0);

    if (totalWeightSum === 0) {
      alert('مجموع الأوزان الاستثمارية يساوي صفر. يرجى مراجعة نسب أرباح العقود.');
      return;
    }

    const drafts: DistributionItemDraft[] = activeContracts.map(c => {
      const contractWeight = Number(c.amount) * (Number(c.profit_percentage) / 100);
      // weighted Share = (weight / sum of weights) * pool
      const share = (contractWeight / totalWeightSum) * pool;
      const roundedShare = Math.round((share + Number.EPSILON) * 100) / 100;

      return {
        investor_id: c.investor_id,
        contract_id: c.id,
        investor_name: c.investor?.name || 'مستثمر غير معروف',
        contract_number: c.contract_number,
        contract_amount: Number(c.amount),
        profit_percentage: Number(c.profit_percentage),
        calculated_amount: roundedShare,
        final_amount: roundedShare
      };
    });

    setDraftItems(drafts);
  }

  function handleFinalAmountChange(index: number, val: string) {
    const updated = [...draftItems];
    updated[index].final_amount = Number(val) || 0;
    setDraftItems(updated);
  }

  async function handleApproveDistribution(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    if (draftItems.length === 0) {
      setFormError('الرجاء الضغط على "بدء الاحتساب المالي" أولاً لتوليد كشف توزيع الحصص.');
      setIsSaving(false);
      return;
    }

    const computedTotal = draftItems.reduce((sum, item) => sum + item.final_amount, 0);

    try {
      // 1. Double-Entry General Ledger Creation
      // Create journal entry header
      const journalDesc = `توزيع أرباح دوري - دورة رقم ${formDistributionNumber}`;
      const { data: journalHeader, error: jhErr } = await supabase
        .from('journal_entries')
        .insert([{
          date: formDate,
          description: journalDesc,
          reference: formDistributionNumber,
          status: 'posted' // Auto posted on approval
        }])
        .select();

      if (jhErr) throw jhErr;
      const entryId = journalHeader[0].id;

      // Journal items: 
      // DEBIT Retained Earnings (321101) - total pool
      // CREDIT Accrued Dividends to Investors (211101) - portion per investor
      const itemsPayload: any[] = [
        {
          entry_id: entryId,
          account_id: '321101', // Retained earnings
          debit: computedTotal,
          credit: 0,
          description: journalDesc
        }
      ];

      draftItems.forEach(item => {
        itemsPayload.push({
          entry_id: entryId,
          account_id: '211101', // Accrued dividends
          debit: 0,
          credit: item.final_amount,
          description: `إثبات أرباح مستحقة للمستثمر ${item.investor_name} عن عقد ${item.contract_number}`
        });
      });

      const { error: jiErr } = await supabase
        .from('journal_items')
        .insert(itemsPayload);

      if (jiErr) {
        // Rollback header
        await supabase.from('journal_entries').delete().eq('id', entryId);
        throw jiErr;
      }

      // 2. Insert Profit Distribution Header
      const { data: dist, error: distErr } = await supabase
        .from('profit_distributions')
        .insert([{
          distribution_number: formDistributionNumber,
          date: formDate,
          total_amount: computedTotal,
          status: 'approved',
          entry_id: entryId
        }])
        .select();

      if (distErr) throw distErr;
      const distributionId = dist[0].id;

      // 3. Insert Profit Distribution Items
      const distItemsPayload = draftItems.map(item => ({
        distribution_id: distributionId,
        investor_id: item.investor_id,
        contract_id: item.contract_id,
        amount: item.final_amount,
        status: 'pending' // pending payment voucher
      }));

      const { error: itemsErr } = await supabase
        .from('profit_distribution_items')
        .insert(distItemsPayload);

      if (itemsErr) throw itemsErr;

      setShowAddModal(false);
      resetForm();
      fetchDistributionsAndContracts();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'حدث خطأ في النظام المحاسبي أو قاعدة البيانات أثناء حفظ دورة الأرباح.');
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormTotalAmount('');
    setDraftItems([]);
    setFormError('');
    const nextNum = `DIS-${new Date().getFullYear()}-${String((distributions?.length || 0) + 1).padStart(3, '0')}`;
    setFormDistributionNumber(nextNum);
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(val);
  };

  return (
    <div className="space-y-6" id="profit_distributions_view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">توزيع أرباح المستثمرين</h1>
          <p className="text-slate-500 text-sm mt-1">توليد دورات أرباح الشركاء بنسب الأوزان الاستثمارية، وترحيل الأرباح من المبقاة إلى الذمم الدائنة</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors self-start"
        >
          <Play className="w-4 h-4" />
          إطلاق دورة توزيع أرباح جديدة
        </button>
      </div>

      {/* Cycle Listings */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">سجل دورات توزيع الأرباح السابقة</h3>
          <button 
            onClick={fetchDistributionsAndContracts}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
              <tr>
                <th className="py-3 px-6 font-bold">رقم الدورة</th>
                <th className="py-3 px-6 font-bold">تاريخ التوزيع</th>
                <th className="py-3 px-6 font-bold">إجمالي المبلغ الموزع</th>
                <th className="py-3 px-6 font-bold">المستفيدون (حجم الحصة)</th>
                <th className="py-3 px-6 font-bold">القيد المحاسبي المولد</th>
                <th className="py-3 px-6 font-bold">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">جاري تحميل الدورات المحققة...</td>
                </tr>
              ) : distributions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">لم يسبق إطلاق أي دورة توزيع أرباح بعد.</td>
                </tr>
              ) : (
                distributions.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors align-top">
                    <td className="py-4 px-6 font-mono font-bold text-slate-700">{d.distribution_number}</td>
                    <td className="py-4 px-6 text-slate-600 font-mono">{d.date}</td>
                    <td className="py-4 px-6 font-black text-slate-950">{formatCurrency(d.total_amount)}</td>
                    <td className="py-4 px-6 space-y-1">
                      {d.items?.map((item: any) => (
                        <div key={item.id} className="text-xs text-slate-600 border-b border-slate-50 pb-1 flex justify-between gap-4 max-w-sm">
                          <span className="font-semibold text-slate-800">{item.investor?.name}</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded">
                        JE-POSTED ({String(d.entry_id).substring(0, 8)})
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" />
                        تم الاعتماد والدفع
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution Creator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-xl border border-slate-100 my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">صياغة وتوزيع دورة أرباح جديدة</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApproveDistribution} className="p-6 space-y-6">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Pool specs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 items-end">
                <div className="space-y-1">
                  <label className="text-slate-600 text-xs font-semibold">رقم دورة التوزيع *</label>
                  <input 
                    type="text" 
                    value={formDistributionNumber}
                    onChange={(e) => setFormDistributionNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-mono text-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 text-xs font-semibold">تاريخ التوزيع والاعتماد *</label>
                  <input 
                    type="date" 
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600 text-xs font-semibold">المبلغ الإجمالي للتوزيع (SAR) *</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={formTotalAmount}
                      onChange={(e) => setFormTotalAmount(e.target.value)}
                      placeholder="مثال: 150000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-800 bg-white"
                    />
                    <button 
                      type="button" 
                      onClick={runDistributionCalculation}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Calculator className="w-4 h-4" />
                      الاحتساب
                    </button>
                  </div>
                </div>
              </div>

              {/* Draft Allocation Grid */}
              {draftItems.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">الحصص المحتسبة للمستثمرين بناءً على ثقل عقودهم الاستثمارية الجارية</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-sm">
                    <table className="w-full text-right">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="py-2.5 px-4 font-bold">اسم المستثمر الشريك</th>
                          <th className="py-2.5 px-4 font-bold">رقم العقد</th>
                          <th className="py-2.5 px-4 font-bold">مبلغ الاستثمار الرئيسي</th>
                          <th className="py-2.5 px-4 font-bold">النسبة المتفق عليها</th>
                          <th className="py-2.5 px-4 font-bold">الحصة المحتسبة بقوة الوزن</th>
                          <th className="py-2.5 px-4 font-bold">الحصة المقررة للتوزيع (تعديل يدوي)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {draftItems.map((item, index) => (
                          <tr key={index}>
                            <td className="py-3 px-4 font-semibold text-slate-800">{item.investor_name}</td>
                            <td className="py-3 px-4 font-mono text-slate-500">{item.contract_number}</td>
                            <td className="py-3 px-4 font-bold text-slate-700">{formatCurrency(item.contract_amount)}</td>
                            <td className="py-3 px-4 font-semibold text-emerald-700">{item.profit_percentage}%</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">{formatCurrency(item.calculated_amount)}</td>
                            <td className="py-3 px-4 w-44">
                              <input 
                                type="number" 
                                value={item.final_amount}
                                onChange={(e) => handleFinalAmountChange(index, e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded-md font-mono text-sm focus:outline-none focus:border-slate-400 font-bold text-slate-900 text-left"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs rounded-xl flex justify-between items-center">
                    <span>إجمالي الحصص الموزعة الفعلي:</span>
                    <strong className="font-mono font-bold text-sm bg-indigo-200 px-3 py-1 rounded">
                      {formatCurrency(draftItems.reduce((sum, item) => sum + item.final_amount, 0))}
                    </strong>
                  </div>
                </div>
              )}

              {/* Alert on Retained earnings depletion */}
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs flex gap-2 items-start leading-relaxed">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <h5 className="font-bold">تأثيرات الميزانية وقيد التوزيع</h5>
                  <p className="mt-1">سيتم ترحيل قيد توزيع الأرباح آلياً، بحيث يتم خصم المبلغ الإجمالي من حساب الأرباح المحتجزة [321101] ليكون مديناً، ويزيد حساب أرباح مستحقة التوزيع [211101] ليكون دائناً لكل مستثمر بقيمة حصته.</p>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving || draftItems.length === 0}
                  className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors"
                >
                  {isSaving ? 'جاري ترحيل دورة الأرباح...' : 'اعتماد الدورة وتوزيع الأرباح'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
