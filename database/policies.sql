-- Fazza Financial ERP - Row Level Security Policies (Supabase RLS)

-- Helper function to fetch the current authenticated user's ERP role safely
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Enable RLS and define Policies for Profiles
CREATE POLICY "Allow public read on profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow update on own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Admin full power on profiles" ON public.profiles
    FOR ALL TO authenticated USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');


-- Policies for Chart of Accounts (accounts)
CREATE POLICY "Allow read on accounts" ON public.accounts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write on accounts for finance staff" ON public.accounts
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('admin', 'accountant', 'manager'))
    WITH CHECK (public.get_user_role() IN ('admin', 'accountant', 'manager'));


-- Policies for Investors (investors)
CREATE POLICY "Allow read on investors" ON public.investors
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write on investors for operations staff" ON public.investors
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('admin', 'accountant', 'manager'))
    WITH CHECK (public.get_user_role() IN ('admin', 'accountant', 'manager'));


-- Policies for Contracts (contracts)
CREATE POLICY "Allow read on contracts" ON public.contracts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write on contracts for authorized staff" ON public.contracts
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('admin', 'accountant', 'manager'))
    WITH CHECK (public.get_user_role() IN ('admin', 'accountant', 'manager'));


-- Policies for Journal Entries (journal_entries)
CREATE POLICY "Allow read on journal entries" ON public.journal_entries
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write on journal entries for accountants" ON public.journal_entries
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('admin', 'accountant'))
    WITH CHECK (public.get_user_role() IN ('admin', 'accountant'));


-- Policies for Journal Items (journal_items)
CREATE POLICY "Allow read on journal items" ON public.journal_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write on journal items for accountants" ON public.journal_items
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('admin', 'accountant'))
    WITH CHECK (public.get_user_role() IN ('admin', 'accountant'));


-- Policies for Vouchers (vouchers)
CREATE POLICY "Allow read on vouchers" ON public.vouchers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write on vouchers for accountants" ON public.vouchers
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('admin', 'accountant'))
    WITH CHECK (public.get_user_role() IN ('admin', 'accountant'));


-- Policies for Profit Distributions
CREATE POLICY "Allow read on profit distributions" ON public.profit_distributions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write on profit distributions for accountants" ON public.profit_distributions
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('admin', 'accountant'))
    WITH CHECK (public.get_user_role() IN ('admin', 'accountant'));


-- Policies for Profit Distribution Items
CREATE POLICY "Allow read on profit distribution items" ON public.profit_distribution_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write on profit distribution items for accountants" ON public.profit_distribution_items
    FOR ALL TO authenticated 
    USING (public.get_user_role() IN ('admin', 'accountant'))
    WITH CHECK (public.get_user_role() IN ('admin', 'accountant'));


-- Policies for Audit Logs
CREATE POLICY "Allow admin to view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated USING (public.get_user_role() = 'admin');
