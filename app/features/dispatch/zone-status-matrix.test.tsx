import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';
import { TooltipProvider } from '~/shared/components/ui/tooltip';
import { ZoneStatusMatrix } from './zone-status-matrix';

type Zone = ZoneSummaryResponse['zones'][number];
function zone(
  n: number,
  name: string,
  statusCounts: Zone['statusCounts'] = {},
  total = 99,
): Zone {
  return {
    zoneId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name,
    total,
    statusCounts,
  };
}
function mount(zones: Zone[]) {
  return render(
    <TooltipProvider>
      <ZoneStatusMatrix zones={zones} />
    </TooltipProvider>,
  );
}

describe('Zone status matrix', () => {
  it('renders scoped headers, authoritative totals and accessible zero cells for all zones', () => {
    mount([
      zone(1, 'First', { Created: 1, Returned: 2 }, 101),
      zone(2, 'Empty', {}, 0),
    ]);
    const table = screen.getByRole('table', { name: 'Zone status matrix' });
    expect(
      within(table).getByRole('rowheader', { name: 'First' }),
    ).toHaveAttribute('scope', 'row');
    expect(
      screen.getByRole('columnheader', { name: 'Before transit' }),
    ).toHaveAttribute('colspan', '3');
    const first = screen
      .getByRole('rowheader', { name: 'First' })
      .closest('tr')!;
    expect(
      within(first).getByRole('cell', { name: '101' }),
    ).toBeInTheDocument();
    const empty = screen
      .getByRole('rowheader', { name: 'Empty' })
      .closest('tr')!;
    expect(within(empty).getAllByRole('cell', { name: '0' })).toHaveLength(10);
    for (const cell of within(first).getAllByRole('cell')) {
      for (const header of cell.getAttribute('headers')!.split(' '))
        expect(document.getElementById(header)).toBeInTheDocument();
    }
    expect(
      screen.getByRole('region', { name: 'Zone status matrix scroll area' }),
    ).toHaveAttribute('tabindex', '0');
  });

  it('exposes the exact compact count on keyboard focus and dismisses its tooltip', async () => {
    const user = userEvent.setup();
    mount([zone(1, 'Large zone', { Created: 1_234_567 }, 1_234_567)]);
    const count = screen.getByRole('group', {
      name: 'Large zone · Booked, 1,234,567 parcels',
    });
    expect(count).toHaveTextContent('1.2M');
    act(() => count.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '1,234,567 parcels',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses system status color families while keeping zero and unknown counts neutral', () => {
    mount([
      zone(1, 'Colors', {
        Created: 1,
        Assigned: 1,
        PickedUp: 1,
        InTransit: 1,
        OutForDelivery: 1,
        Delivered: 1,
        Failed: 1,
        Cancelled: 1,
        Returned: 1,
      }),
      zone(2, 'Zero'),
    ]);
    const cells = within(
      screen.getByRole('rowheader', { name: 'Colors' }).closest('tr')!,
    ).getAllByRole('cell');
    for (const index of [0, 1, 2])
      expect(cells[index]!.firstChild).toHaveClass(
        'text-amber-800',
        'dark:text-amber-300',
        'border-amber-200',
      );
    for (const index of [3, 4])
      expect(cells[index]!.firstChild).toHaveClass(
        'text-sky-800',
        'dark:text-sky-300',
      );
    expect(cells[5]!.firstChild).toHaveClass(
      'text-emerald-800',
      'dark:text-emerald-300',
    );
    for (const index of [6, 7])
      expect(cells[index]!.firstChild).toHaveClass(
        'bg-destructive/10',
        'text-destructive',
        'border-destructive/25',
      );
    expect(cells[8]!.firstChild).toHaveClass('bg-muted', 'text-foreground');
    const zeros = within(
      screen.getByRole('rowheader', { name: 'Zero' }).closest('tr')!,
    ).getAllByRole('cell');
    expect(zeros[0]!.firstChild).toHaveClass('text-muted-foreground');
  });

  it('keeps 100 configured zones available in the same table', () => {
    mount(
      Array.from({ length: 100 }, (_, n) =>
        zone(n + 1, `Zone ${n}`, { Created: n }),
      ),
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(100);
    expect(screen.getAllByRole('row')).toHaveLength(102);
  });
});
