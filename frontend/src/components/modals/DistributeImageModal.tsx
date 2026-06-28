import React from "react";
import { ImageModel, ServerCredential } from "../../types";

interface DistributeImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  selectedImage: ImageModel | null;
  servers: any[]; // ProxmoxServerData or ServerCredential
  nodes: any[];
  storages: any[];
  serverId: string;
  node: string;
  storage: string;
  isDistributing: boolean;
  onServerChange: (serverId: string) => void;
  onNodeChange: (node: string) => void;
  onStorageChange: (storage: string) => void;
}

export default function DistributeImageModal({
  isOpen,
  onClose,
  onSubmit,
  selectedImage,
  servers,
  nodes,
  storages,
  serverId,
  node,
  storage,
  isDistributing,
  onServerChange,
  onNodeChange,
  onStorageChange
}: DistributeImageModalProps) {
  if (!isOpen || !selectedImage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#151926] border border-indigo-500/20 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-[#1b2031] border-b border-indigo-500/10 flex justify-between items-center">
          <h3 className="font-bold text-base text-white">이미지 배포 대상 지정</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white"
            type="button"
            disabled={isDistributing}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 flex flex-col gap-4 text-sm text-gray-200">
          <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs text-indigo-300">
            <p>배포 파일: <span className="font-semibold text-white">{selectedImage.name}</span></p>
            <p className="mt-0.5">파일 형식: <span className="uppercase font-semibold">{selectedImage.type}</span></p>
          </div>

          {/* Server */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Proxmox 서버</label>
            <select
              required
              value={serverId}
              onChange={(e) => onServerChange(e.target.value)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              disabled={isDistributing}
            >
              <option value="" disabled>서버를 선택하세요</option>
              {servers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
              ))}
            </select>
          </div>

          {/* Node */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">대상 노드</label>
            <select
              required
              value={node}
              onChange={(e) => onNodeChange(e.target.value)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              disabled={isDistributing}
            >
              <option value="" disabled>노드를 선택하세요</option>
              {nodes.map((n: any) => (
                <option key={n.name || n.node} value={n.name || n.node}>{n.name || n.node}</option>
              ))}
            </select>
          </div>

          {/* Storage */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">대상 스토리지 Pool</label>
            <select
              required
              value={storage}
              onChange={(e) => onStorageChange(e.target.value)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              disabled={isDistributing}
            >
              <option value="" disabled>스토리지를 선택하세요</option>
              {storages.map((st: any) => (
                <option key={st.name} value={st.name}>{st.name} ({st.content})</option>
              ))}
              {storages.length === 0 && (
                <option value="" disabled className="text-rose-400">
                  [주의] 노드에서 해당 이미지 형식을 수용할 수 있는 스토리지가 감지되지 않습니다. (local 등 권장)
                </option>
              )}
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-indigo-500/5 pt-4 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 font-semibold text-xs transition"
              disabled={isDistributing}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs transition flex items-center gap-1.5"
              disabled={isDistributing || storages.length === 0}
            >
              {isDistributing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  전송 중...
                </>
              ) : (
                "배포 명령 전송"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
