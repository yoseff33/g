import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, CircleDollarSign, PauseCircle, PlayCircle, RefreshCw, Scale, Sparkles, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/finance'
import { PageError, PageLoading } from './PageState'

type InvestorScore = {
  id: string
  name: string
  capital_total?: number
  capital_available?: number
  max_active_amount?: number
  allocation_weight?: number
  rotation_paused?: boolean
  last_allocation_at?: string | null
  activeAmount: number
  activeCount: number
  score: number
  reasons: string[]
}

export default function FairDistributionView() {
  const [investors, setInvestors] = useState<InvestorScore[]>([])
  const [amount, setAmount] = useState('10000')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')

    const advanced = await supabase
      .from('investors')
      .select('id,name,status,capital_total,capital_available,max_active_amount,allocation_weight,rotation_paused,last_allocation_at')
      .eq('status', 'active')
      .order('name')

    let investorRows: Array<Record<string, unknown>> = []
    if (advanced.error) {
      const fallback = await supabase.from('investors').select('id,name,status').eq('status', 'active').order('name')
      if (fallback.error) {
        setError(fallback.error.message)
        setLoading(false)
        return
      }
      investorRows = fallback.data || []
    } else {
      investorRows = advanced.data || []
    }

    const contractsResult = await supabase
      .from('installment_contracts')
      .select('id,investor_id,total_amount,status')
      .in('status', ['draft', 'review', 'approved', 'active', 'due_soon', 'due', 'overdue'])

    const contracts = contractsResult.data || []
    const computed = investorRows.map(item => {
      const related = contracts.filter(contract => contract.investor_id === item.id)
      const activeAmount = related.reduce((sum, contract) => sum + Number(contract.total_amount || 0), 0)
      return {
        id: String(item.id),
        name: String(item.name),
        capital_total: Number(item.capital_total || 0),
        capital_available: Number(item.capital_available || 0),
        max_active_amount: Number(item.max_active_amount || 0),
        allocation_weight: Number(item.allocation_weight || 1),
        rotation_paused: Boolean(item.rotation_paused),
        last_allocation_at: item.last_allocation_at ? String(item.last_allocation_at) : null,
        activeAmount,
        activeCount: related.length,
        score: 0,
        reasons: [],
      }
    })
    setInvestors(computed)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const ranked = useMemo(() => {
    const requestAmount = Number(amount || 0)
    const activeInvestors = investors.filter(investor => !investor.rotation_paused)
    const maxContracts = Math.max(1, ...activeInvestors.map(investor => investor.activeCount))
    const oldest = [...activeInvestors]
      .sort((a, b) => new Date(a.last_allocation_at || 0).getTime() - new Date(b.last_allocation_at || 0).getTime())
      .map(investor => investor.id)

    return investors.map(investor => {
      const reasons: string[] = []
      if (investor.rotation_paused) return { ...investor, score: -9999, reasons: ['المستثمر موقوف مؤقتًا من التوزيع'] }

      const available = investor.capital_available || Math.max(0, investor.capital_total - investor.activeAmount)
      const capacityScore = requestAmount > 0 && available >= requestAmount ? 35 : requestAmount > 0 ? -100 : 10
      if (available >= requestAmount) reasons.push('الرصيد المتاح يغطي العملية')
      else reasons.push('الرصيد المتاح لا يغطي كامل العملية')

      const fairnessScore = ((maxContracts - investor.activeCount) / maxContracts) * 30
      if (investor.activeCount === Math.min(...activeInvestors.map(item => item.activeCount))) reasons.push('لديه أقل عدد من العمليات النشطة')

      const turnIndex = oldest.indexOf(investor.id)
      const rotationScore = turnIndex >= 0 ? Math.max(0, 25 - turnIndex * 3) : 0
      if (turnIndex === 0) reasons.push('الأقدم منذ آخر عملية')

      const limitExceeded = investor.max_active_amount > 0 && investor.activeAmount + requestAmount > investor.max_active_amount
      const limitScore = limitExceeded ? -100 : 5
      if (limitExceeded) reasons.push('سيتجاوز الحد الأعلى المسموح')

      const weightScore = Math.min(10, Math.max(0, investor.allocation_weight || 1) * 2)
      return {
        ...investor,
        score: Math.round((capacityScore + fairnessScore + rotationScore + limitScore + weightScore) * 10) / 10,
        reasons,
      }
    }).sort((a, b) => b.score - a.score)
  }, [amount, investors])

  const winner = ranked.find(investor => investor.score > 0)

  async function recordDecision() {
    if (!winner) {
      toast.error('لا يوجد مستثمر مؤهل للعملية الحالية')
      return
    }
    setRecording(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { error: insertError } = await supabase.from('investor_allocation_log').insert({
        investor_id: winner.id,
        requested_amount: Number(amount),
        decision_score: winner.score,
        decision_reason: winner.reasons.join('، '),
        allocated_by: userData.user?.id || null,
      })
      if (insertError) throw insertError

      await supabase.from('investors').update({ last_allocation_at: new Date().toISOString() }).eq('id', winner.id)
      toast.success(`تم تسجيل أولوية المستثمر ${winner.name}`)
      await fetchData()
    } catch (decisionError) {
      toast.error(decisionError instanceof Error ? decisionError.message : 'تعذر تسجيل قرار التوزيع')
    } finally {
      setRecording(false)
    }
  }

  async function togglePause(investor: InvestorScore) {
    const { error: updateError } = await supabase.from('investors').update({ rotation_paused: !investor.rotation_paused }).eq('id', investor.id)
    if (updateError) {
      toast.error('يتطلب هذا الإجراء تشغيل ملف الترقية في Supabase')
      return
    }
    toast.success(investor.rotation_paused ? 'تمت إعادة المستثمر للتوزيع' : 'تم إيقاف المستثمر مؤقتًا')
    fetchData()
  }

  if (loading) return <PageLoading label="جاري تحليل عدالة توزيع المستثمرين..." />
  if (error) return <PageError message={error} onRetry={fetchData} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">محرك التوزيع العادل</h1>
          <p className="mt-1 text-sm text-slate-400">ترتيب شفاف يعتمد على الدور، الرصيد المتاح، الحمل الحالي، والحدود المسموحة.</p>
        </div>
        <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-200"><RefreshCw className="w-4 h-4" /> تحديث</button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.5fr]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400"><CircleDollarSign className="w-6 h-6" /></div><div><h2 className="font-black text-white">عملية جديدة</h2><p className="text-xs text-slate-500">أدخل مبلغ العملية لحساب الأولوية</p></div></div>
            <label className="mt-6 mb-2 block text-xs font-bold text-slate-400">مبلغ التمويل المطلوب</label>
            <input value={amount} onChange={event => setAmount(event.target.value)} min="0" step="100" type="number" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-lg font-black text-white outline-none focus:border-emerald-500" />
          </div>

          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-slate-900 p-6">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-emerald-400">المرشح الأول</p><h3 className="mt-2 text-2xl font-black text-white">{winner?.name || 'لا يوجد مرشح'}</h3></div><Award className="w-10 h-10 text-emerald-400" /></div>
            {winner && <><p className="mt-4 text-sm text-slate-300">درجة الأولوية: <strong className="text-emerald-400">{winner.score}</strong></p><div className="mt-4 space-y-2">{winner.reasons.map(reason => <div key={reason} className="flex items-center gap-2 text-xs text-slate-400"><Sparkles className="w-3.5 h-3.5 text-emerald-400" />{reason}</div>)}</div><button disabled={recording} onClick={recordDecision} className="mt-6 w-full rounded-xl bg-emerald-500 py-3 font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{recording ? 'جاري التسجيل...' : 'تسجيل قرار التوزيع'}</button></>}
          </div>

          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 text-sm text-slate-300">
            <div className="flex gap-3"><Scale className="mt-0.5 w-5 h-5 shrink-0 text-sky-400" /><p className="leading-7">لا يعتمد النظام على الاسم أو الاختيار اليدوي وحده. كل قرار يُحفظ بدرجته وسببه ليتمكن المستثمر والإدارة من مراجعة عدالة التوزيع.</p></div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between border-b border-slate-800 p-5"><div><h2 className="font-black text-white">ترتيب المستثمرين</h2><p className="mt-1 text-xs text-slate-500">يتحدث فور تغيير مبلغ العملية</p></div><Users className="w-5 h-5 text-emerald-400" /></div>
          <div className="divide-y divide-slate-800">
            {ranked.map((investor, index) => {
              const available = investor.capital_available || Math.max(0, investor.capital_total - investor.activeAmount)
              return (
                <div key={investor.id} className={`p-5 ${index === 0 && investor.score > 0 ? 'bg-emerald-500/5' : ''}`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl font-black ${index === 0 && investor.score > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>{index + 1}</div><div><div className="flex items-center gap-2"><h3 className="font-black text-white">{investor.name}</h3>{investor.rotation_paused && <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-black text-rose-400">موقوف</span>}</div><p className="mt-1 text-xs text-slate-500">{investor.activeCount} عمليات • مستخدم {formatCurrency(investor.activeAmount)}</p></div></div>
                    <div className="flex items-center gap-4"><div className="text-left"><p className="text-[10px] text-slate-500">الرصيد المتاح</p><p className="font-black text-slate-200">{formatCurrency(available)}</p></div><div className="min-w-16 rounded-xl bg-slate-950 px-3 py-2 text-center"><p className="text-[10px] text-slate-500">الدرجة</p><p className={`font-black ${investor.score > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{investor.score}</p></div><button onClick={() => togglePause(investor)} className="rounded-lg bg-slate-800 p-2 text-slate-400 hover:text-white" title={investor.rotation_paused ? 'إعادة للتوزيع' : 'إيقاف مؤقت'}>{investor.rotation_paused ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}</button></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">{investor.reasons.map(reason => <span key={reason} className="rounded-lg bg-slate-800/70 px-2.5 py-1 text-[10px] font-bold text-slate-400">{reason}</span>)}</div>
                </div>
              )
            })}
            {ranked.length === 0 && <div className="p-12 text-center text-slate-500">لا يوجد مستثمرون نشطون.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
