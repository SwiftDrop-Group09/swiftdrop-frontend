import type { ComponentProps } from 'react';
import { WorkspacePage } from '~/shared/components/workspace-page';

export function AdminWorkspace(
  props: Omit<ComponentProps<typeof WorkspacePage>, 'eyebrow'>,
) {
  return <WorkspacePage {...props} />;
}
