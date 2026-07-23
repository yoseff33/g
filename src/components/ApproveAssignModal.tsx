import { useEffect, useMemo, useState } from 'react'
import { Loader2, UserCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  assignOperationToInvestor,
  fetchActiveInvestors,
  type InvestorOption,
  type OperationSource,
} from '../lib/investorAssignment'

interface ApproveAssignModalProps {
  open: boolean
  operationId: string
  source: OperationSource
  operationLabel?: string
  onClose: () => void
  onSuccess?: () => void | Promise<void>
}

export default function ApproveAssignModal({
  open,
  operationId,
  source,
  operationLabel = 'العملية',
  onClose,
  onSuccess,
}: ApproveAssignModalProps) {
  const [investors, setInvestors] = useState<InvestorOption[]>([])
  const [selectedInvestorId, setSelectedInvestorId] = useState('')
  const [notes, setNotes] = useState('')
  const [loadingInvestors, setLoadingInvestors] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const selectedInvestor = useMemo(
    () => investors.find((item) => item.id === selectedInvestorId) ?? null,
    [investors, selectedInvestorId],
  )

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function load() {
      setLoadingInvestors(true)
      try {
        const rows = await fetchActiveInvestors()
        if (!cancelled) {
          setInvestors(rows)
          setSelectedInvestorId('')
          setNotes('')
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'تعذر تحميل المستثمرين',
          )
        }
      } finally {
        if (!cancelled) setLoadingInvestors(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [open])

  async function handleSubmit() {
    if (!selectedInvestor) {
      toast.error('اختر المستثمر أولًا')
      return
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من اعتماد ${operationLabel} وإسنادها إلى المستثمر ${selectedInvestor.name}؟`,
    )

    if (!confirmed) return

    setSubmitting(true)

    try {
      const result = await assignOperationToInvestor({
        source,
        operationId,
        investorId: selectedInvestor.id,
        notes,
      })

      toast.success(
        `تم اعتماد العملية وإسنادها للمستثمر ${result.investor_name}`,
      )

      await onSuccess?.()
      onClose()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'تعذر اعتماد وإسناد العملية',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <h2 className="text-lg font-bold text-white">
              اعتماد وإسناد العملية
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              يتم الحفظ بمعرف المستثمر وليس باسمه.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              المستثمر
            </label>

            <select
              value={selectedInvestorId}
              onChange={(event) => setSelectedInvestorId(event.target.value)}
              disabled={loadingInvestors || submitting}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500 disabled:opacity-50"
            >
              <option value="">
                {loadingInvestors
                  ? 'جاري تحميل المستثمرين...'
                  : 'اختر المستثمر'}
              </option>

              {investors.map((investor) => (
                <option key={investor.id} value={investor.id}>
                  {investor.name}
                </option>
              ))}
            </select>
          </div>

          {selectedInvestor && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="font-bold text-white">{selectedInvestor.name}</p>
              <p className="mt-1 text-sm text-slate-400">
                رأس المال المتاح:{' '}
                {Number(
                  selectedInvestor.capital_available ?? 0,
                ).toLocaleString('ar-SA', {
                  style: 'currency',
                  currency: 'SAR',
                })}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              ملاحظة الإسناد
            </label>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="اختياري"
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-800 p-5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              loadingInvestors ||
              !selectedInvestorId ||
              !operationId
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري الاعتماد...
              </>
            ) : (
              <>
                <UserCheck className="h-5 w-5" />
                اعتماد وإسناد
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-700 px-5 py-3 font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
