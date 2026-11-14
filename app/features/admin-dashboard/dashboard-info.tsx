import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Button } from '~/shared/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/shared/components/ui/tooltip';

export function DashboardInfo({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground"
          aria-label={`About ${label}`}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        className="max-w-72 text-sm leading-relaxed"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
