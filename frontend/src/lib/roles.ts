export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER';

export const ROLES: { key: Role; label: string; description: string }[] = [
  { key: 'CASHIER', label: 'Kasir', description: 'Melayani penjualan di menu Kasir dan melihat daftar produk.' },
  { key: 'MANAGER', label: 'Manager', description: 'Kasir ditambah kelola produk, stok, pembelian, import, dan laporan.' },
  { key: 'ADMIN', label: 'Admin', description: 'Semua akses Manager ditambah mengatur karyawan.' },
  { key: 'OWNER', label: 'Owner', description: 'Akses penuh, termasuk mengatur Owner lain.' },
];

export const roleLabel = (role: Role) => ROLES.find((r) => r.key === role)?.label ?? role;

export const canManageStore = (role: Role | null | undefined) => role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
export const canManageTeam = (role: Role | null | undefined) => role === 'OWNER' || role === 'ADMIN';

/** Halaman yang boleh dibuka Kasir. Peran lain boleh membuka semua halaman. */
const CASHIER_PATHS = ['/transactions', '/products'];

export function canAccess(role: Role | null | undefined, pathname: string) {
  if (!role) return false;
  if (role !== 'CASHIER') return true;
  return CASHIER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Halaman awal setelah login, sesuai peran. */
export const homeFor = (role: Role | null | undefined) => (role === 'CASHIER' ? '/transactions/new' : '/');
