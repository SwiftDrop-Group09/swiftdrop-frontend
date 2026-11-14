import { Link } from 'react-router';
import { WorkspacePage } from '~/shared/components/workspace-page';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { useIdentity } from './session';
import { getWorkspaceNavigation } from './workspace-navigation';

export function RoleHome() {
  const { user } = useIdentity();
  const groups = getWorkspaceNavigation(user!.roles).filter(
    (group) => group.id !== 'workspace',
  );
  return (
    <WorkspacePage
      title="Dashboard"
      description="Open your workspace to manage the tasks available to your account."
    >
      <div
        aria-label="Dashboard workspace"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle>{group.label}</CardTitle>
              <CardDescription>
                Your available tools and workflows.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {group.items
                .filter((item) => item.to)
                .map(({ label, to, icon: Icon }) => (
                  <Button
                    key={label}
                    asChild
                    variant="outline"
                    className="justify-start"
                  >
                    <Link to={to!} aria-label={`Open ${label}`}>
                      <Icon aria-hidden="true" />
                      {label}
                    </Link>
                  </Button>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </WorkspacePage>
  );
}
