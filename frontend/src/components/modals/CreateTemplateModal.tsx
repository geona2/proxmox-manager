import React, { useState, useEffect } from "react";
import { ImageModel } from "../../types";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    serverId: string;
    node: string;
    vmid: number;
    name: string;
    storage: string;
    templateOs: "ubuntu22.04" | "ubuntu24.04" | "rhel8" | "rhel9";
    isoImage: string;
  }) => void;
  servers: any[];
  nodes: any[];
  storages: any[];
  imagesList: ImageModel[];
  isCreating: boolean;
  onServerChange: (serverId: string) => void;
  onNodeChange: (node: string) => void;
}

export default function CreateTemplateModal({
  isOpen,
  onClose,
  onSubmit,
  servers,
  nodes,
  storages,
  imagesList,
  isCreating,
  onServerChange,
  onNodeChange
}: CreateTemplateModalProps) {
  const [serverId, setServerId] = useState("");
  const [node, setNode] = useState("");
  const [vmid, setVmid] = useState(500);
  const [name, setName] = useState("");
  const [storage, setStorage] = useState("");
  const [templateOs, setTemplateOs] = useState<"ubuntu22.04" | "ubuntu24.04" | "rhel8" | "rhel9">("ubuntu22.04");
  const [isoImage, setIsoImage] = useState("");

  // Initialize dropdowns when modal opens or lists load
  useEffect(() => {
    if (isOpen && servers.length > 0) {
      const defaultServerId = servers[0].id || "";
      setServerId(defaultServerId);
      onServerChange(defaultServerId);
    }
  }, [isOpen, servers]);

  useEffect(() => {
    if (nodes.length > 0) {
      const defaultNode = nodes[0].name || nodes[0].node || "";
      setNode(defaultNode);
      onNodeChange(defaultNode);
    }
  }, [nodes]);

  useEffect(() => {
    if (storages.length > 0) {
      setStorage(storages[0].name || "");
    } else {
      setStorage("");
    }
  }, [storages]);

  // Filter images to only ISO files
  const isoImages = imagesList.filter(img => img.type === "iso");

  useEffect(() => {
    if (isoImages.length > 0) {
      setIsoImage(isoImages[0].name);
    } else {
      setIsoImage("");
    }
  }, [imagesList]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId || !node || !storage || !isoImage) {
      alert("모든 필수 필드를 지정하세요.");
      return;
    }
    onSubmit({
      serverId,
      node,
      vmid,
      name: name || `template-${templateOs}`,
      storage,
      templateOs,
      isoImage
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#151926] border border-indigo-500/20 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="px-6 py-4 bg-[#1b2031] border-b border-indigo-500/10 flex justify-between items-center">
          <h3 className="font-bold text-base text-white">OS 템플릿 생성 (Cloud-Init ready QCOW2)</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white"
            type="button"
            disabled={isCreating}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 text-sm text-gray-200">
          <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs text-indigo-300">
            <p className="font-semibold">💡 Info: Cloud-Init OS 템플릿 만들기</p>
            <p className="mt-1">지정한 ISO 이미지와 기본 디스크(QCOW2), Cloud-Init 드라이브, 직렬 인터페이스가 결합된 가상머신 템플릿을 생성합니다.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Server */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Proxmox 서버</label>
              <select
                required
                value={serverId}
                onChange={(e) => {
                  setServerId(e.target.value);
                  onServerChange(e.target.value);
                }}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              >
                <option value="" disabled>서버 선택</option>
                {servers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Node */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">대상 노드</label>
              <select
                required
                value={node}
                onChange={(e) => {
                  setNode(e.target.value);
                  onNodeChange(e.target.value);
                }}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              >
                <option value="" disabled>노드 선택</option>
                {nodes.map((n: any) => (
                  <option key={n.name || n.node} value={n.name || n.node}>{n.name || n.node}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* VMID */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">VMID (템플릿 ID)</label>
              <input
                type="number"
                required
                min={100}
                value={vmid}
                onChange={(e) => setVmid(Number(e.target.value))}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">템플릿 이름</label>
              <input
                type="text"
                placeholder={`template-${templateOs}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              />
            </div>
          </div>

          {/* OS Choice */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">배포 템플릿 OS 버전</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#151926] p-1 rounded-lg border border-indigo-500/5">
              {(["ubuntu22.04", "ubuntu24.04", "rhel8", "rhel9"] as const).map((os) => (
                <button
                  key={os}
                  type="button"
                  onClick={() => setTemplateOs(os)}
                  className={`py-1.5 rounded-md text-[10px] font-semibold uppercase transition ${
                    templateOs === os ? "bg-indigo-500 text-white" : "text-gray-400 hover:text-white"
                  }`}
                  disabled={isCreating}
                >
                  {os.replace(".", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* ISO Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">원본 설치용 ISO 이미지 파일</label>
            <select
              required
              value={isoImage}
              onChange={(e) => setIsoImage(e.target.value)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              disabled={isCreating}
            >
              <option value="" disabled>ISO 파일 선택</option>
              {isoImages.map((img) => (
                <option key={img.id} value={img.name}>{img.name} ({(img.size_gb).toFixed(2)} GB)</option>
              ))}
              {isoImages.length === 0 && (
                <option value="" disabled className="text-rose-400">
                  [주의] 업로드된 ISO 파일이 없습니다. 먼저 업로드해 주세요.
                </option>
              )}
            </select>
          </div>

          {/* Storage */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">배포 스토리지 Pool (QCOW2 저장위치)</label>
            <select
              required
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              disabled={isCreating}
            >
              <option value="" disabled>스토리지 pool 선택</option>
              {storages.map((st: any) => (
                <option key={st.name} value={st.name}>{st.name} ({st.content})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-indigo-500/5 pt-4 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 font-semibold text-xs transition"
              disabled={isCreating}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs transition flex items-center gap-1.5"
              disabled={isCreating || !isoImage || !storage}
            >
              {isCreating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  템플릿 빌드 중...
                </>
              ) : (
                "템플릿 빌드 시작"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
