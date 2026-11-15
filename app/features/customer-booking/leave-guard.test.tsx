import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingLeaveGuard } from './leave-guard';
const identity = vi.hoisted(() => ({
  user: { roles: ['Customer'] },
  logoutRequested: false,
}));
vi.mock('~/features/identity/session', () => ({ useIdentity: () => identity }));
afterEach(() => {
  identity.logoutRequested = false;
});

function setup() {
  const discard = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: '/book',
        element: (
          <>
            <BookingLeaveGuard active discard={discard} />
            <Link to="/history">Delivery history</Link>
          </>
        ),
      },
      { path: '/history', element: <h1>Delivery history</h1> },
    ],
    { initialEntries: ['/book'] },
  );
  render(<RouterProvider router={router} />);
  return { discard, router };
}
describe('unfinished booking navigation', () => {
  it('allows keeping the current-session draft when navigating away', async () => {
    const { discard } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Delivery history' }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Keep draft & leave' }));
    await screen.findByRole('heading', { name: 'Delivery history' });
    expect(discard).not.toHaveBeenCalled();
  });
  it('keeps the booking on cancel and discards details only on explicit confirmation', async () => {
    const { discard, router } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Delivery history' }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(router.state.location.pathname).toBe('/book');
    expect(discard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Delivery history' }));
    await screen.findByRole('alertdialog');
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard details & leave' }),
    );
    await screen.findByRole('heading', { name: 'Delivery history' });
    expect(discard).toHaveBeenCalledOnce();
  });
  it('does not block an explicit sign-out transition', async () => {
    identity.logoutRequested = true;
    const { discard } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Delivery history' }));
    await screen.findByRole('heading', { name: 'Delivery history' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(discard).not.toHaveBeenCalled();
  });
});
