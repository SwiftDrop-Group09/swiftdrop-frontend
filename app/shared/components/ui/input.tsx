import * as React from 'react';
import { cn } from '~/shared/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-[7px] border border-[#9db2a9] bg-white px-3 py-2 text-base text-[#182a30] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#52685e] focus-visible:outline-[3px] focus-visible:outline-[#dea836] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };

