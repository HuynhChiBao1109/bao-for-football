import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
};

const variantClass: Record<Variant, string> = {
  primary: 'game-button-primary',
  secondary: 'game-button-secondary',
  ghost: 'rounded-[14px] px-4 py-2 text-sm text-slate-300 hover:bg-white/5 transition',
};

export function Button({
  variant = 'primary',
  loading,
  fullWidth,
  children,
  disabled,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${variantClass[variant]}${fullWidth ? ' w-full' : ''} ${className}`}
    >
      {loading ? 'Đang xử lý...' : children}
    </button>
  );
}
