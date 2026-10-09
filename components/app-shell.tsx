'use client';

import React, { useState, type ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { AppSidebar, type AppTab } from '@/components/app-sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export type { AppTab } from '@/components/app-sidebar';

export function AppShell({ activeTab, onTabChange, title, baseCurrency, onBaseCurrencyChange, onRefresh, onAddTransaction, onOpenAlerts, onLogout, children }: { activeTab: AppTab; onTabChange: (tab: AppTab) => void; title: string; baseCurrency?: 'USD' | 'VND'; onBaseCurrencyChange?: (currency: 'USD' | 'VND') => void; onRefresh?: () => void; onAddTransaction?: () => void; onOpenAlerts?: () => void; onLogout?: () => void; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const selectTab = (tab: AppTab) => { onTabChange(tab); setMobileOpen(false); };
  return <div className="app-canvas min-h-screen text-foreground md:grid md:grid-cols-[16rem_1fr]">
    <div className="hidden border-r border-white/10 md:block"><AppSidebar activeTab={activeTab} onTabChange={onTabChange} /></div>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent className="p-0"><AppSidebar activeTab={activeTab} onTabChange={selectTab} /></SheetContent></Sheet>
    <div className="min-w-0"><AppHeader title={title} baseCurrency={baseCurrency} onBaseCurrencyChange={onBaseCurrencyChange} onMenu={() => setMobileOpen(true)} onRefresh={onRefresh} onAddTransaction={onAddTransaction} onOpenAlerts={onOpenAlerts} onLogout={onLogout} /><main className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}<footer className="pt-8 text-xs text-muted-foreground"><a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-foreground hover:underline">Data provided by CoinGecko</a></footer></main></div>
  </div>;
}
