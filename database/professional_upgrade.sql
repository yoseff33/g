-- =============================================================
-- Fazza ERP Professional Upgrade
-- Run this file once from Supabase SQL Editor.
-- It is designed to be safe on new and existing databases.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  national_id TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  address TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','blocked')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Professional installment contracts
CREATE TABLE IF NOT EXISTS public.installment_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serial_number BIGSERIAL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE RESTRICT,
  guarantor_name TEXT,
  guarantor_id_number TEXT,
  guarantor_phone TEXT,
  total_amount NUMERIC(15,2) NOT NULL CHECK (total_amount > 0),
  installment_amount NUMERIC(15,2) NOT NULL CHECK (installment_amount > 0),
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  cost_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (cost_amount >= 0),
  start_date DATE NOT NULL,
  end_date DATE,
  sale_type TEXT NOT NULL DEFAULT 'deferred' CHECK (sale_type IN ('deferred','finance')),
  finance_company TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','active','due_soon','due','overdue','paid','closed','cancelled')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add new contract columns safely if the table already existed
ALTER TABLE public.installment_contracts ADD COLUMN IF NOT EXISTS cost_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.installment_contracts ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.installment_contracts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.installment_contracts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.installment_contracts ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.installment_contracts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.installment_contracts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Installments and balances
CREATE TABLE IF NOT EXISTS public.contract_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.installment_contracts(id) ON DELETE CASCADE,
  installment_number INTEGER,
  due_date DATE NOT NULL,
  amount_due NUMERIC(15,2) NOT NULL CHECK (amount_due > 0),
  amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','waived')),
  payment_date DATE,
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id, installment_number)
);

ALTER TABLE public.contract_payments ADD COLUMN IF NOT EXISTS installment_number INTEGER;
ALTER TABLE public.contract_payments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.contract_payments ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE public.contract_payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.contract_payments ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.contract_payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.contract_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Immutable detail for every payment, including partial payments
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES public.contract_payments(id) ON DELETE RESTRICT,
  contract_id UUID NOT NULL REFERENCES public.installment_contracts(id) ON DELETE RESTRICT,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','bank_transfer','card','payment_link','other')),
  reference_number TEXT,
  notes TEXT,
  received_by UUID REFERENCES public.profiles(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES public.profiles(id),
  reversal_reason TEXT
);

