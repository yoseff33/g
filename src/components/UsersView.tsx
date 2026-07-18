import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, RefreshCw, Key, CheckCircle, Shield, AlertCircle } from 'lucide-react';
import { Profile } from '../types';

export default function UsersView() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

  // Modal and edits
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [errMessage, setErrMessage] = useState('');

  useEffect(() => {
    fetchUsersAndCurrent();
  }, []);

  async function fetchUsersAndCurrent() {
    setLoading(true);
    setErrMessage('');
    try {
      // 1. Fetch current user info
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (!profErr && prof) {
          setCurrentUserProfile(prof);
        }
      }

      // 2. Fetch all profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role');

      if (error) throw error;
      setProfiles(data || []);
    } catch (err: any) {
      console.error(err);
      setErrMessage(err.message || 'فشل جلب الصلاحيات والمستخدمين من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(profileId: string, newRole: 'admin' | 'accountant' | 'manager' | 'viewer') {
    setUpdatingId(profileId);
    setMessage('');
    setErrMessage('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId);

      if (error) throw error;
      setMessage('تم تعديل دور وصلاحية المستخدم بنجاح في قاعدة البيانات.');
      fetchUsersAndCurrent();
    } catch (err: any) {
      console.error(err);
      setErrMessage(err.message || 'تعذر تغيير دور المستخدم بسبب قيود RLS أو الصلاحيات.');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6" id="users_view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">صلاحيات المستخدمين والمحاسبين</h1>
          <p className="text-slate-500 text-sm mt-1">تعديل صلاحيات الوصول وأدوار الموظفين لتقييد النفاذ للبيانات الحساسة ودفاتر الشيكات</p>
        </div>
        <button 
          onClick={fetchUsersAndCurrent}
          className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 bg-white"
          title="تحديث البيانات"
        >
          <RefreshCw className="w-4.5 h-4.5" />
        </button>
      </div>

      {errMessage && (
        <div className="p-3.5 bg-red-50 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errMessage}</span>
        </div>
      )}

      {message && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 animate-fade-in">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* User profile layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Users table */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800">حسابات الوصول المسجلة بالمشروع</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6 font-bold">البريد الإلكتروني</th>
                  <th className="py-3 px-6 font-bold">تاريخ الانضمام</th>
                  <th className="py-3 px-6 font-bold">الصلاحية الحالية</th>
                  <th className="py-3 px-6 font-bold">تحديث الصلاحية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">جاري جلب قائمة المستخدمين...</td>
                  </tr>
                ) : profiles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">لا يوجد مستخدمون مسجلون.</td>
                  </tr>
                ) : (
                  profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono font-semibold text-slate-800">
                        {p.email}
                        {currentUserProfile?.id === p.id && (
                          <span className="mr-2 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full font-sans font-bold">أنت</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-mono text-xs">{new Date(p.created_at).toLocaleDateString('ar-SA')}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.role === 'admin' ? 'bg-indigo-50 text-indigo-700' :
                          p.role === 'accountant' ? 'bg-emerald-50 text-emerald-700' :
                          p.role === 'manager' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <Shield className="w-3.5 h-3.5" />
                          {p.role === 'admin' ? 'مدير نظام (Admin)' :
                           p.role === 'accountant' ? 'محاسب مسؤول' :
                           p.role === 'manager' ? 'مدير استثمار' : 'مراقب عام (Viewer)'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {currentUserProfile?.role === 'admin' && currentUserProfile?.id !== p.id ? (
                          <select
                            value={p.role}
                            disabled={updatingId === p.id}
                            onChange={(e) => handleRoleChange(p.id, e.target.value as any)}
                            className="text-xs border border-slate-200 px-2 py-1.5 rounded bg-white text-slate-700 focus:outline-none"
                          >
                            <option value="admin">مدير نظام</option>
                            <option value="accountant">محاسب مسؤول</option>
                            <option value="manager">مدير استثمار</option>
                            <option value="viewer">مراقب عام</option>
                          </select>
                        ) : (
                          <span className="text-xs text-slate-400">غير مسموح بالتعديل</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security guidelines */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-800 border-r-2 border-slate-800 pr-2 pb-0.5">منشور الأمن والصلاحيات</h3>

          <div className="space-y-4 text-xs leading-relaxed text-slate-600">
            <div className="flex gap-2 items-start">
              <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-slate-800 mb-1">صلاحية مدير النظام (Admin)</strong>
                يملك الصلاحية الكاملة لإعداد المنشأة وتعديل مستويات صلاحيات المستخدمين والاطلاع على سجلات التدقيق بالكامل.
              </div>
            </div>

            <div className="flex gap-2 items-start">
              <Key className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-slate-800 mb-1">صلاحية المحاسب المسؤول (Accountant)</strong>
                يملك الصلاحية لإنشاء القيود، السندات، توزيع الأرباح، وتوليد القوائم الختامية، ولا يملك حق إلغاء القيود أو تعديل الصلاحيات.
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed text-[10px]">
              تنويه: جميع الحركات والمصادقات يتم حمايتها في الخلفية مباشرةً عبر خادم قاعدة البيانات بالاعتماد على ميزة الـ <strong>Row Level Security (RLS)</strong> بشكل متأصل ولا يمكن تجاوزها من الواجهة.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
