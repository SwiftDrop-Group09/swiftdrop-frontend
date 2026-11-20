import { AssistantPage } from '~/features/ai-assistant/assistant-page';
import { IdentityShell, Protected } from '~/features/identity/components';

export default function CustomerAssistantPortal() {
  return (
    <IdentityShell>
      <Protected
        roles={['Customer', 'Courier', 'Merchant', 'Dispatcher', 'Admin']}
      >
        <AssistantPage />
      </Protected>
    </IdentityShell>
  );
}
