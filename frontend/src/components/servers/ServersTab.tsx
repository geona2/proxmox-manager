import React from "react";
import { ServerCredential } from "../../types";

interface ServersTabProps {
  credentials: ServerCredential[];
  userRole: string;
  onAddTrigger: () => void;
  onEditTrigger: (cred: ServerCredential) => void;
  onDelete: (id: string) => void;
}

export default function ServersTab({
  credentials,
  userRole,
  onAddTrigger,
  onEditTrigger,
  onDelete
}: ServersTabProps) {
  const isAdmin = userRole === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">Proxmox 서버 연동 설정</h2>
          <p className="text-xs text-slate-300 font-medium">데이터를 주기적으로 수집할 Proxmox API Credential을 관리합니다.</p>
        </div>
        
        {isAdmin && (
          <button
            onClick={onAddTrigger}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-sm transition shadow-lg shadow-indigo-500/10 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            서버 추가
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {credentials.map((cred) => (
          <div key={cred.id} className="glass-card rounded-2xl p-5 flex flex-col justify-between gap-4 border border-indigo-500/10">
            <div>
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base text-white">{cred.name}</h3>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold font-mono bg-slate-800 text-slate-300">
                  Port: {cred.port}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-1.5 text-sm text-gray-200">
                <p className="flex justify-between"><span className="text-slate-400 font-medium">호스트 IP</span> <span className="font-mono text-white">{cred.host}</span></p>
                <p className="flex justify-between"><span className="text-slate-400 font-medium">사용자 이름</span> <span className="font-mono text-white">{cred.username}</span></p>
                <p className="flex justify-between"><span className="text-slate-400 font-medium">토큰 식별자</span> <span className="font-mono text-white">{cred.token_name}</span></p>
                <p className="flex justify-between"><span className="text-slate-400 font-medium">SSL 검증</span> <span className="text-white">{cred.verify_ssl ? "활성" : "비활성 (Self-signed 허용)"}</span></p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-indigo-500/5 pt-3">
              {isAdmin ? (
                <>
                  <button
                    onClick={() => onEditTrigger(cred)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    정보 수정
                  </button>
                  <button
                    onClick={() => cred.id && onDelete(cred.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition"
                  >
                    서버 삭제
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-400 italic">수정 권한 없음 (Admin 전용)</span>
              )}
            </div>
          </div>
        ))}

        {credentials.length === 0 && (
          <div className="col-span-2 text-center py-10 text-slate-300 font-medium">
            등록된 Proxmox 서버가 없습니다. 우측 상단의 [서버 추가] 버튼을 눌러 연동 설정을 진행해 주세요.
          </div>
        )}
      </div>
    </div>
  );
}
