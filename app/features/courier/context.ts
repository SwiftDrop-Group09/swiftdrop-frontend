import { createContext, useContext, useSyncExternalStore } from 'react';
import type { CourierApi } from './api';
import type { CourierWorkflow } from './workflow';

export const CourierContext = createContext<{
  api: CourierApi;
  workflow: CourierWorkflow;
  scope: string;
} | null>(null);
export function useCourier() {
  const context = useContext(CourierContext);
  if (!context) throw Error('Courier workspace required');
  return {
    ...context,
    state: useSyncExternalStore(
      context.workflow.subscribe,
      context.workflow.getSnapshot,
      context.workflow.getSnapshot,
    ),
  };
}
