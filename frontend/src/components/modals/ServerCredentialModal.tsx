import React from "react";
import { ServerCredential } from "../../types";

interface ServerCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  title: string;
  serverData: ServerCredential;
  onChange: (updated: ServerCredential) => void;
  isEdit?: boolean;
}

export default function ServerCredentialModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  serverData,
  onChange,
  isEdit = false
}: ServerCredentialModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#151926] border border-indigo-500/20 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-[#1b2031] border-b border-indigo-500/10 flex justify-between items-center">
          <h3 className="font-bold text-base text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">서버 이름</label>
            <input
              type="text"
              required
              placeholder="예: 홈 서버, PVE-Datacenter"
              value={serverData.name}
              onChange={(e) => onChange({ ...serverData, name: e.target.value })}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">IP 주소 / Host</label>
              <input
                type="text"
                required
                placeholder="192.168.1.100"
                value={serverData.host}
                onChange={(e) => onChange({ ...serverData, host: e.target.value })}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Port</label>
              <input
                type="number"
                required
                value={serverData.port}
                onChange={(e) => onChange({ ...serverData, port: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Username</label>
            <input
              type="text"
              required
              placeholder="root@pam"
              value={serverData.username}
              onChange={(e) => onChange({ ...serverData, username: e.target.value })}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">토큰 식별자 (Token Name)</label>
              <input
                type="text"
                required
                placeholder="monitoring"
                value={serverData.token_name}
                onChange={(e) => onChange({ ...serverData, token_name: e.target.value })}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">토큰 값 (Token Value)</label>
              <input
                type="password"
                placeholder={isEdit ? "기존 값 그대로 유지하려면 입력 생략" : "xxxx-xxxx-xxxx"}
                required={!isEdit}
                value={serverData.token_value}
                onChange={(e) => onChange({ ...serverData, token_value: e.target.value })}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              CPU 코어 가상화 배수 (%)
            </label>
            <input
              type="number"
              required
              min={50}
              max={1000}
              placeholder="100"
              value={serverData.cpu_overcommit_ratio ?? 100}
              onChange={(e) => onChange({ ...serverData, cpu_overcommit_ratio: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
            />
            <p className="text-xs text-slate-400 mt-1">
              물리 코어 대비 할당 가능 가상 코어 배수 (기본값: 100%)
            </p>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="verify-ssl-check"
              checked={serverData.verify_ssl}
              onChange={(e) => onChange({ ...serverData, verify_ssl: e.target.checked })}
              className="accent-indigo-500 cursor-pointer"
            />
            <label htmlFor="verify-ssl-check" className="text-xs text-slate-300 cursor-pointer">
              SSL 인증서 검증 활성화 (체크 해제 시 사설 인증서 무시 허용)
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-4 border-t border-indigo-500/5 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition"
            >
              {isEdit ? "수정사항 적용" : "저장 및 연결"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
