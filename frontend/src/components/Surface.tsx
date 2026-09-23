import type { HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  tone?: 'glass' | 'solid';
};

export function Surface({ children, className = '', tone = 'glass', ...props }: Props) {
  return (
    <div className={`surface surface--${tone} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
