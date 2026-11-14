import * as React from 'react';
import { AlertDialog as Primitive } from 'radix-ui';
import { cn } from '~/shared/lib/utils';
import { buttonVariants } from './button';

const AlertDialog = Primitive.Root;
function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
      <Primitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-lg',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
function AlertDialogHeader(props: React.ComponentProps<'div'>) {
  return <div className="space-y-2 text-left" {...props} />;
}
function AlertDialogFooter(props: React.ComponentProps<'div'>) {
  return (
    <div
      className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
      {...props}
    />
  );
}
function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Title>) {
  return (
    <Primitive.Title
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  );
}
function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Description>) {
  return (
    <Primitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Action>) {
  return (
    <Primitive.Action className={cn(buttonVariants(), className)} {...props} />
  );
}
function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Cancel>) {
  return (
    <Primitive.Cancel
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      {...props}
    />
  );
}
export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
