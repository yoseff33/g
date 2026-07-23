import { useState } from 'react'
import ApproveAssignModal from './ApproveAssignModal'
import type { OperationSource } from '../lib/investorAssignment'

interface OperationRow {
  id: string
  source: OperationSource
  contract_number?: string | null
}

export default function ExampleUsage({
  row,
  refresh,
}: {
  row: OperationRow
  refresh: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white"
      >
        اعتماد وإسناد
      </button>

      <ApproveAssignModal
        open={open}
        operationId={row.id}
        source={row.source}
        operationLabel={row.contract_number || 'العملية'}
        onClose={() => setOpen(false)}
        onSuccess={refresh}
      />
    </>
  )
}
