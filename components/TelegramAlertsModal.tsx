'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  X,
  Bell,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { PriceAlert, AlertCondition } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TelegramAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCurrency: string;
}

interface WalletAssetOption {
  id: string;
  chain: string;
  symbol: string;
  name: string;
  assetAddress: string;
  isNative: boolean;
}

export const TelegramAlertsModal: React.FC<TelegramAlertsModalProps> = ({
  isOpen,
  onClose,
  baseCurrency,
}) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [walletAssets, setWalletAssets] = useState<WalletAssetOption[]>([]);
  const [deliveries, setDeliveries] = useState<Array<{
    id: string;
    alertId: string;
    observedPriceUsd: number | null;
    observedChange24h: number | null;
    status: 'pending' | 'sent' | 'failed' | 'skipped';
    createdAt: string;
  }>>([]);
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingMsg, setTestingMsg] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [newAlertError, setNewAlertError] = useState<string | null>(null);
  const [alertActionError, setAlertActionError] = useState<string | null>(null);
  const [alertLoadError, setAlertLoadError] = useState<string | null>(null);
  const [creatingAlert, setCreatingAlert] = useState(false);

  // New alert form
  const [newSymbol, setNewSymbol] = useState('BTC');
  const [newCondition, setNewCondition] = useState<AlertCondition>('ABOVE');
  const [newTarget, setNewTarget] = useState('95000');
  const [newRecurring, setNewRecurring] = useState(false);
  const [newWalletAssetId, setNewWalletAssetId] = useState('ticker');
  const previousNewCondition = useRef(newCondition);

  // Editing alert state
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState('');
  const [editCondition, setEditCondition] = useState<AlertCondition>('ABOVE');
  const [editRecurring, setEditRecurring] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadAlerts();
  }, [isOpen]);

  async function loadAlerts() {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể tải cảnh báo');
      if (data.alerts) setAlerts(data.alerts);
      if (Array.isArray(data.walletAssets)) setWalletAssets(data.walletAssets);
      if (Array.isArray(data.deliveries)) setDeliveries(data.deliveries);
      if (data.telegramConfig) {
        setChatId(data.telegramConfig.chatId || '');
      }
      setAlertLoadError(null);
    } catch (error) {
      setAlertLoadError(error instanceof Error ? error.message : 'Không thể kết nối máy chủ');
    }
  }

  const handleStartEdit = (alt: PriceAlert) => {
    setEditingAlertId(alt.id);
    setEditTarget(String(alt.targetValue));
    setEditCondition(alt.condition);
    setEditRecurring(alt.isRecurring);
  };

  const handleCancelEdit = () => {
    setEditingAlertId(null);
  };

  const handleSaveEdit = async (id: string) => {
    setAlertActionError(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          condition: editCondition,
          targetValue: Number(editTarget),
          isRecurring: editRecurring,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu cảnh báo');
      setEditingAlertId(null);
      await loadAlerts();
    } catch (error) {
      setAlertActionError(error instanceof Error ? error.message : 'Không thể kết nối máy chủ');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/alerts/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, saveOnly: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, msg: 'Đã lưu cấu hình Telegram Bot thành công!' });
      } else {
        setTestResult({ success: false, msg: data.error || 'Lỗi lưu thông tin' });
      }
    } catch (e) {
      setTestResult({ success: false, msg: 'Không thể kết nối máy chủ' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestPing = async () => {
    setTestingMsg(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/alerts/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, saveOnly: false }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, msg: '🎉 Tin nhắn thử nghiệm đã được gửi đến Telegram thành công!' });
      } else {
        setTestResult({ success: false, msg: data.error || 'Lỗi gửi tin nhắn Telegram' });
      }
    } catch (e) {
      setTestResult({ success: false, msg: 'Lỗi gửi thử nghiệm: Vui lòng kiểm tra lại Bot Token' });
    } finally {
      setTestingMsg(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewAlertError(null);
    setCreatingAlert(true);
    const linkedAsset = walletAssets.find((asset) => asset.id === newWalletAssetId);
    const symbol = (linkedAsset?.symbol ?? newSymbol).trim().toUpperCase();
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinId: symbol.toLowerCase(),
          symbol,
          ...(linkedAsset ? { walletAssetId: linkedAsset.id } : {}),
          condition: newCondition,
          targetValue: Number(newTarget),
          isRecurring: newRecurring,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể tạo cảnh báo');
      await loadAlerts();
      setNewWalletAssetId('ticker');
    } catch (error) {
      setNewAlertError(error instanceof Error ? error.message : 'Không thể kết nối máy chủ');
    } finally {
      setCreatingAlert(false);
    }
  };

  const handleNewConditionChange = (value: string) => {
    const nextCondition = value as AlertCondition;
    const currentCondition = previousNewCondition.current;
    previousNewCondition.current = nextCondition;
    const currentIsPercentage = currentCondition === 'PCT_UP_24H' || currentCondition === 'PCT_DOWN_24H';
    const nextIsPercentage = nextCondition === 'PCT_UP_24H' || nextCondition === 'PCT_DOWN_24H';
    if (currentIsPercentage !== nextIsPercentage) setNewTarget(nextIsPercentage ? '5' : '95000');
    setNewCondition(nextCondition);
  };

  const handleDeleteAlert = async (id: string) => {
    setAlertActionError(null);
    try {
      const res = await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa cảnh báo');
      await loadAlerts();
    } catch (error) {
      setAlertActionError(error instanceof Error ? error.message : 'Không thể kết nối máy chủ');
    }
  };

  const handleToggleAlert = async (id: string) => {
    setAlertActionError(null);
    try {
      const res = await fetch(`/api/alerts?id=${id}`, { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể cập nhật cảnh báo');
      await loadAlerts();
    } catch (error) {
      setAlertActionError(error instanceof Error ? error.message : 'Không thể kết nối máy chủ');
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2"><Send className="size-5 text-primary" />Cảnh báo giá qua Telegram</DialogTitle>
          <DialogDescription>Thiết lập cảnh báo giá và nhận thông báo tự động qua bot Telegram.</DialogDescription>
        </DialogHeader>

        {/* Telegram Bot Credentials */}
        <Card className="mt-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kết nối Telegram</CardTitle>
            <CardDescription>Bot token được quản lý an toàn trên server; nhập Chat ID nhận thông báo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="telegram-chat-id">Telegram Chat ID</Label>
              <Input id="telegram-chat-id" inputMode="numeric" placeholder="VD: 984512340" value={chatId} onChange={(e) => setChatId(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Lấy Chat ID bằng bot @userinfobot. Máy chủ cần cấu hình TELEGRAM_BOT_TOKEN.</p>

          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success ? (
                <CheckCircle2 />
              ) : (
                <AlertCircle />
              )}
              <AlertDescription>{testResult.msg}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveConfig}
              disabled={loading}
            >
              {loading ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}Lưu Chat ID
            </Button>
            <Button
              type="button"
              onClick={handleTestPing}
              disabled={testingMsg}
            >
              {testingMsg ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}Gửi tin nhắn thử
            </Button>
          </div>
          </CardContent>
        </Card>

        {/* Create Price Alert Form */}
        <div className="mt-5">
          <h3 className="mb-2 font-semibold">Thiết lập điều kiện cảnh báo</h3>
          <form
            onSubmit={handleCreateAlert}
            className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
          >
            <div className="grid gap-2">
              <Label htmlFor="alert-asset-source">Tài sản cần theo dõi</Label>
              <Select value={newWalletAssetId} onValueChange={setNewWalletAssetId}>
                <SelectTrigger id="alert-asset-source" aria-label="Tài sản cần theo dõi">
                  <SelectValue placeholder="Chọn tài sản" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ticker">Ticker bất kỳ</SelectItem>
                  {walletAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.symbol} · {asset.name} · {asset.chain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newWalletAssetId === 'ticker' ? (
              <div className="grid gap-2">
                <Label htmlFor="alert-symbol">Ticker</Label>
                <Input id="alert-symbol" required minLength={2} maxLength={20} pattern="[A-Za-z0-9]+" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} className="font-mono" placeholder="BTC" />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Tài sản</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 font-mono text-sm">
                  {walletAssets.find((asset) => asset.id === newWalletAssetId)?.symbol ?? '—'}
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:col-span-2 lg:col-span-2">
              <span className="text-sm font-medium">Điều kiện</span>
              <Tabs value={newCondition} onValueChange={handleNewConditionChange}>
                <TabsList aria-label="Điều kiện cảnh báo" className="grid h-auto w-full grid-cols-2 gap-1">
                  <TabsTrigger value="ABOVE" className="min-h-9 whitespace-normal px-2 text-xs">Giá vượt trên ($)</TabsTrigger>
                  <TabsTrigger value="BELOW" className="min-h-9 whitespace-normal px-2 text-xs">Giá dưới ($)</TabsTrigger>
                  <TabsTrigger value="PCT_UP_24H" className="min-h-9 whitespace-normal px-2 text-xs">Tăng mạnh 24h (% ≥)</TabsTrigger>
                  <TabsTrigger value="PCT_DOWN_24H" className="min-h-9 whitespace-normal px-2 text-xs">Giảm 24h (% ≤)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alert-target">{newCondition === 'PCT_UP_24H' || newCondition === 'PCT_DOWN_24H' ? 'Mục tiêu (%)' : 'Mục tiêu (USD)'}</Label>
              <Input
                id="alert-target"
                type="number"
                step="any"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                required
                min="0.00000001"
                className="font-mono"
              />
            </div>

            <div>
              <Button
                type="submit"
                className="w-full lg:col-span-1"
                disabled={creatingAlert}
              >
                {creatingAlert ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />}{creatingAlert ? 'Đang thêm…' : 'Thêm cảnh báo'}
              </Button>
            </div>
          </form>
          {newAlertError && <Alert variant="destructive" className="mt-3"><AlertCircle /><AlertDescription>{newAlertError}</AlertDescription></Alert>}
        </div>

        {/* Active Alerts List */}
        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">Danh sách cảnh báo <Badge variant="secondary">{alerts.length}</Badge></h3>
          {alertLoadError && <Alert variant="destructive" className="mb-3"><AlertCircle /><AlertDescription>{alertLoadError}</AlertDescription></Alert>}
          {alertActionError && <Alert variant="destructive" className="mb-3"><AlertCircle /><AlertDescription>{alertActionError}</AlertDescription></Alert>}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.length === 0 && !alertLoadError ? (
              <p className="py-3 text-center italic text-muted-foreground">Chưa có cảnh báo nào được đặt.</p>
            ) : alerts.length > 0 ? (
              alerts.map((alt) => {
                const isEditing = editingAlertId === alt.id;
                if (isEditing) {
                  return (
                    <div
                      key={alt.id}
                      className="space-y-3 rounded-lg border border-primary/40 bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-primary">
                          Chỉnh sửa: {alt.symbol}
                        </span>
                        <div className="flex items-center space-x-1.5">
                          <Button size="sm"
                            type="button"
                            onClick={() => handleSaveEdit(alt.id)}
                          >
                            <Save className="size-3.5" />Lưu
                          </Button>
                          <Button variant="outline" size="sm"
                            type="button"
                            onClick={handleCancelEdit}
                          >
                            Hủy
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="grid gap-2 sm:col-span-2">
                          <span className="text-sm font-medium">Điều kiện</span>
                          <Tabs value={editCondition} onValueChange={(value) => setEditCondition(value as AlertCondition)}>
                            <TabsList aria-label="Điều kiện chỉnh sửa" className="grid h-auto w-full grid-cols-2 gap-1">
                              <TabsTrigger value="ABOVE" className="min-h-9 whitespace-normal px-2 text-xs">Giá vượt trên ($)</TabsTrigger>
                              <TabsTrigger value="BELOW" className="min-h-9 whitespace-normal px-2 text-xs">Giá dưới ($)</TabsTrigger>
                              <TabsTrigger value="PCT_UP_24H" className="min-h-9 whitespace-normal px-2 text-xs">Tăng mạnh 24h (% ≥)</TabsTrigger>
                              <TabsTrigger value="PCT_DOWN_24H" className="min-h-9 whitespace-normal px-2 text-xs">Giảm 24h (% ≤)</TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor={`edit-alert-target-${alt.id}`}>Mục tiêu</Label>
                          <Input
                            id={`edit-alert-target-${alt.id}`}
                            type="number"
                            step="any"
                            value={editTarget}
                            onChange={(e) => setEditTarget(e.target.value)}
                            className="font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={alt.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-sm font-bold text-primary">
                        {alt.symbol}
                      </span>
                      <span className="text-foreground">
                        {alt.condition === 'ABOVE' && `Vượt ngưỡng $${alt.targetValue}`}
                        {alt.condition === 'BELOW' && `Giảm dưới $${alt.targetValue}`}
                        {alt.condition === 'PCT_UP_24H' && `Tăng 24h ≥ +${alt.targetValue}%`}
                        {alt.condition === 'PCT_DOWN_24H' && `Giảm 24h ≤ -${alt.targetValue}%`}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <Button variant={alt.isActive ? 'secondary' : 'outline'} size="sm"
                        onClick={() => handleToggleAlert(alt.id)}
                        title="Bật/Tắt cảnh báo"
                      >
                        {alt.isActive ? 'ĐANG BẬT' : 'TẠM TẮT'}
                      </Button>
                      <Button variant="ghost" size="icon"
                        onClick={() => handleStartEdit(alt)}
                        title="Chỉnh sửa cảnh báo"
                        aria-label={`Chỉnh sửa cảnh báo ${alt.symbol}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon"
                        onClick={() => handleDeleteAlert(alt.id)}
                        title="Xóa cảnh báo"
                        aria-label={`Xóa cảnh báo ${alt.symbol}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              }) ) : null}
          </div>
        </div>

        <Card className="mt-5 overflow-hidden">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">Lịch sử gửi gần đây</CardTitle>
            <CardDescription>Tối đa 25 lần đánh giá cảnh báo gần nhất, gồm cả lần gửi lỗi hoặc bị bỏ qua.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table aria-label="Lịch sử gửi cảnh báo Telegram">
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead className="text-right">Giá ghi nhận</TableHead>
                  <TableHead className="text-right">24h</TableHead>
                  <TableHead className="text-right">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có lần gửi nào.</TableCell></TableRow>
                ) : deliveries.map((delivery) => {
                  const relatedAlert = alerts.find((item) => item.id === delivery.alertId);
                  const statusLabels = { pending: 'Đang gửi', sent: 'Đã gửi', failed: 'Gửi lỗi', skipped: 'Bỏ qua' } as const;
                  const statusVariants = { pending: 'secondary', sent: 'default', failed: 'destructive', skipped: 'outline' } as const;
                  return (
                    <TableRow key={delivery.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(delivery.createdAt).toLocaleString('vi-VN')}</TableCell>
                      <TableCell className="font-mono font-medium">{relatedAlert?.symbol ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono">{delivery.observedPriceUsd === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(delivery.observedPriceUsd)}</TableCell>
                      <TableCell className="text-right font-mono">{delivery.observedChange24h === null ? '—' : `${delivery.observedChange24h.toFixed(2)}%`}</TableCell>
                      <TableCell className="text-right"><Badge variant={statusVariants[delivery.status]}>{statusLabels[delivery.status]}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
