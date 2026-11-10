'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './button';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/** Modal ringan berbasis <dialog> native: fokus, Esc dan backdrop ditangani browser. */
export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px] open:animate-[dialog-in_160ms_ease-out]"
    >
      {open && (
        <div>
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div>
              <h2 id={titleId} className="text-base font-semibold tracking-tight">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
            </div>
            <IconButton aria-label="Tutup" onClick={onClose} className="-mt-1 -mr-1">
              <X />
            </IconButton>
          </div>
          <div className="px-5 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line bg-zinc-50/60 px-5 py-3.5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
