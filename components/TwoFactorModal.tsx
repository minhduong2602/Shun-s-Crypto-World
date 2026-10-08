'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  X,
  Copy,
  Check,
  RefreshCw,
  Lock,
  Smartphone,
  KeyRound,
} from 'lucide-react';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  twoFactorEnabled: boolean;
  onSuccess: () => void;
}

export const TwoFactorModal: React.FC<TwoFactorModalProps> = ({
  isOpen,
  onClose,
  twoFactorEnabled,
  onSuccess,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || twoFactorEnabled) return;
    let ignore = false;

    async function initSetup() {
      try {
        const res = await fetch('/api/auth/setup-2fa', { method: 'POST' });
        const data = await res.json();
        if (ignore) return;
        if (data.qrCodeDataUrl) {
          setQrCodeDataUrl(data.qrCodeDataUrl);
          setSecret(data.secret);
        }
      } catch {
        if (!ignore) setStatusMsg({ type: 'error', text: 'Không thể tạo mã QR' });
      }
    }

    void initSetup();
    return () => {
      ignore = true;
    };
  }, [isOpen, twoFactorEnabled]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setStatusMsg({ type: 'error', text: 'Vui lòng nhập đủ 6 chữ số' });
      return;
    }

    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode.trim(), isEnabling: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: '✅ Đã kích hoạt 2FA thành công! Tài khoản được bảo vệ tối đa.' });
        onSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Mã OTP không hợp lệ hoặc đã hết hạn' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Lỗi xác minh kết nối' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl relative my-8 text-xs">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 pb-4 border-b border-[#21262d]">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              twoFactorEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}
          >
            {twoFactorEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Xác Thực Hai Yếu Tố (2FA TOTP)</h2>
            <p className="text-slate-400">
              {twoFactorEnabled ? 'Trạng thái: ĐÃ BẢO VỆ' : 'Google Authenticator / Authy RFC 6238'}
            </p>
          </div>
        </div>

        {twoFactorEnabled ? (
          <div className="mt-5 space-y-4 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">2FA Đang Được Kích Hoạt</h3>
              <p className="text-slate-300 mt-1">
                Tài khoản cá nhân của bạn trên <strong>Shun&apos;s Crypto World</strong> đã được bảo vệ bằng lớp mã OTP 6 số.
              </p>
            </div>

            {statusMsg && (
              <div
                className={`p-2.5 rounded-lg text-xs ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <div className="pt-2 border-t border-[#21262d] space-y-2">
              <div className="text-left">
                <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                  Nhập mã OTP 6 số để Tắt 2FA:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="VD: 123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.5em] text-lg font-mono py-1.5 bg-[#0d1117] border border-[#30363d] rounded-xl text-white focus:outline-none focus:border-rose-500 font-bold"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (otpCode.length !== 6) {
                      setStatusMsg({ type: 'error', text: 'Nhập đủ 6 số OTP để tắt 2FA' });
                      return;
                    }
                    setLoading(true);
                    try {
                      const res = await fetch('/api/auth/verify-2fa', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: otpCode.trim(), action: 'disable' }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setStatusMsg({ type: 'success', text: 'Đã tắt 2FA thành công!' });
                        onSuccess();
                        setTimeout(onClose, 1200);
                      } else {
                        setStatusMsg({ type: 'error', text: data.error || 'Mã OTP không đúng' });
                      }
                    } catch {
                      setStatusMsg({ type: 'error', text: 'Lỗi mạng khi tắt 2FA' });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || otpCode.length !== 6}
                  className="w-1/2 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold transition-colors disabled:opacity-40"
                >
                  Tắt 2FA
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/2 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="p-3 bg-[#0d1117] rounded-xl border border-[#21262d] space-y-2">
              <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Bước 1: Quét mã QR bằng Google Authenticator</span>
              </span>

              {loading && !qrCodeDataUrl ? (
                <div className="h-44 flex items-center justify-center space-x-2 text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Đang sinh khóa bí mật TOTP...</span>
                </div>
              ) : (
                qrCodeDataUrl && (
                  <div className="flex flex-col items-center py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeDataUrl}
                      alt="2FA QR Code"
                      className="w-44 h-44 rounded-lg bg-white p-2 border border-slate-700 shadow-md"
                    />
                  </div>
                )
              )}

              {/* Secret key backup */}
              <div className="flex items-center justify-between bg-[#161b22] px-3 py-1.5 rounded-lg border border-[#30363d]">
                <div className="font-mono text-[11px] text-slate-300 truncate max-w-[240px]">
                  {secret || '...'}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-white flex items-center space-x-1 ml-2"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{copied ? 'Đã chép' : 'Chép'}</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center space-x-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bước 2: Nhập mã 6 chữ số từ ứng dụng</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="VD: 123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.5em] text-xl font-mono py-2 bg-[#0d1117] border border-[#30363d] rounded-xl text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              {statusMsg && (
                <div
                  className={`p-2.5 rounded-lg text-xs ${
                    statusMsg.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {statusMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-1.5"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Xác nhận &amp; Bật 2FA</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
