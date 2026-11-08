import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Package2 } from 'lucide-react';

// Adapted from the official shadcn login-02 and signup-02 split-screen blocks.
export function AuthLayout({
  children,
  register,
}: {
  children: ReactNode;
  register: boolean;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-8 p-6 sm:p-10 lg:px-14">
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
            aria-label="SwiftDrop home"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Package2 className="size-5" aria-hidden="true" />
            </span>
            SwiftDrop
          </Link>
          <Link
            to={register ? '/login' : '/register'}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {register ? 'Sign in' : 'Create account'}
          </Link>
        </header>
        <main
          id="main-content"
          className="flex flex-1 items-center justify-center py-4 sm:py-8"
        >
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="text-center text-xs text-muted-foreground">
          SwiftDrop · Every parcel starts here.
        </footer>
      </div>
      <aside
        className="relative hidden overflow-hidden bg-muted lg:block"
        aria-label={
          register ? 'Parcel preparation photograph' : 'Warehouse photograph'
        }
      >
        <img
          src={
            register
              ? '/images/auth/parcel-preparation.jpg'
              : '/images/auth/warehouse-team.jpg'
          }
          alt={
            register
              ? 'A small business owner preparing parcels beside a laptop.'
              : 'Warehouse workers organizing goods and parcels.'
          }
          width={1200}
          height={register ? 801 : 1800}
          className="absolute inset-0 size-full object-cover"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-5 p-10 text-white xl:p-14">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/75">
            Made for your next delivery
          </p>
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            {register
              ? 'A fresh start for every parcel.'
              : 'Your deliveries. One place.'}
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-white/80">
            {register
              ? 'Create your SwiftDrop account and get ready for your next delivery.'
              : 'Sign in to your SwiftDrop workspace and pick up where you left off.'}
          </p>
          <a
            className="inline-block text-xs text-white/65 underline-offset-4 hover:text-white hover:underline"
            href={
              register
                ? 'https://www.pexels.com/photo/woman-standing-next-to-a-desk-with-a-laptop-and-cardboard-boxes-and-writing-on-paper-7857553/'
                : 'https://www.pexels.com/photo/men-working-in-a-warehouse-4481258/'
            }
            target="_blank"
            rel="noreferrer"
          >
            Photo: {register ? 'Kampus Production' : 'Tiger Lily'} / Pexels
          </a>
        </div>
      </aside>
    </div>
  );
}
