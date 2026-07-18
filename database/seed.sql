-- Fazza Financial ERP Seed Data
-- Saudi Standard Chart of Accounts

-- Root Accounts & Sub-Accounts
INSERT INTO public.accounts (id, name_ar, name_en, parent_id, type, is_ledger, is_active) VALUES
-- 1. Assets
('100000', 'الأصول', 'Assets', NULL, 'asset', false, true),
('110000', 'الأصول المتداولة', 'Current Assets', '100000', 'asset', false, true),
('111000', 'النقد وما في حكمه', 'Cash and Cash Equivalents', '110000', 'asset', false, true),
('111101', 'الصندوق الرئيسي', 'Main Safe Cash', '111000', 'asset', true, true),
('111201', 'بنك الراجحي الرئيسي', 'Al-Rajhi Bank Main Account', '111000', 'asset', true, true),
('112000', 'ذمم ومستحقات المستثمرين', 'Investor Receivables', '110000', 'asset', false, true),
('112101', 'حساب مديني الاستثمار', 'Investment Receivables Ledger', '112000', 'asset', true, true),

('120000', 'الأصول غير المتداولة', 'Non-Current Assets', '100000', 'asset', false, true),
('121000', 'العقارات والآلات والمعدات', 'Property, Plant and Equipment', '120000', 'asset', false, true),
('121101', 'المعدات المكتبية', 'Office Equipment', '121000', 'asset', true, true),

-- 2. Liabilities
('200000', 'الالتزامات', 'Liabilities', NULL, 'liability', false, true),
('210000', 'الالتزامات المتداولة', 'Current Liabilities', '200000', 'liability', false, true),
('211000', 'توزيعات أرباح مستحقة للمستثمرين', 'Accrued Dividends to Investors', '210000', 'liability', false, true),
('211101', 'حساب أرباح مستحقة التوزيع', 'Accrued Dividends Ledger', '211000', 'liability', true, true),
('212000', 'الدائنون والذمم الدائنة الأخرى', 'Accounts Payable and Accruals', '210000', 'liability', false, true),
('212101', 'حساب الموردين الرئيسي', 'Main Trade Payables', '212000', 'liability', true, true),

-- 3. Equity
('300000', 'حقوق الملكية', 'Equity', NULL, 'equity', false, true),
('310000', 'رأس المال المدفوع', 'Paid-in Capital', '300000', 'equity', false, true),
('311000', 'رأس مال المستثمرين', 'Investors Share Capital', '310000', 'equity', false, true),
('311101', 'رأس مال المستثمرين الرئيسي', 'Investors Capital Ledger', '311000', 'equity', true, true),
('320000', 'الأرباح المبقاة والمحتجزة', 'Retained Earnings', '300000', 'equity', false, true),
('321101', 'حساب الأرباح المحتجزة', 'Retained Earnings Ledger', '320000', 'equity', true, true),

-- 4. Revenues
('400000', 'الإيرادات', 'Revenues', NULL, 'revenue', false, true),
('410000', 'الإيرادات التشغيلية', 'Operating Revenues', '400000', 'revenue', false, true),
('411000', 'إيرادات الاستثمارات العقارية والتجارية', 'Real Estate & Commercial Revenues', '410000', 'revenue', false, true),
('411101', 'إيرادات المشاريع التشغيلية', 'Project Revenues Ledger', '411000', 'revenue', true, true),

-- 5. Expenses
('500000', 'المصروفات', 'Expenses', NULL, 'expense', false, true),
('510000', 'المصروفات التشغيلية والعمومية', 'Operating & Administrative Expenses', '500000', 'expense', false, true),
('511000', 'الإيجارات والمرافق الحكومية', 'Rents & Government Utilities', '510000', 'expense', false, true),
('511101', 'مصروف إيجار المقر', 'Office Rent Expense', '511000', 'expense', true, true),
('511102', 'الرسوم الحكومية والتراخيص', 'Government Fees & Licensing', '511000', 'expense', true, true),
('520000', 'المصروفات التمويلية والبنكية', 'Financial & Bank Expenses', '500000', 'expense', false, true),
('521000', 'العمولات البنكية والمصرفية', 'Bank Commissions', '520000', 'expense', false, true),
('521101', 'مصروف العمولات البنكية', 'Bank Commissions Ledger', '521000', 'expense', true, true)
ON CONFLICT (id) DO NOTHING;
