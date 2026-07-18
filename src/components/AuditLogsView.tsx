import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Shield, RefreshCw, KeyRound, Clock, Code, AlertTriangle } from 'lucide-react';
import { AuditLog } from '../types';

export default function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('all');

  // Selected Log detail for modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [tableFilter]);

  async function fetchLogs() {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(l => {
    const email = l.user_email || 'system';
    const matchesSearch = email.includes(search) || l.record_id.includes(search) || l.action.includes(search);
    return matchesSearch;
  });

  return (
    <div className="space-y-6" id="audit_logs_view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">سجل تدقيق النظام الأمني</h1>
          <p className="text-slate-500 text-sm mt-1">سجل تدقيق غير قابل للتعديل يوثق كافة التعديلات، الإدخالات، وحركات قواعد البيانات التشغيلية والمالية</p>
        </div>
        <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 text-slate-600 text-xs font-semibold self-start">
          <Shield className="w-4 h-4 text-slate-700 animate-pulse" />
          مؤمن ومعزز بسياسات RLS
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-2.5 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="ابحث بالبريد الإلكتروني للفاعل، أو رمز السجل المرجعي..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 bg-slate-50/50"
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 bg-slate-50/50 text-slate-700"
          >
            <option value="all">كل الجداول</option>
            <option value="investors">المستثمرون (investors)</option>
            <option value="contracts">العقود الاستثمارية (contracts)</option>
            <option value="journal_entries">قيود اليومية (journal_entries)</option>
            <option value="vouchers">سندات القبض والصرف (vouchers)</option>
            <option value="profit_distributions">دورات الأرباح (profit_distributions)</option>
          </select>
          <button 
            onClick={fetchLogs}
            className="p-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            title="تحديث السجل"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audit table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
              <tr>
                <th className="py-3 px-6 font-bold">تاريخ الحركة</th>
                <th className="py-3 px-6 font-bold">الفاعل / المستخدم</th>
                <th className="py-3 px-6 font-bold">نوع العملية</th>
                <th className="py-3 px-6 font-bold">الجدول المتأثر</th>
                <th className="py-3 px-6 font-bold">معرّف السجل المرجعي</th>
                <th className="py-3 px-6 font-bold">البيانات (JSON)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">جاري تحميل سجل التدقيق الأمني...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">لا يوجد سجلات متوافقة مع شروط الفلترة.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors align-middle font-medium">
                    <td className="py-4 px-6 text-slate-500 font-mono whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(log.created_at).toLocaleString('ar-SA')}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-700 font-semibold">{log.user_email || 'عملية_آلية_للنظام'}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        log.action === 'INSERT' ? 'bg-emerald-50 text-emerald-700' :
                        log.action === 'UPDATE' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {log.action === 'INSERT' ? 'إدخال جديد' :
                         log.action === 'UPDATE' ? 'تحديث وتعديل' : 'حذف وإلغاء'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-mono text-xs">{log.table_name}</td>
                    <td className="py-4 px-6 text-slate-500 font-mono text-xs max-w-xs truncate">{log.record_id}</td>
                    <td className="py-4 px-6">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="text-xs font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Code className="w-3.5 h-3.5" />
                        عرض الفروقات التعديلية
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Difference Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-xl border border-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-base">تدقيق الفروقات التعديلية للسجل</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[450px] overflow-y-auto font-mono text-xs">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2">
                <div>الجدول: <strong className="font-bold">{selectedLog.table_name}</strong></div>
                <div>العملية: <strong className="font-bold text-indigo-600">{selectedLog.action}</strong></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old value JSON */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-sans">القيم السابقة (قبل التعديل)</span>
                  <pre className="bg-red-50/50 p-4 rounded-xl border border-red-100 text-red-800 overflow-x-auto">
                    {selectedLog.old_values ? JSON.stringify(selectedLog.old_values, null, 2) : '--- لا يوجد قيم سابقة ---'}
                  </pre>
                </div>

                {/* New value JSON */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-sans">القيم الجديدة (بعد التعديل)</span>
                  <pre className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 text-emerald-800 overflow-x-auto">
                    {selectedLog.new_values ? JSON.stringify(selectedLog.new_values, null, 2) : '--- لا يوجد قيم جديدة ---'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
