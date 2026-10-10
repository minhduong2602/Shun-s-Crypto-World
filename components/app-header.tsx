'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface AppHeaderProps {
  title: string;
  username?: string;
  avatarIcon?: string;
  onOpenSettings: () => void;
  className?: string;
  // Optional legacy props maintained for interface safety
  baseCurrency?: 'USD' | 'VND';
  onBaseCurrencyChange?: (currency: 'USD' | 'VND') => void;
  onMenu?: () => void;
  onRefresh?: () => void;
  onAddTransaction?: () => void;
  onOpenAlerts?: () => void;
  onLogout?: () => void;
}

export function AppHeader({
  title,
  username = 'Shun',
  onOpenSettings,
  className,
}: AppHeaderProps) {
  const initials = (username || 'Shun').slice(0, 2).toUpperCase();

  return (
    <header className={cn('glass-nav sticky top-2 z-30 mx-3 mt-2 flex h-16 items-center justify-between rounded-[1.5rem] px-3 sm:px-4 md:hidden', className)}>
      {/* Mobile Top Header: User avatar nhỏ nhỏ cùng username bên trái */}
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenSettings}
          className="group flex items-center gap-2 rounded-2xl p-1 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Hồ sơ ${username}`}
          title="Mở cài đặt hồ sơ"
        >
          <Avatar className="size-8 ring-2 ring-primary/20 shadow-sm transition-transform group-hover:scale-105">
            <AvatarFallback className="bg-slate-400 font-bold text-xs text-white dark:bg-slate-600">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-left leading-tight">
            <span className="block max-w-[100px] truncate text-xs font-semibold sm:max-w-[140px] sm:text-sm">
              {username}
            </span>

          </div>
        </button>
      </div>

      {/* Mobile Top Header: Nút Settings (cog) bên phải */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-2xl"
          aria-label="Cài đặt"
          title="Cài đặt"
          onClick={onOpenSettings}
        >
          <Settings className="size-5" />
        </Button>
      </div>
    </header>
  );
}
