import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '~/shared/components/ui/alert';
import { Button } from '~/shared/components/ui/button';
import { useCourier } from './context';
export function Pending() {
  const { state, workflow } = useCourier();
  const queries = useQueryClient();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return (
    <Alert aria-label="Pending delivery request" className="space-y-3">
      <p>
        The original request is retained in this open session. Keep this page
        open until its outcome is confirmed. Other actions are paused.
      </p>
      <Button
        disabled={state.busy || now < state.retryAt}
        onClick={() => {
          void workflow.submit().then((r) => {
            if (r === 'success' || r === 'reload' || r === 'denied') {
              void queries.resetQueries({ queryKey: ['courier'] });
            }
          });
        }}
      >
        {state.busy ? 'Waiting for confirmation...' : 'Retry original request'}
      </Button>
    </Alert>
  );
}
