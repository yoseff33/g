import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Search, Printer, Download, RefreshCw, BarChart3, TrendingUp, Layers, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Account, JournalItem, TrialBalanceRow, IncomeStatementRow } from '../types';

export default function FinancialReportsView() {
  const [activeTab, setActiveTab] = useState<'trial_balance' | 'income_statement' | 'balance_sheet' | 'general_ledger'>('trial_balance');
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(0); // Jan 1st
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // General dependencies
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // 1. Trial Balance state
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);

  // 2. Income Statement state
  const [incomeStatement, setIncomeStatement] = useState<{
    revenues: any[];
    expenses: any[];
    totalRevenues: number;
    totalExpenses: number;
    netProfit: number;
  }>({ revenues: [], expenses: [], totalRevenues: 0, totalExpenses: 0, netProfit: 0 });

  // 3. Balance Sheet state
  const [balanceSheet, setBalanceSheet] = useState<{
    assets: any[];
    liabilities: any[];
    equity: any[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  }>({ assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 });

  // 4. General Ledger state
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    runReportQuery();
  }, [activeTab, startDate, endDate, selectedAccountId]);

  async function fetchAccounts() {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_ledger', true)
        .order('id');
      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0) {
        setSelectedAccountId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  }

  async function runReportQuery() {
    setLoading(true);
    try {
      if (activeTab === 'trial_balance') {
        await queryTrialBalance();
      } else if (activeTab === 'income_statement') {
        await queryIncomeStatement();
      } else if (activeTab === 'balance_sheet') {
        await queryBalanceSheet();
      } else if (activeTab === 'general_ledger') {
        await queryGeneralLedger();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // --- REPORT QUERY ENGINES ---

  async function queryTrialBalance() {
    // We can call get_trial_balance RPC in Supabase, but let's write a robust, 
    // full client-side aggregator to work seamlessly in case the RPC is pending db deployment
    const { data: items, error: itemsErr } = await supabase
      .from('journal_items')
      .select('account_id, debit, credit, journal_entries!inner(date, status)')
      .eq('journal_entries.status', 'posted');

    if (itemsErr) throw itemsErr;

    const { data: accs, error: accsErr } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_ledger', true);
    if (accsErr) throw accsErr;

    const rows: TrialBalanceRow[] = (accs || []).map(acc => {
      let opening_debit = 0;
      let opening_credit = 0;
      let period_debit = 0;
      let period_credit = 0;

      items?.forEach(item => {
        if (item.account_id === acc.id) {
          const deb = Number(item.debit) || 0;
          const cred = Number(item.credit) || 0;
          const entryDate = item.journal_entries.date;

          if (entryDate < startDate) {
            opening_debit += deb;
            opening_credit += cred;
          } else if (entryDate >= startDate && entryDate <= endDate) {
            period_debit += deb;
            period_credit += cred;
          }
        }
      });

      return {
        account_id: acc.id,
        name_ar: acc.name_ar,
        name_en: acc.name_en,
        type: acc.type,
        opening_debit,
        opening_credit,
        period_debit,
        period_credit,
        closing_debit: opening_debit + period_debit,
        closing_credit: opening_credit + period_credit
      };
    });

    setTrialBalance(rows);
  }

  async function queryIncomeStatement() {
    // Revenues (type='revenue') & Expenses (type='expense')
    const { data: items, error: itemsErr } = await supabase
      .from('journal_items')
      .select('account_id, debit, credit, journal_entries!inner(date, status)')
      .eq('journal_entries.status', 'posted')
      .gte('journal_entries.date', startDate)
      .lte('journal_entries.date', endDate);

    if (itemsErr) throw itemsErr;

    const { data: accs, error: accsErr } = await supabase
      .from('accounts')
      .select('*')
      .in('type', ['revenue', 'expense'])
      .eq('is_ledger', true);
    if (accsErr) throw accsErr;

    const revenueMap = new Map<string, { name: string, balance: number }>();
    const expenseMap = new Map<string, { name: string, balance: number }>();

    accs?.forEach(acc => {
      if (acc.type === 'revenue') {
        revenueMap.set(acc.id, { name: acc.name_ar, balance: 0 });
      } else {
        expenseMap.set(acc.id, { name: acc.name_ar, balance: 0 });
      }
    });

    items?.forEach(item => {
      const deb = Number(item.debit) || 0;
      const cred = Number(item.credit) || 0;
      
      if (revenueMap.has(item.account_id)) {
        const entry = revenueMap.get(item.account_id)!;
        // Credit increases revenue
        entry.balance += (cred - deb);
      } else if (expenseMap.has(item.account_id)) {
        const entry = expenseMap.get(item.account_id)!;
        // Debit increases expense
        entry.balance += (deb - cred);
      }
    });

    const revenuesList = Array.from(revenueMap.entries()).map(([id, val]) => ({ id, name: val.name, balance: val.balance }));
    const expensesList = Array.from(expenseMap.entries()).map(([id, val]) => ({ id, name: val.name, balance: val.balance }));

    const totRev = revenuesList.reduce((sum, item) => sum + item.balance, 0);
    const totExp = expensesList.reduce((sum, item) => sum + item.balance, 0);

    setIncomeStatement({
      revenues: revenuesList,
      expenses: expensesList,
      totalRevenues: totRev,
      totalExpenses: totExp,
      netProfit: totRev - totExp
    });
  }

  async function queryBalanceSheet() {
    // Assets (type='asset'), Liabilities (type='liability'), Equity (type='equity')
    // We fetch everything up to endDate
    const { data: items, error: itemsErr } = await supabase
      .from('journal_items')
      .select('account_id, debit, credit, journal_entries!inner(date, status)')
      .eq('journal_entries.status', 'posted')
      .lte('journal_entries.date', endDate);

    if (itemsErr) throw itemsErr;

    const { data: accs, error: accsErr } = await supabase
      .from('accounts')
      .select('*')
      .in('type', ['asset', 'liability', 'equity'])
      .eq('is_ledger', true);
    if (accsErr) throw accsErr;

    const assetMap = new Map<string, { name: string, balance: number }>();
    const liabilityMap = new Map<string, { name: string, balance: number }>();
    const equityMap = new Map<string, { name: string, balance: number }>();

    accs?.forEach(acc => {
      if (acc.type === 'asset') {
        assetMap.set(acc.id, { name: acc.name_ar, balance: 0 });
      } else if (acc.type === 'liability') {
        liabilityMap.set(acc.id, { name: acc.name_ar, balance: 0 });
      } else {
        equityMap.set(acc.id, { name: acc.name_ar, balance: 0 });
      }
    });

    items?.forEach(item => {
      const deb = Number(item.debit) || 0;
      const cred = Number(item.credit) || 0;

      if (assetMap.has(item.account_id)) {
        const entry = assetMap.get(item.account_id)!;
        entry.balance += (deb - cred);
      } else if (liabilityMap.has(item.account_id)) {
        const entry = liabilityMap.get(item.account_id)!;
        entry.balance += (cred - deb);
      } else if (equityMap.has(item.account_id)) {
        const entry = equityMap.get(item.account_id)!;
        entry.balance += (cred - deb);
      }
    });

    // Also inject Net Income inside Retained Earnings on Equity side
    // Fetch Net Income for same period
    const { data: plItems, error: plErr } = await supabase
      .from('journal_items')
      .select('account_id, debit, credit, accounts!inner(type), journal_entries!inner(date, status)')
      .eq('journal_entries.status', 'posted')
      .lte('journal_entries.date', endDate)
      .in('accounts.type', ['revenue', 'expense']);

    if (!plErr && plItems) {
      let totalPlRev = 0;
      let totalPlExp = 0;
      plItems.forEach(item => {
        const deb = Number(item.debit) || 0;
        const cred = Number(item.credit) || 0;
        if (item.accounts.type === 'revenue') {
          totalPlRev += (cred - deb);
        } else {
          totalPlExp += (deb - cred);
        }
      });
      const periodNetIncome = totalPlRev - totalPlExp;
      
      // Inject net profit into Equity list
      equityMap.set('NET_INCOME_YEAR', { name: 'صافي أرباح الفترة الجارية', balance: periodNetIncome });
    }

    const assetsList = Array.from(assetMap.entries()).map(([id, val]) => ({ id, name: val.name, balance: val.balance }));
    const liabilitiesList = Array.from(liabilityMap.entries()).map(([id, val]) => ({ id, name: val.name, balance: val.balance }));
    const equityList = Array.from(equityMap.entries()).map(([id, val]) => ({ id, name: val.name, balance: val.balance }));

    const totAsset = assetsList.reduce((sum, item) => sum + item.balance, 0);
    const totLiab = liabilitiesList.reduce((sum, item) => sum + item.balance, 0);
    const totEq = equityList.reduce((sum, item) => sum + item.balance, 0);

    setBalanceSheet({
      assets: assetsList,
      liabilities: liabilitiesList,
      equity: equityList,
      totalAssets: totAsset,
      totalLiabilities: totLiab,
      totalEquity: totEq
    });
  }

  async function queryGeneralLedger() {
    if (!selectedAccountId) return;

    // Fetch account type to compute correct balance
    const currentAcc = accounts.find(a => a.id === selectedAccountId);
    if (!currentAcc) return;

    const { data: items, error } = await supabase
      .from('journal_items')
      .select('id, debit, credit, description, journal_entries!inner(entry_number, date, status, reference)')
      .eq('account_id', selectedAccountId)
      .eq('journal_entries.status', 'posted')
      .gte('journal_entries.date', startDate)
      .lte('journal_entries.date', endDate)
      .order('journal_entries(date)', { ascending: true });

    if (error) throw error;

    // Calculate opening balance before startDate
    const { data: openingItems, error: opErr } = await supabase
      .from('journal_items')
      .select('debit, credit, journal_entries!inner(date, status)')
      .eq('account_id', selectedAccountId)
      .eq('journal_entries.status', 'posted')
      .lt('journal_entries.date', startDate);

    let runningBal = 0;
    if (!opErr && openingItems) {
      let opDebit = 0;
      let opCredit = 0;
      openingItems.forEach(i => {
        opDebit += Number(i.debit) || 0;
        opCredit += Number(i.credit) || 0;
      });
      runningBal = currentAcc.type === 'asset' || currentAcc.type === 'expense' 
        ? opDebit - opCredit 
        : opCredit - opDebit;
    }

    const rows = (items || []).map(item => {
      const deb = Number(item.debit) || 0;
      const cred = Number(item.credit) || 0;

      if (currentAcc.type === 'asset' || currentAcc.type === 'expense') {
        runningBal += (deb - cred);
      } else {
        runningBal += (cred - deb);
      }

      return {
        id: item.id,
        date: item.journal_entries.date,
        entry_number: item.journal_entries.entry_number,
        reference: item.journal_entries.reference,
        description: item.description,
        debit: deb,
        credit: cred,
        balance: runningBal
      };
    });

    setLedgerRows(rows);
  }

  // --- EXPORT TOOLS ---

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Include BOM for proper Arabic Excel render
    
    if (activeTab === 'trial_balance') {
      csvContent += "كود الحساب,اسم الحساب,مدين افتتاحي,دائن افتتاحي,مدين الفترة,دائن الفترة,مدين كلي,دائن كلي\n";
      trialBalance.forEach(r => {
        csvContent += `${r.account_id},${r.name_ar},${r.opening_debit},${r.opening_credit},${r.period_debit},${r.period_credit},${r.closing_debit},${r.closing_credit}\n`;
      });
    } else if (activeTab === 'income_statement') {
      csvContent += "الحساب,النوع,المبلغ الفعلي (SAR)\n";
      incomeStatement.revenues.forEach(r => csvContent += `${r.name},إيراد,${r.balance}\n`);
      incomeStatement.expenses.forEach(r => csvContent += `${r.name},مصروف,${r.balance}\n`);
      csvContent += `صافي الدخل,,${incomeStatement.netProfit}\n`;
    } else if (activeTab === 'balance_sheet') {
      csvContent += "الحساب,النوع,المبلغ الفعلي (SAR)\n";
      balanceSheet.assets.forEach(r => csvContent += `${r.name},أصل,${r.balance}\n`);
      balanceSheet.liabilities.forEach(r => csvContent += `${r.name},التزام,${r.balance}\n`);
      balanceSheet.equity.forEach(r => csvContent += `${r.name},حقوق ملكية,${r.balance}\n`);
    } else if (activeTab === 'general_ledger') {
      csvContent += "التاريخ,رقم القيد,البيان,المرجع,مدين,دائن,الرصيد التراكمي\n";
      ledgerRows.forEach(r => {
        csvContent += `${r.date},JE-${r.entry_number},${r.description},${r.reference || ''},${r.debit},${r.credit},${r.balance}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير_فزاع_${activeTab}_${startDate}_إلى_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" id="financial_reports_view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-sans">التقارير المحاسبية والقوائم المالية</h1>
          <p className="text-slate-500 text-sm mt-1">توليد القوائم الختامية والميزانيات العمومية التفصيلية بنقرة واحدة</p>
        </div>
        <div className="flex gap-2 shrink-0 self-start">
          <button 
            onClick={handlePrint}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            طباعة التقرير الحالي
          </button>
          <button 
            onClick={handleExportCSV}
            className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            تصدير البيانات CSV
          </button>
        </div>
      </div>

      {/* Date period filtering block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm no-print">
        <div className="space-y-1">
          <label className="text-slate-500 text-xs font-semibold">تاريخ البداية (من)</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-slate-500 text-xs font-semibold">تاريخ النهاية (إلى)</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none"
          />
        </div>
        <div className="flex items-end justify-between">
          <span className="text-xs text-slate-400 mb-2">الدقة: ترحيل يومي حقيقي</span>
          <button 
            onClick={runReportQuery}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            توليد القوائم الحية
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto no-print">
        {[
          { id: 'trial_balance', label: 'ميزان المراجعة' },
          { id: 'income_statement', label: 'قائمة الدخل' },
          { id: 'balance_sheet', label: 'الميزانية العمومية' },
          { id: 'general_ledger', label: 'دفتر الأستاذ العام' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-2 px-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-slate-800 text-slate-900 bg-white rounded-t-lg' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- REPORT RENDERING PANELS --- */}

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 md:p-8 print-card">
        {/* Printable Header */}
        <div className="hidden print:flex justify-between items-start border-b border-slate-300 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-black">شركة فزاع المالي والاستثماري</h1>
            <p className="text-xs text-slate-500">منظومة ERP المتكاملة للمحاسبة السنوية</p>
          </div>
          <div className="text-left text-xs text-slate-500">
            <div>نوع القائمة الختامية: {
              activeTab === 'trial_balance' ? 'ميزان المراجعة بالملخص' :
              activeTab === 'income_statement' ? 'قائمة الأرباح والخسائر' :
              activeTab === 'balance_sheet' ? 'تقرير الميزانية العمومية' : 'دفتر الأستاذ العام'
            }</div>
            <div>الفترة: من {startDate} إلى {endDate}</div>
            <div>تاريخ الطبع: {new Date().toLocaleDateString('ar-SA')}</div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">جاري احتساب البيانات المالية وتجميع الأستاذ العام...</div>
        ) : (
          <>
            {/* 1. Trial Balance UI */}
            {activeTab === 'trial_balance' && (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 font-bold" rowSpan={2}>رقم الكود</th>
                        <th className="py-3 px-4 font-bold" rowSpan={2}>اسم الحساب بالعربية</th>
                        <th className="py-3 px-4 font-bold text-center border-b border-slate-200" colSpan={2}>الأرصدة الافتتاحية</th>
                        <th className="py-3 px-4 font-bold text-center border-b border-slate-200" colSpan={2}>حركات الفترة</th>
                        <th className="py-3 px-4 font-bold text-center border-b border-slate-200" colSpan={2}>الأرصدة الختامية</th>
                      </tr>
                      <tr>
                        <th className="py-1 px-4 font-bold text-emerald-700 text-left">مدين</th>
                        <th className="py-1 px-4 font-bold text-blue-700 text-left">دائن</th>
                        <th className="py-1 px-4 font-bold text-emerald-700 text-left">مدين</th>
                        <th className="py-1 px-4 font-bold text-blue-700 text-left">دائن</th>
                        <th className="py-1 px-4 font-bold text-emerald-700 text-left">مدين</th>
                        <th className="py-1 px-4 font-bold text-blue-700 text-left">دائن</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trialBalance.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">لا توجد حركات مالية مسجلة في هذه الفترة لتوليد الميزان.</td>
                        </tr>
                      ) : (
                        trialBalance.map(r => (
                          <tr key={r.account_id} className="hover:bg-slate-50/30 font-medium">
                            <td className="py-3 px-4 font-mono font-bold text-slate-600">{r.account_id}</td>
                            <td className="py-3 px-4 text-slate-800">{r.name_ar}</td>
                            <td className="py-3 px-4 font-mono text-left">{r.opening_debit > 0 ? formatCurrency(r.opening_debit) : '-'}</td>
                            <td className="py-3 px-4 font-mono text-left">{r.opening_credit > 0 ? formatCurrency(r.opening_credit) : '-'}</td>
                            <td className="py-3 px-4 font-mono text-left text-emerald-700">{r.period_debit > 0 ? formatCurrency(r.period_debit) : '-'}</td>
                            <td className="py-3 px-4 font-mono text-left text-blue-700">{r.period_credit > 0 ? formatCurrency(r.period_credit) : '-'}</td>
                            <td className="py-3 px-4 font-mono text-left font-bold">{r.closing_debit > 0 ? formatCurrency(r.closing_debit) : '-'}</td>
                            <td className="py-3 px-4 font-mono text-left font-bold">{r.closing_credit > 0 ? formatCurrency(r.closing_credit) : '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100/70 border-t-2 border-slate-300 font-bold text-slate-900">
                      <tr>
                        <td colSpan={2} className="py-3 px-4 text-center text-sm">المجموع الكلي الموحد</td>
                        <td className="py-3 px-4 text-left font-mono">{formatCurrency(trialBalance.reduce((sum, r) => sum + r.opening_debit, 0))}</td>
                        <td className="py-3 px-4 text-left font-mono">{formatCurrency(trialBalance.reduce((sum, r) => sum + r.opening_credit, 0))}</td>
                        <td className="py-3 px-4 text-left font-mono text-emerald-800">{formatCurrency(trialBalance.reduce((sum, r) => sum + r.period_debit, 0))}</td>
                        <td className="py-3 px-4 text-left font-mono text-blue-800">{formatCurrency(trialBalance.reduce((sum, r) => sum + r.period_credit, 0))}</td>
                        <td className="py-3 px-4 text-left font-mono text-emerald-950">{formatCurrency(trialBalance.reduce((sum, r) => sum + r.closing_debit, 0))}</td>
                        <td className="py-3 px-4 text-left font-mono text-blue-950">{formatCurrency(trialBalance.reduce((sum, r) => sum + r.closing_credit, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Income Statement UI */}
            {activeTab === 'income_statement' && (
              <div className="space-y-8 max-w-2xl mx-auto">
                <div className="text-center pb-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">قائمة الأرباح والخسائر (الدخل الشامل)</h2>
                  <p className="text-slate-400 text-xs font-mono mt-1">عن الفترة من {startDate} إلى {endDate}</p>
                </div>

                {/* Revenues */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-r-4 border-emerald-600 pr-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    أولاً: الإيرادات التشغيلية والاستثمارية
                  </h3>
                  <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-right text-sm">
                      <tbody>
                        {incomeStatement.revenues.length === 0 ? (
                          <tr>
                            <td className="py-4 px-6 text-slate-400 text-center">لا يوجد بنود إيرادات مرحلة.</td>
                          </tr>
                        ) : (
                          incomeStatement.revenues.map(r => (
                            <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-3 px-6 text-slate-700 font-semibold">{r.name}</td>
                              <td className="py-3 px-6 text-left font-mono text-emerald-700 font-bold">{formatCurrency(r.balance)}</td>
                            </tr>
                          ))
                        )}
                        <tr className="bg-slate-50 font-bold text-slate-800">
                          <td className="py-3 px-6">إجمالي الإيرادات</td>
                          <td className="py-3 px-6 text-left font-mono text-emerald-800">{formatCurrency(incomeStatement.totalRevenues)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Expenses */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-r-4 border-rose-600 pr-2">
                    <Layers className="w-4 h-4 text-rose-600" />
                    ثانياً: المصروفات والعمولات البنكية
                  </h3>
                  <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-right text-sm">
                      <tbody>
                        {incomeStatement.expenses.length === 0 ? (
                          <tr>
                            <td className="py-4 px-6 text-slate-400 text-center">لا يوجد بنود مصروفات مسجلة.</td>
                          </tr>
                        ) : (
                          incomeStatement.expenses.map(e => (
                            <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-3 px-6 text-slate-700 font-semibold">{e.name}</td>
                              <td className="py-3 px-6 text-left font-mono text-rose-700 font-bold">{formatCurrency(e.balance)}</td>
                            </tr>
                          ))
                        )}
                        <tr className="bg-slate-50 font-bold text-slate-800">
                          <td className="py-3 px-6">إجمالي المصروفات التشغيلية والتمويلية</td>
                          <td className="py-3 px-6 text-left font-mono text-rose-800">{formatCurrency(incomeStatement.totalExpenses)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Profit/Loss */}
                <div className="p-6 bg-slate-800 text-white rounded-2xl flex justify-between items-center">
                  <div>
                    <h4 className="text-base font-bold">صافي الأرباح المحققة للمنشأة</h4>
                    <p className="text-[10px] text-slate-300 mt-1">تؤثر مباشرة في حساب الأرباح المبقاة لحقوق الملكية</p>
                  </div>
                  <div className="text-2xl font-black font-mono">
                    {formatCurrency(incomeStatement.netProfit)}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Balance Sheet UI */}
            {activeTab === 'balance_sheet' && (
              <div className="space-y-8 max-w-3xl mx-auto">
                <div className="text-center pb-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">قائمة المركز المالي (الميزانية العمومية)</h2>
                  <p className="text-slate-400 text-xs font-mono mt-1">كما هي في تاريخ: {endDate}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Assets Left Column */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 border-r-4 border-emerald-600 pr-2">الأصـول (Assets)</h3>
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white text-sm">
                      <table className="w-full text-right">
                        <tbody className="divide-y divide-slate-100">
                          {balanceSheet.assets.map(a => (
                            <tr key={a.id}>
                              <td className="py-3 px-4 font-semibold text-slate-700">{a.name}</td>
                              <td className="py-3 px-4 text-left font-mono font-bold">{formatCurrency(a.balance)}</td>
                            </tr>
                          ))}
                          <tr className="bg-emerald-50 font-bold text-emerald-950 text-base">
                            <td className="py-3 px-4">إجمالي قيمة الأصول</td>
                            <td className="py-3 px-4 text-left font-mono">{formatCurrency(balanceSheet.totalAssets)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Liabilities & Equity Right Column */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 border-r-4 border-blue-600 pr-2">الخصوم وحقوق الملكية</h3>
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white text-sm">
                      <table className="w-full text-right">
                        <tbody className="divide-y divide-slate-100">
                          {/* Liabilities */}
                          <tr className="bg-slate-50 font-bold text-slate-800">
                            <td colSpan={2} className="py-2 px-4 text-xs">الالتزامات المطلوبة (Liabilities)</td>
                          </tr>
                          {balanceSheet.liabilities.map(l => (
                            <tr key={l.id}>
                              <td className="py-3 px-4 font-semibold text-slate-700">{l.name}</td>
                              <td className="py-3 px-4 text-left font-mono font-bold">{formatCurrency(l.balance)}</td>
                            </tr>
                          ))}

                          {/* Equity */}
                          <tr className="bg-slate-50 font-bold text-slate-800">
                            <td colSpan={2} className="py-2 px-4 text-xs">حقوق الملكية (Equity)</td>
                          </tr>
                          {balanceSheet.equity.map(e => (
                            <tr key={e.id}>
                              <td className="py-3 px-4 font-semibold text-slate-700">{e.name}</td>
                              <td className="py-3 px-4 text-left font-mono font-bold">{formatCurrency(e.balance)}</td>
                            </tr>
                          ))}

                          <tr className="bg-blue-50 font-bold text-blue-950 text-base">
                            <td className="py-3 px-4">إجمالي الخصوم وحقوق الشركاء</td>
                            <td className="py-3 px-4 text-left font-mono">{formatCurrency(balanceSheet.totalLiabilities + balanceSheet.totalEquity)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Accounting Equation Check Block */}
                {Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)) < 0.1 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>المعاصرة الرياضية متوازنة: الأصول = الالتزامات + حقوق الملكية تماماً.</span>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>تنبيه: يوجد فارق محاسبي غير متطابق بمقدار {formatCurrency(Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)))}. يرجى ترحيل قيود التسوية.</span>
                  </div>
                )}
              </div>
            )}

            {/* 4. General Ledger UI */}
            {activeTab === 'general_ledger' && (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between no-print">
                  <div className="space-y-1 w-full md:w-72">
                    <label className="text-slate-600 text-xs font-semibold">اختر حساب الأستاذ العام المستعلم عنه</label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>[{acc.id}] - {acc.name_ar}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">تحديث مستمر تلقائي</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-6 font-bold">التاريخ</th>
                        <th className="py-3 px-6 font-bold">رقم القيد</th>
                        <th className="py-3 px-6 font-bold">البيان / تفصيل البند</th>
                        <th className="py-3 px-6 font-bold">السند المرجعي</th>
                        <th className="py-3 px-6 font-bold text-left">مدين (Debit)</th>
                        <th className="py-3 px-6 font-bold text-left">دائن (Credit)</th>
                        <th className="py-3 px-6 font-bold text-left">الرصيد التراكمي (Balance)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">لا توجد حركات مقيدة ومرحلة لهذا الحساب في الفترة المحددة.</td>
                        </tr>
                      ) : (
                        ledgerRows.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50 font-medium">
                            <td className="py-3 px-6 font-mono text-slate-600">{r.date}</td>
                            <td className="py-3 px-6 font-mono text-slate-800 font-bold">JE-{String(r.entry_number).padStart(5, '0')}</td>
                            <td className="py-3 px-6 text-slate-700">{r.description}</td>
                            <td className="py-3 px-6 font-mono text-slate-500">{r.reference || '-'}</td>
                            <td className="py-3 px-6 text-left font-mono text-emerald-700 font-semibold">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</td>
                            <td className="py-3 px-6 text-left font-mono text-blue-700 font-semibold">{r.credit > 0 ? formatCurrency(r.credit) : '-'}</td>
                            <td className="py-3 px-6 text-left font-mono text-slate-900 font-black">{formatCurrency(r.balance)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Printable Footer */}
        <div className="hidden print:grid grid-cols-3 gap-12 mt-12 pt-8 border-t border-slate-300 text-center text-xs">
          <div>
            <p className="text-slate-400">المدير المالي والتدقيق</p>
            <div className="h-12"></div>
            <p className="font-bold">توقيع: .......................................</p>
          </div>
          <div>
            <p className="text-slate-400">العضو المنتدب للاستثمار</p>
            <div className="h-12"></div>
            <p className="font-bold">توقيع: .......................................</p>
          </div>
          <div>
            <p className="text-slate-400">ختم شركة فزاع الموحدة</p>
            <div className="h-12"></div>
            <p className="font-bold">.......................................</p>
          </div>
        </div>
      </div>
    </div>
  );
}
