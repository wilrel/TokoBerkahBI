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
  Me,
  Member,
} from './types';
import type { Role } from './roles';

// Default: lewat proxy Next.js (lihat next.config.ts). Bisa diganti ke URL API langsung.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export const api = axios.create({
  baseURL: API_URL,
});

// ---------------------------------------------------------------- Sesi

const TOKEN_KEY = 'tb_token';
const WORKSPACE_KEY = 'tb_workspace';

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* mode privat: sesi hanya bertahan selama tab terbuka */
    }
  },
};

let workspaceId: number | null = null;

/** Toko yang sedang aktif. Diatur oleh AuthProvider setelah login. */
export const setWorkspaceId = (id: number | null) => {
  workspaceId = id;
  storage.set(WORKSPACE_KEY, id == null ? null : String(id));
};

export const getStoredWorkspaceId = () => {
  const v = storage.get(WORKSPACE_KEY);
  return v ? Number(v) : null;
};

const ws = () => {
  if (workspaceId == null) throw new Error('Belum ada toko yang dipilih.');
  return workspaceId;
};

export const getToken = () => storage.get(TOKEN_KEY);

const applyToken = (token: string | null) => {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete api.defaults.headers.common['Authorization'];
};
if (typeof window !== 'undefined') applyToken(getToken());

/** Sesi habis atau token tidak valid: bersihkan dan arahkan ke halaman masuk. */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (isAxiosError(error) && error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      logout();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        // Di luar React: reload penuh ke /login sekaligus membersihkan semua state halaman.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/** Dipertahankan agar halaman lama tetap jalan: memastikan header token terpasang. */
export const initAuth = async () => {
  applyToken(getToken());
  return !!getToken();
};

export const login = async (email: string, password: string) => {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);
  const res = await api.post<{ access_token: string }>('/auth/login', params);
  storage.set(TOKEN_KEY, res.data.access_token);
  applyToken(res.data.access_token);
};

export const register = async (input: { name: string; email: string; password: string; store_name?: string }) => {
  await api.post('/auth/register', input);
  await login(input.email, input.password);
};

export const logout = () => {
  storage.set(TOKEN_KEY, null);
  applyToken(null);
  setWorkspaceId(null);
};

export const getMe = async (): Promise<Me> => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const createWorkspace = async (name: string): Promise<Workspace> => {
  const res = await api.post('/workspaces', { name });
  return res.data;
};

// ---------------------------------------------------------------- Tim

export const getMembers = async (): Promise<Member[]> => {
  const res = await api.get(`/workspaces/${ws()}/members`);
  return res.data;
};

export const addMember = async (input: { email: string; name?: string; password?: string; role: Role }): Promise<Member> => {
  const res = await api.post(`/workspaces/${ws()}/members`, input);
  return res.data;
};

export const updateMemberRole = async (userId: number, role: Role): Promise<Member> => {
  const res = await api.patch(`/workspaces/${ws()}/members/${userId}`, { role });
  return res.data;
};

export const removeMember = async (userId: number) => {
  await api.delete(`/workspaces/${ws()}/members/${userId}`);
};

export const resetMemberPassword = async (userId: number, password: string) => {
  await api.post(`/workspaces/${ws()}/members/${userId}/password`, { password });
};

// ---------------------------------------------------------------- Data toko

export const getWorkspaces = async (): Promise<Workspace[]> => {
  const res = await api.get('/workspaces');
  return res.data;
};

export const getProducts = async (): Promise<Product[]> => {
  const res = await api.get(`/workspaces/${ws()}/products`);
  return res.data;
};

export const getCategories = async (): Promise<Category[]> => {
  const res = await api.get(`/workspaces/${ws()}/categories`);
  return res.data;
};

export const createProduct = async (product: ProductInput): Promise<Product> => {
  const res = await api.post(`/products?workspace_id=${ws()}`, product);
  return res.data;
};

export const createTransaction = async (transaction: TransactionInput) => {
  const res = await api.post(`/workspaces/${ws()}/transactions`, transaction);
  return res.data;
};

export const uploadImportFile = async (file: File): Promise<UploadPreview> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/workspaces/${ws()}/imports/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const validateImportMapping = async (jobId: number, mapping: ColumnMapping): Promise<ImportJob> => {
  const res = await api.post(`/workspaces/${ws()}/imports/${jobId}/validate`, mapping);
  return res.data;
};

export const confirmImport = async (jobId: number, mapping: ColumnMapping) => {
  const res = await api.post(`/workspaces/${ws()}/imports/${jobId}/confirm`, mapping);
  return res.data;
};

export const getImports = async (): Promise<ImportJob[]> => {
  const res = await api.get(`/workspaces/${ws()}/imports`);
  return res.data;
};

export const getPurchases = async (): Promise<Purchase[]> => {
  const res = await api.get(`/workspaces/${ws()}/purchases`);
  return res.data;
};

export const createPurchase = async (purchase: PurchaseInput) => {
  const res = await api.post(`/workspaces/${ws()}/purchases`, purchase);
  return res.data;
};

export const adjustInventory = async (productId: number, adjust: InventoryAdjustInput) => {
  const res = await api.post(`/workspaces/${ws()}/inventory/adjust?product_id=${productId}`, adjust);
  return res.data;
};

// ---------------------------------------------------------------- Reports

export const getDashboard = async (startDate: string, endDate: string) => {
  const res = await api.get(`/workspaces/${ws()}/reports/dashboard`, {
    params: { start_date: startDate, end_date: endDate },
  });
  return res.data;
};

export const getProfitLoss = async (startDate: string, endDate: string) => {
  const res = await api.get(`/workspaces/${ws()}/reports/profit-loss`, {
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
