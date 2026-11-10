'use client';

import { useEffect, useRef, useState } from 'react';
import { CameraOff, Check, ScanLine } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Dipanggil untuk setiap kode yang terbaca. */
  onScan: (code: string) => void;
  title?: string;
  /** true = kamera tetap menyala untuk scan berikutnya (mode kasir). */
  continuous?: boolean;
  /** Teks status terakhir, mis. "Beras 5kg ditambahkan". */
  lastResult?: string | null;
};

/** Bunyi "bip" pendek supaya kasir tahu scan berhasil tanpa melihat layar. */
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1500;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
    osc.onended = () => ctx.close();
  } catch {
    /* audio tidak tersedia */
  }
  navigator.vibrate?.(60);
}

function cameraError(e: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Kamera hanya bisa dipakai lewat alamat https atau localhost. Buka aplikasi lewat alamat aman, atau gunakan scanner USB.';
  }
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Kamera tidak ditemukan di perangkat ini.';
  if (name === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain.';
  return 'Kamera tidak bisa dibuka.';
}

export default function BarcodeScanner({ open, onClose, onScan, title = 'Scan barcode', continuous = false, lastResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  // Simpan callback terbaru tanpa memulai ulang kamera setiap render.
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    let controls: IScannerControls | null = null;
    let cancelled = false;
    let last = { code: '', at: 0 };

    (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('insecure');
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        // Tunggu <video> dirender di dalam dialog.
        await new Promise((r) => requestAnimationFrame(r));
        if (cancelled || !videoRef.current) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => {
            if (!result) return;
            const code = result.getText().trim();
            const now = Date.now();
            // Abaikan kode yang sama dalam 1,5 detik (kamera membaca berkali-kali per detik).
            if (!code || (code === last.code && now - last.at < 1500)) return;
            last = { code, at: now };
            beep();
            onScanRef.current(code);
            if (!continuous) onCloseRef.current();
          },
        );
        if (cancelled) controls.stop();
        else setStarting(false);
      } catch (e) {
        if (!cancelled) {
          setError(cameraError(e));
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
      setError(null);
      setStarting(true);
    };
  }, [open, continuous]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={continuous ? 'Arahkan kamera ke barcode. Kamera tetap menyala untuk barang berikutnya.' : 'Arahkan kamera ke barcode atau QR code.'}
      footer={
        <Button variant={continuous ? 'primary' : 'secondary'} onClick={onClose}>
          {continuous ? 'Selesai' : 'Batal'}
        </Button>
      }
    >
      {error ? (
        <div className="flex flex-col items-center rounded-xl border border-line bg-zinc-50 px-6 py-10 text-center">
          <CameraOff className="size-6 text-ink-subtle" />
          <p className="mt-3 text-sm text-ink-muted">{error}</p>
        </div>
      ) : (
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-950">
          <video ref={videoRef} className="size-full object-cover" muted playsInline />
          {/* Bingkai bidik */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[42%] w-[72%] rounded-lg ring-[999px] ring-black/35">
              <span className="absolute -top-px -left-px size-5 rounded-tl-lg border-t-2 border-l-2 border-white" />
              <span className="absolute -top-px -right-px size-5 rounded-tr-lg border-t-2 border-r-2 border-white" />
              <span className="absolute -bottom-px -left-px size-5 rounded-bl-lg border-b-2 border-l-2 border-white" />
              <span className="absolute -right-px -bottom-px size-5 rounded-br-lg border-r-2 border-b-2 border-white" />
              <span className="absolute inset-x-3 top-1/2 h-px bg-red-500/80" />
            </div>
          </div>
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
              <ScanLine className="mr-2 size-4 animate-pulse" /> Membuka kamera
            </div>
          )}
        </div>
      )}
      {lastResult && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Check className="size-4 shrink-0" /> {lastResult}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-subtle">Punya scanner USB atau Bluetooth? Langsung scan saja ke kolom pencarian, tanpa membuka kamera.</p>
    </Dialog>
  );
}
