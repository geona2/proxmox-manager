import React, { useState, useEffect } from "react";

interface CreateCephStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
  isCreating: boolean;
  nodesList: string[];
}

export default function CreateCephStorageModal({
  isOpen,
  onClose,
  onSubmit,
  isCreating,
  nodesList
}: CreateCephStorageModalProps) {
  const [storageId, setStorageId] = useState("");
  const [type, setType] = useState<"rbd" | "cephfs">("rbd");
  const [monhosts, setMonhosts] = useState("");
  const [pool, setPool] = useState("device_image");
  const [username, setUsername] = useState("admin");
  const [content, setContent] = useState("images,rootdir");
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  // Update default content based on type
  useEffect(() => {
    if (type === "rbd") {
      setContent("images,rootdir");
      setPool("device_image");
    } else {
      setContent("iso,vztmpl,backup");
      setPool("");
    }
  }, [type]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storageId || !monhosts || !content) {
      alert("필수 입력 항목을 채워주세요.");
      return;
    }

    onSubmit({
      storage_id: storageId,
      type,
      monhosts,
      pool: type === "rbd" ? pool : "",
      username: type === "rbd" ? username : "",
      content,
      nodes: selectedNodes.length > 0 ? selectedNodes.join(",") : undefined
    });
  };

  const handleNodeToggle = (node: string) => {
    setSelectedNodes(prev =>
      prev.includes(node) ? prev.filter(n => n !== node) : [...prev, node]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#151926] border border-indigo-500/20 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-[#1b2031] border-b border-indigo-500/10 flex justify-between items-center">
          <h3 className="font-bold text-base text-white">Ceph 스토리지 연동 추가</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-white" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">스토리지 ID (이름)</label>
            <input
              type="text"
              required
              placeholder="예: ceph-rbd, shared-cephfs"
              value={storageId}
              onChange={(e) => setStorageId(e.target.value)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Ceph 스토리지 종류</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
            >
              <option value="rbd">RBD (Block Device / 가상 머신 디스크용)</option>
              <option value="cephfs">CephFS (Shared File System / ISO, 템플릿 백업용)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">모니터 호스트 IP 주소 (monhosts)</label>
            <input
              type="text"
              required
              placeholder="192.168.1.100;192.168.1.101"
              value={monhosts}
              onChange={(e) => setMonhosts(e.target.value)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
            />
            <p className="text-xs text-slate-400 mt-1">세미콜론(;)으로 구분하여 Monitor 노드들의 IP를 기입하십시오.</p>
          </div>

          {type === "rbd" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Ceph Pool 이름</label>
                <input
                  type="text"
                  required
                  placeholder="device_image"
                  value={pool}
                  onChange={(e) => setPool(e.target.value)}
                  className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">사용자 ID (Client User)</label>
                <input
                  type="text"
                  required
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">허용 콘텐츠 유형 (Content)</label>
            <input
              type="text"
              required
              placeholder={type === "rbd" ? "images,rootdir" : "iso,vztmpl,backup"}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
            />
            <p className="text-xs text-slate-400 mt-1">콤마(,)로 구분 (RBD: images,rootdir / CephFS: iso,vztmpl,backup)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">사용 가능 노드 제한 (선택)</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {nodesList.map(node => (
                <button
                  type="button"
                  key={node}
                  onClick={() => handleNodeToggle(node)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedNodes.includes(node)
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-900 border border-indigo-500/10 text-slate-200 hover:text-white"
                  }`}
                >
                  {node}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">미선택 시 클러스터 내 전체 노드에서 마운트 가능합니다.</p>
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
              disabled={isCreating}
              className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white text-sm font-semibold transition flex items-center gap-2"
            >
              {isCreating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              스토리지 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
