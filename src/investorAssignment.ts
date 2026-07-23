import { supabase } from './supabase'

export type OperationSource =
  | 'contracts'
  | 'installment_contracts'
  | 'vouchers'

export interface InvestorOption {
  id: string
  name: string
  status?: string | null
  capital_total?: number | null
  capital_available?: number | null
}

export interface AssignOperationInput {
  source: OperationSource
  operationId: string
  investorId: string
  notes?: string
}

export interface AssignOperationResult {
  success: boolean
  source: OperationSource
  operation_id: string
  previous_investor_id: string | null
  investor_id: string
  investor_name: string
}

export async function fetchActiveInvestors(): Promise<InvestorOption[]> {
  const { data, error } = await supabase
    .from('investors')
    .select('id,name,status,capital_total,capital_available')
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    ...row,
    name: String(row.name ?? '').trim(),
  }))
}

export async function assignOperationToInvestor(
  input: AssignOperationInput,
): Promise<AssignOperationResult> {
  if (!input.operationId) {
    throw new Error('معرف العملية غير موجود')
  }

  if (!input.investorId) {
    throw new Error('اختر المستثمر أولًا')
  }

  const { data, error } = await supabase.rpc(
    'assign_operation_to_investor',
    {
      p_source: input.source,
      p_operation_id: input.operationId,
      p_investor_id: input.investorId,
      p_notes: input.notes?.trim() || null,
    },
  )

  if (error) throw new Error(error.message)

  const result = data as AssignOperationResult | null

  if (!result?.success) {
    throw new Error('لم يتم إسناد العملية')
  }

  return result
}
