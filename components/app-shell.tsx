'use client';

import React, { useState, type ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { AppSidebar, type AppTab } from '@/components/app-sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export type { AppTab } from '@/components/app-sidebar';

export function AppShell({ activeTab, onTabChange, title, onRefresh, children }: { activeTab: AppTab; onTabChange: (tab: AppTab) => void; title: string; onRefresh?: () => void; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const selectTab = (tab: AppTab) => { onTabChange(tab); setMobileOpen(false); };
  return <div className="min-h-screen bg-muted/30 text-foreground md:grid md:grid-cols-[15rem_1fr]">
    <div className="hidden border-r md:block"><AppSidebar activeTab={activeTab} onTabChange={onTabChange} /></div>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent className="p-0"><AppSidebar activeTab={activeTab} onTabChange={selectTab} /></SheetContent></Sheet>
    <div className="min-w-0"><AppHeader title={title} onMenu={() => setMobileOpen(true)} onRefresh={onRefresh} /><main className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</main></div>
  </div>;
}
