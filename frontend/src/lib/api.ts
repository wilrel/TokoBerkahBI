import axios, { isAxiosError } from 'axios';
import type {
  Category,
  ColumnMapping,
  ImportJob,
  InventoryAdjustInput,
  Product,
  ProductInput,
  Purchase,
  PurchaseInput,
  TransactionInput,
  UploadPreview,
  Workspace,
} from './types';

// Default: lewat proxy Next.js (lihat next.config.ts). Bisa diganti ke URL API langsung.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export const WORKSPACE_ID = 1;

export const api = axios.create({
  baseURL: API_URL,
});

export const initAuth = async () => {
  try {
    const params = new URLSearchParams();
    params.append('username', 'admin@toko.com');
    params.append('password', 'password');
    const res = await axios.post(`${API_URL}/auth/login`, params);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
    return true;
  } catch (error) {
    console.error("Login failed", error);
    return false;
  }
};

export const getWorkspaces = async (): Promise<Workspace[]> => {
  const res = await api.get('/workspaces');
  return res.data;
};

export const getProducts = async (): Promise<Product[]> => {
  const res = await api.get(`/workspaces/${WORKSPACE_ID}/products`);
  return res.data;
};

export const getCategories = async (): Promise<Category[]> => {
  const res = await api.get(`/workspaces/${WORKSPACE_ID}/categories`);
  return res.data;
};

export const createProduct = async (product: ProductInput): Promise<Product> => {
  const res = await api.post(`/products?workspace_id=${WORKSPACE_ID}`, product);
  return res.data;
};

export const createTransaction = async (transaction: TransactionInput) => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/transactions`, transaction);
  return res.data;
};

export const uploadImportFile = async (file: File): Promise<UploadPreview> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/imports/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const validateImportMapping = async (jobId: number, mapping: ColumnMapping): Promise<ImportJob> => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/imports/${jobId}/validate`, mapping);
  return res.data;
};

export const confirmImport = async (jobId: number, mapping: ColumnMapping) => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/imports/${jobId}/confirm`, mapping);
  return res.data;
};

export const getImports = async (): Promise<ImportJob[]> => {
  const res = await api.get(`/workspaces/${WORKSPACE_ID}/imports`);
  return res.data;
};

export const getPurchases = async (): Promise<Purchase[]> => {
  const res = await api.get(`/workspaces/${WORKSPACE_ID}/purchases`);
  return res.data;
};

export const createPurchase = async (purchase: PurchaseInput) => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/purchases`, purchase);
  return res.data;
};

export const adjustInventory = async (productId: number, adjust: InventoryAdjustInput) => {
  const res = await api.post(`/workspaces/${WORKSPACE_ID}/inventory/adjust?product_id=${productId}`, adjust);
  return res.data;
};

// ---------------------------------------------------------------- Reports

export const getDashboard = async (startDate: string, endDate: string) => {
  const res = await api.get(`/workspaces/${WORKSPACE_ID}/reports/dashboard`, {
    params: { start_date: startDate, end_date: endDate },
  });
  return res.data;
};

export const getProfitLoss = async (startDate: string, endDate: string) => {
  const res = await api.get(`/workspaces/${WORKSPACE_ID}/reports/profit-loss`, {
    params: { start_date: startDate, end_date: endDate },
  });
  return res.data;
};

/** Pesan error yang bisa dibaca manusia dari respons API. */
export const errorMessage = (e: unknown, fallback = 'Terjadi kesalahan. Coba lagi.') => {
  if (isAxiosError(e)) {
    const detail = e.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (!e.response) return 'Tidak bisa terhubung ke server API.';
  }
  return fallback;
};
