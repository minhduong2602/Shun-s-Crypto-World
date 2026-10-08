'use client';

import React from 'react';

import { Menu, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppHeader({ title, onMenu, onRefresh }: { title: string; onMenu: () => void; onRefresh?: () => void }) {
  return <header className="flex h-16 items-center gap-3 border-b bg-background px-4 md:px-6">
    <Button variant="ghost" size="icon" className="md:hidden" aria-label="Mở điều hướng" onClick={onMenu}><Menu className="size-5" /></Button>
    <h1 className="text-lg font-semibold">{title}</h1>
    {onRefresh && <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={onRefresh}><RefreshCw className="size-4" />Đồng bộ</Button>}
  </header>;
}
