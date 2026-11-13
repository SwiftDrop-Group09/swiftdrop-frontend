import { describe, it, expect } from 'vitest';
import { profileSchema } from './contracts';
import { customer } from './test-fixtures';
import { getWorkspaceNavigation } from './workspace-navigation';
describe('Exactly one account role', () => {
  it.each([
    { roles: [] },
    { roles: ['Customer', 'Admin'] },
    { roles: ['Unknown'] },
  ])('rejects invalid role assignments %j', ({ roles }) => {
    expect(profileSchema.safeParse({ ...customer, roles }).success).toBe(false);
  });
  it('does not combine navigation for ambiguous direct callers', () => {
    expect(getWorkspaceNavigation(['Customer', 'Admin'])).toEqual([]);
    expect(getWorkspaceNavigation([])).toEqual([]);
    expect(getWorkspaceNavigation(['Customer']).length).toBeGreaterThan(0);
  });
});
