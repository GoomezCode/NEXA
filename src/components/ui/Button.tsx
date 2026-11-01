import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25',
        outline: 'border-border bg-transparent text-foreground hover:bg-foreground/5',
        ghost: 'border-transparent bg-transparent text-muted hover:border-border hover:bg-foreground/5 hover:text-foreground',
        danger: 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        icon: 'h-11 w-11 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'size'> & { label: string }>(function IconButton({
  label,
  className,
  children,
  ...props
}, ref) {
  return <Button ref={ref} size="icon" aria-label={label} className={className} {...props}>{children}</Button>;
});
