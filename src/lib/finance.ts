export type PaymentStatus = 'paid' | 'due_today' | 'upcoming' | 'overdue'

export const formatCurrency = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

export const formatDate = (value: string | null | undefined) => {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export const getDaysDifference = (date: string) => {
  const target = new Date(`${date}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function getPaymentStatus(payment: {
  status?: string | null
  due_date: string
  amount_due?: number | string | null
  amount_paid?: number | string | null
}): PaymentStatus {
  const due = Number(payment.amount_due || 0)
  const paid = Number(payment.amount_paid || 0)
  if (payment.status === 'paid' || (due > 0 && paid >= due)) return 'paid'

  const days = getDaysDifference(payment.due_date)
  if (days < 0) return 'overdue'
  if (days === 0) return 'due_today'
  return 'upcoming'
}

export const statusMeta: Record<PaymentStatus, { label: string; className: string }> = {
  paid: {
    label: 'مسدد',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  due_today: {
    label: 'مستحق اليوم',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  upcoming: {
    label: 'قادم',
    className: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  overdue: {
    label: 'متأخر',
    className: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
}

export function normalizeSaudiPhone(phone?: string | null) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('966')) return digits
  if (digits.startsWith('05')) return `966${digits.slice(1)}`
  if (digits.startsWith('5') && digits.length === 9) return `966${digits}`
  return digits
}

export function openWhatsApp(phone: string | null | undefined, message: string) {
  const normalized = normalizeSaudiPhone(phone)
  if (!normalized) return false
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  return true
}
