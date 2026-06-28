import React from "react";

interface DeleteGuestConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  guestName: string;
  vmid: number;
  serverName: string;
  nodeName: string;
  guestType: "qemu" | "lxc";
  confirmInput: string;
  setConfirmInput: (val: string) => void;
  isDeleting: boolean;
}

export default function DeleteGuestConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  guestName,
  vmid,
  serverName,
  nodeName,
  guestType,
  confirmInput,
  setConfirmInput,
  isDeleting
}: DeleteGuestConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#151926] border border-rose-500/30 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-rose-950/10 border-b border-rose-500/20 flex justify-between items-center">
          <div className="flex items-center gap-2 text-rose-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-bold text-base">가상 자원 삭제 (이중 확인)</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white"
            disabled={isDeleting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <div className="p-3.5 bg-rose-500/5 rounded-xl border border-rose-500/10 text-xs text-rose-300">
            <p className="font-semibold">⚠️ 경고: 이 작업은 되돌릴 수 없습니다.</p>
            <p className="mt-1">선택하신 가상 자원의 디스크와 모든 구성 파일이 영구적으로 파괴됩니다. 데이터 소실을 예방하기 위해 실행하기 전 2차 확인이 필요합니다.</p>
          </div>

          <div className="text-sm text-gray-300">
            <p>대상 서버: <span className="font-semibold text-white">{serverName}</span></p>
            <p>대상 노드: <span className="font-semibold text-white">{nodeName}</span></p>
            <p>대상 장비: <span className="font-semibold text-white">{guestName} (ID: {vmid})</span></p>
            <p className="mt-1">자원 종류: <span className="text-indigo-400 uppercase font-bold">{guestType === "qemu" ? "Virtual Machine (가상머신)" : "LXC Container (컨테이너)"}</span></p>
          </div>

          <div className="border-t border-indigo-500/5 pt-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
              최종 승인을 위해 가상 장비 이름 (<span className="text-rose-400 font-mono select-all">{guestName}</span>)을 똑같이 입력해 주세요:
            </label>
            <input
              type="text"
              required
              placeholder="장비 이름 입력"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full bg-slate-900 border border-rose-500/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500 text-white font-semibold"
              disabled={isDeleting}
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 border-t border-indigo-500/5 pt-4">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 text-sm font-semibold transition disabled:opacity-50"
            >
              돌아가기
            </button>
            <button
              type="button"
              disabled={confirmInput !== guestName || isDeleting}
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition disabled:opacity-30 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  삭제 중...
                </>
              ) : (
                "최종 삭제 실행"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
