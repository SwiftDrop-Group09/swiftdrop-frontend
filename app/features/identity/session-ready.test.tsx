import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { IdentityApi, IdentityError } from './api';
import { IdentityProvider, IdentitySession, SessionReady } from './session';
import { pair } from './test-fixtures';

describe('Session startup experience', () => {
  it.each([true, false])(
    'keeps route children unmounted until session verification finishes (signed in: %s)',
    async (signedIn) => {
      let finish!: () => void;
      const api = new IdentityApi();
      vi.spyOn(api, 'refresh').mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            finish = () =>
              signedIn
                ? resolve(pair())
                : reject(new IdentityError('invalid_credentials', 401));
          }),
      );
      const child = vi.fn(() => <p>Route ready</p>);
      const session = new IdentitySession(api);
      render(
        <QueryClientProvider client={new QueryClient()}>
          <IdentityProvider session={session}>
            <SessionReady>{childElement(child)}</SessionReady>
          </IdentityProvider>
        </QueryClientProvider>,
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        'Getting your workspace ready',
      );
      expect(child).not.toHaveBeenCalled();
      await act(async () => {
        finish();
        await Promise.resolve();
      });
      expect(await screen.findByText('Route ready')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(session.getSnapshot().restoring).toBe(false);
    },
  );
});
function childElement(Child: () => React.ReactNode) {
  return <Child />;
}
