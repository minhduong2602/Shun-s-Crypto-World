'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Bell,
  Check,
  LogOut,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  User,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCurrency?: 'USD' | 'VND';
  onBaseCurrencyChange?: (currency: 'USD' | 'VND') => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  onRefresh?: () => void;
  onLogout?: () => void;
  onOpenAlerts?: () => void;
  username: string;
  onUpdateUsername: (name: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  baseCurrency,
  onBaseCurrencyChange,
  darkMode,
  onToggleTheme,
  onRefresh,
  onLogout,
  onOpenAlerts,
  username,
  onUpdateUsername,
}: SettingsModalProps) {
  const [nameInput, setNameInput] = useState(username);
  const [syncing, setSyncing] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    setNameInput(username);
  }, [username]);

  const handleSaveName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = nameInput.trim() || 'Shun';
    onUpdateUsername(trimmed);
    setNameInput(trimmed);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleSync = async () => {
    if (!onRefresh || syncing) return;
    setSyncing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setSyncing(false), 600);
    }
  };

  const initials = (username || 'Shun').slice(0, 2).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="border-b pb-3.5 text-left">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Settings className="size-4" />
            </div>
            <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
              Cài đặt
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1 text-sm">
          {/* Hồ sơ cá nhân: Avatar initials + Username input */}
          <div className="flex items-center gap-3 rounded-2xl border bg-card/60 p-3">
            <Avatar className="size-10 shrink-0 bg-slate-400 text-white dark:bg-slate-600">
              <AvatarFallback className="bg-slate-400 font-bold text-xs text-white dark:bg-slate-600">
                {initials}
              </AvatarFallback>
            </Avatar>
            <form onSubmit={handleSaveName} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative flex-1">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Tên người dùng..."
                  className="h-9 rounded-xl pl-8 text-xs sm:text-sm"
                  maxLength={30}
                />
              </div>
              <Button type="submit" size="sm" className="h-9 rounded-xl px-3 text-xs gap-1">
                {savedFeedback ? <Check className="size-3.5" /> : null}
                <span>{savedFeedback ? 'Đã lưu' : 'Lưu'}</span>
              </Button>
            </form>
          </div>

          {/* Gộp các mục: Tiền tệ, Giao diện, Hệ thống & dữ liệu thành 1 mục dạng các nút bấm có text */}
          <div className="rounded-2xl border bg-card/60 p-2 space-y-2">
            {/* Tiền tệ */}
            {baseCurrency && onBaseCurrencyChange && (
              <div className="flex items-center justify-between rounded-xl p-2 hover:bg-accent/40">
                <span className="text-xs sm:text-sm font-medium">Đơn vị tiền tệ</span>
                <Tabs
                  value={baseCurrency}
                  onValueChange={(val) => onBaseCurrencyChange(val as 'USD' | 'VND')}
                >
                  <TabsList aria-label="Đơn vị tiền tệ hiển thị" className="h-9">
                    <TabsTrigger value="USD" className="h-7 px-3 text-xs">
                      USD
                    </TabsTrigger>
                    <TabsTrigger value="VND" className="h-7 px-3 text-xs">
                      VND
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Giao diện */}
            <div className="flex items-center justify-between rounded-xl p-2 hover:bg-accent/40">
              <span className="text-xs sm:text-sm font-medium">Giao diện</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleTheme}
                className="h-9 rounded-xl gap-2 text-xs min-w-28 justify-center"
                aria-label={darkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              >
                {darkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                <span>{darkMode ? 'Giao diện sáng' : 'Giao diện tối'}</span>
              </Button>
            </div>

            {/* Đồng bộ dữ liệu */}
            {onRefresh && (
              <div className="flex items-center justify-between rounded-xl p-2 hover:bg-accent/40">
                <span className="text-xs sm:text-sm font-medium">Dữ liệu thị trường</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-9 rounded-xl gap-2 text-xs min-w-28 justify-center"
                  aria-label="Đồng bộ dữ liệu"
                >
                  <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}</span>
                </Button>
              </div>
            )}

            {/* Cảnh báo Telegram nếu có */}
            {onOpenAlerts && (
              <div className="flex items-center justify-between rounded-xl p-2 hover:bg-accent/40">
                <span className="text-xs sm:text-sm font-medium">Thông báo giá</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenAlerts();
                  }}
                  className="h-9 rounded-xl gap-2 text-xs min-w-28 justify-center"
                  aria-label="Cảnh báo Telegram"
                >
                  <Bell className="size-3.5" />
                  <span>Cảnh báo Telegram</span>
                </Button>
              </div>
            )}
          </div>

          {/* Riêng nút đăng xuất thì để riêng cuối menu */}
          {onLogout && (
            <div className="pt-2 border-t">
              <Button
                type="button"
                variant="destructive"
                onClick={onLogout}
                className="w-full h-10 rounded-xl gap-2 text-xs font-medium"
                aria-label="Đăng xuất"
              >
                <LogOut className="size-4" />
                <span>Đăng xuất</span>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
