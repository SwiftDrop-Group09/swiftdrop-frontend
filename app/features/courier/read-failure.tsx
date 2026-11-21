import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '~/shared/components/ui/alert';
import { Button } from '~/shared/components/ui/button';
import { CourierError } from './api';
import { useCourier } from './context';
export function CourierReadFailure({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const { workflow, scope } = useCourier();
  const queries = useQueryClient();
  useEffect(() => {
    if (error instanceof CourierError && [401, 403].includes(error.status)) {
      workflow.denyRead();
      queries.removeQueries({ queryKey: ['courier', scope] });
    }
  }, [error, workflow, queries, scope]);
  return (
    <Alert variant="destructive" className="space-y-3">
      <p>
        {error instanceof CourierError
          ? error.message
          : 'Unable to load deliveries.'}
      </p>
      {!(
        error instanceof CourierError && [401, 403, 404].includes(error.status)
      ) && <Button onClick={retry}>Reload</Button>}
    </Alert>
  );
}
