// Fazza Financial ERP - TypeScript Types and Definitions

export type UserRole = 'admin' | 'accountant' | 'manager' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string; // e.g. "111101"
  name_ar: string;
  name_en: string;
  parent_id: string | null;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  is_ledger: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Investor {
  id: string;
  name: string;
  national_id: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank_name: string | null;
  iban: string | null;
  status: 'active' | 'inactive';
  capital_total?: number;
  capital_available?: number;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  contract_number: string;
  investor_id: string;
  amount: number;
  profit_percentage: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'terminated';
  created_at: string;
  updated_at: string;
  // Join helper
  investor?: Investor;
}

export interface JournalItem {
  id?: string;
  entry_id?: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string;
  created_at?: string;
  // Join helper
  account?: Account;
}

export interface JournalEntry {
  id: string;
  entry_number: number;
  date: string;
  description: string;
  reference: string | null;
  status: 'draft' | 'posted' | 'voided';
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: JournalItem[];
}

export interface Voucher {
  id: string;
  voucher_number: string;
  type: 'receipt' | 'payment';
  date: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'check';
  account_id: string; // Cash/Bank
  target_account_id: string; // Counter account
  investor_id: string | null;
  contract_id: string | null;
  description: string;
  entry_id: string | null;
  created_at: string;
  // Join helpers
  account?: Account;
  target_account?: Account;
  investor?: Investor;
  contract?: Contract;
}

export interface ProfitDistribution {
  id: string;
  distribution_number: string;
  date: string;
  total_amount: number;
  status: 'draft' | 'approved';
  entry_id: string | null;
  created_at: string;
  items?: ProfitDistributionItem[];
}

export interface ProfitDistributionItem {
  id: string;
  distribution_id: string;
  investor_id: string;
  contract_id: string;
  amount: number;
  status: 'pending' | 'paid';
  payment_date: string | null;
  created_at: string;
  // Join helpers
  investor?: Investor;
  contract?: Contract;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_values: any | null;
  new_values: any | null;
  created_at: string;
}

export interface TrialBalanceRow {
  account_id: string;
  name_ar: string;
  name_en: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export interface IncomeStatementRow {
  category: 'revenue' | 'expense';
  account_id: string;
  account_name: string;
  amount: number;
}
