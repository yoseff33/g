import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, FilePlus, FileMinus, RefreshCw, X, AlertCircle, Printer, CheckCircle } from 'lucide-react';
import { Voucher, Account, Investor, Contract } from '../types';

export default function ReceiptsPaymentsView() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [voucherType, setVoucherType] = useState<'receipt' | 'payment'>('receipt');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form states
  const [formVoucherNumber, setFormVoucherNumber] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAmount, setFormAmount] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'cash' | 'bank_transfer' | 'check'>('bank_transfer');
  const [formAccountId, setFormAccountId] = useState(''); // Cash or Bank Account
  const [formTargetAccountId, setFormTargetAccountId] = useState(''); // Contra Account
  const [formInvestorId, setFormInvestorId] = useState('');
  const [formContractId, setFormContractId] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Selected Voucher to Print
  const [printVoucher, setPrintVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    fetchVoucherDependencies();
  }, []);

  async function fetchVoucherDependencies() {
    setLoading(true);
    try {
      // 1. Fetch Vouchers
      const { data: vData, error: vErr } = await supabase
        .from('vouchers')
        .select('*, account:accounts!vouchers_account_id_fkey(name_ar), target_account:accounts!vouchers_target_account_id_fkey(name_ar), investor:investors(name)')
        .order('date', { ascending: false });
      if (vErr) throw vErr;
      setVouchers(vData || []);

      // 2. Fetch Cash and Bank Accounts (Assets in النقد وما في حكمه)
      const { data: accData, error: accErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_ledger', true)
        .eq('is_active', true);
      if (accErr) throw accErr;
      
      setAllAccounts(accData || []);
      // Filter for cash & bank ledger nodes (e.g. Al-Rajhi and Main Safe)
      const cbAccs = accData?.filter(a => a.id.startsWith('111')) || [];
      setCashBankAccounts(cbAccs);

      // 3. Fetch Investors
      const { data: invData, error: invErr } = await supabase
        .from('investors')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (invErr) throw invErr;
      setInvestors(invData || []);

      // 4. Fetch Contracts
      const { data: conData, error: conErr } = await supabase
        .from('contracts')
        .select('*')
        .eq('status', 'active');
      if (conErr) throw conErr;
      setContracts(conData || []);

      // Suggest voucher number
      const nextNum = `VOU-${new Date().getFullYear()}-${String((vData?.length || 0) + 1).padStart(5, '0')}`;
      setFormVoucherNumber(nextNum);

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Auto-fill contract selections depending on selected investor
  const filteredContracts = contracts.filter(c => c.investor_id === formInvestorId);

  async function handleCreateVoucher(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    if (!formAmount || !formAccountId || !formTargetAccountId || !formDescription) {
      setFormError('يرجى تعبئة كافة الحقول الرئيسية لإصدار السند.');
      setIsSaving(false);
      return;
    }

    try {
      // 1. Double-Entry bookkeeping creation
      // Create journal entry header
      const entryDesc = `${voucherType === 'receipt' ? 'سند قبض' : 'سند صرف'} - رقم ${formVoucherNumber}: ${formDescription}`;
      
      const { data: entryHeader, error: entryErr } = await supabase
        .from('journal_entries')
        .insert([{
          date: formDate,
          description: entryDesc,
          reference: formVoucherNumber,
          status: 'posted' // Directly post to General Ledger
        }])
        .select();

      if (entryErr) throw entryErr;
      const entryId = entryHeader[0].id;

      // Create double journal items depending on Receipt or Payment:
      // Receipt (قبض): DEBIT Cash/Bank, CREDIT Target/Revenue/Customer Account
      // Payment (صرف): DEBIT Target/Expense, CREDIT Cash/Bank
      const debitAccount = voucherType === 'receipt' ? formAccountId : formTargetAccountId;
      const creditAccount = voucherType === 'receipt' ? formTargetAccountId : formAccountId;

      const itemsPayload = [
        {
          entry_id: entryId,
          account_id: debitAccount,
          debit: Number(formAmount),
          credit: 0,
          description: entryDesc
        },
        {
          entry_id: entryId,
          account_id: creditAccount,
          debit: 0,
          credit: Number(formAmount),
          description: entryDesc
        }
      ];

      const { error: itemsErr } = await supabase
        .from('journal_items')
        .insert(itemsPayload);

      if (itemsErr) {
        // Rollback header
        await supabase.from('journal_entries').delete().eq('id', entryId);
        throw itemsErr;
      }

      // 2. Insert Voucher
      const voucherPayload = {
        voucher_number: formVoucherNumber,
        type: voucherType,
        date: formDate,
        amount: Number(formAmount),
        payment_method: formPaymentMethod,
        account_id: formAccountId,
        target_account_id: formTargetAccountId,
        investor_id: formInvestorId || null,
        contract_id: formContractId || null,
        description: formDescription,
        entry_id: entryId
      };

      const { error: vouErr } = await supabase
        .from('vouchers')
        .insert([voucherPayload]);

      if (vouErr) throw vouErr;

      setShowAddModal(false);
      resetForm();
      fetchVoucherDependencies();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'فشل ترحيل السند وإصدار القيود المحاسبية الآلية.');
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAmount('');
    setFormPaymentMethod('bank_transfer');
    setFormAccountId('');
    setFormTargetAccountId('');
    setFormInvestorId('');
    setFormContractId('');
    setFormDescription('');
    setFormError('');
    const nextNum = `VOU-${new Date().getFullYear()}-${String((vouchers?.length || 0) + 1).padStart(5, '0')}`;
    setFormVoucherNumber(nextNum);
  }

  function openAddVoucher(type: 'receipt' | 'payment') {
    setVoucherType(type);
    resetForm();
    // Pre-fill target accounts depending on standard operations
    if (type === 'receipt') {
      // Suggest "Investors Capital Ledger" (311101) or "Project Revenues" (411101)
      setFormTargetAccountId('311101');
    } else {
      // Suggest "Retained Earnings" (321101) or "Accrued Dividends" (211101) or "Office Rent" (511101)
      setFormTargetAccountId('211101');
    }
    // Pre-fill default bank account (Al-Rajhi Bank - 111201)
    setFormAccountId('111201');
    setShowAddModal(true);
  }

  const filteredVouchers = vouchers.filter(v => {
    const investorName = v.investor?.name || '';
    const matchesSearch = v.description.includes(search) || v.voucher_number.includes(search) || investorName.includes(search);
    const matchesType = typeFilter === 'all' || v.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(val);
  };

  const printSelectedReceipt = (v: Voucher) => {
    setPrintVoucher(v);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="space-y-6 text-slate-100" id="vouchers_view">
      {/* Printable Receipt Overlay (displays only on Print) */}
      {printVoucher && (
        <div className="hidden print:block fixed inset-0 bg-white p-12 text-slate-950 text-sm">
          <div className="border-2 border-slate-950 p-8 space-y-6">
            {/* Logo */}
            <div className="flex justify-between items-start border-b border-slate-950 pb-4">
              <div>
                <h1 className="text-2xl font-black">شركة فزاع للاستثمار العقاري والتجاري</h1>
                <p className="text-xs text-slate-500">نظام فزاع المالي المتكامل لتدقيق الحسابات والربط الاستثماري</p>
              </div>
              <div className="text-left">
                <div className="font-bold text-lg text-slate-950">
                  {printVoucher.type === 'receipt' ? 'سند قبض رسمي' : 'سند صرف رسمي'}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-mono">{printVoucher.voucher_number}</div>
              </div>
            </div>

            {/* Receipt Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>تاريخ التحرير: <span className="font-bold font-mono">{printVoucher.date}</span></div>
              <div className="text-left">طريقة السداد: <span className="font-bold">
                {printVoucher.payment_method === 'cash' ? 'نقداً بالخزينة' :
                 printVoucher.payment_method === 'bank_transfer' ? 'تحويل بنكي مباشر' : 'شيك بنكي مصدق'}
              </span></div>
            </div>

            {/* Main content box */}
            <div className="bg-slate-50 p-6 border border-slate-300 space-y-4 rounded-lg">
              <div className="flex justify-between items-center text-lg font-bold border-b border-slate-300 pb-2">
                <span>المبلـغ المالي:</span>
                <span className="font-mono text-slate-950 bg-slate-200 px-3 py-1 rounded">{formatCurrency(printVoucher.amount)}</span>
              </div>
              
              <div className="space-y-2">
                <div>استُلم من السيد/ة: <strong className="font-bold underline text-sm">{printVoucher.investor?.name || '---'}</strong></div>
                <div>وذلك لغرض: <span className="text-slate-700 underline text-sm">{printVoucher.description}</span></div>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-12 pt-12">
              <div className="text-center">
                <p className="text-xs text-slate-400">توقيع المستلم (المحاسب المسؤول)</p>
                <div className="h-12"></div>
                <p className="text-sm font-bold">.........................................</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">توقيع العميل / المستثمر</p>
                <div className="h-12"></div>
                <p className="text-sm font-bold">.........................................</p>
              </div>
            </div>
            
            {/* Close Button on Web view to clear print selection */}
            <button 
              onClick={() => setPrintVoucher(null)}
              className="no-print mt-8 bg-slate-950 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              إغلاق معاينة الطباعة
            </button>
          </div>
        </div>
      )}

      {/* Main Screen Layout */}
      <div className="no-print space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">السندات والخزينة</h1>
            <p className="text-slate-400 text-sm mt-1 font-medium">إصدار وتدوين سندات القبض والصرف، وتوليد القيود المحاسبية الآلية الفورية بالخزائن والبنوك</p>
          </div>
          <div className="flex gap-2.5 self-start">
            <button 
              onClick={() => openAddVoucher('receipt')}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] cursor-pointer"
            >
              <FilePlus className="w-4 h-4 text-slate-950" />
              <span>إصدار سند قبض (+ قبض)</span>
            </button>
            <button 
              onClick={() => openAddVoucher('payment')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.15)] cursor-pointer"
            >
              <FileMinus className="w-4 h-4 text-slate-950" />
              <span>إصدار سند صرف (- صرف)</span>
            </button>
          </div>
        </div>

        {/* Filtering */}
        <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute right-3.5 top-3 text-slate-500 w-4.5 h-4.5" />
            <input 
              type="text" 
              placeholder="ابحث برقم السند، الوصف، أو اسم العميل المستثمر..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-11 pl-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="flex gap-2.5">
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-slate-300 font-bold"
            >
              <option value="all">كل السندات</option>
              <option value="receipt">سندات القبض</option>
              <option value="payment">سندات الصرف</option>
            </select>
            <button 
              onClick={fetchVoucherDependencies}
              className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Vouchers Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/40 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-6 font-bold uppercase tracking-wider">رقم السند الموحد</th>
                  <th className="py-3.5 px-6 font-bold uppercase tracking-wider">التاريخ</th>
                  <th className="py-3.5 px-6 font-bold uppercase tracking-wider">نوع السند</th>
                  <th className="py-3.5 px-6 font-bold uppercase tracking-wider">العميل / المستثمر</th>
                  <th className="py-3.5 px-6 font-bold uppercase tracking-wider">المبلغ المالي</th>
                  <th className="py-3.5 px-6 font-bold uppercase tracking-wider">الحساب النقدي / البنك</th>
                  <th className="py-3.5 px-6 font-bold uppercase tracking-wider">البيان / الوصف</th>
                  <th className="py-3.5 px-6 font-bold uppercase tracking-wider">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">جاري سحب وتحديث السندات المالية من الخزينة...</td>
                  </tr>
                ) : filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">لا توجد سندات مقيدة في دفاتر الخزينة حالياً.</td>
                  </tr>
                ) : (
                  filteredVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-emerald-400 text-xs">{v.voucher_number}</td>
                      <td className="py-4 px-6 font-mono text-slate-400">{v.date}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black border ${
                          v.type === 'receipt' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {v.type === 'receipt' ? 'قبض (+)' : 'صرف (-)'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-white text-xs">{v.investor?.name || '---'}</td>
                      <td className="py-4 px-6 font-black text-white text-sm font-mono">{formatCurrency(v.amount)}</td>
                      <td className="py-4 px-6 text-slate-300">
                        <div className="font-semibold">{v.account?.name_ar}</div>
                        <div className="text-[10px] text-slate-500 mt-1 font-medium">المقابل: {v.target_account?.name_ar}</div>
                      </td>
                      <td className="py-4 px-6 text-slate-400 max-w-xs truncate font-medium">{v.description}</td>
                      <td className="py-4 px-6">
                        <button 
                          onClick={() => printSelectedReceipt(v)}
                          className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 rounded-lg flex items-center gap-1.5 text-[10px] font-black cursor-pointer transition-all"
                          title="طباعة إيصال السند"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>إيصال الطباعة</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Voucher Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in text-slate-100">
            <div className={`flex items-center justify-between p-6 border-b border-slate-800/80 ${
              voucherType === 'receipt' ? 'bg-emerald-950/20' : 'bg-amber-950/20'
            }`}>
              <h3 className="font-black text-white text-base">
                {voucherType === 'receipt' ? 'إصدار وتدوين سند قبض جديد' : 'إصدار وتدوين سند صرف جديد'}
              </h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-950/40 text-rose-300 text-xs font-semibold rounded-xl border border-rose-900/40 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Automatic accounting notification */}
              <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-emerald-400 flex items-start gap-2 leading-relaxed">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                <span className="font-medium">تنبيه آلي: سيقوم نظام فزاع بإنشاء وترحيل قيد يومية متوازن تلقائياً للأستاذ العام بمجرد حفظ هذا السند لضمان استقرار ميزان المراجعة.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">رقم السند المرجعي *</label>
                  <input 
                    type="text" 
                    value={formVoucherNumber}
                    onChange={(e) => setFormVoucherNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">تاريخ السند *</label>
                  <input 
                    type="date" 
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">مبلـغ السنـد (SAR) *</label>
                  <input 
                    type="number" 
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    min={1}
                    placeholder="25,000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">طريقة الدفع / وسيلة السداد *</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="bank_transfer" className="bg-slate-900">تحويل بنكي مباشر</option>
                    <option value="cash" className="bg-slate-900">نقداً بالخزينة</option>
                    <option value="check" className="bg-slate-900">شيك بنكي مصدق</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">الخزينة أو حساب البنك المستهدف *</label>
                  <select
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="" className="bg-slate-900">-- اختر البنك / الخزينة --</option>
                    {cashBankAccounts.map(cb => (
                      <option key={cb.id} value={cb.id} className="bg-slate-900">{cb.name_ar} ({cb.id})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">الحساب المقابل (Contra Account) *</label>
                  <select
                    value={formTargetAccountId}
                    onChange={(e) => setFormTargetAccountId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="" className="bg-slate-900">-- اختر الحساب المقابل --</option>
                    {allAccounts.map(acc => (
                      <option key={acc.id} value={acc.id} className="bg-slate-900">[{acc.id}] - {acc.name_ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">العميل / المستثمر الشريك (اختياري)</label>
                  <select
                    value={formInvestorId}
                    onChange={(e) => setFormInvestorId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="" className="bg-slate-900">-- اختر مستثمراً --</option>
                    {investors.map(inv => (
                      <option key={inv.id} value={inv.id} className="bg-slate-900">{inv.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">العقد المرتبط بالاستثمار (اختياري)</label>
                  <select
                    value={formContractId}
                    onChange={(e) => setFormContractId(e.target.value)}
                    disabled={!formInvestorId}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold disabled:opacity-50"
                  >
                    <option value="" className="bg-slate-900">-- اختر عقداً --</option>
                    {filteredContracts.map(con => (
                      <option key={con.id} value={con.id} className="bg-slate-900">{con.contract_number} ({formatCurrency(con.amount)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">البيان التفصيلي والملاحظات السدادية *</label>
                <textarea 
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  required
                  placeholder="مثال: تحصيل الدفعة الأولى من قيمة رأس مال العقد رقم CTR-001"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
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
                  className={`font-black px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-slate-950 ${
                    voucherType === 'receipt' 
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                      : 'bg-amber-500 hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  }`}
                >
                  {isSaving ? 'جاري ترحيل السند...' : 'إصدار السند والترحيل بالدفاتر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
