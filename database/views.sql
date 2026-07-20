-- Fazza Financial ERP - Database Views

-- General Ledger View to display detailed transaction histories in a structured format
CREATE OR REPLACE VIEW public.vw_general_ledger AS
SELECT 
    ji.id AS item_id,
    ji.entry_id,
    je.entry_number,
    je.date,
    je.description AS entry_description,
    je.reference,
    ji.account_id,
    a.name_ar AS account_name_ar,
    a.name_en AS account_name_en,
    a.type AS account_type,
    ji.debit,
    ji.credit,
    ji.description AS item_description,
    je.created_at
FROM public.journal_items ji
JOIN public.journal_entries je ON ji.entry_id = je.id
JOIN public.accounts a ON ji.account_id = a.id
WHERE je.status = 'posted'
ORDER BY je.date ASC, je.entry_number ASC, ji.created_at ASC;


-- Investor Ledger View to query all investor-related transactions directly
CREATE OR REPLACE VIEW public.vw_investor_ledger AS
SELECT 
    v.id AS voucher_id,
    v.voucher_number,
    v.type AS voucher_type,
    v.date,
    v.amount,
    v.payment_method,
    v.description,
    v.investor_id,
    i.name AS investor_name,
    v.account_id,
    a1.name_ar AS account_name,
    v.target_account_id,
    a2.name_ar AS target_account_name,
    v.entry_id
FROM public.vouchers v
JOIN public.investors i ON v.investor_id = i.id
JOIN public.accounts a1 ON v.account_id = a1.id
JOIN public.accounts a2 ON v.target_account_id = a2.id
ORDER BY v.date DESC, v.created_at DESC;
