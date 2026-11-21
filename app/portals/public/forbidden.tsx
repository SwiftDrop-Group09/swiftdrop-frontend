import { AccessPage } from '~/features/identity/access-page';
export const meta = () => [{ title: '403 · Access denied | SwiftDrop' }];
export default function Forbidden() {
  return <AccessPage status={403} />;
}
