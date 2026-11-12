import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const inputClass =
'w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-50';

export function Field({ label, hint, children }: {label: string;hint?: string;children: ReactNode;}) {
  return (
    <label data-ev-id="ev_ca5636480c" className="flex flex-col gap-1.5">
			<span data-ev-id="ev_fd5cdb0c36" className="text-xs font-semibold text-muted-foreground">{label}</span>
			{children}
			{hint && <span data-ev-id="ev_6d24b84e68" className="text-xs text-muted-foreground/80">{hint}</span>}
		</label>);

}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input data-ev-id="ev_a4a8847ada" {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea data-ev-id="ev_8de2007184" {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select data-ev-id="ev_7235648de5" {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function PrimaryButton({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button data-ev-id="ev_6e8c9fe51d"
    {...props}
    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-50 ${className}`} />);


}

export function GhostButton({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button data-ev-id="ev_7e31e01a58"
    {...props}
    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 ${className}`} />);


}

export function Toggle({ checked, onChange, label }: {checked: boolean;onChange: (v: boolean) => void;label: string;}) {
  return (
    <button data-ev-id="ev_e141b1af16"
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 flex-none rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-3'}`}>
      
			<span data-ev-id="ev_5e5586c80d" className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${checked ? 'left-[1.375rem] bg-primary-foreground' : 'left-0.5'}`} />
		</button>);

}

export function Notice({ tone = 'info', children }: {tone?: 'info' | 'error' | 'success';children: ReactNode;}) {
  const styles = {
    info: 'border-border bg-surface-2 text-muted-foreground',
    error: 'border-destructive/40 bg-destructive/10 text-destructive',
    success: 'border-primary/40 bg-primary/10 text-primary'
  }[tone];
  return <p data-ev-id="ev_0560c017a3" className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</p>;
}