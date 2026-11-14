import type { ReactNode } from 'react';
import { Separator } from '~/shared/components/ui/separator';

/** Page composition only; interactive controls belong to shared shadcn/ui. */
export function WorkspacePage({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-3">
          {eyebrow}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&>button]:w-full sm:[&>button]:w-auto">
            {actions}
          </div>
        )}
      </header>
      <Separator />
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}
