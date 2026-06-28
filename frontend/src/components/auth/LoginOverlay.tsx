import React, { useState } from "react";
import { UserSession } from "../../types";

interface LoginOverlayProps {
  backendUrl: string;
  onLoginSuccess: (session: UserSession) => void;
}

export default function LoginOverlay({ backendUrl, onLoginSuccess }: LoginOverlayProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "로그인 정보가 올바르지 않습니다.");
      }

      const data: UserSession = await res.json();
      onLoginSuccess(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070913] p-4">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>

      <div className="w-full max-w-md bg-[#111422]/70 backdrop-blur-xl border border-indigo-500/10 p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-bold text-white text-2xl">P</span>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white">Proxmox Datacenter Manager</h2>
            <p className="text-xs text-slate-300 mt-1">인증 토큰 및 리소스를 관리하는 통합 대시보드</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">사용자 ID (Username)</label>
            <input
              type="text"
              required
              placeholder="아이디를 입력하세요"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950/50 border border-indigo-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-white transition placeholder-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">비밀번호 (Password)</label>
            <input
              type="password"
              required
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/50 border border-indigo-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-white transition placeholder-gray-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition disabled:opacity-50 shadow-lg shadow-indigo-500/15 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                로그인 중...
              </>
            ) : (
              "로그인"
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-indigo-500/5 pt-6 text-xs text-slate-400">
          <p>초기 계정 정보: admin/admin123, operator/operator123, reader/reader123</p>
        </div>
      </div>
    </div>
  );
}
