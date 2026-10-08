'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  X,
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { PriceAlert, AlertCondition } from '@/lib/types';
import { DEFAULT_PRICES } from '@/lib/db/store';

interface TelegramAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCurrency: string;
}

export const TelegramAlertsModal: React.FC<TelegramAlertsModalProps> = ({
  isOpen,
  onClose,
  baseCurrency,
}) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingMsg, setTestingMsg] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // New alert form
  const [newCoinId, setNewCoinId] = useState('bitcoin');
  const [newCondition, setNewCondition] = useState<AlertCondition>('ABOVE');
  const [newTarget, setNewTarget] = useState('95000');
  const [newRecurring, setNewRecurring] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadAlerts();
  }, [isOpen]);

  async function loadAlerts() {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      if (data.alerts) setAlerts(data.alerts);
      if (data.telegramConfig) {
        setChatId(data.telegramConfig.chatId || '');
      }
    } catch (e) {
      console.error(e);
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/alerts/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatId, saveOnly: true }),
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
        body: JSON.stringify({ botToken: botToken || undefined, chatId: chatId || undefined, saveOnly: false }),
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
    const coin = DEFAULT_PRICES[newCoinId] || DEFAULT_PRICES['bitcoin'];
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinId: newCoinId,
          symbol: coin.symbol,
          condition: newCondition,
          targetValue: Number(newTarget),
          isRecurring: newRecurring,
        }),
      });
      if (res.ok) {
        loadAlerts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadAlerts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts?id=${id}`, { method: 'PATCH' });
      if (res.ok) {
        loadAlerts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 pb-4 border-b border-[#21262d]">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Cảnh Báo Biến Động Giá Qua Telegram Bot</h2>
            <p className="text-xs text-slate-400">
              Nhận thông báo tự động 24/7 trực tiếp vào tài khoản Telegram cá nhân
            </p>
          </div>
        </div>

        {/* Telegram Bot Credentials */}
        <div className="mt-5 p-4 bg-[#0d1117] rounded-xl border border-[#21262d] text-xs">
          <h3 className="font-bold text-slate-200 mb-2 flex items-center justify-between">
            <span>1. Kết nối Telegram Bot của bạn</span>
            <span className="text-[10px] text-sky-400 font-normal">
              Tạo bot miễn phí qua @BotFather
            </span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Telegram Bot Token</label>
              <input
                type="password"
                placeholder="VD: 7218392819:AAH..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Telegram Chat ID</label>
              <input
                type="text"
                placeholder="VD: 984512340 (lấy từ @userinfobot)"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`mt-3 p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                testResult.success
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 mt-3">
            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-200 text-xs font-medium transition-colors"
            >
              Lưu cấu hình
            </button>
            <button
              onClick={handleTestPing}
              disabled={testingMsg}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md transition-colors"
            >
              {testingMsg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Gửi tin nhắn test</span>
            </button>
          </div>
        </div>

        {/* Create Price Alert Form */}
        <div className="mt-5 text-xs">
          <h3 className="font-bold text-white mb-2">2. Thiết lập điều kiện cảnh báo mới</h3>
          <form
            onSubmit={handleCreateAlert}
            className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-[#0d1117] p-3 rounded-xl border border-[#21262d] items-end"
          >
            <div>
              <label className="block text-slate-400 mb-1">Đồng tiền</label>
              <select
                value={newCoinId}
                onChange={(e) => {
                  setNewCoinId(e.target.value);
                  const p = DEFAULT_PRICES[e.target.value]?.price || 100;
                  setNewTarget(String(p));
                }}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              >
                {Object.entries(DEFAULT_PRICES).map(([id, c]) => (
                  <option key={id} value={id}>
                    {c.symbol} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Điều kiện</label>
              <select
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value as AlertCondition)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="ABOVE">Giá vượt lên trên ($)</option>
                <option value="BELOW">Giá giảm xuống dưới ($)</option>
                <option value="PCT_UP_24H">Tăng mạnh 24h (% ≥)</option>
                <option value="PCT_DOWN_24H">Giảm mạnh 24h (% ≤)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Mục tiêu</label>
              <input
                type="number"
                step="any"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <button
                type="submit"
                className="w-full px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1 transition-colors shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm rule</span>
              </button>
            </div>
          </form>
        </div>

        {/* Active Alerts List */}
        <div className="mt-5 text-xs">
          <h3 className="font-bold text-white mb-2">3. Danh sách cảnh báo đang chạy ({alerts.length})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-slate-500 italic py-3 text-center">Chưa có cảnh báo nào được đặt.</p>
            ) : (
              alerts.map((alt) => (
                <div
                  key={alt.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#0d1117] border border-[#21262d]"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {alt.symbol}
                    </span>
                    <span className="text-slate-300">
                      {alt.condition === 'ABOVE' && `Vượt ngưỡng $${alt.targetValue}`}
                      {alt.condition === 'BELOW' && `Giảm dưới $${alt.targetValue}`}
                      {alt.condition === 'PCT_UP_24H' && `Tăng 24h ≥ +${alt.targetValue}%`}
                      {alt.condition === 'PCT_DOWN_24H' && `Giảm 24h ≤ -${alt.targetValue}%`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleAlert(alt.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                        alt.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {alt.isActive ? 'ĐANG BẬT' : 'TẠM TẮT'}
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alt.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
