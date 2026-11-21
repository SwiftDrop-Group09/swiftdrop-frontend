import { Monitor, Moon, Sun } from 'lucide-react';
import {
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '~/shared/components/ui/dropdown-menu';
import { useTheme } from '~/shared/theme';

export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Sun aria-hidden="true" />
        Appearance
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup
            aria-label="Appearance"
            value={theme}
            onValueChange={(value) => {
              if (value === 'light' || value === 'dark' || value === 'device')
                setTheme(value);
            }}
          >
            <DropdownMenuRadioItem value="light">
              <Sun aria-hidden="true" />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon aria-hidden="true" />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="device">
              <Monitor aria-hidden="true" />
              Device
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
