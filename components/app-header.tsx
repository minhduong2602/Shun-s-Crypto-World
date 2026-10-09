'use client';

import React, { useEffect, useState } from 'react';

import { Bell, LogOut, Menu, Moon, Plus, RefreshCw, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AppHeader({ title, baseCurrency, onBaseCurrencyChange, onMenu, onRefresh, onAddTransaction, onOpenAlerts, onLogout }: { title: string; baseCurrency?: 'USD' | 'VND'; onBaseCurrencyChange?: (currency: 'USD' | 'VND') => void; onMenu: () => void; onRefresh?: () => void; onAddTransaction?: () => void; onOpenAlerts?: () => void; onLogout?: () => void }) {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('theme');
    const dark = savedTheme
      ? savedTheme === 'dark'
      : typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
    window.localStorage.setItem('theme', nextDark ? 'dark' : 'light');
  };

  return <header className="glass-nav sticky top-0 z-40 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-x-0 border-t-0 px-3 py-2 md:h-16 md:flex-nowrap md:px-6 md:py-0">
    <div className="flex min-w-0 items-center gap-2">
      <Button variant="ghost" size="icon" className="size-11 shrink-0 md:hidden" aria-label="Mở điều hướng" onClick={onMenu}><Menu className="size-5" /></Button>
      <h1 className="truncate text-base font-semibold md:text-lg">{title}</h1>
    </div>
    <div className="flex w-full min-w-0 items-center justify-between gap-1 md:ml-auto md:w-auto md:justify-end md:gap-2">
      {baseCurrency && onBaseCurrencyChange && <Tabs value={baseCurrency} onValueChange={(value) => onBaseCurrencyChange(value as 'USD' | 'VND')}>
        <TabsList aria-label="Đơn vị tiền tệ hiển thị" className="h-11 shrink-0 sm:h-9">
          <TabsTrigger value="USD" className="min-h-9 px-2 text-xs">USD</TabsTrigger>
          <TabsTrigger value="VND" className="min-h-9 px-2 text-xs">VND</TabsTrigger>
        </TabsList>
      </Tabs>}
      <Button variant="ghost" size="icon" className="size-11 shrink-0 sm:size-10" aria-label={darkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} title={darkMode ? 'Giao diện sáng' : 'Giao diện tối'} onClick={toggleTheme}>{darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
      {onOpenAlerts && <Button variant="ghost" size="icon" className="size-11 shrink-0 sm:size-10" aria-label="Cảnh báo Telegram" title="Cảnh báo Telegram" onClick={onOpenAlerts}><Bell className="size-4" /></Button>}
      {onAddTransaction && <Button size="sm" className="size-11 shrink-0 p-0 md:h-8 md:w-auto md:px-3" aria-label="Giao dịch" onClick={onAddTransaction}><Plus className="size-4" /><span className="hidden sm:inline">Giao dịch</span></Button>}
      {onRefresh && <Button variant="outline" size="sm" className="size-11 shrink-0 p-0 md:h-8 md:w-auto md:px-3" aria-label="Đồng bộ dữ liệu" title="Đồng bộ dữ liệu" onClick={onRefresh}><RefreshCw className="size-4" /><span className="hidden sm:inline">Đồng bộ</span></Button>}
      {onLogout && <Button variant="ghost" size="icon" className="size-11 shrink-0 sm:size-10" aria-label="Đăng xuất" title="Đăng xuất" onClick={onLogout}><LogOut className="size-4" /></Button>}
    </div>
  </header>;
}
