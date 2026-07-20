-- Fazza Financial ERP - Performance Indexes

-- Index on Accounts hierarchy
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON public.accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(type);

-- Indexes on Journal entries and items for quick Ledger / Trial Balance queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON public.journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_items_entry ON public.journal_items(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_items_account ON public.journal_items(account_id);

-- Indexes on Investors and Contracts for quick business listings
CREATE INDEX IF NOT EXISTS idx_contracts_investor ON public.contracts(investor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);

-- Indexes on Vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_account ON public.vouchers(account_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_target_account ON public.vouchers(target_account_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_investor ON public.vouchers(investor_id);

-- Indexes on Profit Distributions
CREATE INDEX IF NOT EXISTS idx_profit_items_dist ON public.profit_distribution_items(distribution_id);
CREATE INDEX IF NOT EXISTS idx_profit_items_investor ON public.profit_distribution_items(investor_id);

-- Index on Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
