-- Fazza Financial ERP - Database Functions (PL/pgSQL)

-- 1. Get Balance of a Specific Account for a Date Range
CREATE OR REPLACE FUNCTION public.get_account_balance(
    p_account_id TEXT,
    p_start_date DATE DEFAULT '1970-01-01',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_type TEXT;
    v_total_debit NUMERIC(15, 2) := 0;
    v_total_credit NUMERIC(15, 2) := 0;
    v_balance NUMERIC(15, 2) := 0;
BEGIN
    -- Get Account Type
    SELECT type INTO v_type FROM public.accounts WHERE id = p_account_id;
    
    IF v_type IS NULL THEN
        RETURN 0.00;
    END IF;

    -- Sum Debits and Credits
    SELECT COALESCE(SUM(ji.debit), 0), COALESCE(SUM(ji.credit), 0)
    INTO v_total_debit, v_total_credit
    FROM public.journal_items ji
    JOIN public.journal_entries je ON ji.entry_id = je.id
    WHERE ji.account_id = p_account_id
      AND je.status = 'posted'
      AND je.date BETWEEN p_start_date AND p_end_date;

    -- Calculate Balance based on standard debit/credit rules
    IF v_type IN ('asset', 'expense') THEN
        v_balance := v_total_debit - v_total_credit;
    ELSE -- liability, equity, revenue
        v_balance := v_total_credit - v_total_debit;
    END IF;

    RETURN v_balance;
END;
$$;

-- 2. Fetch Trial Balance for a Specific Date Range
CREATE OR REPLACE FUNCTION public.get_trial_balance(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    account_id TEXT,
    name_ar TEXT,
    name_en TEXT,
    type TEXT,
    opening_debit NUMERIC(15, 2),
    opening_credit NUMERIC(15, 2),
    period_debit NUMERIC(15, 2),
    period_credit NUMERIC(15, 2),
    closing_debit NUMERIC(15, 2),
    closing_credit NUMERIC(15, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH opening_balances AS (
        -- Balances before the period
        SELECT 
            ji.account_id,
            COALESCE(SUM(ji.debit), 0) AS op_debit,
            COALESCE(SUM(ji.credit), 0) AS op_credit
        FROM public.journal_items ji
        JOIN public.journal_entries je ON ji.entry_id = je.id
        WHERE je.status = 'posted' AND je.date < p_start_date
        GROUP BY ji.account_id
    ),
    period_movements AS (
        -- Debits & Credits inside the period
        SELECT 
            ji.account_id,
            COALESCE(SUM(ji.debit), 0) AS pr_debit,
            COALESCE(SUM(ji.credit), 0) AS pr_credit
        FROM public.journal_items ji
        JOIN public.journal_entries je ON ji.entry_id = je.id
        WHERE je.status = 'posted' AND je.date BETWEEN p_start_date AND p_end_date
        GROUP BY ji.account_id
    )
    SELECT 
        a.id AS account_id,
        a.name_ar,
        a.name_en,
        a.type,
        COALESCE(op.op_debit, 0.00) AS opening_debit,
        COALESCE(op.op_credit, 0.00) AS opening_credit,
        COALESCE(pm.pr_debit, 0.00) AS period_debit,
        COALESCE(pm.pr_credit, 0.00) AS period_credit,
        -- Total Debits & Credits
        (COALESCE(op.op_debit, 0.00) + COALESCE(pm.pr_debit, 0.00)) AS closing_debit,
        (COALESCE(op.op_credit, 0.00) + COALESCE(pm.pr_credit, 0.00)) AS closing_credit
    FROM public.accounts a
    LEFT JOIN opening_balances op ON a.id = op.account_id
    LEFT JOIN period_movements pm ON a.id = pm.account_id
    WHERE a.is_ledger = true
    ORDER BY a.id;
END;
$$;

-- 3. Calculate Income Statement Summary
CREATE OR REPLACE FUNCTION public.get_income_statement(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    category TEXT, -- 'revenue' or 'expense'
    account_id TEXT,
    account_name TEXT,
    amount NUMERIC(15, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.type AS category,
        a.id AS account_id,
        a.name_ar AS account_name,
        -- Balance of revenue is credit-debit, expense is debit-credit
        CASE 
            WHEN a.type = 'revenue' THEN COALESCE(SUM(ji.credit - ji.debit), 0)
            ELSE COALESCE(SUM(ji.debit - ji.credit), 0)
        END AS amount
    FROM public.accounts a
    JOIN public.journal_items ji ON a.id = ji.account_id
    JOIN public.journal_entries je ON ji.entry_id = je.id
    WHERE je.status = 'posted'
      AND a.type IN ('revenue', 'expense')
      AND je.date BETWEEN p_start_date AND p_end_date
    GROUP BY a.type, a.id, a.name_ar
    HAVING COALESCE(SUM(ji.credit), 0) != 0 OR COALESCE(SUM(ji.debit), 0) != 0
    ORDER BY a.type, a.id;
END;
$$;
