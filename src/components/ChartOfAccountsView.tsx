import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronDown, ChevronRight, FolderPlus, ToggleLeft, ToggleRight, Plus, X, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { Account } from '../types';

export default function ChartOfAccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    '100000': true, '200000': true, '300000': true, '400000': true, '500000': true
  });
  const [search, setSearch] = useState('');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [formParentId, setFormParentId] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formType, setFormType] = useState<'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>('asset');
  const [formIsLedger, setFormIsLedger] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('id');
      if (error) throw error;
      setAccounts(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleNode(id: string) {
    setExpandedNodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    if (!formAccountId || !formNameAr || !formNameEn) {
      setFormError('يرجى تعبئة جميع الحقول الإجبارية.');
      setIsSaving(false);
      return;
    }

    const payload = {
      id: formAccountId,
      name_ar: formNameAr,
      name_en: formNameEn,
      parent_id: formParentId || null,
      type: formType,
      is_ledger: formIsLedger,
      is_active: true
    };

    try {
      const { error } = await supabase
        .from('accounts')
        .insert([payload]);
      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      fetchAccounts();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'فشل إدخال الحساب في الدليل. تأكد من فرادة رقم الكود.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleOpenAddChild(parent: Account) {
    setFormParentId(parent.id);
    setFormType(parent.type);
    setFormIsLedger(true);
    // Suggest next child ID based on existing children
    const siblings = accounts.filter(a => a.parent_id === parent.id);
    let suggestedId = `${parent.id}01`;
    if (siblings.length > 0) {
      const lastSiblingId = siblings[siblings.length - 1].id;
      const num = Number(lastSiblingId);
      if (!isNaN(num)) {
        suggestedId = String(num + 1);
      }
    } else {
      // If parent length is e.g. 6 digits, append 01 or suggest
      if (parent.id.endsWith('000')) {
        suggestedId = parent.id.replace(/000$/, '100');
      } else if (parent.id.endsWith('00')) {
        suggestedId = parent.id.replace(/00$/, '01');
      }
    }
    setFormAccountId(suggestedId);
    setShowAddModal(true);
  }

  function resetForm() {
    setFormParentId('');
    setFormAccountId('');
    setFormNameAr('');
    setFormNameEn('');
    setFormType('asset');
    setFormIsLedger(true);
    setFormError('');
  }

  // Build structured tree nodes
  function buildTree(parent: string | null): Account[] {
    return accounts.filter(a => a.parent_id === parent);
  }

  // Recursive tree rendering
  const renderAccountNode = (account: Account, level: number = 0) => {
    const children = accounts.filter(a => a.parent_id === account.id);
    const hasChildren = children.length > 0;
    const isExpanded = !!expandedNodes[account.id];
    
    // Hide node if search doesn't match and none of children match
    if (search) {
      const matchesSearch = account.name_ar.includes(search) || account.id.includes(search) || account.name_en.toLowerCase().includes(search.toLowerCase());
      const childMatches = accounts.some(c => c.id.startsWith(account.id) && (c.name_ar.includes(search) || c.id.includes(search)));
      if (!matchesSearch && !childMatches) return null;
    }

    const typeLabels: Record<string, string> = {
      asset: 'أصل مالي',
      liability: 'التزام / خصوم',
      equity: 'حقوق ملكية',
      revenue: 'إيراد',
      expense: 'مصروفات تشغيلية'
    };

    const typeBadgeColor: Record<string, string> = {
      asset: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      liability: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      equity: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      revenue: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      expense: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    };

    return (
      <div key={account.id} className="space-y-1">
        <div 
          style={{ paddingRight: `${level * 24}px` }}
          className={`flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-slate-800 hover:bg-slate-800/30 transition-all ${
            account.is_ledger ? 'bg-slate-900/40' : 'bg-slate-900 font-bold text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {!account.is_ledger ? (
              <button 
                onClick={() => toggleNode(account.id)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-6 h-6 flex items-center justify-center text-slate-600 font-mono text-[10px]">•</span>
            )}
            
            <span className="font-mono text-[11px] text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800/60">
              {account.id}
            </span>
            <span className="text-xs font-bold text-slate-100">{account.name_ar}</span>
            <span className="text-[10px] text-slate-500 font-medium font-mono">| {account.name_en}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[9px] font-black px-2 py-0.5 border rounded-md uppercase tracking-wide ${typeBadgeColor[account.type]}`}>
              {typeLabels[account.type]}
            </span>

            {account.is_ledger ? (
              <span className="text-[9px] font-bold text-slate-500 bg-slate-950/40 px-2 py-0.5 border border-slate-800/60 rounded-md">حساب فرعي / ترحيلي</span>
            ) : (
              <button 
                onClick={() => handleOpenAddChild(account)}
                className="text-[10px] font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-950" />
                <span>إضافة حساب فرعي</span>
              </button>
            )}
          </div>
        </div>

        {!account.is_ledger && isExpanded && hasChildren && (
          <div className="border-r border-dashed border-slate-800 mr-3 pr-2.5 space-y-1 mt-1">
            {children.map(child => renderAccountNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootAccounts = accounts.filter(a => a.parent_id === null);

  return (
    <div className="space-y-6 text-slate-100" id="chart_of_accounts_view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">دليل الحسابات الموحد</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">عرض شجري متكامل للدليل المحاسبي المنظم لشركات الاستثمار وفق المعايير السعودية</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] cursor-pointer self-start"
        >
          <FolderPlus className="w-4 h-4 text-slate-950" />
          <span>إضافة حساب رئيسي جديد</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-3.5 top-3 text-slate-500 w-4.5 h-4.5" />
          <input 
            type="text" 
            placeholder="ابحث برقم الكود الفريد أو الاسم العربي والانجليزي للحساب..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-11 pl-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <button 
          onClick={fetchAccounts}
          className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          <span>تحديث الدليل</span>
        </button>
      </div>

      {/* Account Tree Canvas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-500 font-medium">جاري سحب وتدقيق دليل الحسابات من الخادم...</div>
        ) : rootAccounts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-medium">لا توجد حسابات مدخلة في الدليل حالياً.</div>
        ) : (
          <div className="space-y-3">
            {rootAccounts.map(root => renderAccountNode(root, 0))}
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in text-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-800/80 bg-slate-950/40">
              <h3 className="font-black text-white text-base">إدراج حساب جديد بدليل الحسابات</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-950/40 text-rose-300 text-xs font-semibold rounded-xl border border-rose-900/40 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formParentId && (
                <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl text-xs text-slate-400 font-bold leading-relaxed">
                  سيتم إنشاء هذا كحساب فرعي تحت الحساب الأب المباشر: <strong className="text-emerald-400 font-mono font-black ml-1">{formParentId}</strong>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">رقم كود الحساب الفريد *</label>
                  <input 
                    type="text" 
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    required
                    placeholder="مثال: 111102"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">التصنيف المالي للحساب *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    disabled={!!formParentId}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold disabled:opacity-50"
                  >
                    <option value="asset" className="bg-slate-900">أصول (Assets)</option>
                    <option value="liability" className="bg-slate-900">التزامات (Liabilities)</option>
                    <option value="equity" className="bg-slate-900">حقوق ملكية (Equity)</option>
                    <option value="revenue" className="bg-slate-900">إيرادات (Revenues)</option>
                    <option value="expense" className="bg-slate-900">مصروفات (Expenses)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">الاسم بالعربية *</label>
                  <input 
                    type="text" 
                    value={formNameAr}
                    onChange={(e) => setFormNameAr(e.target.value)}
                    required
                    placeholder="مثال: البنك الأهلي السعودي"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">الاسم بالإنجليزية *</label>
                  <input 
                    type="text" 
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    required
                    placeholder="SNB Bank Account"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                <label className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-2">طبيعة الحركة على الحساب</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-300 font-bold cursor-pointer">
                    <input 
                      type="radio" 
                      checked={formIsLedger}
                      onChange={() => setFormIsLedger(true)}
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>حساب ترحيلي فرعي (يقبل تسجيل قيود اليومية بنجاح)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-300 font-bold cursor-pointer">
                    <input 
                      type="radio" 
                      checked={!formIsLedger}
                      onChange={() => setFormIsLedger(false)}
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>حساب تجميعي رئيسي (حاوية حسابات فقط ولا يقبل قيود مباشرة)</span>
                  </label>
                </div>
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
                  {isSaving ? 'جاري إدراج الحساب حالياً...' : 'إدراج الحساب بالدليل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
