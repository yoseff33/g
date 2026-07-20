import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'

export function PageLoading({ label = 'جاري تحميل البيانات...' }: { label?: string }) {
  return (
    <div className="min-h-[280px] flex flex-col items-center justify-center gap-3 text-slate-400">
      <LoaderCircle className="w-8 h-8 animate-spin text-emerald-400" />
      <p className="text-sm font-bold">{label}</p>
    </div>
  )
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="min-h-[280px] flex flex-col items-center justify-center gap-4 text-center rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8">
      <AlertTriangle className="w-10 h-10 text-rose-400" />
      <div>
        <h3 className="font-black text-lg text-white">تعذر تحميل الشاشة</h3>
        <p className="text-sm text-slate-400 mt-2 max-w-xl">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
          <RefreshCw className="w-4 h-4" /> إعادة المحاولة
        </button>
      )}
    </div>
  )
}
