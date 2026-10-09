'use client';

import React, { useState } from 'react';
import {
  Wallet as WalletIcon,
  Plus,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Trash2,
  Edit2,
  Save,
  Copy,
  Check,
  Coins,
  AlertCircle,
  CheckCircle2,
  Search,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { Wallet, ChainType, WalletToken } from '@/lib/types';
import { formatPortfolioCurrency } from '@/lib/format-portfolio-currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ViewOnlyWalletsProps {
  wallets: Wallet[];
  baseCurrency: string;
  usdVndRate?: number | null;
  onRefresh: () => void;
}

const EXPLORER_URLS: Record<ChainType, (addr: string) => string> = {
  ETH: (addr) => `https://etherscan.io/address/${addr}`,
  SOL: (addr) => `https://solscan.io/account/${addr}`,
  BTC: (addr) => `https://mempool.space/address/${addr}`,
  BSC: (addr) => `https://bscscan.com/address/${addr}`,
  POLYGON: (addr) => `https://polygonscan.com/address/${addr}`,
  ARBITRUM: (addr) => `https://arbiscan.io/address/${addr}`,
  BASE: (addr) => `https://basescan.org/address/${addr}`,
};

const TOKEN_EXPLORER_URLS: Record<ChainType, (contract: string) => string> = {
  ETH: (contract) => `https://etherscan.io/token/${contract}`,
  SOL: (mint) => `https://solscan.io/token/${mint}`,
  BTC: () => `https://mempool.space`,
  BSC: (contract) => `https://bscscan.com/token/${contract}`,
  POLYGON: (contract) => `https://polygonscan.com/token/${contract}`,
  ARBITRUM: (contract) => `https://arbiscan.io/token/${contract}`,
  BASE: (contract) => `https://basescan.org/token/${contract}`,
};

const ALLOCATION_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#64748b', // slate
];