-- Collection history: WhatsApp, calls, promises, visits and notes
CREATE TABLE IF NOT EXISTS public.collection_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.installment_contracts(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.contract_payments(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('whatsapp','call','promise_to_pay','visit','note','payment','escalation')),
  notes TEXT,
  promised_payment_date DATE,
  outcome TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approval workflow
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(15,2),
  entity_type TEXT,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_by UUID REFERENCES public.profiles(id),
  reviewed_by UUID REFERENCES public.profiles(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Investor portal and fair distribution fields
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS capital_total NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS capital_available NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS max_active_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS allocation_weight NUMERIC(8,2) NOT NULL DEFAULT 1;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS rotation_paused BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS last_allocation_at TIMESTAMPTZ;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS distribution_frequency TEXT NOT NULL DEFAULT 'monthly';

CREATE TABLE IF NOT EXISTS public.investor_allocation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE RESTRICT,
  contract_id UUID REFERENCES public.installment_contracts(id) ON DELETE SET NULL,
  requested_amount NUMERIC(15,2) NOT NULL CHECK (requested_amount > 0),
  decision_score NUMERIC(10,2),
  decision_reason TEXT NOT NULL,
  allocated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Internal notification center
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_target TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'info',
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for daily operational screens
CREATE INDEX IF NOT EXISTS idx_contract_payments_due_status ON public.contract_payments(status, due_date);
CREATE INDEX IF NOT EXISTS idx_contract_payments_contract ON public.contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_installment_contracts_investor_status ON public.installment_contracts(investor_id, status);
CREATE INDEX IF NOT EXISTS idx_installment_contracts_customer ON public.installment_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_collection_activities_contract_created ON public.collection_activities(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status_created ON public.approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_allocation_log_investor_created ON public.investor_allocation_log(investor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- Atomic partial/full payment registration
CREATE OR REPLACE FUNCTION public.register_installment_payment(
  p_payment_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.contract_payments%ROWTYPE;
  v_new_paid NUMERIC(15,2);
  v_transaction_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT * INTO v_payment
  FROM public.contract_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;

  v_new_paid := COALESCE(v_payment.amount_paid, 0) + p_amount;
  IF v_new_paid > v_payment.amount_due THEN
    RAISE EXCEPTION 'Payment exceeds remaining installment balance';
  END IF;

  INSERT INTO public.payment_transactions (
    payment_id, contract_id, amount, payment_method, reference_number, notes, received_by
  ) VALUES (
    v_payment.id, v_payment.contract_id, p_amount, p_method, p_reference, p_notes, auth.uid()
  ) RETURNING id INTO v_transaction_id;

  UPDATE public.contract_payments
  SET amount_paid = v_new_paid,
      status = CASE WHEN v_new_paid >= amount_due THEN 'paid' ELSE 'partial' END,
      payment_date = CURRENT_DATE,
      payment_method = p_method,
      reference_number = p_reference,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO public.collection_activities (
    contract_id, payment_id, activity_type, notes, created_by
  ) VALUES (
    v_payment.contract_id,
    v_payment.id,
    'payment',
    concat('دفعة بقيمة ', p_amount, ' ريال، الطريقة: ', p_method, COALESCE('، المرجع: ' || p_reference, '')),
    auth.uid()
  );

  RETURN v_transaction_id;
END;
$$;

-- Report used by ContractsReport and CustomReports
CREATE OR REPLACE VIEW public.vw_contracts_report AS
SELECT
  ic.id AS contract_id,
  ic.serial_number,
  ic.investor_id,
  i.name AS investor_name,
  c.id AS customer_id,
  c.name AS customer_name,
  c.national_id AS customer_id_num,
  c.phone,
  ic.guarantor_name,
  ic.guarantor_id_number,
  ic.guarantor_phone,
  ic.total_amount,
  ic.installment_amount,
  ic.discount_amount,
  ic.cost_amount,
  ic.start_date,
  ic.end_date,
  ic.sale_type,
  ic.finance_company,
  ic.status,
  COALESCE(SUM(cp.amount_paid), 0) AS total_paid,
  GREATEST(ic.total_amount - ic.discount_amount - COALESCE(SUM(cp.amount_paid), 0), 0) AS remaining_amount,
  COALESCE(SUM(
    CASE WHEN cp.status <> 'paid' AND cp.due_date < CURRENT_DATE
      THEN GREATEST(cp.amount_due - COALESCE(cp.amount_paid, 0), 0)
      ELSE 0 END
  ), 0) AS late_amount,
  MIN(cp.due_date) FILTER (WHERE cp.status <> 'paid') AS next_due_date,
  ic.created_at,
  ic.updated_at
FROM public.installment_contracts ic
JOIN public.customers c ON c.id = ic.customer_id
JOIN public.investors i ON i.id = ic.investor_id
LEFT JOIN public.contract_payments cp ON cp.contract_id = ic.id
GROUP BY ic.id, i.id, c.id;

-- RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_allocation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies are created only when missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='Authenticated read customers') THEN
    CREATE POLICY "Authenticated read customers" ON public.customers FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='Operations manage customers') THEN
    CREATE POLICY "Operations manage customers" ON public.customers FOR ALL TO authenticated USING (public.get_user_role() IN ('admin','accountant','manager')) WITH CHECK (public.get_user_role() IN ('admin','accountant','manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='installment_contracts' AND policyname='Authenticated read installment contracts') THEN
    CREATE POLICY "Authenticated read installment contracts" ON public.installment_contracts FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='installment_contracts' AND policyname='Operations manage installment contracts') THEN
    CREATE POLICY "Operations manage installment contracts" ON public.installment_contracts FOR ALL TO authenticated USING (public.get_user_role() IN ('admin','accountant','manager')) WITH CHECK (public.get_user_role() IN ('admin','accountant','manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_payments' AND policyname='Authenticated read contract payments') THEN
    CREATE POLICY "Authenticated read contract payments" ON public.contract_payments FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contract_payments' AND policyname='Finance manage contract payments') THEN
    CREATE POLICY "Finance manage contract payments" ON public.contract_payments FOR ALL TO authenticated USING (public.get_user_role() IN ('admin','accountant','manager')) WITH CHECK (public.get_user_role() IN ('admin','accountant','manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transactions' AND policyname='Finance read payment transactions') THEN
    CREATE POLICY "Finance read payment transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (public.get_user_role() IN ('admin','accountant','manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transactions' AND policyname='Finance create payment transactions') THEN
    CREATE POLICY "Finance create payment transactions" ON public.payment_transactions FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('admin','accountant','manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='collection_activities' AND policyname='Staff manage collection activities') THEN
    CREATE POLICY "Staff manage collection activities" ON public.collection_activities FOR ALL TO authenticated USING (public.get_user_role() IN ('admin','accountant','manager')) WITH CHECK (public.get_user_role() IN ('admin','accountant','manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='approval_requests' AND policyname='Staff read approval requests') THEN
    CREATE POLICY "Staff read approval requests" ON public.approval_requests FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='approval_requests' AND policyname='Staff create approval requests') THEN
    CREATE POLICY "Staff create approval requests" ON public.approval_requests FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid() OR requested_by IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='approval_requests' AND policyname='Managers review approval requests') THEN
    CREATE POLICY "Managers review approval requests" ON public.approval_requests FOR UPDATE TO authenticated USING (public.get_user_role() IN ('admin','manager')) WITH CHECK (public.get_user_role() IN ('admin','manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='investor_allocation_log' AND policyname='Authenticated read allocation log') THEN
    CREATE POLICY "Authenticated read allocation log" ON public.investor_allocation_log FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='investor_allocation_log' AND policyname='Managers create allocation log') THEN
    CREATE POLICY "Managers create allocation log" ON public.investor_allocation_log FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('admin','manager','accountant'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Users read own notifications') THEN
    CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR role_target = public.get_user_role());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Managers create notifications') THEN
    CREATE POLICY "Managers create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('admin','manager','accountant'));
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.register_installment_payment(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT SELECT ON public.vw_contracts_report TO authenticated;
