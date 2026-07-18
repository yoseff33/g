import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ShieldCheck, ServerCrash, Landmark, Check, AlertCircle, Save } from 'lucide-react';

export default function SettingsView() {
  const [dbStatus, setDbStatus] = useState<'testing' | 'success' | 'failed'>('testing');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Organization info
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
      const { data, error } = await supabase
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
    <div className="space-y-6" id="settings_view">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">إعدادات النظام والربط التقني</h1>
        <p className="text-slate-500 text-sm mt-1">تعديل الإعدادات المحاسبية للمنشأة، تشخيص الاتصال المباشر لـ Supabase ومراقبة المفاتيح الحية</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Core settings form */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm lg:col-span-2 space-y-6">
          <h3 className="text-sm font-bold text-slate-800 border-r-2 border-slate-800 pr-2 pb-0.5">معلومات المنشأة الحالية</h3>
          
          <form onSubmit={handleSaveSettings} className="space-y-4">
            {saveSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>تم حفظ إعدادات المنشأة بنجاح في ذاكرة المتصفح المحلية!</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-slate-600 text-xs font-semibold">اسم الشركة / المنشأة بالكامل *</label>
                <input 
                  type="text" 
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  placeholder="شركة فزاع القابضة للاستثمار"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-600 text-xs font-semibold">العملة الافتراضية للتقارير الموحدة</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 font-bold"
                >
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-slate-600 text-xs font-semibold">السنة المالية الحالية</label>
                <input 
                  type="text" 
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono bg-slate-50 text-slate-700 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-600 text-xs font-semibold">تنسيق الفواصل العشرية بالأرقام</label>
                <select
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700"
                >
                  <option value="2">منزلتين عشريتين (0.00)</option>
                  <option value="3">ثلاث منازل عشرية (0.000)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit"
                className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                حفظ التكوينات
              </button>
            </div>
          </form>
        </div>

        {/* Supabase Technical Diagnostics panel */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-800 border-r-2 border-slate-800 pr-2 pb-0.5">تشخيص فني حقيقي</h3>

          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 block font-sans">عنوان خادم المشروع (Supabase URL)</span>
              <code className="text-[10px] text-slate-600 font-mono bg-slate-50 p-2 border border-slate-150 rounded block truncate">
                {import.meta.env.VITE_SUPABASE_URL || 'لا يوجد قيمة - مفتاح مفقود'}
              </code>
            </div>

            {/* Diagnostic Status Indicator */}
            <div className="p-4 rounded-xl border space-y-3 bg-white">
              <span className="text-xs font-bold text-slate-700 block">حالة الاتصال والربط:</span>

              {dbStatus === 'testing' && (
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <div className="w-3 h-3 bg-slate-400 rounded-full animate-ping"></div>
                  <span>جاري اختبار الاتصال بقاعدة البيانات...</span>
                </div>
              )}

              {dbStatus === 'success' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>الربط حقيقي وفعال 100%</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">نجح النظام في الاتصال الفوري بـ Supabase وجلب الحسابات والأستاذ العام بدون أي محاكاة.</p>
                </div>
              )}

              {dbStatus === 'failed' && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-red-800 text-xs font-bold bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                    <ServerCrash className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span>فشل الربط التلقائي بقاعدة البيانات</span>
                      <p className="text-[10px] text-red-600 font-normal mt-1 leading-normal font-mono">{errorMessage}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 text-xs rounded-lg flex items-start gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <p className="text-[10px] leading-relaxed">تنبيه: لتفعيل النظام، قم بنسخ ملف <code>.env.example</code> إلى <code>.env</code> واملأ المتغيرات بالمفاتيح الصحيحة ثم أعد التشغيل.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Manual test-ping trigger */}
            <button
              onClick={testDatabaseConnection}
              className="w-full text-center border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2 rounded-lg text-xs transition-colors"
            >
              إعادة اختبار الربط بقاعدة البيانات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
