import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { AppProviders } from '../app/providers';
import { CustomerBookingPage } from '../app/features/customer-booking/booking-page';
import { tabAttemptStore } from './attempt-store';
import '../app/styles/app.css';

const contextSchema = z.object({
  actorId: z.string().uuid(),
  roles: z.array(z.string()),
  zones: z.array(z.object({ id: z.string().uuid(), name: z.string().min(1) })),
});

async function start() {
  const root = createRoot(document.getElementById('root')!);
  try {
    const response = await fetch('/__test/booking-context');
    if (!response.ok) throw new Error('Fixture unavailable.');
    const value: unknown = await response.json();
    const context = contextSchema.parse(value);
    root.render(
      <AppProviders>
        <div
          className="bg-amber-100 px-5 py-2 text-center text-xs font-semibold text-amber-950"
          role="note"
        >
          Local integration fixture · fictional Customer and delivery areas ·
          disposable data
        </div>
        <CustomerBookingPage
          environment={{
            session: { principalId: context.actorId, roles: context.roles },
            request: (path, init) => fetch(path, init),
            zones: { load: () => Promise.resolve(context.zones) },
            attempts: tabAttemptStore(sessionStorage),
            apiBase: '/api',
          }}
        />
      </AppProviders>,
    );
  } catch {
    root.render(
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>Booking fixture unavailable</h1>
        <p>
          Start the isolated Delivery booking harness, then reload this page.
        </p>
      </main>,
    );
  }
}

void start();
