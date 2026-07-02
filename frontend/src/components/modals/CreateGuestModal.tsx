import React, { useState, useEffect } from "react";
import { ImageModel } from "../../types";

interface CreateGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
  servers: any[];
  nodes: any[];
  storages: any[];
  imagesList: ImageModel[];
  isCreating: boolean;
  onServerChange: (serverId: string) => void;
  onNodeChange: (node: string, serverId: string) => void;
}

export default function CreateGuestModal({
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
}: CreateGuestModalProps) {
  const [serverId, setServerId] = useState("");
  const [node, setNode] = useState("");
  const [vmid, setVmid] = useState(200);
  const [name, setName] = useState("");
  const [guestType, setGuestType] = useState<"qemu" | "lxc">("qemu");
  const [cores, setCores] = useState(2);
  const [memory, setMemory] = useState(2048);
  const [storage, setStorage] = useState("");
  const [diskSize, setDiskSize] = useState(32);
  const [image, setImage] = useState("");

  // Cloud init sub-states
  const [ciEnabled, setCiEnabled] = useState(false);
  const [ciUser, setCiUser] = useState("root");
  const [ciPassword, setCiPassword] = useState("");
  const [sshKeys, setSshKeys] = useState("");
  const [ipConfigType, setIpConfigType] = useState<"dhcp" | "static">("dhcp");
  const [staticIp, setStaticIp] = useState("");
  const [staticGateway, setStaticGateway] = useState("");

  // Reset dropdown selections on server change
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
      onNodeChange(defaultNode, serverId);
    }
  }, [nodes]);

  useEffect(() => {
    if (storages.length > 0) {
      setStorage(storages[0].name || "");
    } else {
      setStorage("");
    }
  }, [storages]);

  // Handle image list change
  const filteredImages = imagesList.filter(
    (img) => img.type === (guestType === "qemu" ? "iso" : "vztmpl")
  );

  useEffect(() => {
    if (filteredImages.length > 0) {
      setImage(filteredImages[0].name);
    } else {
      setImage("");
    }
  }, [guestType, imagesList]);

  if (!isOpen) return null;

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId || !node || !storage || !image) {
      alert("필수 항목을 모두 작성해 주세요 (서버, 노드, 스토리지, 이미지).");
      return;
    }

    let ipconfig0 = "ip=dhcp";
    if (ciEnabled && guestType === "qemu") {
      if (ipConfigType === "static") {
        if (!staticIp) {
          alert("고정 IP 주소를 입력해 주세요 (예: 192.168.1.50/24).");
          return;
        }
        ipconfig0 = `ip=${staticIp}`;
        if (staticGateway) {
          ipconfig0 += `,gw=${staticGateway}`;
        }
      }
    }

    onSubmit({
      serverId,
      node,
      vmid,
      name,
      type: guestType,
      cores,
      memory,
      storage,
      disk_size: diskSize,
      image,
      cloudinit: {
        enabled: ciEnabled,
        ciuser: ciUser,
        cipassword: ciPassword || undefined,
        sshkeys: sshKeys || undefined,
        ipconfig0
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#151926] border border-indigo-500/20 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="px-6 py-4 bg-[#1b2031] border-b border-indigo-500/10 flex justify-between items-center">
          <h3 className="font-bold text-base text-white">가상 장비 생성 (Create VM / Container)</h3>
          <button 
            onClick={onClose} 
            className="text-slate-300 hover:text-white"
            type="button"
            disabled={isCreating}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmitForm} className="p-6 flex flex-col gap-5 text-sm text-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Server */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Proxmox 서버</label>
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
                <option value="" disabled>서버를 선택해 주세요</option>
                {servers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
                ))}
              </select>
            </div>

            {/* Node */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">대상 노드 (Node)</label>
              <select
                required
                value={node}
                onChange={(e) => {
                  setNode(e.target.value);
                  onNodeChange(e.target.value, serverId);
                }}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              >
                <option value="" disabled>노드를 선택해 주세요</option>
                {nodes.map((n: any) => (
                  <option key={n.name || n.node} value={n.name || n.node}>{n.name || n.node}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VMID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">VMID (ID 식별값)</label>
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
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">장비 이름 (Hostname / Name)</label>
              <input
                type="text"
                required
                placeholder="예: database-replica-01"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Guest Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">가상 장비 종류</label>
              <div className="grid grid-cols-2 gap-2 bg-[#151926] p-1 rounded-lg border border-indigo-500/5">
                <button
                  type="button"
                  onClick={() => setGuestType("qemu")}
                  className={`py-1.5 rounded-md text-xs font-medium transition ${
                    guestType === "qemu" ? "bg-indigo-500 text-white" : "text-slate-200 hover:text-white"
                  }`}
                  disabled={isCreating}
                >
                  VM (QEMU 가상머신)
                </button>
                <button
                  type="button"
                  onClick={() => setGuestType("lxc")}
                  className={`py-1.5 rounded-md text-xs font-medium transition ${
                    guestType === "lxc" ? "bg-indigo-500 text-white" : "text-slate-200 hover:text-white"
                  }`}
                  disabled={isCreating}
                >
                  LXC (시스템 컨테이너)
                </button>
              </div>
            </div>

            {/* Disk Size */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">디스크 크기 (GB)</label>
              <input
                type="number"
                required
                min={1}
                value={diskSize}
                onChange={(e) => setDiskSize(Number(e.target.value))}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CPU Cores */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">CPU 코어 수</label>
              <input
                type="number"
                required
                min={1}
                value={cores}
                onChange={(e) => setCores(Number(e.target.value))}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              />
            </div>

            {/* Memory */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">메모리 할당량 (MB)</label>
              <input
                type="number"
                required
                min={128}
                step={128}
                value={memory}
                onChange={(e) => setMemory(Number(e.target.value))}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              />
            </div>

            {/* Storage selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">대상 스토리지 pool</label>
              <select
                required
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                disabled={isCreating}
              >
                <option value="" disabled>스토리지를 선택하세요</option>
                {storages.map((st: any) => (
                  <option key={st.name} value={st.name}>
                    {st.name} (남은 용량: {(st.total_gb - st.used_gb).toFixed(1)} GB / 전체: {st.total_gb} GB)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* OS/Template Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              {guestType === "qemu" ? "OS 이미지 파일 (ISO)" : "LXC 템플릿 파일"}
            </label>
            <select
              required
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              disabled={isCreating}
            >
              <option value="" disabled>파일 선택</option>
              {filteredImages.map((img) => (
                <option key={img.id} value={img.name}>{img.name} ({img.size_gb.toFixed(2)} GB)</option>
              ))}
              {filteredImages.length === 0 && (
                <option value="" disabled className="text-rose-400">
                  [경고] 먼저 이미지 저장소 탭에서 {guestType === "qemu" ? "ISO" : "템플릿"} 파일을 업로드해 주세요!
                </option>
              )}
            </select>
          </div>

          {/* CLOUD-INIT SETTINGS (VM Only) */}
          {guestType === "qemu" && (
            <div className="mt-2 border border-indigo-500/10 rounded-xl p-4 bg-slate-900/40">
              <div className="flex items-center justify-between">
                <label htmlFor="ci-enabled" className="text-xs font-bold text-gray-300 uppercase cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ci-enabled"
                    checked={ciEnabled}
                    onChange={(e) => setCiEnabled(e.target.checked)}
                    className="accent-indigo-500 cursor-pointer w-4 h-4"
                    disabled={isCreating}
                  />
                  Cloud-Init 설정 활성화 (자동 초기화 구성)
                </label>
              </div>

              {ciEnabled && (
                <div className="flex flex-col gap-4 mt-4 border-t border-indigo-500/5 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CI User */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">사용자명 (Username)</label>
                      <input
                        type="text"
                        placeholder="root"
                        value={ciUser}
                        onChange={(e) => setCiUser(e.target.value)}
                        className="w-full bg-slate-955 border border-indigo-500/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        disabled={isCreating}
                      />
                    </div>

                    {/* CI Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">비밀번호 (Password)</label>
                      <input
                        type="password"
                        placeholder="비밀번호 설정"
                        value={ciPassword}
                        onChange={(e) => setCiPassword(e.target.value)}
                        className="w-full bg-slate-955 border border-indigo-500/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        disabled={isCreating}
                      />
                    </div>
                  </div>

                  {/* SSH Public Key */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">SSH 공개키 (Public Keys)</label>
                    <textarea
                      rows={2}
                      placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC..."
                      value={sshKeys}
                      onChange={(e) => setSshKeys(e.target.value)}
                      className="w-full bg-slate-955 border border-indigo-500/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      disabled={isCreating}
                    />
                  </div>

                  {/* IP Configuration */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">IP 주소 설정 방법</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-indigo-500/5 mb-3">
                      <button
                        type="button"
                        onClick={() => setIpConfigType("dhcp")}
                        className={`py-1 rounded-md text-xxs font-medium transition ${
                          ipConfigType === "dhcp" ? "bg-indigo-500 text-white" : "text-slate-200 hover:text-white"
                        }`}
                        disabled={isCreating}
                      >
                        DHCP (자동 할당)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIpConfigType("static")}
                        className={`py-1 rounded-md text-xxs font-medium transition ${
                          ipConfigType === "static" ? "bg-indigo-500 text-white" : "text-slate-200 hover:text-white"
                        }`}
                        disabled={isCreating}
                      >
                        Static IP (고정 IP 구성)
                      </button>
                    </div>

                    {ipConfigType === "static" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="block text-xs text-slate-300 mb-1">고정 IP 주소 (CIDR 표기법)</label>
                          <input
                            type="text"
                            placeholder="192.168.1.50/24"
                            value={staticIp}
                            onChange={(e) => setStaticIp(e.target.value)}
                            className="w-full bg-slate-950 border border-indigo-500/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            disabled={isCreating}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-300 mb-1">게이트웨이 (Gateway)</label>
                          <input
                            type="text"
                            placeholder="192.168.1.1"
                            value={staticGateway}
                            onChange={(e) => setStaticGateway(e.target.value)}
                            className="w-full bg-slate-950 border border-indigo-500/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            disabled={isCreating}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-indigo-500/5 pt-4 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
              disabled={isCreating}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs transition flex items-center gap-1.5"
              disabled={isCreating || !image || !storage}
            >
              {isCreating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  생성 중...
                </>
              ) : (
                "배포 및 생성 시작"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
