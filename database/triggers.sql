-- Fazza Financial ERP - Database Triggers

-- 1. Enforce Double-Entry Balance Verification before Posting
CREATE OR REPLACE FUNCTION public.fn_check_journal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_debit NUMERIC(15, 2) := 0;
    v_total_credit NUMERIC(15, 2) := 0;
    v_item_count INT := 0;
BEGIN
    -- Only check if transitioning to 'posted' status
    IF NEW.status = 'posted' THEN
        -- Sum journal items for this entry
        SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0), COUNT(*)
        INTO v_total_debit, v_total_credit, v_item_count
        FROM public.journal_items
        WHERE entry_id = NEW.id;

        -- Must have at least 2 items
        IF v_item_count < 2 THEN
            RAISE EXCEPTION 'خطأ محاسبي: يجب أن يحتوي القيد على بندين على الأقل (مدين ودائن)';
        END IF;

        -- Must be balanced (total debit = total credit)
        IF v_total_debit != v_total_credit THEN
            RAISE EXCEPTION 'قيد اليومية غير متوازن: مجموع المدين (%).2f ومجموع الدائن (%).2f يجب أن يتساويا تماماً ليتم الترحيل.', v_total_debit, v_total_credit;
        END IF;

        -- Must have positive value
        IF v_total_debit <= 0 THEN
            RAISE EXCEPTION 'خطأ محاسبي: لا يمكن ترحيل قيد يومية بمبلغ صفر أو سالب.';
        END IF;
    END IF;

    -- Avoid editing or deleting posted entries
    IF OLD.status = 'posted' AND NEW.status = 'posted' AND NEW.entry_number != OLD.entry_number THEN
        RAISE EXCEPTION 'لا يمكن تعديل القيود المحاسبية بعد ترحيلها.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_check_journal_balance
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_journal_balance();


-- 2. Audit Logging System Trigger Function
CREATE OR REPLACE FUNCTION public.fn_create_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_record_id TEXT;
BEGIN
    -- Try to capture the current authenticated user's ID and email from Supabase context
    BEGIN
        v_user_id := auth.uid();
        v_user_email := auth.email();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
        v_user_email := 'system_process';
    END;

    IF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_record_id := OLD.id::TEXT;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
    ELSIF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
    END IF;

    -- Insert into audit log table
    INSERT INTO public.audit_logs (
        user_id,
        user_email,
        action,
        table_name,
        record_id,
        old_values,
        new_values
    ) VALUES (
        v_user_id,
        v_user_email,
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        v_old_data,
        v_new_data
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Create Audit Triggers for Essential Financial and Business Tables
CREATE OR REPLACE TRIGGER trg_audit_investors
AFTER INSERT OR UPDATE OR DELETE ON public.investors
FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_contracts
AFTER INSERT OR UPDATE OR DELETE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_journal_entries
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_vouchers
AFTER INSERT OR UPDATE OR DELETE ON public.vouchers
FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_profit_distributions
AFTER INSERT OR UPDATE OR DELETE ON public.profit_distributions
FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();
