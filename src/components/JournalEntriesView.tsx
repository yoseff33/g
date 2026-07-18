import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, Trash2, ShieldCheck, RefreshCw, X, AlertCircle, Bookmark, CheckCircle2, AlertTriangle } from 'lucide-react';
import { JournalEntry, Account, JournalItem } from '../types';

interface NewEntryRow {
  account_id: string;
  debit: string;
  credit: string;
  description: string;
}

export default function JournalEntriesView() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Form states
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState('');
  const [formReference, setFormReference] = useState('');
  const [formRows, setFormRows] = useState<NewEntryRow[]>([
    { account_id: '', debit: '', credit: '', description: '' },
    { account_id: '', debit: '', credit: '', description: '' }
  ]);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchEntriesAndAccounts();
  }, []);

  async function fetchEntriesAndAccounts() {
    setLoading(true);
    try {
      // 1. Fetch Accounts for transaction dropdown (only ledger leaf nodes)
      const { data: accs, error: accErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_ledger', true)
        .eq('is_active', true)
        .order('id');
      if (accErr) throw accErr;
      setAccounts(accs || []);

      // 2. Fetch Journal Entries with items
      const { data: ents, error: entErr } = await supabase
        .from('journal_entries')
        .select('*, items:journal_items(*, account:accounts(name_ar))')
        .order('entry_number', { ascending: false });
      if (entErr) throw entErr;
      setEntries(ents || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleAddRow() {
    setFormRows([
      ...formRows,
      { account_id: '', debit: '', credit: '', description: '' }
    ]);
  }

  function handleRemoveRow(index: number) {
    if (formRows.length <= 2) return;
    const updated = [...formRows];
    updated.splice(index, 1);
    setFormRows(updated);
  }

  function handleRowChange(index: number, field: keyof NewEntryRow, value: string) {
    const updated = [...formRows];
    
    if (field === 'debit') {
      updated[index].debit = value;
      // If debit is typed, clear credit
      if (value) updated[index].credit = '';
    } else if (field === 'credit') {
      updated[index].credit = value;
      // If credit is typed, clear debit
      if (value) updated[index].debit = '';
    } else {
      updated[index][field] = value;
    }

    setFormRows(updated);
  }

  // Calculate totals
  const totalDebit = formRows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
  const totalCredit = formRows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  async function handleSaveEntry(isPost: boolean) {
    setFormError('');
    setIsSaving(true);

    if (!formDescription) {
      setFormError('الرجاء إضافة بيان رئيسي لوصف القيد المحاسبي.');
      setIsSaving(false);
      return;
    }

    // Row checks
    for (let i = 0; i < formRows.length; i++) {
      const row = formRows[i];
      if (!row.account_id) {
        setFormError(`البند رقم ${i + 1}: يجب تحديد حساب ترحيلي.`);
        setIsSaving(false);
        return;
      }
      const deb = Number(row.debit) || 0;
      const cred = Number(row.credit) || 0;
      if (deb === 0 && cred === 0) {
        setFormError(`البند رقم ${i + 1}: يجب تعبئة قيمة مدين أو دائن.`);
        setIsSaving(false);
        return;
      }
    }

    if (isPost && !isBalanced) {
      setFormError('لا يمكن ترحيل القيد: يجب أن يتساوى مجموع المدين مع مجموع الدائن تماماً.');
      setIsSaving(false);
      return;
    }

    try {
      // Create transaction block
      // 1. Insert Header
      const { data: header, error: headErr } = await supabase
        .from('journal_entries')
        .insert([{
          date: formDate,
          description: formDescription,
          reference: formReference || null,
          status: isPost ? 'posted' : 'draft'
        }])
        .select();

      if (headErr) throw headErr;
      const entryId = header[0].id;

      // 2. Insert items
      const itemsPayload = formRows.map(row => ({
        entry_id: entryId,
        account_id: row.account_id,
        debit: Number(row.debit) || 0,
        credit: Number(row.credit) || 0,
        description: row.description || formDescription
      }));

      const { error: itemsErr } = await supabase
        .from('journal_items')
        .insert(itemsPayload);

      if (itemsErr) {
        // Rollback header to keep atomicity
        await supabase.from('journal_entries').delete().eq('id', entryId);
        throw itemsErr;
      }

      // If it's a post, trigger check balance trigger by updating status to posted 
      // (Supabase insert with posted already ran it, but we double-check)
      if (isPost) {
        const { error: verifyErr } = await supabase
          .from('journal_entries')
          .update({ status: 'posted' })
          .eq('id', entryId);
        if (verifyErr) throw verifyErr;
      }

      setShowAddModal(false);
      resetForm();
      fetchEntriesAndAccounts();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'حدث خطأ في النظام المحاسبي أو قاعدة البيانات أثناء حفظ القيد.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleVoidEntry() {
    if (!voidReason) return;
    try {
      const { error } = await supabase
        .from('journal_entries')
        .update({
          status: 'voided',
          void_reason: voidReason
        })
        .eq('id', selectedEntry?.id);

      if (error) throw error;
      setShowVoidModal(false);
      setVoidReason('');
      fetchEntriesAndAccounts();
    } catch (err: any) {
      console.error(err);
      alert('لا يمكن إبطال القيد: ' + err.message);
    }
  }

  function resetForm() {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDescription('');
    setFormReference('');
    setFormRows([
      { account_id: '', debit: '', credit: '', description: '' },
      { account_id: '', debit: '', credit: '', description: '' }
    ]);
    setFormError('');
  }

  const filteredEntries = entries.filter(e => {
    const matchesSearch = e.description.includes(search) || (e.reference && e.reference.includes(search)) || String(e.entry_number).includes(search);
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(val);
  };

  return (
    <div className="space-y-6 text-slate-100" id="journal_entries_view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">قيود اليومية العامة</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">تسجيل ومعالجة قيود اليومية العامة بنظام القيد المزدوج الإلزام وتحديث ميزان المراجعة</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] cursor-pointer self-start"
        >
          <Plus className="w-4 h-4 text-slate-950" />
          <span>إنشاء قيد يومية متوازن</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-3.5 top-3 text-slate-500 w-4.5 h-4.5" />
          <input 
            type="text" 
            placeholder="ابحث برقم القيد، البيان، أو المرجع الأصلي للعملية..." 
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
            <option value="all">كل قيود اليومية</option>
            <option value="posted">قيود مرحلة للأستاذ</option>
            <option value="draft">مسودات معلقة</option>
            <option value="voided">ملغاة وعكسية</option>
          </select>
          <button 
            onClick={fetchEntriesAndAccounts}
            className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/40 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">رقم القيد الدفتري</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">تاريخ التسجيل</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">البيان والشرح الأساسي</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">تفاصيل الحركات (مدين / دائن)</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">المرجع</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">حالة الترحيل</th>
                <th className="py-3.5 px-6 font-bold uppercase tracking-wider">الإجراءات المحاسبية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">جاري سحب وتحديث القيود المزدوجة من خادم الحسابات...</td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">لا توجد قيود يومية عامة مسجلة تتوافق مع معايير البحث الحالية.</td>
                </tr>
              ) : (
                filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/30 transition-colors align-top">
                    <td className="py-4 px-6 font-mono font-bold text-emerald-400 text-xs">JE-{String(e.entry_number).padStart(5, '0')}</td>
                    <td className="py-4 px-6 text-slate-400 font-mono whitespace-nowrap">{e.date}</td>
                    <td className="py-4 px-6 font-bold text-white text-xs">
                      <div>{e.description}</div>
                      {e.status === 'voided' && e.void_reason && (
                        <div className="text-rose-400 text-[10px] mt-2 bg-rose-950/30 p-2 rounded-lg border border-rose-900/30 leading-relaxed">
                          سبب الإلغاء والتسوية العكسية: {e.void_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 space-y-2">
                      {e.items?.map((item: any) => (
                        <div key={item.id} className="flex gap-2 text-[11px] text-slate-300 border-b border-slate-800/40 pb-1.5 last:border-b-0">
                          <span className="font-bold text-slate-200 w-36 truncate">{item.account?.name_ar}</span>
                          {Number(item.debit) > 0 && <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">مدين: {formatCurrency(item.debit)}</span>}
                          {Number(item.credit) > 0 && <span className="text-sky-400 font-bold bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded font-mono">دائن: {formatCurrency(item.credit)}</span>}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-mono">{e.reference || '-'}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                        e.status === 'posted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        e.status === 'voided' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {e.status === 'posted' ? 'مرحّل بالدفاتر' : e.status === 'voided' ? 'ملغى ومبطل' : 'مسودة معلقة'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {e.status === 'posted' && (
                        <button 
                          onClick={() => { setSelectedEntry(e); setShowVoidModal(true); }}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 rounded-lg border border-rose-500/20 transition-all cursor-pointer"
                        >
                          عكس وإبطال
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl animate-fade-in text-slate-100 my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-800/80 bg-slate-950/40">
              <h3 className="font-black text-white text-base">صياغة قيد محاسبي مزدوج جديد</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {formError && (
                <div className="p-3.5 bg-rose-950/40 text-rose-300 text-xs font-semibold rounded-xl border border-rose-900/40 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Journal Header details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">تاريخ القيد المالي *</label>
                  <input 
                    type="date" 
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">رقم المرجع / السند الأصلي</label>
                  <input 
                    type="text" 
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    placeholder="رقم الفاتورة أو مرجع التحويل"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">البيان التوجيهي للعملية *</label>
                  <input 
                    type="text" 
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    required
                    placeholder="مثال: إيداع رأس مال الشريك نقداً"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Journal Grid network */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider border-r-2 border-emerald-500 pr-2">شجرة توزيع وبنود القيد المزدوج</h4>
                  <button 
                    type="button" 
                    onClick={handleAddRow}
                    className="text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بند مالي</span>
                  </button>
                </div>

                <div className="border border-slate-800 rounded-2xl overflow-hidden text-xs bg-slate-950/20">
                  <table className="w-full text-right">
                    <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 font-bold">الحساب المالي الفرعي</th>
                        <th className="py-3 px-4 font-bold">مدين (Debit)</th>
                        <th className="py-3 px-4 font-bold">دائن (Credit)</th>
                        <th className="py-3 px-4 font-bold">شرح السطر التوجيهي</th>
                        <th className="py-3 px-4 font-bold w-12">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {formRows.map((row, index) => (
                        <tr key={index}>
                          <td className="p-2">
                            <select 
                              value={row.account_id}
                              onChange={(e) => handleRowChange(index, 'account_id', e.target.value)}
                              className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                            >
                              <option value="" className="bg-slate-900">-- اختر حساب اليومية --</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id} className="bg-slate-900">[{acc.id}] - {acc.name_ar}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 w-32">
                            <input 
                              type="number" 
                              value={row.debit}
                              onChange={(e) => handleRowChange(index, 'debit', e.target.value)}
                              placeholder="0.00"
                              disabled={!!row.credit}
                              className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-left text-white focus:outline-none focus:border-emerald-500 disabled:opacity-30 disabled:bg-slate-900"
                            />
                          </td>
                          <td className="p-2 w-32">
                            <input 
                              type="number" 
                              value={row.credit}
                              onChange={(e) => handleRowChange(index, 'credit', e.target.value)}
                              placeholder="0.00"
                              disabled={!!row.debit}
                              className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-left text-white focus:outline-none focus:border-emerald-500 disabled:opacity-30 disabled:bg-slate-900"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" 
                              value={row.description}
                              onChange={(e) => handleRowChange(index, 'description', e.target.value)}
                              placeholder={formDescription || 'بيان توجيهي فرعي للسطر المحاسبي'}
                              className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button 
                              type="button" 
                              disabled={formRows.length <= 2}
                              onClick={() => handleRemoveRow(index)}
                              className="text-rose-400 hover:text-rose-300 disabled:opacity-20 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Balance Summary block */}
                <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl gap-4">
                  <div className="flex gap-6 text-xs font-bold">
                    <div>إجمالي المدين: <span className="text-emerald-400 font-mono text-sm font-black mr-1">{formatCurrency(totalDebit)}</span></div>
                    <div>إجمالي الدائن: <span className="text-sky-400 font-mono text-sm font-black mr-1">{formatCurrency(totalCredit)}</span></div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isBalanced ? (
                      <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4" />
                        القيد متوازن وجاهز للترحيل بالدفاتر
                      </span>
                    ) : (
                      <span className="bg-amber-500/10 text-amber-400 text-[10px] font-black px-3 py-1.5 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        القيد غير متوازن (الفارق: {formatCurrency(Math.abs(totalDebit - totalCredit))})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء وتراجع
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSaveEntry(false)}
                  disabled={isSaving}
                  className="border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Bookmark className="w-4 h-4 text-slate-400" />
                  <span>حفظ كمسودة مؤقتة</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSaveEntry(true)}
                  disabled={isSaving || !isBalanced}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-950" />
                  <span>ترحيل نهائي للأستاذ العام</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl text-slate-100">
            <div className="p-6 border-b border-slate-800/80 bg-rose-950/40 text-rose-300 font-black text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>عكس وإبطال قيد ترحيل معتمد</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                تنبيه: وفقاً لمعايير المحاسبة والتدقيق الرسمية، لا يمكن تدمير أو حذف القيود بعد ترحيلها. عند التأكيد، سيقوم النظام بتحويل حالة القيد إلى <strong>"ملغى"</strong>، ويولد تسوية عكسية للأرصدة في الأستاذ مع بقاء السجل مسجلاً للرقابة المالية والامتثال.
              </p>
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">سبب عكس القيد بالتفصيل *</label>
                <textarea 
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="مثال: قيد تسوية خاطئ لمبلغ أرباح العقد CTR-2026-003"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => { setShowVoidModal(false); setVoidReason(''); }}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  تراجع وإلغاء
                </button>
                <button 
                  onClick={handleVoidEntry}
                  disabled={!voidReason}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  تأكيد الإبطال والعكس
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
