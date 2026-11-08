import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/shared/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[7px] text-base font-semibold transition-colors focus-visible:outline-[3px] focus-visible:outline-[#dea836] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[#146354] text-white hover:bg-[#0e4b3f]',
        destructive: 'bg-[#9e3035] text-white hover:bg-[#85272b]',
        outline:
          'border border-[#dce6e1] bg-white text-[#182a30] hover:bg-[#f2f6f5]',
        secondary: 'bg-[#e4ece8] text-[#164d42] hover:bg-[#d5e2dc]',
        ghost: 'hover:bg-[#f2f6f5] text-[#182a30]',
        link: 'text-[#116356] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 rounded-[5px] px-3 text-sm',
        lg: 'h-12 rounded-[8px] px-6 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
