'use client';

import React, { useState, type ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { AppSidebar, MobileBottomNav, type AppTab } from '@/components/app-sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export type { AppTab } from '@/components/app-sidebar';

export function AppShell({ activeTab, onTabChange, title, baseCurrency, onBaseCurrencyChange, onRefresh, onAddTransaction, onOpenAlerts, onLogout, children }: { activeTab: AppTab; onTabChange: (tab: AppTab) => void; title: string; baseCurrency?: 'USD' | 'VND'; onBaseCurrencyChange?: (currency: 'USD' | 'VND') => void; onRefresh?: () => void; onAddTransaction?: () => void; onOpenAlerts?: () => void; onLogout?: () => void; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const selectTab = (tab: AppTab) => { onTabChange(tab); setMobileOpen(false); };
  return <div className="app-canvas min-h-screen min-w-0 max-w-full overflow-x-clip text-foreground md:grid md:grid-cols-[17rem_minmax(0,1fr)] md:gap-4 md:p-4">
    <div className="hidden md:sticky md:top-4 md:block md:h-[calc(100vh-2rem)]"><AppSidebar activeTab={activeTab} onTabChange={onTabChange} /></div>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent className="p-0"><AppSidebar activeTab={activeTab} onTabChange={selectTab} /></SheetContent></Sheet>
    <div className="min-w-0 max-w-full overflow-x-clip"><AppHeader title={title} baseCurrency={baseCurrency} onBaseCurrencyChange={onBaseCurrencyChange} onMenu={() => setMobileOpen(true)} onRefresh={onRefresh} onAddTransaction={onAddTransaction} onOpenAlerts={onOpenAlerts} onLogout={onLogout} /><main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-visible px-3 pb-28 pt-4 sm:px-5 md:px-2 md:pb-6 md:pt-5">{children}<footer className="px-2 pt-8 text-xs text-muted-foreground"><a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-foreground hover:underline">Data provided by CoinGecko</a></footer></main></div>
    <MobileBottomNav activeTab={activeTab} onTabChange={selectTab} />
  </div>;
}
