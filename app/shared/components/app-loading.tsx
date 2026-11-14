import { LoaderCircle } from 'lucide-react';
import { BrandLogo } from './brand-logo';

export function AppLoading() {
  return (
    <main
      className="grid min-h-svh place-items-center bg-muted/30 px-6 py-12"
      aria-busy="true"
    >
      <div
        className="flex w-full max-w-sm flex-col items-center gap-8 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-4xl font-semibold tracking-tight sm:text-5xl">
          <BrandLogo className="text-4xl sm:text-5xl" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <LoaderCircle
            className="size-6 motion-safe:animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">Getting your workspace ready</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Securely checking your session. Your workspace will be ready in a
            moment.
          </p>
        </div>
      </div>
    </main>
  );
}
