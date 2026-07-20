import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, FilePlus, Calendar, ShieldCheck, DollarSign, RefreshCw, X, AlertCircle } from 'lucide-react';
import { Contract, Investor } from '../types';

export default function ContractsView() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form states
  const [formContractNumber, setFormContractNumber] = useState('');
  const [formInvestorId, setFormInvestorId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formProfitPercentage, setFormProfitPercentage] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'completed' | 'terminated'>('active');

  useEffect(() => {
    fetchContractsAndInvestors();
  }, []);

  async function fetchContractsAndInvestors() {
    setLoading(true);
    try {
      // 1. Fetch Investors
      const { data: invData, error: invErr } = await supabase
        .from('investors')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (invErr) throw invErr;
      setInvestors(invData || []);

      // 2. Fetch Contracts with Investor Details
      const { data: conData, error: conErr } = await supabase
        .from('contracts')
        .select('*, investor:investors(name)')
        .order('created_at', { ascending: false });
      if (conErr) throw conErr;
      setContracts(conData || []);

      // Pre-fill next contract number
      const nextNum = `CTR-${new Date().getFullYear()}-${String((conData?.length || 0) + 1).padStart(4, '0')}`;
      setFormContractNumber(nextNum);

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    if (!formInvestorId || !formAmount || !formProfitPercentage || !formStartDate || !formEndDate) {
      setFormError('يرجى تعبئة كافة الحقول المطلوبة لإنشاء العقد.');
      setIsSaving(false);
      return;
    }

    if (new Date(formEndDate) < new Date(formStartDate)) {
      setFormError('تاريخ نهاية العقد لا يمكن أن يكون قبل تاريخ بدايته.');
      setIsSaving(false);
      return;
    }

    const payload = {
      contract_number: formContractNumber,
      investor_id: formInvestorId,
      amount: Number(formAmount),
      profit_percentage: Number(formProfitPercentage),
      start_date: formStartDate,
      end_date: formEndDate,
      status: formStatus,
    };

    try {
      // 1. Write Contract
      const { data: contractData, error: cErr } = await supabase
        .from('contracts')
        .insert([payload])
        .select();
      if (cErr) throw cErr;

      // 2. (Optional but professional) We do NOT post a journal entry automatically, 
      // but let's notify that contracts are generated. Vouchers can receive actual cash later!

      setShowAddModal(false);
      resetForm();
      fetchContractsAndInvestors();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'حدث خطأ غير متوقع أثناء تسجيل العقد الاستثماري في قاعدة البيانات.');
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setFormInvestorId('');
    setFormAmount('');
    setFormProfitPercentage('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate('');
    setFormStatus('active');
    setFormError('');
    const nextNum = `CTR-${new Date().getFullYear()}-${String((contracts?.length || 0) + 1).padStart(4, '0')}`;
    setFormContractNumber(nextNum);
  }

  const filteredContracts = contracts.filter(c => {
    const investorName = c.investor?.name || '';
    const matchesSearch = investorName.includes(search) || c.contract_number.includes(search);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(val);
  };

  return (
    <div className="space-y-6 text-slate-100" id="contracts_view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">العقود والربط الاستثماري</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">إصدار وصياغة ومتابعة عقود استثمار الشركاء وتحديد نسب توزيعات الأرباح السنوية</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] cursor-pointer self-start"
        >
          <FilePlus className="w-4 h-4 text-slate-950" />
          <span>توقيع عقد استثماري جديد</span>
        </button>
      </div>

      {/* Filtering */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-3.5 top-3 text-slate-500 w-4.5 h-4.5" />
          <input 
            type="text" 
            placeholder="ابحث برقم العقد الموحد أو اسم المستثمر الشريك..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-11 pl-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <div className="flex gap-2.5">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-300 font-bold"
          >
            <option value="all">كل حالات التعاقد</option>
            <option value="active">عقود جارية (نشطة)</option>
            <option value="completed">عقود مكتملة ومغلقة</option>
            <option value="terminated">عقود مفسوخة / ملغاة</option>
          </select>
          <button 
            onClick={fetchContractsAndInvestors}
            className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/40 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">رقم العقد الموحد</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">المستثمر الشريك</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">رأس المال المستثمر الرئيسي</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">الربح السنوي المتفق عليه</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">فترة سريان العقد ونهايته</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">الحالة القانونية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">جاري سحب وتحديث العقود الاستثمارية من الخادم السحابي...</td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">لا توجد عقود ربط استثماري مسجلة تطابق محددات البحث الحالية.</td>
                </tr>
              ) : (
                filteredContracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-emerald-400 text-sm">{c.contract_number}</td>
                    <td className="py-4 px-6 font-bold text-white text-sm">{c.investor?.name || 'مستثمر غير مسجل بالخطأ'}</td>
                    <td className="py-4 px-6 font-bold text-white font-mono text-sm">{formatCurrency(c.amount)}</td>
                    <td className="py-4 px-6">
                      <span className="text-emerald-400 font-black text-sm">{c.profit_percentage}%</span>
                      <p className="text-[10px] text-slate-500 mt-1 font-bold">عائد توزيع دوري</p>
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>البداية: {c.start_date}</span>
                        <span className="text-slate-600">|</span>
                        <span>الاستحقاق: {c.end_date}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                        c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        c.status === 'completed' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {c.status === 'active' ? 'عقد سارٍ' :
                         c.status === 'completed' ? 'منتهٍ بنجاح' : 'مفسوخ / ملغى'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in text-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-800/80 bg-slate-950/40">
              <h3 className="font-black text-white text-base">صياغة وتوقيع عقد استثماري قانوني جديد</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-950/40 text-rose-300 text-xs font-semibold rounded-xl border border-rose-900/40 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">رقم العقد المرجعي *</label>
                  <input 
                    type="text" 
                    value={formContractNumber}
                    onChange={(e) => setFormContractNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">اختيار المستثمر الشريك *</label>
                  <select
                    value={formInvestorId}
                    onChange={(e) => setFormInvestorId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="" className="bg-slate-900">-- اختر مستثمر شريك --</option>
                    {investors.map(inv => (
                      <option key={inv.id} value={inv.id} className="bg-slate-900">{inv.name} ({inv.national_id})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">مبلغ الاستثمار الرئيسي (SAR) *</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      required
                      min={100}
                      placeholder="100,000"
                      className="w-full pl-12 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <DollarSign className="absolute left-3 top-2 text-slate-500 w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">نسبة الربح السنوية المتفق عليها (%) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formProfitPercentage}
                    onChange={(e) => setFormProfitPercentage(e.target.value)}
                    required
                    min={0}
                    max={100}
                    placeholder="12.50"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">تاريخ توقيع وسريان العقد *</label>
                  <input 
                    type="date" 
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">تاريخ نهاية وانقضاء العقد *</label>
                  <input 
                    type="date" 
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">حالة التعاقد الرسمية</label>
                <select 
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="active" className="bg-slate-900">نشط / ساري المفعول حالياً</option>
                  <option value="completed" className="bg-slate-900">مكتمل ومنقضي بالتسوية</option>
                  <option value="terminated" className="bg-slate-900">ملغي ومفسوخ ودياً أو قانونياً</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء وتراجع
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)] cursor-pointer"
                >
                  {isSaving ? 'جاري تسجيل العقد رسمياً...' : 'إصدار وتوقيع العقد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
