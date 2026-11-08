import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/shared/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#dea836] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#146354] text-white hover:bg-[#0e4b3f]',
        secondary:
          'border-transparent bg-[#e4ece8] text-[#164d42] hover:bg-[#d5e2dc]',
        destructive:
          'border-transparent bg-[#9e3035] text-white hover:bg-[#85272b]',
        outline: 'text-[#182a30] border-[#dce6e1]',
        warning: 'border-[#c58b19] bg-[#fff8e8] text-[#c58b19]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
