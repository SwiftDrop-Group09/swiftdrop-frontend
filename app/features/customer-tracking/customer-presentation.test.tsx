import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomerJourney } from './customer-presentation';

describe('Customer delivery journey', () => {
  it.each([
    { status: 'Created', value: '0' },
    { status: 'Delivered', value: '100' },
  ] as const)(
    'announces actual milestones for $status',
    ({ status, value }) => {
      render(<CustomerJourney status={status} />);
      const progress = screen.getByRole('progressbar', {
        name: 'Delivery milestones',
      });
      expect(progress).toHaveAttribute('aria-valuenow', value);
      expect(
        screen
          .getByRole('list', { name: 'Delivery journey' })
          .querySelectorAll('[aria-current="step"]'),
      ).toHaveLength(1);
    },
  );
  it.each(['Failed', 'Cancelled'] as const)(
    'does not present %s as a completed delivery',
    (status) => {
      render(<CustomerJourney status={status} />);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.getByText(/timeline/)).toBeInTheDocument();
    },
  );
});
