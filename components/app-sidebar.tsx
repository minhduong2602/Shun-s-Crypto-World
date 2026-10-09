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
    <aside className={cn('glass-nav flex h-full flex-col rounded-[2rem]', className)}>
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><CandlestickChart className="size-5" /></div>
        <div><p className="font-semibold leading-none tracking-tight">Shun&apos;s Crypto</p><p className="mt-1.5 text-xs text-muted-foreground">Your money, in focus</p></div>
      </div>
      <nav className="grid gap-2 px-3 py-4" aria-label="Điều hướng chính">
        {items.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant={activeTab === id ? 'default' : 'ghost'} className={cn('justify-start gap-3 rounded-2xl', activeTab === id && 'shadow-lg shadow-primary/20')} onClick={() => onTabChange(id)}>
            <Icon className="size-4" />{label}
          </Button>
        ))}
      </nav>
      <div className="m-3 mt-auto rounded-2xl bg-secondary/70 p-4 text-xs text-muted-foreground"><span className="mr-2 inline-block size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgb(16_185_129_/_0.12)]" />Dữ liệu trực tiếp</div>
    </aside>
  );
}

export function MobileBottomNav({ activeTab, onTabChange }: { activeTab: AppTab; onTabChange: (tab: AppTab) => void }) {
  return <nav aria-label="Điều hướng di động" className="glass-nav fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.75rem] p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] md:hidden">
    {items.map(({ id, label, icon: Icon }) => {
      const active = activeTab === id;
      return <button key={id} type="button" onClick={() => onTabChange(id)} aria-current={active ? 'page' : undefined} aria-label={label} className={cn('flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active && 'bg-primary text-primary-foreground shadow-lg shadow-primary/25')}>
        <Icon className="size-5" />
        <span>{label}</span>
      </button>;
    })}
  </nav>;
}
