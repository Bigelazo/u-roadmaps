'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from '@base-ui/react/menu';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from 'cn';
import styles from './speed-dial.module.css';

type SpeedDialAction = {
  id: string;
  label: string;
  accessibleLabel?: string;
  icon: ReactNode;
  onSelect: () => void;
};

type Props = {
  label: string;
  actionsFromTopToTrigger: readonly SpeedDialAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SpeedDial({ label, actionsFromTopToTrigger, open, onOpenChange }: Props) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);

  return (
    <div ref={setLayer} data-slot="speed-dial" className={styles.layer}>
      <Menu.Root open={open} onOpenChange={onOpenChange}>
        <Menu.Trigger
          data-toast-anchor=""
          aria-label={label}
          render={
            <Button
              type="button"
              size="icon-lg"
              className={cn(styles.trigger, open && styles.triggerOpen)}
            />
          }
        >
          <span aria-hidden="true" className={styles.triggerIcon}>
            <Plus />
          </span>
        </Menu.Trigger>
        <Menu.Portal container={layer}>
          <Menu.Positioner
            data-toast-obstacle=""
            side="top"
            align="end"
            sideOffset={0}
            className={styles.positioner}
          >
            <Menu.Popup aria-label={label} className={styles.popup}>
              {actionsFromTopToTrigger.map((action) => (
                <Menu.Item
                  key={action.id}
                  aria-label={action.accessibleLabel ?? action.label}
                  className={styles.action}
                  onClick={action.onSelect}
                >
                  <span className={styles.actionLabel} aria-hidden="true">
                    {action.label}
                  </span>
                  <span className={styles.actionButton} aria-hidden="true">
                    {action.icon}
                  </span>
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