export const ViewOnlyWallets: React.FC<ViewOnlyWalletsProps> = ({
  wallets,
  baseCurrency,
  usdVndRate,
  onRefresh,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [chain, setChain] = useState<ChainType>('ETH');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // Detail Modal for viewing all coins in wallet
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [tokenSearch, setTokenSearch] = useState('');
  const [tokenFilter, setTokenFilter] = useState<'ALL' | 'NATIVE' | 'STABLE' | 'OTHER'>('ALL');
  const [customContract, setCustomContract] = useState('');
  const [scanningContract, setScanningContract] = useState(false);
  const [contractError, setContractError] = useState('');

  // In-app Delete Confirmation Modal (fixes iframe window.confirm blocking)
  const [walletToDelete, setWalletToDelete] = useState<Wallet | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit wallet label modal state
  const [walletToEdit, setWalletToEdit] = useState<Wallet | null>(null);
  const [editWalletLabel, setEditWalletLabel] = useState('');
  const [savingWalletLabel, setSavingWalletLabel] = useState(false);

  const handleOpenEditWallet = (wallet: Wallet, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWalletToEdit(wallet);
    setEditWalletLabel(wallet.label);
  };

  const handleSaveWalletLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletToEdit || !editWalletLabel.trim()) return;
    setSavingWalletLabel(true);
    try {
      const res = await fetch(`/api/wallets/${encodeURIComponent(walletToEdit.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editWalletLabel.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          text: 'Đã cập nhật tên nhãn ví thành công!',
        });
        if (selectedWallet?.id === walletToEdit.id) {
          setSelectedWallet({ ...selectedWallet, label: editWalletLabel.trim() });
        }
        setWalletToEdit(null);
        onRefresh();
      } else {
        setNotification({ type: 'error', text: data.error || 'Lỗi cập nhật tên ví' });
      }
    } catch {
      setNotification({ type: 'error', text: 'Lỗi mạng khi cập nhật nhãn ví' });
    } finally {
      setSavingWalletLabel(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const formatCurrency = (val: number) => formatPortfolioCurrency(val, baseCurrency, usdVndRate);

  const handleCopy = (text: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSync = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSyncingId(id);
    setNotification(null);
    try {
      const res = await fetch(`/api/wallets/${id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          text: data.message || 'Đã đồng bộ số dư và danh sách coin thành công!',
        });
        onRefresh();
        // If current modal is viewing this wallet, refresh modal state
        if (selectedWallet && selectedWallet.id === id && data.wallet) {
          setSelectedWallet(data.wallet);
        }
      } else {
        setNotification({
          type: 'error',
          text: data.error || 'Lỗi khi đồng bộ số dư on-chain',
        });
      }
    } catch {
      setNotification({
        type: 'error',
        text: 'Không thể kết nối đến máy chủ RPC on-chain',
      });
    } finally {
      setSyncingId(null);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const handleSelectWallet = async (wallet: Wallet) => {
    setSelectedWallet(wallet);
    try {
      const res = await fetch(`/api/wallets/${encodeURIComponent(wallet.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.wallet) {
          setSelectedWallet(data.wallet);
        }
      }
    } catch {
      // Keep existing wallet info
    }
  };

  // Open in-app delete modal instead of window.confirm
  const handleOpenDelete = (wallet: Wallet, e: React.MouseEvent) => {
    e.stopPropagation();
    setWalletToDelete(wallet);
  };

  const handleConfirmDelete = async () => {
    if (!walletToDelete) return;
    setDeleting(true);
    try {
      let res = await fetch(`/api/wallets?id=${encodeURIComponent(walletToDelete.id)}`, {
        method: 'DELETE',
      });
      let data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Fallback to route with dynamic id param
        res = await fetch(`/api/wallets/${encodeURIComponent(walletToDelete.id)}`, {
          method: 'DELETE',
        });
        data = await res.json().catch(() => ({}));
      }

      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          text: `Đã xóa ví "${walletToDelete.label}" khỏi danh sách theo dõi thành công!`,
        });
        if (selectedWallet?.id === walletToDelete.id) {
          setSelectedWallet(null);
        }
        setWalletToDelete(null);
        onRefresh();
      } else {
        setNotification({
          type: 'error',
          text: data.error || 'Lỗi khi xóa ví',
        });
      }
    } catch {
      setNotification({
        type: 'error',
        text: 'Lỗi mạng khi thực hiện xóa ví',
      });
    } finally {
      setDeleting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !label.trim()) {
      setErrorMsg('Vui lòng điền đầy đủ tên nhãn và địa chỉ ví');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setNotification(null);

    try {
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain, address: address.trim(), label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Lỗi thêm ví');
      } else {
        setShowAddModal(false);
        setAddress('');
        setLabel('');
        setNotification({
          type: data.scanWarning ? 'warning' : 'success',
          text: data.message || 'Đã thêm ví và quét số dư on-chain thành công!',
        });
        onRefresh();
        if (data.wallet) {
          setSelectedWallet(data.wallet);
        }
      }
    } catch {
      setErrorMsg('Không thể kết nối máy chủ');
    } finally {
      setLoading(false);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  // Scan custom token contract within wallet detail modal
  const handleScanCustomToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet || !customContract.trim()) return;

    setScanningContract(true);
    setContractError('');
    try {
      const res = await fetch(`/api/wallets/${selectedWallet.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: customContract.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedWallet(data.wallet);
        setCustomContract('');
        setNotification({
          type: 'success',
          text: data.message || 'Đã quét và thêm token hợp đồng thành công!',
        });
        onRefresh();
      } else {
        setContractError(data.error || 'Không tìm thấy số dư cho hợp đồng này');
      }
    } catch {
      setContractError('Lỗi kết nối RPC khi quét hợp đồng');
    } finally {
      setScanningContract(false);
    }
  };

  const totalBalance = wallets.reduce((acc, w) => acc + w.balanceUsd, 0);

  // Filtered tokens for selected wallet
  const walletTokens: WalletToken[] = selectedWallet?.tokens || [];
  const filteredTokens = walletTokens.filter((token) => {
    const matchesSearch =
      token.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) ||
      token.name.toLowerCase().includes(tokenSearch.toLowerCase()) ||
      (token.contractAddress && token.contractAddress.toLowerCase().includes(tokenSearch.toLowerCase()));

    if (!matchesSearch) return false;

    if (tokenFilter === 'NATIVE') return token.isNative;
    if (tokenFilter === 'STABLE')
      return ['USDT', 'USDC', 'DAI', 'BUSD', 'FDUSD', 'TUSD'].includes(token.symbol.toUpperCase());
    if (tokenFilter === 'OTHER')
      return !token.isNative && !['USDT', 'USDC', 'DAI', 'BUSD'].includes(token.symbol.toUpperCase());
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <Alert
          variant={notification.type === 'error' ? 'destructive' : 'default'}
          className={notification.type === 'warning' ? 'border-amber-500/40 text-amber-500' : ''}
        >
          {notification.type === 'success' ? <CheckCircle2 /> : <AlertCircle />}
          <AlertDescription>{notification.text}</AlertDescription>
        </Alert>
      )}

      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center space-x-2">
            <span>Danh sách Ví đang theo dõi (Watch-Only)</span>
            <span className="text-xs text-muted-foreground font-normal">({wallets.length} ví)</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Tổng tài sản trong các ví công khai: <span className="font-mono font-bold text-emerald-400">{formatCurrency(totalBalance)}</span>
            <span className="text-muted-foreground ml-2">• Bấm vào ví để xem danh sách toàn bộ các coin/token</span>
          </p>
        </div>

        <Button
          onClick={() => {
            setErrorMsg('');
            setShowAddModal(true);
          }}
          className="h-9 rounded-md bg-primary px-4 text-primary-foreground shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Theo dõi địa chỉ mới</span>
        </Button>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.length === 0 ? (
          <Card className="col-span-full border-dashed p-12 text-center text-muted-foreground">
            <WalletIcon className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">Chưa có ví nào trong danh sách theo dõi</p>
            <p className="mt-1 text-xs text-muted-foreground">Bấm nút &ldquo;Theo dõi địa chỉ mới&rdquo; ở trên để thêm địa chỉ ví công khai đầu tiên.</p>
          </Card>
        ) : (
          wallets.map((wallet) => {
            const explorerLink = EXPLORER_URLS[wallet.chain]?.(wallet.address) || '#';
            const coinsCount = wallet.tokens?.length || wallet.tokensCount || 1;
            const topTokens = (wallet.tokens || []).slice(0, 3);

            return (
              <Card
                key={wallet.id}
                className="group flex flex-col justify-between p-5 transition-colors hover:border-primary/50"
              >
                <div>
                  {/* Card top */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="font-mono text-[11px]">{wallet.chain}</Badge>
                      <span className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                        {wallet.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleSync(wallet.id, e)}
                        disabled={syncingId === wallet.id}
                        className="size-11 rounded-lg sm:size-9"
                        aria-label="Đồng bộ lại số dư on-chain"
                        title="Đồng bộ lại số dư on-chain"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingId === wallet.id ? 'animate-spin text-emerald-400' : ''}`} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleOpenEditWallet(wallet, e)}
                        className="size-11 rounded-lg sm:size-9"
                        aria-label="Đổi tên nhãn ví"
                        title="Đổi tên nhãn ví"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <a
                        href={explorerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
                        aria-label={`Mở Explorer cho ví ${wallet.label}`}
                        title="Kiểm tra trực tiếp trên Blockchain Explorer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleOpenDelete(wallet, e)}
                        className="size-11 rounded-lg text-destructive sm:size-9"
                        aria-label="Xóa ví khỏi danh sách theo dõi"
                        title="Xóa ví khỏi danh sách theo dõi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Address truncated */}
                  <div className="mt-3 flex items-center justify-between rounded-md border bg-muted/50 px-3 py-1.5">
                    <span className="max-w-[200px] truncate font-mono text-xs text-muted-foreground" title={wallet.address}>
                      {wallet.address}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleCopy(wallet.address, wallet.id, e)}
                      className="ml-2 size-11 sm:size-9"
                      aria-label="Sao chép địa chỉ ví"
                      title="Sao chép địa chỉ"
                    >
                      {copiedId === wallet.id ? (
                        <Check className="size-3.5 text-primary" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>

                  {/* Balances */}
                  <div className="mt-4 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Giá trị đã định giá:</span>
                      <Badge variant="secondary" className="rounded-full text-[11px]">
                        {coinsCount} {coinsCount === 1 ? 'Coin' : 'Coins'}
                      </Badge>
                    </div>
                    <div className="mt-0.5 font-mono text-xl font-bold text-foreground">
                      {formatCurrency(wallet.balanceUsd)}
                    </div>
                    {!!wallet.unpricedAssetsCount && <div className="mt-1 text-[11px] text-amber-500">{wallet.unpricedAssetsCount} token chưa có giá</div>}
                    <div className="mt-0.5 font-mono text-xs font-semibold text-primary">
                      {wallet.nativeBalance} {wallet.nativeSymbol}
                    </div>

                    {/* Preview badges of top tokens */}
                    {topTokens.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {topTokens.map((t) => (
                          <Badge key={t.id} variant="secondary" className="font-mono text-[10px]">
                            <strong className="mr-1 text-foreground">{t.symbol}:</strong> {t.balance.toLocaleString()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card footer with CTA */}
                <div className="mt-4 border-t pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleSelectWallet(wallet)}
                    className="h-auto w-full justify-between rounded-md px-2 py-2 text-xs font-semibold text-primary"
                    aria-label={`Xem chi tiết ví ${wallet.label}`}
                  >
                    <span className="flex items-center space-x-1.5">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Xem tất cả {coinsCount} coins chi tiết</span>
                    </span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: VIEW ALL COINS IN ON-CHAIN WALLET DETAIL MODAL */}
      {/* ============================================================ */}
      <Dialog open={Boolean(selectedWallet)} onOpenChange={(open) => { if (!open) setSelectedWallet(null); }}>
        {selectedWallet && (
          <DialogContent className="w-[calc(100%-1rem)] max-w-4xl overflow-hidden border-border bg-card p-0 text-card-foreground">
            <DialogTitle className="sr-only">Ví {selectedWallet.label}</DialogTitle>
            <DialogDescription className="sr-only">Chi tiết số dư và token của ví {selectedWallet.label}.</DialogDescription>
            <div className="flex max-h-[90vh] min-w-0 flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex flex-col gap-3 border-b bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 font-mono text-emerald-400">
                    {selectedWallet.chain}
                  </Badge>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center space-x-2">
                    <span>{selectedWallet.label}</span>
                  </h3>
                  <Badge variant="secondary" className="font-mono">
                    {walletTokens.length} coins on-chain
                  </Badge>
                </div>

                {/* Address bar with copy & explorer link */}
                <div className="mt-2.5 flex min-w-0 items-center gap-2 text-xs">
                  <span className="min-w-0 truncate rounded-md border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground" title={selectedWallet.address}>
                    {selectedWallet.address}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleCopy(selectedWallet.address, 'modal-addr', e)}
                    className="size-11 sm:size-9"
                    aria-label="Sao chép địa chỉ ví"
                    title="Sao chép địa chỉ"
                  >
                    {copiedId === 'modal-addr' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <a
                    href={EXPLORER_URLS[selectedWallet.chain]?.(selectedWallet.address) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-primary hover:underline px-2 py-1 rounded-md bg-muted border"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <Button variant="outline" size="sm"
                  onClick={(e) => handleSync(selectedWallet.id, e)}
                  disabled={syncingId === selectedWallet.id}
                  title="Quét lại số dư on-chain"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingId === selectedWallet.id ? 'animate-spin text-emerald-400' : ''}`} />
                  <span className="hidden sm:inline">Quét lại</span>
                </Button>
                <Button variant="outline" size="sm"
                  onClick={(e) => handleOpenEditWallet(selectedWallet, e)}
                  title="Đổi tên nhãn ví"
                >
                  <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Đổi tên</span>
                </Button>
                <Button variant="destructive" size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWalletToDelete(selectedWallet);
                  }}
                  title="Xóa ví khỏi danh sách theo dõi"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xóa ví</span>
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              {/* Wallet Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-3.5">
                  <div className="text-[11px] text-muted-foreground">Giá trị đã định giá</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                    {formatCurrency(selectedWallet.balanceUsd)}
                  </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    ≈ {formatPortfolioCurrency(selectedWallet.balanceUsd, 'VND', usdVndRate)}
                  </div>
                  {!!selectedWallet.unpricedAssetsCount && <div className="text-[11px] text-amber-400 mt-1">{selectedWallet.unpricedAssetsCount} token chưa có nguồn giá</div>}
                </Card>

                <Card className="p-3.5">
                  <div className="text-[11px] text-muted-foreground">Coin gốc (Native Coin)</div>
                  <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                    {selectedWallet.nativeBalance.toLocaleString()} {selectedWallet.nativeSymbol}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-0.5 font-semibold">
                    Đã xác thực on-chain
                  </div>
                </Card>

                <Card className="p-3.5">
                  <div className="text-[11px] text-muted-foreground">Tổng loại coin/token</div>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">
                    {walletTokens.length} Tokens
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Đồng bộ lần cuối: {new Date(selectedWallet.lastSyncedAt || selectedWallet.createdAt).toLocaleTimeString('vi-VN')}
                  </div>
                </Card>
              </div>

              {/* Allocation Visual Bar */}
              {walletTokens.length > 0 && (
                <Card className="space-y-2 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Phân bổ tài sản trong ví (Portfolio Allocation)</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">100% On-Chain</span>
                  </div>

                  {/* Multi-color Progress Bar */}
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    {walletTokens.map((t, idx) => {
                      const color = ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length];
                      const pct = t.allocationPercentage || 0;
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={t.id}
                          style={{ width: `${pct}%`, backgroundColor: color }}
                          className="h-full transition-all duration-300 relative group"
                          title={`${t.symbol}: ${pct}% ($${t.balanceUsd.toLocaleString()})`}
                        />
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {walletTokens.slice(0, 6).map((t, idx) => {
                      const color = ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length];
                      return (
                        <div key={t.id} className="flex items-center space-x-1 text-[11px] font-mono">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-slate-300 font-bold">{t.symbol}</span>
                          <span className="text-slate-400">({t.allocationPercentage || 0}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="search"
                    aria-label="Tìm token trong ví"
                    placeholder="Tìm coin theo tên, symbol hoặc hợp đồng..."
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    className="h-9 bg-background pl-9 pr-9 text-xs"
                  />
                  {tokenSearch && (
                    <Button variant="ghost" size="icon"
                      onClick={() => setTokenSearch('')}
                      className="absolute right-0 top-1/2 size-11 -translate-y-1/2 sm:right-1 sm:size-9"
                      aria-label="Xóa nội dung tìm token"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <Tabs value={tokenFilter} onValueChange={(value) => setTokenFilter(value as typeof tokenFilter)}>
                  <TabsList aria-label="Lọc token" className="h-9 w-full justify-start overflow-x-auto sm:w-auto">
                    <TabsTrigger value="ALL" className="text-xs">Tất cả ({walletTokens.length})</TabsTrigger>
                    <TabsTrigger value="NATIVE" className="text-xs">Native</TabsTrigger>
                    <TabsTrigger value="STABLE" className="text-xs">Stablecoins</TabsTrigger>
                    <TabsTrigger value="OTHER" className="text-xs">Tokens</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* COIN LIST TABLE */}
              <div className="max-w-full overflow-x-auto rounded-lg border border-border bg-card">
                  <Table className="min-w-[900px] text-left text-xs" aria-label={`Danh sách token của ví ${selectedWallet.label}`}>
                    <TableHeader className="bg-muted/60 uppercase text-[10px] tracking-wider">
                      <TableRow>
                        <TableHead className="px-4">Tài sản (Coin/Token)</TableHead>
                        <TableHead className="px-4">Loại</TableHead>
                        <TableHead className="px-4 text-right">Số lượng on-chain</TableHead>
                        <TableHead className="px-4 text-right">Giá Live (USD)</TableHead>
                        <TableHead className="px-4 text-right">24h</TableHead>
                        <TableHead className="px-4 text-right">Tổng giá trị</TableHead>
                        <TableHead className="px-4 text-right">Tỷ trọng</TableHead>
                        <TableHead className="px-4 text-center">Hợp đồng</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTokens.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            <Coins className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="font-semibold text-foreground">Không tìm thấy coin nào phù hợp</p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Thử tìm kiếm với từ khóa khác hoặc bấm nút Quét Lại ở trên.
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTokens.map((token, idx) => {
                          const isPositive = (token.change24h || 0) >= 0;
                          const tokenExplorer = token.contractAddress
                            ? TOKEN_EXPLORER_URLS[token.chain]?.(token.contractAddress)
                            : EXPLORER_URLS[token.chain]?.(selectedWallet.address);

                          return (
                            <TableRow key={token.id || idx}>
                              {/* Asset name & symbol */}
                              <TableCell className="px-4">
                                <div className="flex items-center space-x-2.5">
                                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-[11px] font-bold text-primary">
                                    {token.symbol.slice(0, 3)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-foreground flex items-center space-x-1.5">
                                      <span>{token.symbol}</span>
                                      {token.isNative && (
                                        <Badge variant="secondary" className="px-1.5 py-0 font-mono text-[9px]">
                                          NATIVE
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                                      {token.name}
                                    </div>
                                    {token.chain === 'SOL' && !token.isNative && token.symbol !== 'SPL' && (
                                      <Badge variant="outline" className="mt-1 h-auto border-amber-500/30 px-1 py-0 text-[9px] font-normal text-amber-500">
                                        Metadata on-chain · chưa xác minh
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>

                              {/* Type */}
                              <TableCell className="px-4 font-mono text-[11px]">
                                <Badge variant="outline" className="font-normal">
                                  {token.isNative
                                    ? `${token.chain} Native`
                                    : token.chain === 'SOL'
                                    ? 'SPL Token'
                                    : token.chain === 'BSC'
                                    ? 'BEP-20'
                                    : 'ERC-20'}
                                </Badge>
                              </TableCell>

                              {/* Balance */}
                              <TableCell className="px-4 text-right font-mono font-bold text-foreground">
                                {token.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                              </TableCell>

                              {/* Live Price */}
                              <TableCell className="px-4 text-right font-mono text-muted-foreground">
                                {token.priceAvailable === false ? '—' : `$${token.priceUsd < 0.01 ? token.priceUsd.toFixed(8) : token.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
                              </TableCell>

                              {/* 24h change */}
                              <TableCell className="px-4 text-right font-mono font-semibold">
                                <span
                                  className={`inline-flex items-center space-x-0.5 ${
                                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {isPositive ? (
                                    <ArrowUpRight className="w-3 h-3" />
                                  ) : (
                                    <ArrowDownRight className="w-3 h-3" />
                                  )}
                                  <span>{token.change24h === undefined ? '—' : `${Math.abs(token.change24h).toFixed(2)}%`}</span>
                                </span>
                              </TableCell>

                              {/* Total USD value */}
                              <TableCell className="px-4 text-right font-mono font-bold text-emerald-400">
                                {token.priceAvailable === false ? <span className="text-amber-400">Chưa định giá</span> : formatCurrency(token.balanceUsd)}
                              </TableCell>

                              {/* Allocation % */}
                              <TableCell className="px-4 text-right font-mono text-muted-foreground">
                                <Badge variant="secondary" className="font-mono">
                                  {token.allocationPercentage || 0}%
                                </Badge>
                              </TableCell>

                              {/* Contract / Explorer */}
                              <TableCell className="px-4 text-center">
                                {token.contractAddress ? (
                                  <div className="flex items-center justify-center space-x-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => handleCopy(token.contractAddress!, `tok-${token.id}`, e)}
                                      className="size-11 sm:size-9"
                                      aria-label={`Sao chép hợp đồng ${token.symbol}`}
                                      title={`Sao chép hợp đồng: ${token.contractAddress}`}
                                    >
                                      {copiedId === `tok-${token.id}` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                    <a
                                      href={tokenExplorer || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                                      title="Xem trên Explorer"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">Native</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
              </div>

              {/* Add Custom Token Contract Scan */}
              <Card className="p-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-foreground mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Quét thêm Token hợp đồng tùy chỉnh (Custom Contract Address)</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Nếu ví sở hữu token ERC-20 / SPL chưa có trong danh sách mặc định, hãy nhập địa chỉ Smart Contract để hệ thống truy vấn số dư on-chain ngay lập tức.
                </p>

                {contractError && (
                  <div className="mb-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{contractError}</span>
                  </div>
                )}

                <form onSubmit={handleScanCustomToken} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    type="text"
                    placeholder="VD: 0xdAC17F958D2ee523a2206206994597C13D831ec7 (Tether USD)..."
                    value={customContract}
                    onChange={(e) => setCustomContract(e.target.value)}
                    className="h-9 flex-1 bg-background font-mono text-xs"
                  />
                  <Button
                    type="submit"
                    disabled={scanningContract || !customContract.trim()}
                    className="h-9 bg-primary text-primary-foreground"
                  >
                    {scanningContract && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{scanningContract ? 'Đang truy vấn...' : 'Quét Token'}</span>
                  </Button>
                </form>
              </Card>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
              <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Chế độ View-Only an toàn 100%. Dữ liệu được trích xuất trực tiếp từ RPC Node công khai.</span>
                <span className="sm:hidden">View-Only an toàn 100%</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setWalletToDelete(selectedWallet)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ví</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedWallet(null)}
                >
                  Đóng
                </Button>
              </div>
            </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 2: IN-APP DELETE WALLET CONFIRMATION (NO window.confirm) */}
      {/* ============================================================ */}
      <Dialog open={Boolean(walletToDelete)} onOpenChange={(open) => { if (!open && !deleting) setWalletToDelete(null); }}>
      {walletToDelete && (
        <DialogContent className="max-w-md border-border bg-card text-card-foreground">
              <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <DialogTitle className="text-lg font-bold text-center">
              Xác nhận xóa ví theo dõi
            </DialogTitle>

            <DialogDescription className="text-xs text-center mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa ví <strong className="text-foreground font-semibold">{walletToDelete.label}</strong> ({walletToDelete.chain}) khỏi danh sách theo dõi?
            </DialogDescription>

            <div className="mt-3 p-3 bg-muted rounded-md border border-border text-center font-mono text-xs text-muted-foreground truncate">
              {walletToDelete.address}
            </div>

            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Lưu ý: Thao tác này chỉ xóa ví khỏi danh sách theo dõi cá nhân của bạn, không ảnh hưởng đến tài sản trên blockchain. Bạn có thể thêm lại bất cứ lúc nào.
            </p>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <Button variant="outline"
                type="button"
                onClick={() => setWalletToDelete(null)}
                disabled={deleting}
                className="flex-1"
              >
                Hủy bỏ
              </Button>
              <Button variant="destructive"
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1"
              >
                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'Đang xóa...' : 'Xác nhận xóa ví'}</span>
              </Button>
            </div>
        </DialogContent>
      )}
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL 3: ADD VIEW-ONLY WALLET MODAL */}
      {/* ============================================================ */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md border-border bg-card p-6 text-card-foreground">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <WalletIcon className="w-5 h-5 text-emerald-400" />
              <span>Thêm Ví View-Only (Chỉ Xem)</span>
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm">
              Chỉ nhập Public Address. Hệ thống truy vấn số dư on-chain từ indexer/RPC công khai; khả năng liệt kê token tùy theo từng mạng.
            </DialogDescription>

            {errorMsg && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddWallet} className="mt-4 space-y-4 text-xs">
              <div>
                <Label className="mb-1 block" htmlFor="wallet-chain">Mạng Blockchain</Label>
                <Select
                  value={chain}
                  onValueChange={(value) => setChain(value as ChainType)}
                >
                  <SelectTrigger id="wallet-chain" className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ETH">Ethereum (ETH / ERC-20)</SelectItem>
                    <SelectItem value="SOL">Solana (SOL / SPL)</SelectItem>
                    <SelectItem value="BTC">Bitcoin (BTC Native / SegWit)</SelectItem>
                    <SelectItem value="BSC">BNB Smart Chain (BEP-20)</SelectItem>
                    <SelectItem value="POLYGON">Polygon Network (POL)</SelectItem>
                    <SelectItem value="ARBITRUM">Arbitrum One (ETH)</SelectItem>
                    <SelectItem value="BASE">Base (ETH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block" htmlFor="wallet-label">Tên nhãn gợi nhớ</Label>
                <Input
                  type="text"
                  id="wallet-label"
                  placeholder="VD: Ví lạnh Trezor, Ví cá nhân..."
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="h-9 bg-background text-sm"
                />
              </div>

              <div>
                <Label className="mb-1 block" htmlFor="wallet-address">
                  Địa chỉ Ví công khai (Public Address)
                </Label>
                <Input
                  type="text"
                  id="wallet-address"
                  placeholder={
                    chain === 'ETH' || chain === 'BSC' || chain === 'POLYGON' || chain === 'ARBITRUM' || chain === 'BASE'
                      ? '0x...'
                      : chain === 'SOL'
                      ? 'Địa chỉ Solana Base58...'
                      : 'bc1... hoặc 1... hoặc 3...'
                  }
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 bg-background font-mono text-sm"
                />
              </div>

              <div className="p-3 bg-muted rounded-md border border-primary/30 text-primary text-[11px] leading-relaxed flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>An toàn 100%:</strong> Chỉ truy vấn số dư on-chain từ Public RPC. Không yêu cầu Private Key hay ký giao dịch.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-9 bg-primary text-primary-foreground"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{loading ? 'Đang quét on-chain...' : 'Bắt đầu theo dõi'}</span>
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* Edit Wallet Label Modal */}
      <Dialog open={Boolean(walletToEdit)} onOpenChange={(open) => { if (!open) setWalletToEdit(null); }}>
      {walletToEdit && (
        <DialogContent className="max-w-md border-border bg-card text-card-foreground">

            <div className="flex items-center space-x-3 pb-3 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Edit2 className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="font-bold text-sm">Đổi tên nhãn ví theo dõi</DialogTitle>
                <DialogDescription className="text-xs font-mono truncate max-w-[240px]">Địa chỉ: {walletToEdit.address}</DialogDescription>
              </div>
            </div>

            <form onSubmit={handleSaveWalletLabel} className="mt-4 space-y-3.5 text-xs">
              <div>
                <Label className="mb-1 block" htmlFor="edit-wallet-label">Tên nhãn ví mới</Label>
                <Input
                  type="text"
                  id="edit-wallet-label"
                  required
                  value={editWalletLabel}
                  onChange={(e) => setEditWalletLabel(e.target.value)}
                  placeholder="VD: Ví lạnh dài hạn, Ví Phantom phụ..."
                  className="h-9 bg-background text-foreground"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <Button variant="outline"
                  type="button"
                  onClick={() => setWalletToEdit(null)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={savingWalletLabel}
                >
                  {savingWalletLabel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Lưu thay đổi</span>
                </Button>
              </div>
            </form>
        </DialogContent>
      )}
      </Dialog>
    </div>
  );
};
