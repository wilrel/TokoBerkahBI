'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  Boxes,
  ChevronsUpDown,
  LogOut,
  Store,
  FileBarChart2,
  FileUp,
  LayoutGrid,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { canAccess, roleLabel } from '@/lib/roles';
import { initials, useAuth } from '@/components/auth';
import { IconButton } from '@/components/ui/button';

type NavItem = { name: string; href: string; icon: typeof LayoutGrid; match?: string };

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Ringkasan',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutGrid },
      { name: 'Laba Rugi', href: '/reports/profit-loss', icon: FileBarChart2, match: '/reports' },
    ],
  },
  {
    label: 'Operasional',
    items: [
      { name: 'Kasir', href: '/transactions/new', icon: ShoppingBag, match: '/transactions' },
      { name: 'Produk', href: '/products', icon: Package },
      { name: 'Stok & Opname', href: '/inventory', icon: Boxes },
      { name: 'Pembelian', href: '/purchases', icon: ArrowDownToLine },
    ],
  },
  {
    label: 'Data',
    items: [
      { name: 'Import Data', href: '/imports', icon: FileUp },
      { name: 'Pelanggan', href: '/customers', icon: Users },
    ],
  },
];

const footerItem: NavItem = { name: 'Pengaturan', href: '/settings', icon: Settings };

function isActive(pathname: string, item: NavItem) {
  if (item.href === '/') return pathname === '/';
  const prefix = item.match ?? item.href;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors',
        active ? 'bg-white font-medium text-ink shadow-[var(--shadow-card)] ring-1 ring-line' : 'text-ink-muted hover:bg-zinc-200/50 hover:text-ink',
      )}
    >
      <item.icon
        className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-ink-subtle group-hover:text-ink-muted')}
        aria-hidden="true"
      />
      {item.name}
    </Link>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-[13px] font-semibold tracking-tight text-white">
        TB
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-ink">Toko Berkah</div>
        <div className="text-xs text-ink-subtle">Business Intelligence</div>
      </div>
    </div>
  );
}

function StoreCard() {
  const { user, membership, switchStore } = useAuth();
  const stores = user?.memberships ?? [];
  return (
    <div className="relative flex w-full items-center gap-2.5 rounded-lg border border-line bg-white px-2.5 py-2 shadow-[var(--shadow-card)]">
      <Store className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-ink-subtle">Toko aktif</span>
        <span className="block truncate text-sm font-medium text-ink">{membership?.workspace_name}</span>
      </span>
      {stores.length > 1 && (
        <>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          {/* Select native transparan di atas kartu: mudah dipakai di HP maupun desktop. */}
          <select
            aria-label="Ganti toko"
            value={membership?.workspace_id}
            onChange={(e) => switchStore(Number(e.target.value))}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {stores.map((m) => (
              <option key={m.workspace_id} value={m.workspace_id}>
                {m.workspace_name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

function UserCard() {
  const { user, role, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
        {initials(user.name, user.email)}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-medium text-ink">{user.name || user.email}</div>
        <div className="truncate text-xs text-ink-subtle">{role ? roleLabel(role) : ''}</div>
      </div>
      <IconButton aria-label="Keluar" title="Keluar" onClick={logout}>
        <LogOut />
      </IconButton>
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { role } = useAuth();
  const visible = sections
    .map((section) => ({ ...section, items: section.items.filter((item) => canAccess(role, item.href)) }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-4">
        <Brand />
      </div>

      <div className="px-3">
        <StoreCard />
      </div>

      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Navigasi utama">
        {visible.map((section) => (
          <div key={section.label}>
            <div className="mb-1 px-2.5 text-[11px] font-medium tracking-wide text-ink-subtle uppercase">{section.label}</div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-line px-3 py-3">
        {canAccess(role, footerItem.href) && <NavLink item={footerItem} pathname={pathname} onNavigate={onNavigate} />}
        <UserCard />
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);

  // Kunci scroll halaman saat drawer mobile terbuka.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-zinc-50 lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          aria-expanded={open}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-zinc-100"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-[fade-in_150ms_ease-out] bg-zinc-950/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-[fade-in_150ms_ease-out] border-r border-line bg-zinc-50 shadow-[var(--shadow-pop)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup menu"
              className="absolute top-4 right-3 inline-flex size-8 items-center justify-center rounded-lg text-ink-subtle hover:bg-zinc-200/60"
            >
              <X className="size-4" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
