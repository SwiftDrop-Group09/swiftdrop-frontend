import { cn } from '~/shared/lib/utils';

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      aria-label="SwiftDrop."
      className={cn(
        'inline-flex shrink-0 items-baseline text-2xl font-extrabold tracking-tighter',
        className,
      )}
    >
      <span aria-hidden="true" className="text-red-600 dark:text-red-500">
        Swift
      </span>
      <span aria-hidden="true" className="text-black dark:text-white">
        Drop
      </span>
      <span aria-hidden="true" className="text-red-600 dark:text-red-500">
        .
      </span>
    </span>
  );
}
