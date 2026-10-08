'use client';

import React, { useState } from 'react';
import {
  Wallet as WalletIcon,
  Plus,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Coins,
  AlertCircle,
} from 'lucide-react';
import { Wallet, ChainType } from '@/lib/types';

interface ViewOnlyWalletsProps {
  wallets: Wallet[];
  baseCurrency: string;
  onRefresh: () => void;
}

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

  const formatCurrency = (val: number) => {
    if (baseCurrency === 'VND') {
      const vndVal = val * 25450;
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vndVal);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/wallets/${id}/sync`, { method: 'POST' });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa ví này khỏi danh sách theo dõi?')) return;
    try {
      const res = await fetch(`/api/wallets?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !label.trim()) {
      setErrorMsg('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setLoading(true);
    setErrorMsg('');
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
        onRefresh();
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const totalBalance = wallets.reduce((acc, w) => acc + w.balanceUsd, 0);

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>Danh sách Ví đang theo dõi</span>
            <span className="text-xs text-slate-400 font-normal">({wallets.length} ví)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Tổng tài sản trong các ví công khai: <span className="font-mono font-bold text-emerald-400">{formatCurrency(totalBalance)}</span>
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Theo dõi địa chỉ mới</span>
        </button>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className="bg-[#161b22] border border-[#30363d] hover:border-slate-600 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
          >
            <div>
              {/* Card top */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#21262d] text-cyan-400 font-mono border border-slate-700">
                    {wallet.chain}
                  </span>
                  <span className="font-bold text-white text-sm">{wallet.label}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleSync(wallet.id)}
                    disabled={syncingId === wallet.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-[#21262d] transition-colors"
                    title="Đồng bộ on-chain"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingId === wallet.id ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDelete(wallet.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#21262d] transition-colors"
                    title="Xóa ví"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Address truncated */}
              <div className="mt-3 flex items-center justify-between bg-[#0d1117] px-3 py-1.5 rounded-lg border border-[#21262d]">
                <span className="font-mono text-xs text-slate-400 truncate max-w-[200px]">
                  {wallet.address}
                </span>
                <button
                  onClick={() => handleCopy(wallet.address, wallet.id)}
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
                <div className="text-slate-400 text-[11px]">Số dư ước tính:</div>
                <div className="text-xl font-bold font-mono text-white mt-0.5">
                  {formatCurrency(wallet.balanceUsd)}
                </div>
                <div className="text-xs text-emerald-400 font-mono mt-0.5">
                  {wallet.nativeBalance} {wallet.nativeSymbol}
                </div>
              </div>
            </div>

            {/* Card footer */}
            <div className="mt-4 pt-2 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Đồng bộ: {new Date(wallet.lastSyncedAt || wallet.createdAt).toLocaleTimeString('vi-VN')}</span>
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Active</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add View-Only Wallet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <WalletIcon className="w-5 h-5 text-emerald-400" />
              <span>Thêm Ví View-Only (Chỉ Xem)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Chỉ nhập Public Address công khai. Không cần kết nối ví Web3.
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
                  onChange={(e) => setChain(e.target.value as ChainType)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="ETH">Ethereum (ETH / ERC-20)</option>
                  <option value="SOL">Solana (SOL / SPL)</option>
                  <option value="BTC">Bitcoin (BTC SegWit / Taproot)</option>
                  <option value="BSC">BNB Smart Chain (BEP-20)</option>
                  <option value="POLYGON">Polygon Network</option>
                  <option value="ARBITRUM">Arbitrum One</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Tên nhãn gợi nhớ</label>
                <input
                  type="text"
                  placeholder="VD: Ví lạnh Trezor, Quỹ Staking, v.v..."
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
                  placeholder="0x... hoặc bc1... hoặc địa chỉ Solana base58"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-[#0d1117] rounded-xl border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
                ⚠️ <strong>Cảnh báo bảo mật:</strong> Không bao giờ nhập Private Key, Seed Phrase hoặc mật khẩu ví. Chúng tôi chỉ cần Public Address để kiểm tra số dư công khai trên blockchain.
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
                  <span>Bắt đầu theo dõi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
