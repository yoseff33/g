import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, ServerCrash, Check, AlertCircle, Save } from 'lucide-react';

export default function SettingsView() {
  const [dbStatus, setDbStatus] = useState<'testing' | 'success' | 'failed'>('testing');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [orgName, setOrgName] = useState(() => localStorage.getItem('fazza_org_name') || 'فزاع للاستثمارات المالية');
  const [currency, setCurrency] = useState('SAR');
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [decimals, setDecimals] = useState('2');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    testDatabaseConnection();
  }, []);

  async function testDatabaseConnection() {
    setDbStatus('testing');
    try {
      const { error } = await supabase
        .from('accounts')
        .select('id')
        .limit(1);

      if (error) throw error;
      setDbStatus('success');
    } catch (err: any) {
      console.error(err);
      setDbStatus('failed');
      setErrorMessage(err.message || 'فشل الاتصال بقاعدة بيانات Supabase. يرجى مراجعة إدخال مفتاح ANON_KEY.');
    }
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem('fazza_org_name', orgName);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);
  }

  return (
    <div className="space-y-6 w-full min-w-0" id="settings_view">
      <div>
        <h1 className="text-xl sm:text-2xl font-black">إعدادات النظام والربط التقني</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          تعديل الإعدادات المحاسبية للمنشأة، تشخيص الاتصال المباشر لـ Supabase ومراقبة المفاتيح الحية
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full min-w-0">
        {/* Core settings form */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm space-y-6 w-full min-w-0">
          <h3 className="text-sm font-bold border-r-4 border-emerald-500 pr-3">معلومات المنشأة الحالية</h3>
          
          <form onSubmit={handleSaveSettings} className="space-y-4 w-full">
            {saveSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>تم حفظ إعدادات المنشأة بنجاح!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">اسم الشركة / المنشأة بالكامل *</label>
                <input 
                  type="text" 
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  placeholder="شركة فزاع القابضة للاستثمار"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs sm:text-sm outline-none focus:border-emerald-500 font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">العملة الافتراضية للتقارير الموحدة</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs sm:text-sm outline-none focus:border-emerald-500 font-bold"
                >
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">السنة المالية الحالية</label>
                <input 
                  type="text" 
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs sm:text-sm font-mono outline-none focus:border-emerald-500 font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">تنسيق الفواصل العشرية بالأرقام</label>
                <select
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs sm:text-sm outline-none focus:border-emerald-500"
                >
                  <option value="2">منزلتين عشريتين (0.00)</option>
                  <option value="3">ثلاث منازل عشرية (0.000)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit"
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                حفظ التكوينات
              </button>
            </div>
          </form>
        </div>

        {/* Supabase Technical Diagnostics panel */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm space-y-6 w-full min-w-0">
          <h3 className="text-sm font-bold border-r-4 border-emerald-500 pr-3">تشخيص فني حقيقي</h3>

          <div className="space-y-4 w-full min-w-0">
            <div className="space-y-1.5 w-full min-w-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">عنوان خادم المشروع (Supabase URL)</span>
              <code className="text-[11px] font-mono bg-slate-100 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl block break-all text-slate-700 dark:text-slate-300 w-full">
                {import.meta.env.VITE_SUPABASE_URL || 'لا يوجد قيمة - مفتاح مفقود'}
              </code>
            </div>

            {/* Diagnostic Status Indicator */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3 w-full">
              <span className="text-xs font-bold block">حالة الاتصال والربط:</span>

              {dbStatus === 'testing' && (
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></div>
                  <span>جاري اختبار الاتصال...</span>
                </div>
              )}

              {dbStatus === 'success' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>الربط حقيقي وفعال 100%</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">نجح النظام في الاتصال الفوري بـ Supabase وجلب البيانات بنجاح.</p>
                </div>
              )}

              {dbStatus === 'failed' && (
                <div className="space-y-2 w-full min-w-0">
                  <div className="flex items-start gap-2 text-rose-500 text-xs font-bold bg-rose-500/10 px-3 py-2.5 rounded-xl border border-rose-500/20 w-full min-w-0">
                    <ServerCrash className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span>فشل الربط التلقائي</span>
                      <p className="text-[10px] font-normal mt-1 leading-normal font-mono break-all">{errorMessage}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded-xl flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed">تنبيه: قم بنسخ ملف <code>.env.example</code> إلى <code>.env</code> واملأ المتغيرات بالمفاتيح الصحيحة.</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={testDatabaseConnection}
              className="w-full text-center border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              إعادة اختبار الربط بقاعدة البيانات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
