import { AppLoading } from '~/shared/components/app-loading';
import { Navigate } from 'react-router';
import { useIdentity } from './session';

export function SessionEntry({ register = false }: { register?: boolean }) {
  const { user, restoring } = useIdentity();
  if (restoring) return <AppLoading />;
  return (
    <Navigate
      to={user ? '/dashboard' : register ? '/register' : '/login'}
      replace
    />
  );
}
