import { AccessPage } from '~/features/identity/access-page';
export const meta = () => [{ title: '401 · Sign in | SwiftDrop' }];
export default function Unauthorized() {
  return <AccessPage status={401} />;
}
