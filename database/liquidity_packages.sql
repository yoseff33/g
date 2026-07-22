-- Dynamic liquidity packages module
CREATE TABLE IF NOT EXISTS public.liquidity_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  base_amount NUMERIC(15,2) NOT NULL CHECK (base_amount > 0),
  total_product_price NUMERIC(15,2) NOT NULL CHECK (total_product_price > 0),
  customer_transfer_when_customer_pays NUMERIC(15,2) NOT NULL DEFAULT 0,
  customer_transfer_when_platform_pays NUMERIC(15,2) NOT NULL DEFAULT 0,
  first_payment_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  adjustment_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  duration_months INTEGER NOT NULL DEFAULT 4 CHECK (duration_months > 0),
  installments_count INTEGER NOT NULL DEFAULT 4 CHECK (installments_count > 0),
  investor_percentage NUMERIC(5,2) NOT NULL DEFAULT 70,
  application_percentage NUMERIC(5,2) NOT NULL DEFAULT 20,
  owner_percentage NUMERIC(5,2) NOT NULL DEFAULT 10,
  finance_company TEXT,
  min_investor_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_to_customers BOOLEAN NOT NULL DEFAULT false,
  valid_from DATE,
  valid_until DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT liquidity_package_percentages CHECK (
    investor_percentage + application_percentage + owner_percentage = 100
  )
);

CREATE TABLE IF NOT EXISTS public.liquidity_package_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES public.liquidity_packages(id) ON DELETE RESTRICT,
  package_snapshot JSONB NOT NULL,
  customer_name TEXT NOT NULL,
  customer_national_id TEXT,
  customer_phone TEXT,
  first_payment_mode TEXT NOT NULL CHECK (first_payment_mode IN ('customer','platform')),
  source_type TEXT NOT NULL DEFAULT 'fazza' CHECK (source_type IN ('fazza','investor_referral')),
  referring_investor_id UUID REFERENCES public.investors(id),
  assigned_investor_id UUID NOT NULL REFERENCES public.investors(id),
  allocation_reason TEXT,
  total_product_price NUMERIC(15,2) NOT NULL,
  customer_transfer NUMERIC(15,2) NOT NULL,
  first_payment_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  capital_used NUMERIC(15,2) NOT NULL,
  investor_share NUMERIC(15,2) NOT NULL,
  application_share NUMERIC(15,2) NOT NULL,
  owner_share NUMERIC(15,2) NOT NULL,
  investor_net_profit NUMERIC(15,2) NOT NULL,
  adjustment_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','completed','cancelled')),
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liquidity_packages_active ON public.liquidity_packages(is_active, base_amount);
CREATE INDEX IF NOT EXISTS idx_liquidity_package_orders_investor ON public.liquidity_package_orders(assigned_investor_id, created_at);

ALTER TABLE public.liquidity_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_package_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS liquidity_packages_read ON public.liquidity_packages;
CREATE POLICY liquidity_packages_read ON public.liquidity_packages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS liquidity_packages_write ON public.liquidity_packages;
CREATE POLICY liquidity_packages_write ON public.liquidity_packages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager','accountant')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager','accountant')));

DROP POLICY IF EXISTS liquidity_orders_read ON public.liquidity_package_orders;
CREATE POLICY liquidity_orders_read ON public.liquidity_package_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS liquidity_orders_write ON public.liquidity_package_orders;
CREATE POLICY liquidity_orders_write ON public.liquidity_package_orders FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager','accountant')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager','accountant')));

INSERT INTO public.liquidity_packages (
  name, slug, base_amount, total_product_price,
  customer_transfer_when_customer_pays, customer_transfer_when_platform_pays,
  first_payment_amount, adjustment_amount, duration_months, installments_count
) VALUES
('باقة 500', 'package-500', 500, 1252, 500, 500, 313, 0, 4, 4),
('باقة 600', 'package-600', 600, 1500, 600, 600, 375, 0, 4, 4),
('باقة 800', 'package-800', 800, 2000, 800, 800, 0, 0, 4, 4),
('باقة 1000', 'package-1000', 1000, 2500, 1000, 650, 338, 12, 4, 4),
('باقة 1500', 'package-1500', 1500, 3752, 1500, 1500, 0, 0, 4, 4)
ON CONFLICT (slug) DO NOTHING;
