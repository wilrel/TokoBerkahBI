'use client';

import { useState } from 'react';
import { ArrowRight, Check, ChevronLeft, CircleCheck, FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { confirmImport, errorMessage, initAuth, uploadImportFile, validateImportMapping } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import type { ColumnMapping, ImportJob, UploadPreview } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button, IconButton, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';
import { Table, TBody, TD, TH, THead } from '@/components/ui/table';

const STEPS = ['Unggah file', 'Cocokkan kolom', 'Periksa data', 'Selesai'];

const FIELDS: { key: keyof ColumnMapping; label: string; hint: string }[] = [
  { key: 'date_col', label: 'Tanggal transaksi', hint: 'Format YYYY-MM-DD atau DD/MM/YYYY' },
  { key: 'sku_col', label: 'SKU produk', hint: 'Harus sama dengan SKU di menu Produk' },
  { key: 'quantity_col', label: 'Jumlah', hint: 'Banyaknya barang terjual' },
  { key: 'price_col', label: 'Harga jual', hint: 'Harga per satuan' },
];

const emptyMapping: ColumnMapping = { date_col: '', sku_col: '', quantity_col: '', price_col: '' };

/** Tebak kolom dari nama header supaya pengguna tidak perlu memilih manual. */
function guessMapping(columns: string[]): ColumnMapping {
  const find = (...words: string[]) => columns.find((c) => words.some((w) => c.toLowerCase().includes(w))) ?? '';
  return {
    date_col: find('date', 'tanggal', 'tgl'),
    sku_col: find('sku', 'kode'),
    quantity_col: find('qty', 'quantity', 'jumlah'),
    price_col: find('price', 'harga'),
  };
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2 sm:gap-3">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const current = step === n;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                done && 'bg-accent text-white',
                current && 'bg-accent-soft text-accent ring-1 ring-accent',
                !done && !current && 'bg-zinc-100 text-ink-subtle',
              )}
              aria-current={current ? 'step' : undefined}
            >
              {done ? <Check className="size-3.5" /> : n}
            </span>
            <span className={cn('hidden text-sm whitespace-nowrap sm:inline', current ? 'font-medium text-ink' : 'text-ink-subtle')}>{label}</span>
            {n < STEPS.length && <span className={cn('h-px flex-1', done ? 'bg-accent' : 'bg-line')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function NewImportPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping);
  const [validation, setValidation] = useState<ImportJob | null>(null);
  const [imported, setImported] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await initAuth();
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = () =>
    run(async () => {
      if (!file) return;
      const res = await uploadImportFile(file);
      setPreview(res);
      setMapping(guessMapping(res.columns));
      setStep(2);
    });

  const validate = () =>
    run(async () => {
      if (!preview) return;
      setValidation(await validateImportMapping(preview.job_id, mapping));
      setStep(3);
    });

  const confirm = () =>
    run(async () => {
      if (!preview) return;
      const res = await confirmImport(preview.job_id, mapping);
      setImported(res?.imported_rows ?? 0);
      setStep(4);
    });

  const mappingComplete = FIELDS.every((f) => mapping[f.key]);
  const validRows = validation ? validation.total_rows - validation.error_rows : 0;

  return (
    <Page size="narrow">
      <PageHeader
        eyebrow={
          <LinkButton href="/imports" variant="ghost" size="sm" className="-ml-2.5">
            <ChevronLeft /> Import data
          </LinkButton>
        }
        title="Import transaksi"
        description="Penjualan dari file akan dicatat sebagai transaksi dan mengurangi stok."
      />

      <Stepper step={step} />
      {error && <Alert className="mb-4">{error}</Alert>}

      <Card className="overflow-hidden">
        {step === 1 && (
          <div className="p-5 sm:p-6">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors',
                dragging ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-ink-subtle hover:bg-zinc-50',
              )}
            >
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-line bg-surface shadow-sm">
                <UploadCloud className="size-5 text-ink-subtle" />
              </div>
              <p className="text-sm font-medium text-ink">
                Tarik file ke sini, atau <span className="text-accent">pilih file</span>
              </p>
              <p className="mt-1 text-xs text-ink-subtle">CSV atau Excel (.xlsx)</p>
              <input
                type="file"
                className="sr-only"
                accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {file && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-line px-3.5 py-2.5">
                <FileSpreadsheet className="size-5 shrink-0 text-ink-subtle" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-ink-subtle">{(file.size / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} KB</p>
                </div>
                <IconButton aria-label="Hapus file" onClick={() => setFile(null)}>
                  <X />
                </IconButton>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button onClick={upload} disabled={!file} loading={busy}>
                Lanjut <ArrowRight />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && preview && (
          <div>
            <div className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold tracking-tight">Cocokkan kolom</h2>
              <p className="mt-0.5 text-sm text-ink-subtle">Pilih kolom di file yang berisi data berikut. Sebagian sudah kami tebak dari nama kolom.</p>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <Field key={f.key} label={f.label} htmlFor={f.key} required hint={f.hint}>
                    <Select id={f.key} value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                      <option value="">Pilih kolom</option>
                      {preview.columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
            </div>

            <div className="border-t border-line">
              <p className="px-5 pt-4 pb-2 text-xs font-medium text-ink-subtle sm:px-6">Pratinjau {preview.preview_data.length} baris pertama</p>
              <Table>
                <THead>
                  <tr>
                    {preview.columns.map((c) => {
                      const used = Object.values(mapping).includes(c);
                      return (
                        <TH key={c} className={used ? 'text-accent' : undefined}>
                          {c}
                        </TH>
                      );
                    })}
                  </tr>
                </THead>
                <TBody>
                  {preview.preview_data.map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map((c) => (
                        <TD key={c} className="h-10 text-ink-muted">
                          {String(row[c] ?? '')}
                        </TD>
                      ))}
                    </tr>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="flex justify-between border-t border-line bg-zinc-50/60 px-5 py-3.5 sm:px-6">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Kembali
              </Button>
              <Button onClick={validate} disabled={!mappingComplete} loading={busy}>
                Periksa data <ArrowRight />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && validation && (
          <div>
            <div className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold tracking-tight">Hasil pemeriksaan</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ['Total baris', validation.total_rows, 'text-ink'],
                  ['Siap diimpor', validRows, 'text-emerald-700'],
                  ['Bermasalah', validation.error_rows, validation.error_rows ? 'text-red-700' : 'text-ink'],
                ].map(([label, n, color]) => (
                  <div key={label as string} className="rounded-lg border border-line px-4 py-3">
                    <p className="text-xs text-ink-subtle">{label}</p>
                    <p className={cn('num mt-1 text-xl font-semibold', color as string)}>{formatNumber(n as number)}</p>
                  </div>
                ))}
              </div>

              {validation.errors.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-lg border border-line">
                  <p className="border-b border-line bg-zinc-50/70 px-4 py-2 text-xs font-medium text-ink-subtle">
                    {validation.errors.length > 10 ? '10 error pertama' : 'Daftar error'}
                  </p>
                  <ul className="max-h-64 divide-y divide-line overflow-y-auto">
                    {validation.errors.slice(0, 10).map((err) => (
                      <li key={err.id} className="px-4 py-3">
                        <p className="text-sm">
                          <span className="num font-medium text-ink">Baris {err.row_number}</span>
                          <span className="text-red-700"> · {err.error_message}</span>
                        </p>
                        <p className="mt-1 truncate font-mono text-xs text-ink-subtle">{err.raw_data}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5">
                {validRows === 0 ? (
                  <Alert>Semua baris bermasalah. Perbaiki file lalu unggah ulang.</Alert>
                ) : (
                  <Alert tone="info">
                    {validation.error_rows > 0
                      ? `${formatNumber(validation.error_rows)} baris bermasalah akan dilewati. Hanya ${formatNumber(validRows)} baris valid yang diimpor.`
                      : 'Semua baris valid dan siap diimpor.'}
                  </Alert>
                )}
              </div>
            </div>

            <div className="flex justify-between border-t border-line bg-zinc-50/60 px-5 py-3.5 sm:px-6">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Kembali
              </Button>
              <Button onClick={confirm} disabled={validRows === 0} loading={busy}>
                Import {formatNumber(validRows)} baris
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
              <CircleCheck className="size-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Import selesai</h2>
            <p className="mt-1 max-w-sm text-sm text-ink-subtle">
              {formatNumber(imported || validRows)} transaksi telah dicatat dan stok produk sudah diperbarui.
            </p>
            <div className="mt-6 flex gap-2">
              <LinkButton href="/imports" variant="secondary">
                Lihat riwayat
              </LinkButton>
              <LinkButton href="/">Buka dashboard</LinkButton>
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
