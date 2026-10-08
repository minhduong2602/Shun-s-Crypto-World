'use client';

import React from 'react';

import { Bell, LogOut, Menu, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AppHeader({ title, baseCurrency, onBaseCurrencyChange, onMenu, onRefresh, onAddTransaction, onOpenAlerts, onLogout }: { title: string; baseCurrency?: 'USD' | 'VND'; onBaseCurrencyChange?: (currency: 'USD' | 'VND') => void; onMenu: () => void; onRefresh?: () => void; onAddTransaction?: () => void; onOpenAlerts?: () => void; onLogout?: () => void }) {
  return <header className="flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
    <Button variant="ghost" size="icon" className="md:hidden" aria-label="Mở điều hướng" onClick={onMenu}><Menu className="size-5" /></Button>
    <h1 className="text-lg font-semibold">{title}</h1>
    <div className="ml-auto flex items-center gap-2">
      {baseCurrency && onBaseCurrencyChange && <Tabs value={baseCurrency} onValueChange={(value) => onBaseCurrencyChange(value as 'USD' | 'VND')}>
        <TabsList aria-label="Đơn vị tiền tệ hiển thị" className="h-8">
          <TabsTrigger value="USD" className="h-6 px-2 text-xs">USD</TabsTrigger>
          <TabsTrigger value="VND" className="h-6 px-2 text-xs">VND</TabsTrigger>
        </TabsList>
      </Tabs>}
      {onOpenAlerts && <Button variant="ghost" size="icon" aria-label="Cảnh báo Telegram" title="Cảnh báo Telegram" onClick={onOpenAlerts}><Bell className="size-4" /></Button>}
      {onAddTransaction && <Button size="sm" className="gap-2" onClick={onAddTransaction}><Plus className="size-4" /><span className="hidden sm:inline">Giao dịch</span></Button>}
      {onRefresh && <Button variant="outline" size="sm" aria-label="Đồng bộ dữ liệu" title="Đồng bộ dữ liệu" onClick={onRefresh}><RefreshCw className="size-4" /><span className="hidden sm:inline">Đồng bộ</span></Button>}
      {onLogout && <Button variant="ghost" size="icon" aria-label="Đăng xuất" title="Đăng xuất" onClick={onLogout}><LogOut className="size-4" /></Button>}
    </div>
  </header>;
}
