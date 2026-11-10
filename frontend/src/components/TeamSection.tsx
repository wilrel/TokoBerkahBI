'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw, UserMinus, UserPlus, Users } from 'lucide-react';
import { addMember, errorMessage, getMembers, removeMember, resetMemberPassword, updateMemberRole } from '@/lib/api';
import type { Member } from '@/lib/types';
import { ROLES, roleLabel, type Role } from '@/lib/roles';
import { cn } from '@/lib/cn';
import { initials, useAuth } from '@/components/auth';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';

/** Password awal yang mudah dibacakan: tanpa huruf/angka yang mirip (0/O, 1/l). */
function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function CopyButton({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        await navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? 'Tersalin' : label}
    </Button>
  );
}

/** Kotak info login untuk diberikan ke karyawan. */
function Credentials({ email, password }: { email: string; password?: string }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';
  const text = `Login Toko Berkah\nAlamat: ${url}\nEmail: ${email}${password ? `\nPassword: ${password}` : ''}`;
  return (
    <div className="rounded-xl border border-line bg-zinc-50/70">
      <dl className="divide-y divide-line text-sm">
        {[
          ['Alamat', url],
          ['Email', email],
          ...(password ? [['Password', password]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-ink-subtle">{k}</dt>
            <dd className={cn('truncate text-right font-medium text-ink', k === 'Password' && 'font-mono tracking-wide')}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-end border-t border-line px-4 py-2.5">
        <CopyButton text={text} label="Salin info login" />
      </div>
    </div>
  );
}

function RolePicker({ value, onChange, allowOwner }: { value: Role; onChange: (r: Role) => void; allowOwner: boolean }) {
  return (
    <div className="grid gap-2" role="radiogroup" aria-label="Peran">
      {ROLES.filter((r) => allowOwner || r.key !== 'OWNER').map((r) => (
        <button
          key={r.key}
          type="button"
          role="radio"
          aria-checked={value === r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors',
            value === r.key ? 'border-accent bg-accent-soft/60 ring-1 ring-accent' : 'border-line hover:border-line-strong',
          )}
        >
          <span
            className={cn(
              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
              value === r.key ? 'border-accent bg-accent' : 'border-line-strong bg-white',
            )}
          >
            {value === r.key && <span className="size-1.5 rounded-full bg-white" />}
          </span>
          <span>
            <span className="block text-sm font-medium text-ink">{r.label}</span>
            <span className="block text-xs text-ink-subtle">{r.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function AddMemberDialog({ open, onClose, onAdded, allowOwner }: { open: boolean; onClose: () => void; onAdded: (m: Member) => void; allowOwner: boolean }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CASHIER' as Role });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ member: Member; password?: string } | null>(null);

  // Setiap kali dibuka: form baru dengan password awal yang sudah dibuatkan.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm({ name: '', email: '', password: generatePassword(), role: 'CASHIER' });
      setError(null);
      setDone(null);
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const member = await addMember({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role });
      onAdded(member);
      setDone({ member, password: member.new_account ? form.password : undefined });
    } catch (err) {
      setError(errorMessage(err, 'Gagal menambahkan karyawan.'));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={`${done.member.name || done.member.email} sudah ditambahkan`}
        description={
          done.password
            ? 'Berikan info login ini ke karyawan. Password hanya ditampilkan sekali, sarankan untuk menyimpannya.'
            : 'Email ini sudah punya akun, jadi karyawan masuk dengan password miliknya sendiri.'
        }
        footer={<Button onClick={onClose}>Selesai</Button>}
      >
        <Credentials email={done.member.email} password={done.password} />
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tambah karyawan"
      description="Karyawan bisa langsung masuk dengan email dan password awal ini."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="add-member" loading={saving}>
            Tambahkan
          </Button>
        </>
      }
    >
      <form id="add-member" onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Nama" htmlFor="m-name">
          <Input id="m-name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Andi" />
        </Field>
        <Field label="Email" htmlFor="m-email" required>
          <Input
            id="m-email"
            type="email"
            inputMode="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="andi@email.com"
          />
        </Field>
        <Field label="Password awal" htmlFor="m-pass" required hint="Sudah dibuatkan otomatis. Boleh diganti, minimal 6 karakter.">
          <div className="flex gap-1.5">
            <Input
              id="m-pass"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="min-w-0 flex-1 font-mono"
            />
            <IconButton
              aria-label="Buat password baru"
              title="Buat password baru"
              onClick={() => setForm({ ...form, password: generatePassword() })}
              className="size-9 border border-line"
            >
              <RefreshCw />
            </IconButton>
          </div>
        </Field>
        <Field label="Peran" required>
          <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} allowOwner={allowOwner} />
        </Field>
      </form>
    </Dialog>
  );
}

function ResetPasswordDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [forId, setForId] = useState<number | null>(null);
  if ((member?.user_id ?? null) !== forId) {
    setForId(member?.user_id ?? null);
    setPassword(generatePassword());
    setError(null);
    setDone(false);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await resetMemberPassword(member.user_id, password);
      setDone(true);
      toast({ tone: 'success', title: 'Password diganti' });
    } catch (err) {
      setError(errorMessage(err, 'Gagal mengganti password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      title={done ? 'Password baru siap' : 'Ganti password'}
      description={done ? 'Berikan info login ini ke karyawan.' : `Untuk ${member?.name || member?.email}. Password lama tidak bisa dipakai lagi.`}
      footer={
        done ? (
          <Button onClick={onClose}>Selesai</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" form="reset-pass" loading={saving}>
              Ganti password
            </Button>
          </>
        )
      }
    >
      {member &&
        (done ? (
          <Credentials email={member.email} password={password} />
        ) : (
          <form id="reset-pass" onSubmit={submit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Password baru" htmlFor="r-pass" hint="Minimal 6 karakter.">
              <div className="flex gap-1.5">
                <Input id="r-pass" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="min-w-0 flex-1 font-mono" />
                <IconButton aria-label="Buat password baru" onClick={() => setPassword(generatePassword())} className="size-9 border border-line">
                  <RefreshCw />
                </IconButton>
              </div>
            </Field>
          </form>
        ))}
    </Dialog>
  );
}

export default function TeamSection() {
  const toast = useToast();
  const { user, role } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const isOwner = role === 'OWNER';

  const load = useCallback(async () => {
    try {
      setMembers(await getMembers());
    } catch (e) {
      setError(errorMessage(e, 'Gagal memuat anggota tim.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data awal dari API
    load();
  }, [load]);

  const changeRole = async (m: Member, next: Role) => {
    try {
      const updated = await updateMemberRole(m.user_id, next);
      setMembers((list) => list.map((x) => (x.user_id === m.user_id ? updated : x)));
      toast({ tone: 'success', title: 'Peran diubah', description: `${m.name || m.email} sekarang ${roleLabel(next)}.` });
    } catch (e) {
      toast({ tone: 'error', title: 'Gagal mengubah peran', description: errorMessage(e) });
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await removeMember(removing.user_id);
      setMembers((list) => list.filter((x) => x.user_id !== removing.user_id));
      toast({ tone: 'success', title: 'Karyawan dikeluarkan', description: `${removing.name || removing.email} tidak bisa mengakses toko lagi.` });
      setRemoving(null);
    } catch (e) {
      toast({ tone: 'error', title: 'Gagal mengeluarkan', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Anggota tim"
        description="Siapa saja yang bisa masuk ke toko ini, dan apa yang boleh mereka lakukan"
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus /> Tambah karyawan
          </Button>
        }
      />
      {error && <Alert className="mx-5 mb-4">{error}</Alert>}

      {loading ? (
        <div className="space-y-3 border-t border-line p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : members.length <= 1 ? (
        <div className="border-t border-line">
          {renderMembers()}
          <EmptyState
            icon={Users}
            title="Belum ada karyawan"
            description="Tambahkan kasir atau staf agar mereka bisa melayani penjualan dengan akun masing-masing."
            className="py-8"
          />
        </div>
      ) : (
        <div className="border-t border-line">
          {renderMembers()}
        </div>
      )}

      <AddMemberDialog open={adding} onClose={() => setAdding(false)} onAdded={(m) => setMembers((l) => [...l, m])} allowOwner={isOwner} />
      <ResetPasswordDialog member={resetting} onClose={() => setResetting(null)} />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Keluarkan karyawan?"
        description={`${removing?.name || removing?.email} tidak akan bisa masuk ke toko ini lagi. Riwayat transaksinya tetap tersimpan.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Batal
            </Button>
            <Button variant="danger" loading={busy} onClick={confirmRemove}>
              Keluarkan
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-subtle">Anda bisa menambahkannya kembali kapan saja.</p>
      </Dialog>
    </Card>
  );

  function renderMembers() {
    return (
      <ul className="divide-y divide-line">
        {members.map((m) => {
          const self = m.user_id === user?.id;
          // Admin tidak bisa mengatur Owner; tidak ada yang bisa mengubah perannya sendiri di sini.
          const locked = self || (!isOwner && m.role === 'OWNER');
          return (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:flex-nowrap">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-ink-muted">
                {initials(m.name, m.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                  {m.name || m.email}
                  {self && <Badge tone="info">Anda</Badge>}
                </p>
                <p className="truncate text-xs text-ink-subtle">{m.email}</p>
              </div>
              <div className="flex w-full items-center gap-1.5 sm:w-auto">
                {locked ? (
                  <Badge className="mr-auto sm:mr-0">{roleLabel(m.role)}</Badge>
                ) : (
                  <Select
                    aria-label={`Peran ${m.name || m.email}`}
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value as Role)}
                    className="mr-auto w-36 sm:mr-0"
                  >
                    {ROLES.filter((r) => isOwner || r.key !== 'OWNER').map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                )}
                {!locked && (
                  <>
                    <IconButton aria-label={`Ganti password ${m.name || m.email}`} title="Ganti password" onClick={() => setResetting(m)}>
                      <KeyRound />
                    </IconButton>
                    <IconButton
                      aria-label={`Keluarkan ${m.name || m.email}`}
                      title="Keluarkan"
                      onClick={() => setRemoving(m)}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <UserMinus />
                    </IconButton>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
}
