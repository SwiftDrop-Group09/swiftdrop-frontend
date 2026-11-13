import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { FilterBuilder, FilterLabels, type FilterRule } from './filter-builder';
const fields = [
  {
    key: 'role',
    label: 'Role',
    options: [
      { value: 'Admin', label: 'Admin' },
      { value: 'Customer', label: 'Customer' },
    ],
  },
];
function Harness() {
  const [rules, setRules] = useState<FilterRule[]>([]);
  return (
    <>
      <FilterBuilder fields={fields} rules={rules} onChange={setRules} />
      <FilterLabels fields={fields} rules={rules} onChange={setRules} />
    </>
  );
}
describe('Reusable filters', () => {
  it('adds a negative rule, replaces a field and clears labels individually or together', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('button', { name: 'Add filter' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Comparison'), 'isNot');
    await user.selectOptions(screen.getByLabelText('Value'), 'Admin');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));
    expect(screen.getByText('Role is not Admin')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    await user.selectOptions(screen.getByLabelText('Comparison'), 'is');
    await user.selectOptions(screen.getByLabelText('Value'), 'Customer');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));
    expect(screen.queryByText('Role is not Admin')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Remove filter: Role is Customer' }),
    );
    expect(screen.queryByLabelText('Active filters')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.selectOptions(screen.getByLabelText('Value'), 'Admin');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(screen.queryByLabelText('Active filters')).not.toBeInTheDocument();
  });
});
