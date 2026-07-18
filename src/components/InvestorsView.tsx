import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, UserPlus, FileText, Phone, Mail, Landmark, CreditCard, X, Calendar, Printer, RefreshCw } from 'lucide-react';
import { Investor, Contract, Voucher } from '../types';

export default function InvestorsView() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [investorContracts, setInvestorContracts] = useState<Contract[]>([]);
  const [investorVouchers, setInvestorVouchers] = useState<Voucher[]>([]);
  const [runningBalance, setRunningBalance] = useState(0);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formIban, setFormIban] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchInvestors();
  }, []);

  async function fetchInvestors() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('investors')
        .select('*')
        .order('name');
      if (error) throw error;
      setInvestors(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveInvestor(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    if (!formName || !formNationalId) {
      setFormError('الاسم ورقم الهوية الوطنية حقول إجبارية.');
      setIsSaving(false);
      return;
    }

    const payload = {
      name: formName,
      national_id: formNationalId,
      phone: formPhone || null,
      email: formEmail || null,
      address: formAddress || null,
      bank_name: formBankName || null,
      iban: formIban || null,
      status: formStatus,
    };

    try {
      if (isEditing && selectedInvestor) {
        const { error } = await supabase
          .from('investors')
          .update(payload)
          .eq('id', selectedInvestor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('investors')
          .insert([payload]);
        if (error) throw error;
      }

      setShowAddModal(false);
      resetForm();
      fetchInvestors();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'حدث خطأ أثناء حفظ بيانات المستثمر. يرجى التحقق من فرادة رقم الهوية.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleOpenEdit(inv: Investor) {
    setSelectedInvestor(inv);
    setFormName(inv.name);
    setFormNationalId(inv.national_id);
    setFormPhone(inv.phone || '');
    setFormEmail(inv.email || '');
    setFormAddress(inv.address || '');
    setFormBankName(inv.bank_name || '');
    setFormIban(inv.iban || '');
    setFormStatus(inv.status);
    setIsEditing(true);
    setShowAddModal(true);
  }

  async function handleOpenDetail(inv: Investor) {
    setSelectedInvestor(inv);
    setLoading(true);
    try {
      // 1. Fetch Investor's Contracts
      const { data: contracts, error: cErr } = await supabase
        .from('contracts')
        .select('*')
        .eq('investor_id', inv.id)
        .order('created_at', { ascending: false });
      if (cErr) throw cErr;
      setInvestorContracts(contracts || []);

      // 2. Fetch Investor's Vouchers (Receipts & Payments)
      const { data: vouchers, error: vErr } = await supabase
        .from('vouchers')
        .select('*')
        .eq('investor_id', inv.id)
        .order('date', { ascending: true });
      if (vErr) throw vErr;
      setInvestorVouchers(vouchers || []);

      // Calculate running total balance (Receipts increase, Payments decrease)
      let balance = 0;
      vouchers?.forEach(v => {
        if (v.type === 'receipt') {
          balance += Number(v.amount);
        } else {
          balance -= Number(v.amount);
        }
      });
      setRunningBalance(balance);

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedInvestor(null);
    setFormName('');
    setFormNationalId('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormBankName('');
    setFormIban('');
    setFormStatus('active');
    setIsEditing(false);
    setFormError('');
  }

  const filteredInvestors = investors.filter(inv => {
    const matchesSearch = inv.name.includes(search) || inv.national_id.includes(search) || (inv.phone && inv.phone.includes(search));
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(val);
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-slate-100" id="investors_view">
      {/* List Page Section */}
      {!selectedInvestor && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">إدارة شؤون المستثمرين</h1>
              <p className="text-slate-400 text-sm mt-1 font-medium">تسجيل ومتابعة ملفات الشركاء وتتبع تدفقاتهم الاستثمارية والمالية</p>
            </div>
            <button 
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] cursor-pointer self-start"
            >
              <UserPlus className="w-4 h-4 text-slate-950" />
              <span>تسجيل مستثمر جديد</span>
            </button>
          </div>

          {/* Search & Filtering bar */}
          <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute right-3.5 top-3 text-slate-500 w-4.5 h-4.5" />
              <input 
                type="text" 
                placeholder="ابحث بالاسم، رقم الهوية الوطنية، أو رقم الجوال..." 
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
                <option value="all">كل الحالات الاستثمارية</option>
                <option value="active">الحسابات النشطة فقط</option>
                <option value="inactive">غير نشط / مجمد</option>
              </select>
              <button 
                onClick={fetchInvestors}
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
                    <th className="py-3.5 px-6 font-bold uppercase tracking-wider">اسم المستثمر</th>
                    <th className="py-3.5 px-6 font-bold uppercase tracking-wider">رقم الهوية الوطنية</th>
                    <th className="py-3.5 px-6 font-bold uppercase tracking-wider">رقم الجوال للاتصال</th>
                    <th className="py-3.5 px-6 font-bold uppercase tracking-wider">الحساب البنكي للتسويات</th>
                    <th className="py-3.5 px-6 font-bold uppercase tracking-wider">حالة العضوية</th>
                    <th className="py-3.5 px-6 font-bold uppercase tracking-wider">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">جاري مزامنة بيانات المستثمرين من الخادم السحابي...</td>
                    </tr>
                  ) : filteredInvestors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">لا يوجد شركاء أو مستثمرون متوافقون مع خيارات البحث الحالية.</td>
                    </tr>
                  ) : (
                    filteredInvestors.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-6">
                          <button 
                            onClick={() => handleOpenDetail(inv)}
                            className="font-bold text-white hover:text-emerald-400 hover:underline text-right block text-sm"
                          >
                            {inv.name}
                          </button>
                          <div className="text-[10px] text-slate-500 mt-1 font-mono">{inv.email || 'لم يربط بريد إلكتروني'}</div>
                        </td>
                        <td className="py-4 px-6 font-mono text-slate-400 font-semibold">{inv.national_id}</td>
                        <td className="py-4 px-6 text-slate-400 font-mono">{inv.phone || '-'}</td>
                        <td className="py-4 px-6">
                          <div className="text-slate-200 font-bold">{inv.bank_name || '-'}</div>
                          <div className="text-[9px] text-slate-500 font-mono mt-1 tracking-tighter">{inv.iban || '-'}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                            inv.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {inv.status === 'active' ? 'نشط' : 'غير نشط'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleOpenDetail(inv)}
                              className="text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg transition-colors border border-emerald-500/20 cursor-pointer"
                            >
                              كشف الحساب المالي
                            </button>
                            <button 
                              onClick={() => handleOpenEdit(inv)}
                              className="text-[10px] font-bold border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              تعديل
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Detail Account Page for Investor with Statement */}
      {selectedInvestor && !showAddModal && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 no-print">
            <button 
              onClick={() => setSelectedInvestor(null)}
              className="text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              &rarr; العودة لدليل المستثمرين
            </button>
            <div className="flex gap-2">
              <button 
                onClick={triggerPrint}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              >
                <Printer className="w-4 h-4 text-slate-950" />
                <span>طباعة وتصدير كشف الحساب</span>
              </button>
            </div>
          </div>

          {/* Printable Statement Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm p-6 md:p-8 print-card">
            {/* Header Block only for Printing */}
            <div className="hidden print:flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900">نظام فزاع المالي والاستثماري</h1>
                <p className="text-slate-500 text-xs mt-1">كشف حساب مستثمر رسمي ومصدق</p>
              </div>
              <div className="text-left">
                <div className="text-xs text-slate-500">تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</div>
                <div className="text-xs text-slate-500">الموقع: الرياض، المملكة العربية السعودية</div>
              </div>
            </div>

            {/* Account Card Profile Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-800/80 pb-6 mb-6">
              <div className="space-y-2">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">اسم المستثمر</span>
                <span className="text-lg font-black text-white block">{selectedInvestor.name}</span>
                <div className="text-emerald-400 text-xs font-mono font-bold">الهوية الوطنية: {selectedInvestor.national_id}</div>
              </div>
              <div className="space-y-2">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">معلومات الاتصال المباشر</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedInvestor.phone || 'غير مسجل'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedInvestor.email || 'غير مسجل'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">حساب التسوية والتحويل بنكي</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                  <Landmark className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedInvestor.bank_name || 'غير مسجل'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono tracking-tighter">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedInvestor.iban || 'غير مسجل'}</span>
                </div>
              </div>
            </div>

            {/* Financial Overview Grid inside Detail */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-xs font-bold">الرصيد المتبقي الإجمالي دائن</span>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-1.5">{formatCurrency(runningBalance)}</div>
                <p className="text-[9px] text-slate-500 mt-1 font-bold">المبلغ المستحق تصفية أو تحويله</p>
              </div>
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-xs font-bold">عدد الاستثمارات والعقود الجارية</span>
                <div className="text-2xl font-black text-white font-mono mt-1.5">{investorContracts.length} عقد رسمي</div>
                <p className="text-[9px] text-slate-500 mt-1 font-bold">الربط الاستثماري النشط المسجل</p>
              </div>
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-xs font-bold">إجمالي المبالغ والمسحوبات المدفوعة</span>
                <div className="text-2xl font-black text-amber-400 font-mono mt-1.5">
                  {formatCurrency(investorVouchers.filter(v => v.type === 'payment').reduce((s, i) => s + Number(i.amount), 0))}
                </div>
                <p className="text-[9px] text-slate-500 mt-1 font-bold">سندات الصرف والتحويلات المؤكدة للمستثمر</p>
              </div>
            </div>

            {/* Active Contracts Sub-table */}
            <div className="mb-8">
              <h3 className="text-xs font-bold text-white mb-3 border-r-2 border-emerald-500 pr-2 uppercase tracking-wider">العقود وقيم الربط الاستثماري</h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden text-xs bg-slate-950/20">
                <table className="w-full text-right">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">رقم العقد بالمنظومة</th>
                      <th className="py-3 px-4 font-bold">قيمة رأس المال المستثمر</th>
                      <th className="py-3 px-4 font-bold">نسبة الأرباح السنوية</th>
                      <th className="py-3 px-4 font-bold">بداية سريان العقد</th>
                      <th className="py-3 px-4 font-bold">تاريخ الاستحقاق</th>
                      <th className="py-3 px-4 font-bold">حالة الربط المالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {investorContracts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">لا توجد عقود ربط استثماري جارية للمستثمر الحالي.</td>
                      </tr>
                    ) : (
                      investorContracts.map(c => (
                        <tr key={c.id} className="hover:bg-slate-800/20">
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">{c.contract_number}</td>
                          <td className="py-3 px-4 font-bold text-white font-mono">{formatCurrency(c.amount)}</td>
                          <td className="py-3 px-4 text-slate-300 font-semibold">{c.profit_percentage}%</td>
                          <td className="py-3 px-4 text-slate-400">{c.start_date}</td>
                          <td className="py-3 px-4 text-slate-400">{c.end_date}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                              c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {c.status === 'active' ? 'جارٍ العمل به' : 'مكتمل ومرحل'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cash Movements Ledger */}
            <div>
              <h3 className="text-xs font-bold text-white mb-3 border-r-2 border-emerald-500 pr-2 uppercase tracking-wider">الحركات المالية التفصيلية وحساب التبادل (كشف الحساب المالي)</h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden text-xs bg-slate-950/20">
                <table className="w-full text-right">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">التاريخ والتوقيت</th>
                      <th className="py-3 px-4 font-bold">نوع السند المالي</th>
                      <th className="py-3 px-4 font-bold">رقم السند الموحد</th>
                      <th className="py-3 px-4 font-bold">البيان والشرح التفصيلي</th>
                      <th className="py-3 px-4 font-bold">دائن (تحصيل / إيداع)</th>
                      <th className="py-3 px-4 font-bold">مدين (صرف / دفع)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {investorVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">لا توجد حركات مالية مسجلة بعد على كشف الحساب الحالي.</td>
                      </tr>
                    ) : (
                      investorVouchers.map(v => (
                        <tr key={v.id} className="hover:bg-slate-800/20">
                          <td className="py-3 px-4 text-slate-400">{v.date}</td>
                          <td className="py-3 px-4 font-bold">
                            {v.type === 'receipt' ? (
                              <span className="text-emerald-400">سند قبض نقدي</span>
                            ) : (
                              <span className="text-amber-400">سند صرف أرباح / تسوية</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400 font-bold">{v.voucher_number}</td>
                          <td className="py-3 px-4 text-slate-200">{v.description}</td>
                          <td className="py-3 px-4 font-bold text-emerald-400 font-mono">{v.type === 'receipt' ? formatCurrency(v.amount) : '-'}</td>
                          <td className="py-3 px-4 font-bold text-amber-400 font-mono">{v.type === 'payment' ? formatCurrency(v.amount) : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print Sign-off block */}
            <div className="hidden print:grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-slate-200">
              <div className="text-center">
                <p className="text-xs text-slate-400">معد التقرير والمحاسب المسؤول</p>
                <div className="h-16"></div>
                <p className="text-sm font-bold text-slate-700">التوقيع والختم: .......................</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">رئيس مجلس الإدارة أو العضو المنتدب</p>
                <div className="h-16"></div>
                <p className="text-sm font-bold text-slate-700">الاعتماد النهائي: .......................</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in text-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-800/80 bg-slate-950/40">
              <h3 className="font-black text-white text-base">
                {isEditing ? 'تعديل بيانات وملف المستثمر' : 'تسجيل مستثمر استثماري جديد'}
              </h3>
              <button 
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveInvestor} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-950/40 text-rose-300 text-xs font-semibold rounded-xl border border-rose-900/40">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">الاسم الكامل للمستثمر *</label>
                  <input 
                    type="text" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="مثال: صالح بن محمد الراجحي"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">رقم الهوية الوطنية / الإقامة *</label>
                  <input 
                    type="text" 
                    value={formNationalId}
                    onChange={(e) => setFormNationalId(e.target.value)}
                    required
                    maxLength={10}
                    placeholder="مثال: 1012345678"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">رقم الجوال النشط</label>
                  <input 
                    type="text" 
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="مثال: 0551234567"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">البريد الإلكتروني للعمل</label>
                  <input 
                    type="email" 
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="investor@example.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">العنوان الوطني السعودي بالكامل</label>
                <input 
                  type="text" 
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="المملكة العربية السعودية، الرياض، حي النرجس"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">اسم البنك المعتمد</label>
                  <input 
                    type="text" 
                    value={formBankName}
                    onChange={(e) => setFormBankName(e.target.value)}
                    placeholder="مثال: مصرف الراجحي"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">رقم الآيبان الدولي (IBAN)</label>
                  <input 
                    type="text" 
                    value={formIban}
                    onChange={(e) => setFormIban(e.target.value)}
                    placeholder="SA0380000000000000000000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">حالة الحساب الاستثماري بالمنظومة</label>
                <select 
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="active">حساب نشط - جاري معالجة القيود وتوزيع الأرباح</option>
                  <option value="inactive">حساب معطل / مجمد مؤقتاً</option>
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
                  {isSaving ? 'جاري الاتصال والحفظ...' : 'حفظ الملف المالي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
