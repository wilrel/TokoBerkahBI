export type Product = {
  id: number;
  workspace_id: number;
  sku: string;
  name: string;
  unit: string;
  selling_price: number;
  current_hpp: number;
  current_stock: number;
  is_active: boolean;
  category_id: number | null;
  created_at: string;
  updated_at: string | null;
};

export type ProductInput = Pick<
  Product,
  'sku' | 'name' | 'unit' | 'selling_price' | 'current_hpp' | 'current_stock'
> & { category_id?: number | null; is_active?: boolean };

export type Category = { id: number; workspace_id: number; name: string; created_at: string };

export type TransactionInput = {
  payment_method: string;
  items: { product_id: number; quantity: number }[];
};

export type PurchaseItemInput = { product_id: number; quantity: number; unit_cost: number };

export type PurchaseInput = { supplier_name?: string; items: PurchaseItemInput[] };

export type Purchase = {
  id: number;
  workspace_id: number;
  supplier_name: string | null;
  total_amount: number;
  timestamp: string;
  items: (PurchaseItemInput & { id: number; product?: Product | null })[];
};

export type InventoryAdjustInput = { actual_stock: number; reason: string };

export type ImportError = { id: number; row_number: number; raw_data: string; error_message: string };

export type ImportJob = {
  id: number;
  filename: string;
  status: 'PENDING' | 'VALIDATING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  created_at: string;
  completed_at: string | null;
  errors: ImportError[];
};

export type ColumnMapping = { date_col: string; sku_col: string; quantity_col: string; price_col: string };

export type UploadPreview = {
  job_id: number;
  filename: string;
  columns: string[];
  preview_data: Record<string, string | number>[];
};

export type Workspace = {
  id: number;
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  created_at: string;
};

export type Membership = { workspace_id: number; workspace_name: string; role: import('./roles').Role };

export type Me = { id: number; email: string; name: string | null; memberships: Membership[] };

export type Member = {
  user_id: number;
  email: string;
  name: string | null;
  role: import('./roles').Role;
  joined_at: string;
  new_account?: boolean;
};
