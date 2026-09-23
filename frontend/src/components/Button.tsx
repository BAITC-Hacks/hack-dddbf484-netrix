import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ children, className = '', variant = 'primary', type = 'button', ...props }: Props) {
  return (
    <button type={type} className={`button button--${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
