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

interface ViewOnlyWalletsProps {
  wallets: Wallet[];
  baseCurrency: string;
  onRefresh: () => void;
}

const SAMPLE_ADDRESSES: Record<ChainType, { address: string; label: string }> = {
  ETH: {
    address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    label: 'Vitalik Buterin (vitalik.eth)',
  },
  SOL: {
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    label: 'Solana Foundation Staking',
  },
  BTC: {
    address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    label: 'Bitcoin Vault Reserve',
  },
  BSC: {
    address: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
    label: 'Binance Cold Storage',
  },
  POLYGON: {
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    label: 'Polygon Bridge Vault',
  },
  ARBITRUM: {
    address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    label: 'Arbitrum One Holding',
  },
};

const EXPLORER_URLS: Record<ChainType, (addr: string) => string> = {
  ETH: (addr) => `https://etherscan.io/address/${addr}`,
  SOL: (addr) => `https://solscan.io/account/${addr}`,
  BTC: (addr) => `https://mempool.space/address/${addr}`,
  BSC: (addr) => `https://bscscan.com/address/${addr}`,
  POLYGON: (addr) => `https://polygonscan.com/address/${addr}`,
  ARBITRUM: (addr) => `https://arbiscan.io/address/${addr}`,
};

const TOKEN_EXPLORER_URLS: Record<ChainType, (contract: string) => string> = {
  ETH: (contract) => `https://etherscan.io/token/${contract}`,
  SOL: (mint) => `https://solscan.io/token/${mint}`,
  BTC: () => `https://mempool.space`,
  BSC: (contract) => `https://bscscan.com/token/${contract}`,
  POLYGON: (contract) => `https://polygonscan.com/token/${contract}`,
  ARBITRUM: (contract) => `https://arbiscan.io/token/${contract}`,
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
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleDeleteToken = async (tokenId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedWallet) return;
    try {
      const res = await fetch(`/api/wallets/${encodeURIComponent(selectedWallet.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_token', tokenId }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.wallet) {
        setSelectedWallet(data.wallet);
        setNotification({
          type: 'success',
          text: 'Đã xóa token khỏi danh sách theo dõi của ví',
        });
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

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

  const handleFillSample = () => {
    const sample = SAMPLE_ADDRESSES[chain];
    if (sample) {
      setAddress(sample.address);
      setLabel(sample.label);
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
          type: 'success',
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
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 border shadow-lg ${
            notification.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>Danh sách Ví đang theo dõi (Watch-Only)</span>
            <span className="text-xs text-slate-400 font-normal">({wallets.length} ví)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Tổng tài sản trong các ví công khai: <span className="font-mono font-bold text-emerald-400">{formatCurrency(totalBalance)}</span>
            <span className="text-slate-500 ml-2">• Bấm vào ví để xem danh sách toàn bộ các coin/token</span>
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setShowAddModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Theo dõi địa chỉ mới</span>
        </button>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.length === 0 ? (
          <div className="col-span-full bg-[#161b22] border border-[#30363d] rounded-2xl p-12 text-center text-slate-400">
            <WalletIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-white">Chưa có ví nào trong danh sách theo dõi</p>
            <p className="text-xs text-slate-500 mt-1">Bấm nút &ldquo;Theo dõi địa chỉ mới&rdquo; ở trên để thêm địa chỉ ví công khai đầu tiên.</p>
          </div>
        ) : (
          wallets.map((wallet) => {
            const explorerLink = EXPLORER_URLS[wallet.chain]?.(wallet.address) || '#';
            const coinsCount = wallet.tokens?.length || wallet.tokensCount || 1;
            const topTokens = (wallet.tokens || []).slice(0, 3);

            return (
              <div
                key={wallet.id}
                onClick={() => handleSelectWallet(wallet)}
                className="bg-[#161b22] border border-[#30363d] hover:border-emerald-500/50 hover:shadow-emerald-500/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all cursor-pointer group"
              >
                <div>
                  {/* Card top */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#21262d] text-cyan-400 font-mono border border-slate-700">
                        {wallet.chain}
                      </span>
                      <span className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                        {wallet.label}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleSync(wallet.id, e)}
                        disabled={syncingId === wallet.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-[#21262d] transition-colors"
                        title="Đồng bộ lại số dư on-chain"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingId === wallet.id ? 'animate-spin text-emerald-400' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => handleOpenEditWallet(wallet, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-[#21262d] transition-colors"
                        title="Đổi tên nhãn ví"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={explorerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-[#21262d] transition-colors"
                        title="Kiểm tra trực tiếp trên Blockchain Explorer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={(e) => handleOpenDelete(wallet, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#21262d] transition-colors"
                        title="Xóa ví khỏi danh sách theo dõi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Address truncated */}
                  <div className="mt-3 flex items-center justify-between bg-[#0d1117] px-3 py-1.5 rounded-lg border border-[#21262d]">
                    <span className="font-mono text-xs text-slate-400 truncate max-w-[200px]" title={wallet.address}>
                      {wallet.address}
                    </span>
                    <button
                      onClick={(e) => handleCopy(wallet.address, wallet.id, e)}
                      className="text-slate-400 hover:text-white ml-2"
                      title="Sao chép địa chỉ"
                    >
                      {copiedId === wallet.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Balances */}
                  <div className="mt-4 pt-3 border-t border-[#21262d]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Tổng giá trị on-chain:</span>
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        {coinsCount} {coinsCount === 1 ? 'Coin' : 'Coins'}
                      </span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white mt-0.5">
                      {formatCurrency(wallet.balanceUsd)}
                    </div>
                    <div className="text-xs text-emerald-400 font-mono mt-0.5 font-semibold">
                      {wallet.nativeBalance} {wallet.nativeSymbol}
                    </div>

                    {/* Preview badges of top tokens */}
                    {topTokens.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {topTokens.map((t) => (
                          <span
                            key={t.id}
                            className="px-2 py-0.5 rounded bg-[#0d1117] text-[10px] text-slate-300 font-mono border border-slate-800"
                          >
                            <strong className="text-white">{t.symbol}:</strong> {t.balance.toLocaleString()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card footer with CTA */}
                <div className="mt-4 pt-3 border-t border-[#21262d]/50">
                  <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span className="flex items-center space-x-1.5">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Xem tất cả {coinsCount} coins chi tiết</span>
                    </span>
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: VIEW ALL COINS IN ON-CHAIN WALLET DETAIL MODAL */}
      {/* ============================================================ */}
      {selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#21262d] flex items-start justify-between bg-[#0d1117]">
              <div>
                <div className="flex items-center space-x-2.5">
                  <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
                    {selectedWallet.chain}
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
                    <span>{selectedWallet.label}</span>
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/20">
                    {walletTokens.length} coins on-chain
                  </span>
                </div>

                {/* Address bar with copy & explorer link */}
                <div className="mt-2.5 flex items-center space-x-2 text-xs">
                  <span className="font-mono text-slate-300 bg-[#161b22] px-2.5 py-1 rounded-md border border-[#30363d]">
                    {selectedWallet.address}
                  </span>
                  <button
                    onClick={(e) => handleCopy(selectedWallet.address, 'modal-addr', e)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
                    title="Sao chép địa chỉ"
                  >
                    {copiedId === 'modal-addr' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <a
                    href={EXPLORER_URLS[selectedWallet.chain]?.(selectedWallet.address) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 hover:underline px-2 py-1 rounded bg-[#161b22] border border-[#30363d]"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => handleSync(selectedWallet.id, e)}
                  disabled={syncingId === selectedWallet.id}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-200 text-xs font-semibold transition-colors"
                  title="Quét lại số dư on-chain"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingId === selectedWallet.id ? 'animate-spin text-emerald-400' : ''}`} />
                  <span className="hidden sm:inline">Quét lại</span>
                </button>
                <button
                  onClick={(e) => handleOpenEditWallet(selectedWallet, e)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-200 text-xs font-semibold transition-colors"
                  title="Đổi tên nhãn ví"
                >
                  <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Đổi tên</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setWalletToDelete(selectedWallet);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                  title="Xóa ví khỏi danh sách theo dõi"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xóa ví</span>
                </button>
                <button
                  onClick={() => setSelectedWallet(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Wallet Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[#0d1117] rounded-xl border border-[#21262d]">
                  <div className="text-[11px] text-slate-400">Tổng giá trị tài sản</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                    {formatCurrency(selectedWallet.balanceUsd)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    ≈ {(selectedWallet.balanceUsd * 25450).toLocaleString('vi-VN')} VND
                  </div>
                </div>

                <div className="p-3.5 bg-[#0d1117] rounded-xl border border-[#21262d]">
                  <div className="text-[11px] text-slate-400">Coin gốc (Native Coin)</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">
                    {selectedWallet.nativeBalance.toLocaleString()} {selectedWallet.nativeSymbol}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-0.5 font-semibold">
                    Đã xác thực on-chain
                  </div>
                </div>

                <div className="p-3.5 bg-[#0d1117] rounded-xl border border-[#21262d]">
                  <div className="text-[11px] text-slate-400">Tổng loại coin/token</div>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">
                    {walletTokens.length} Tokens
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Đồng bộ lần cuối: {new Date(selectedWallet.lastSyncedAt || selectedWallet.createdAt).toLocaleTimeString('vi-VN')}
                  </div>
                </div>
              </div>

              {/* Allocation Visual Bar */}
              {walletTokens.length > 0 && (
                <div className="bg-[#0d1117] p-4 rounded-xl border border-[#21262d] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Phân bổ tài sản trong ví (Portfolio Allocation)</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">100% On-Chain</span>
                  </div>

                  {/* Multi-color Progress Bar */}
                  <div className="h-3 w-full bg-[#161b22] rounded-full overflow-hidden flex">
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
                </div>
              )}

              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm coin theo tên, symbol hoặc hợp đồng..."
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {tokenSearch && (
                    <button
                      onClick={() => setTokenSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1 bg-[#0d1117] p-1 rounded-xl border border-[#30363d] text-xs">
                  <button
                    onClick={() => setTokenFilter('ALL')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      tokenFilter === 'ALL' ? 'bg-[#21262d] text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tất cả ({walletTokens.length})
                  </button>
                  <button
                    onClick={() => setTokenFilter('NATIVE')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      tokenFilter === 'NATIVE' ? 'bg-[#21262d] text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Native
                  </button>
                  <button
                    onClick={() => setTokenFilter('STABLE')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      tokenFilter === 'STABLE' ? 'bg-[#21262d] text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Stablecoins
                  </button>
                  <button
                    onClick={() => setTokenFilter('OTHER')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      tokenFilter === 'OTHER' ? 'bg-[#21262d] text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tokens
                  </button>
                </div>
              </div>

              {/* COIN LIST TABLE */}
              <div className="bg-[#0d1117] rounded-xl border border-[#21262d] overflow-hidden shadow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#161b22] text-slate-400 font-semibold border-b border-[#21262d] uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Tài sản (Coin/Token)</th>
                        <th className="py-3 px-4">Loại</th>
                        <th className="py-3 px-4 text-right">Số lượng on-chain</th>
                        <th className="py-3 px-4 text-right">Giá Live (USD)</th>
                        <th className="py-3 px-4 text-right">24h</th>
                        <th className="py-3 px-4 text-right">Tổng giá trị</th>
                        <th className="py-3 px-4 text-right">Tỷ trọng</th>
                        <th className="py-3 px-4 text-center">Hợp đồng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#21262d]">
                      {filteredTokens.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            <Coins className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="font-semibold text-white">Không tìm thấy coin nào phù hợp</p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Thử tìm kiếm với từ khóa khác hoặc bấm nút Quét Lại ở trên.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredTokens.map((token, idx) => {
                          const isPositive = (token.change24h || 0) >= 0;
                          const tokenExplorer = token.contractAddress
                            ? TOKEN_EXPLORER_URLS[token.chain]?.(token.contractAddress)
                            : EXPLORER_URLS[token.chain]?.(selectedWallet.address);

                          return (
                            <tr key={token.id || idx} className="hover:bg-[#161b22]/70 transition-colors">
                              {/* Asset name & symbol */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center space-x-2.5">
                                  <div className="w-7 h-7 rounded-full bg-[#21262d] border border-slate-700 flex items-center justify-center font-bold text-[11px] text-emerald-400 font-mono flex-shrink-0">
                                    {token.symbol.slice(0, 3)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white flex items-center space-x-1.5">
                                      <span>{token.symbol}</span>
                                      {token.isNative && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                                          NATIVE
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 truncate max-w-[120px]">
                                      {token.name}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Type */}
                              <td className="py-3.5 px-4 font-mono text-[11px]">
                                <span className="px-2 py-0.5 rounded bg-[#161b22] text-slate-300 border border-[#30363d]">
                                  {token.isNative
                                    ? `${token.chain} Native`
                                    : token.chain === 'SOL'
                                    ? 'SPL Token'
                                    : token.chain === 'BSC'
                                    ? 'BEP-20'
                                    : 'ERC-20'}
                                </span>
                              </td>

                              {/* Balance */}
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                                {token.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                              </td>

                              {/* Live Price */}
                              <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                                ${token.priceUsd < 0.01 ? token.priceUsd.toFixed(8) : token.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                              </td>

                              {/* 24h change */}
                              <td className="py-3.5 px-4 text-right font-mono font-semibold">
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
                                  <span>{Math.abs(token.change24h || 0).toFixed(2)}%</span>
                                </span>
                              </td>

                              {/* Total USD value */}
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                                {formatCurrency(token.balanceUsd)}
                              </td>

                              {/* Allocation % */}
                              <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                                <span className="px-2 py-0.5 rounded bg-[#161b22] border border-slate-700 font-bold">
                                  {token.allocationPercentage || 0}%
                                </span>
                              </td>

                              {/* Contract / Explorer */}
                              <td className="py-3.5 px-4 text-center">
                                {token.contractAddress ? (
                                  <div className="flex items-center justify-center space-x-1">
                                    <button
                                      onClick={(e) => handleCopy(token.contractAddress!, `tok-${token.id}`, e)}
                                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
                                      title={`Sao chép hợp đồng: ${token.contractAddress}`}
                                    >
                                      {copiedId === `tok-${token.id}` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    <a
                                      href={tokenExplorer || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-[#21262d] transition-colors"
                                      title="Xem trên Explorer"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    {!token.isNative && (
                                      <button
                                        onClick={(e) => handleDeleteToken(token.id, e)}
                                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-[#21262d] transition-colors"
                                        title="Xóa / Ẩn token này khỏi ví"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">Native</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Custom Token Contract Scan */}
              <div className="p-4 bg-[#0d1117] rounded-xl border border-[#21262d]">
                <div className="flex items-center space-x-2 text-xs font-bold text-white mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Quét thêm Token hợp đồng tùy chỉnh (Custom Contract Address)</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">
                  Nếu ví sở hữu token ERC-20 / SPL chưa có trong danh sách mặc định, hãy nhập địa chỉ Smart Contract để hệ thống truy vấn số dư on-chain ngay lập tức.
                </p>

                {contractError && (
                  <div className="mb-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{contractError}</span>
                  </div>
                )}

                <form onSubmit={handleScanCustomToken} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="VD: 0xdAC17F958D2ee523a2206206994597C13D831ec7 (Tether USD)..."
                    value={customContract}
                    onChange={(e) => setCustomContract(e.target.value)}
                    className="flex-1 bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={scanningContract || !customContract.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 flex-shrink-0"
                  >
                    {scanningContract && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{scanningContract ? 'Đang truy vấn...' : 'Quét Token'}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#21262d] bg-[#0d1117] flex items-center justify-between">
              <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Chế độ View-Only an toàn 100%. Dữ liệu được trích xuất trực tiếp từ RPC Node công khai.</span>
                <span className="sm:hidden">View-Only an toàn 100%</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setWalletToDelete(selectedWallet)}
                  className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ví</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWallet(null)}
                  className="px-5 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-white font-semibold text-xs transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: IN-APP DELETE WALLET CONFIRMATION (NO window.confirm) */}
      {/* ============================================================ */}
      {walletToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#161b22] border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white text-center">
              Xác nhận xóa ví theo dõi
            </h3>

            <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa ví <strong className="text-white font-semibold">{walletToDelete.label}</strong> ({walletToDelete.chain}) khỏi danh sách theo dõi?
            </p>

            <div className="mt-3 p-3 bg-[#0d1117] rounded-xl border border-[#21262d] text-center font-mono text-xs text-slate-300 truncate">
              {walletToDelete.address}
            </div>

            <p className="text-[11px] text-slate-500 text-center mt-2">
              Lưu ý: Thao tác này chỉ xóa ví khỏi danh sách theo dõi cá nhân của bạn, không ảnh hưởng đến tài sản trên blockchain. Bạn có thể thêm lại bất cứ lúc nào.
            </p>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setWalletToDelete(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#21262d] text-slate-300 hover:text-white font-medium text-xs transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-lg shadow-rose-900/20 flex items-center justify-center space-x-1.5"
              >
                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'Đang xóa...' : 'Xác nhận xóa ví'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: ADD VIEW-ONLY WALLET MODAL */}
      {/* ============================================================ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <WalletIcon className="w-5 h-5 text-emerald-400" />
              <span>Thêm Ví View-Only (Chỉ Xem)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Chỉ nhập Public Address công khai. Hệ thống sẽ quét toàn bộ số dư và các coin on-chain thực tế.
            </p>

            {errorMsg && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddWallet} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Mạng Blockchain</label>
                <select
                  value={chain}
                  onChange={(e) => {
                    const newChain = e.target.value as ChainType;
                    setChain(newChain);
                  }}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="ETH">Ethereum (ETH / ERC-20)</option>
                  <option value="SOL">Solana (SOL / SPL)</option>
                  <option value="BTC">Bitcoin (BTC Native / SegWit)</option>
                  <option value="BSC">BNB Smart Chain (BEP-20)</option>
                  <option value="POLYGON">Polygon Network (POL)</option>
                  <option value="ARBITRUM">Arbitrum One (ETH)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Tên nhãn gợi nhớ</label>
                  <button
                    type="button"
                    onClick={handleFillSample}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Điền ví mẫu để test
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="VD: Ví lạnh Trezor, Ví cá nhân..."
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Địa chỉ Ví công khai (Public Address)
                </label>
                <input
                  type="text"
                  placeholder={
                    chain === 'ETH' || chain === 'BSC' || chain === 'POLYGON' || chain === 'ARBITRUM'
                      ? '0x...'
                      : chain === 'SOL'
                      ? 'Địa chỉ Solana Base58...'
                      : 'bc1... hoặc 1... hoặc 3...'
                  }
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-[#0d1117] rounded-xl border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>An toàn 100%:</strong> Chỉ truy vấn số dư on-chain từ Public RPC. Không yêu cầu Private Key hay ký giao dịch.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#21262d] text-slate-300 hover:text-white font-medium text-xs transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-md flex items-center space-x-1.5"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{loading ? 'Đang quét on-chain...' : 'Bắt đầu theo dõi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Wallet Label Modal */}
      {walletToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setWalletToEdit(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 pb-3 border-b border-[#21262d]">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Edit2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Đổi tên nhãn ví theo dõi</h4>
                <p className="text-xs text-slate-400 font-mono truncate max-w-[240px]">{walletToEdit.address}</p>
              </div>
            </div>

            <form onSubmit={handleSaveWalletLabel} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Tên nhãn ví mới</label>
                <input
                  type="text"
                  required
                  value={editWalletLabel}
                  onChange={(e) => setEditWalletLabel(e.target.value)}
                  placeholder="VD: Ví lạnh dài hạn, Ví Phantom phụ..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setWalletToEdit(null)}
                  className="px-4 py-2 rounded-xl bg-[#21262d] text-slate-300 hover:text-white font-medium text-xs transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingWalletLabel}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-md"
                >
                  {savingWalletLabel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
