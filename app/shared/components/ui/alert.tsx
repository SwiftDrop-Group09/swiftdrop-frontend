import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/shared/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-[8px] p-4 text-base leading-relaxed',
  {
    variants: {
      variant: {
        default: 'bg-white text-[#182a30] border border-[#dce6e1]',
        destructive: 'text-[#9e3035] font-normal p-0',
        success: 'text-[#225f50] font-normal p-0',
        warning:
          'bg-[#fff8e8] border-2 border-[#c58b19] rounded-[8px] p-4 text-[#182a30]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, role, ...props }, ref) => {
  const resolvedRole =
    role ??
    (variant === 'destructive'
      ? 'alert'
      : variant === 'success'
        ? 'status'
        : 'region');
  return (
    <div
      ref={ref}
      role={resolvedRole}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
});
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-bold leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
