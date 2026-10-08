'use client';

import React from 'react';

import { BarChart3, CandlestickChart, LayoutDashboard, Sparkles, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AppTab = 'portfolio' | 'market' | 'chart' | 'wallets' | 'ai';

const items: Array<{ id: AppTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'portfolio', label: 'Danh mục', icon: LayoutDashboard },
  { id: 'market', label: 'Thị trường', icon: BarChart3 },
  { id: 'chart', label: 'Biểu đồ', icon: CandlestickChart },
  { id: 'wallets', label: 'Ví', icon: WalletCards },
  { id: 'ai', label: 'AI', icon: Sparkles },
];

export function AppSidebar({ activeTab, onTabChange, className }: { activeTab: AppTab; onTabChange: (tab: AppTab) => void; className?: string }) {
  return (
    <aside className={cn('flex h-full flex-col bg-card', className)}>
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="grid size-9 place-items-center rounded-lg bg-emerald-500 text-emerald-950"><CandlestickChart className="size-5" /></div>
        <div><p className="font-semibold leading-none">Shun&apos;s Crypto</p><p className="mt-1 text-xs text-muted-foreground">Portfolio tracker</p></div>
      </div>
      <nav className="grid gap-1 px-3 py-4" aria-label="Điều hướng chính">
        {items.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant={activeTab === id ? 'secondary' : 'ghost'} className="justify-start gap-3" onClick={() => onTabChange(id)}>
            <Icon className="size-4" />{label}
          </Button>
        ))}
      </nav>
      <div className="mt-auto border-t p-4 text-xs text-muted-foreground"><span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" />Dữ liệu trực tiếp</div>
    </aside>
  );
}
