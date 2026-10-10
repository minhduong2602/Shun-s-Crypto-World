'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { AppSidebar, MobileBottomNav, type AppTab } from '@/components/app-sidebar';
import { SettingsModal } from '@/components/settings-modal';

export type { AppTab } from '@/components/app-sidebar';

export function AppShell({
  activeTab,
  onTabChange,
  title,
  baseCurrency,
  onBaseCurrencyChange,
  onRefresh,
  onAddTransaction,
  onOpenAlerts,
  onLogout,
  children,
}: {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  title: string;
  baseCurrency?: 'USD' | 'VND';
  onBaseCurrencyChange?: (currency: 'USD' | 'VND') => void;
  onRefresh?: () => void;
  onAddTransaction?: () => void;
  onOpenAlerts?: () => void;
  onLogout?: () => void;
  children: ReactNode;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [username, setUsername] = useState('Shun');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = window.localStorage.getItem('shun_username');
      if (savedName) setUsername(savedName);
      const savedTheme = window.localStorage.getItem('theme');
      const isDark = savedTheme === 'dark';
      setDarkMode(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, []);

  const handleUpdateUsername = (name: string) => {
    setUsername(name);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('shun_username', name);
    }
  };

  const toggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', nextDark);
      window.localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    }
  };

  return (
    <div className="app-canvas min-h-screen min-w-0 max-w-full overflow-x-clip text-foreground md:grid md:grid-cols-[17rem_minmax(0,1fr)] md:gap-4 md:p-4">
      {/* Desktop viewport: left sidebar */}
      <div className="hidden md:sticky md:top-4 md:block md:h-[calc(100vh-2rem)]">
        <AppSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          username={username}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* Main Content Area */}
      <div className="min-w-0 max-w-full overflow-x-clip">
        {/* Top Header chỉ hiện trên Mobile; Desktop loại bỏ Top Header theo yêu cầu */}
        <AppHeader
          title={title}
          username={username}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-visible px-3 pb-28 pt-4 sm:px-5 md:px-2 md:pb-6 md:pt-2">
          {children}
          <footer className="px-2 pt-8 text-xs text-muted-foreground">
            <a
              href="https://www.coingecko.com/en/api"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Data provided by CoinGecko
            </a>
          </footer>
        </main>
      </div>

      {/* Nút add transaction (dấu cộng): absolute button floating bên góc phải bên dưới bên trên bottom nav bar */}
      {onAddTransaction && (
        <button
          type="button"
          onClick={onAddTransaction}
          aria-label="Giao dịch"
          title="Thêm giao dịch mới"
          className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex size-13 sm:size-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/35 transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:shadow-primary/45 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:bottom-8 md:right-8"
        >
          <Plus className="size-6 stroke-[2.5]" />
          <span className="sr-only">Giao dịch</span>
        </button>
      )}

      {/* Mobile viewport: bottom navbar */}
      <MobileBottomNav activeTab={activeTab} onTabChange={onTabChange} />

      {/* Modal Settings */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        baseCurrency={baseCurrency}
        onBaseCurrencyChange={onBaseCurrencyChange}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
        onRefresh={onRefresh}
        onLogout={onLogout}
        onOpenAlerts={onOpenAlerts}
        username={username}
        onUpdateUsername={handleUpdateUsername}
      />
    </div>
  );
}
