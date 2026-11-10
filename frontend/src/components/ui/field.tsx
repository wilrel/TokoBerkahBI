import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const control =
  'block w-full rounded-lg border border-line bg-surface text-sm text-ink shadow-sm placeholder:text-zinc-400 ' +
  'transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 ' +
  'disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-ink-subtle';

type InputProps = ComponentProps<'input'> & { leading?: ReactNode; trailing?: ReactNode };

export function Input({ className, leading, trailing, ...props }: InputProps) {
  if (!leading && !trailing) return <input className={cn(control, 'h-9 px-3', className)} {...props} />;
  return (
    <div className={cn('relative', className)}>
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-ink-subtle [&_svg]:size-4">
          {leading}
        </span>
      )}
      <input className={cn(control, 'h-9', leading ? 'pl-9' : 'pl-3', trailing ? 'pr-10' : 'pr-3')} {...props} />
      {trailing && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-ink-subtle">{trailing}</span>
      )}
    </div>
  );
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(control, 'h-9 appearance-none pr-9 pl-3')} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-20 px-3 py-2', className)} {...props} />;
}

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
