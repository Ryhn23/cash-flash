import React, { useState } from 'react';
import { api } from '../api/client.js';
import { useAppStore } from '../store/useAppStore.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';

export const LoginPage: React.FC = () => {
  const { setUser, setCsrfToken } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.post<{ success: boolean; user: any; csrfToken: string }>(
        '/api/auth/login',
        { email, password }
      );
      setUser(res.user);
      setCsrfToken(res.csrfToken);
    } catch (err: any) {
      setError(err.message || 'Email atau kata sandi tidak valid');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 no-gradient">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex justify-center mb-3">
          <div className="w-10 h-10 rounded bg-[#1E1B4B] text-white flex items-center justify-center font-bold shadow-none no-gradient">
            <i className="fa-solid fa-receipt text-base" />
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold text-[#0F172A] tracking-tight font-heading">
          Next<span className="text-[#3730A3]">-Cash</span>
        </h1>
        <p className="mt-1 text-center text-xs font-medium text-[#475569] font-sans">
          Sovereign Operations &bull; Collaborative Ledger & Expense Telemetry
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-none border border-[#E2E8F0] rounded-lg sm:px-10 no-gradient">
          <form className="space-y-4" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Alamat Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@nextcash.io"
              required
              autoFocus
              icon="fa-regular fa-envelope"
            />

            <Input
              label="Kata Sandi"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              icon="fa-solid fa-lock"
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isLoading}
              icon="fa-solid fa-arrow-right-to-bracket"
            >
              Masuk ke Ledger
            </Button>
          </form>

          {/* Quick Demo Logins Banner */}
          <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.04em] mb-2.5 text-center font-sans">
              Akses Cepat Akun Demo (Klik untuk Isi):
            </p>

            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@nextcash.io', 'AdminPassword123!')}
                className="w-full text-left p-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EEF2FF] hover:border-[#C7D2FE] transition-colors flex items-center justify-between active:scale-[0.99]"
              >
                <div>
                  <div className="font-bold text-[#1E1B4B] font-heading">1. Administrator Utama (SUPER_ADMIN)</div>
                  <div className="text-[11px] text-slate-500 font-mono">admin@nextcash.io &bull; AdminPassword123!</div>
                </div>
                <i className="fa-solid fa-key text-[10px] text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('bendahara@safir.org', 'SafirPassword123!')}
                className="w-full text-left p-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EEF2FF] hover:border-[#C7D2FE] transition-colors flex items-center justify-between active:scale-[0.99]"
              >
                <div>
                  <div className="font-bold text-slate-900 font-heading">2. Fathir Bendahara (GROUP_MANAGER)</div>
                  <div className="text-[11px] text-slate-500 font-mono">bendahara@safir.org &bull; SafirPassword123!</div>
                </div>
                <i className="fa-solid fa-shield-halved text-[10px] text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('staf@safir.org', 'SafirPassword123!')}
                className="w-full text-left p-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EEF2FF] hover:border-[#C7D2FE] transition-colors flex items-center justify-between active:scale-[0.99]"
              >
                <div>
                  <div className="font-bold text-slate-900 font-heading">3. Ahmad Pencatat (EDITOR)</div>
                  <div className="text-[11px] text-slate-500 font-mono">staf@safir.org &bull; SafirPassword123!</div>
                </div>
                <i className="fa-solid fa-pen text-[10px] text-slate-400" />
              </button>
            </div>
          </div>

          {/* Security Features Tag */}
          <div className="mt-6 pt-4 border-t border-[#F1F5F9] flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center h-5 px-1.5 text-[11px] font-semibold rounded-full bg-[#F1F5F9] text-[#475569]">Argon2id Hash</span>
            <span className="inline-flex items-center h-5 px-1.5 text-[11px] font-semibold rounded-full bg-[#F1F5F9] text-[#475569]">SHA-256 Session</span>
            <span className="inline-flex items-center h-5 px-1.5 text-[11px] font-semibold rounded-full bg-[#F1F5F9] text-[#475569]">CSRF Token</span>
            <span className="inline-flex items-center h-5 px-1.5 text-[11px] font-semibold rounded-full bg-[#F1F5F9] text-[#475569]">Strict CSP</span>
          </div>
        </div>
      </div>
    </div>
  );
};
