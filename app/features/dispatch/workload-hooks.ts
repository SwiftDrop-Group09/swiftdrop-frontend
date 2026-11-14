import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '~/features/identity/session';
import { listCourierWorkload, listDispatchAssignments } from './workload-api';

export function useCourierWorkload(page: number) {
  const { session, user, restoring } = useIdentity();
  return useQuery({
    queryKey: ['dispatch-workload', user?.id, page],
    enabled:
      !restoring &&
      !!user?.roles.some((role) => role === 'Dispatcher' || role === 'Admin'),
    queryFn: ({ signal }) =>
      listCourierWorkload(
        session.authenticatedRequest,
        session.api.base,
        page,
        signal,
      ),
  });
}

export function useDispatchAssignments(courierId: string, page: number) {
  const { session, user, restoring } = useIdentity();
  return useQuery({
    queryKey: ['dispatch-assignments', user?.id, courierId, page],
    enabled:
      !restoring &&
      !!user?.roles.some((role) => role === 'Dispatcher' || role === 'Admin'),
    queryFn: ({ signal }) =>
      listDispatchAssignments(
        session.authenticatedRequest,
        session.api.base,
        courierId,
        page,
        signal,
      ),
  });
}
