"use client";

import React, { useState, useEffect } from "react";
import { ServerCredential, ImageModel, UserSession } from "../types";

// Import Modular Components
import LoginOverlay from "../components/auth/LoginOverlay";
import DashboardTab from "../components/dashboard/DashboardTab";
import ImagesTab from "../components/images/ImagesTab";
import ServersTab from "../components/servers/ServersTab";
import UsersTab from "../components/users/UsersTab";

// Import Modals
import CreateGuestModal from "../components/modals/CreateGuestModal";
import ServerCredentialModal from "../components/modals/ServerCredentialModal";
import DeleteGuestConfirmModal from "../components/modals/DeleteGuestConfirmModal";
import DistributeImageModal from "../components/modals/DistributeImageModal";
import CreateTemplateModal from "../components/modals/CreateTemplateModal";

const BACKEND_URL = typeof window !== "undefined" 
  ? `http://${window.location.hostname}:8000` 
  : "http://127.0.0.1:8000";

export default function Home() {
  // Authentication State
  const [session, setSession] = useState<UserSession | null>(null);

  // General States
  const [activeTab, setActiveTab] = useState<"dashboard" | "clusters" | "servers" | "images" | "users">("dashboard");
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [credentials, setCredentials] = useState<ServerCredential[]>([]);
  const [imagesList, setImagesList] = useState<ImageModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Settings & Polling
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [pollingInterval, setPollingInterval] = useState<number>(5000); // 5 seconds
  const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>({});

  // Modals visibility toggles
  const [showAddServerModal, setShowAddServerModal] = useState<boolean>(false);
  const [showEditServerModal, setShowEditServerModal] = useState<boolean>(false);
  const [showCreateGuestModal, setShowCreateGuestModal] = useState<boolean>(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState<boolean>(false);
  const [showDistributeModal, setShowDistributeModal] = useState<boolean>(false);
  const [showDeleteVmModal, setShowDeleteVmModal] = useState<boolean>(false);

  // Action states payloads
  const [selectedServerCredential, setSelectedServerCredential] = useState<ServerCredential | null>(null);
  const [selectedImageForDistribute, setSelectedImageForDistribute] = useState<ImageModel | null>(null);
  
  // Server-specific nodes & storages filtered lists (for modals selector mapping)
  const [modalNodesList, setModalNodesList] = useState<any[]>([]);
  const [modalStoragesList, setModalStoragesList] = useState<any[]>([]);

  // Modal specific state details
  const [newServerPayload, setNewServerPayload] = useState<ServerCredential>({
    name: "",
    host: "",
    port: 8006,
    username: "",
    token_name: "",
    token_value: "",
    verify_ssl: false,
    cpu_overcommit_ratio: 100
  });
  
  const [distributePayload, setDistributePayload] = useState({
    serverId: "",
    node: "",
    storage: ""
  });

  const [guestToDelete, setGuestToDelete] = useState<{
    serverId: string;
    serverName: string;
    vmid: number;
    name: string;
    node: string;
    type: "qemu" | "lxc";
  } | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  // Action status indicators
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [isDeletingVm, setIsDeletingVm] = useState(false);

  // Uploader parameters
  const [uploadType, setUploadType] = useState<"iso" | "vztmpl">("iso");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Session check on mount
  useEffect(() => {
    const saved = localStorage.getItem("proxmox_session");
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem("proxmox_session");
      }
    }
  }, []);

  const handleLoginSuccess = (userSession: UserSession) => {
    localStorage.setItem("proxmox_session", JSON.stringify(userSession));
    setSession(userSession);
  };

  const handleLogout = async () => {
    if (session) {
      try {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` }
        });
      } catch (e) {
        console.error("Logout request error", e);
      }
    }
    localStorage.removeItem("proxmox_session");
    setSession(null);
    setActiveTab("dashboard");
  };

  // Setup headers with Authorization Token
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = { ...extraHeaders };
    if (session) {
      headers["Authorization"] = `Bearer ${session.token}`;
    }
    return headers;
  };

  // Fetch Dashboard Summary
  const fetchDashboardData = async (showLoading = false) => {
    if (!session) return;
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/proxmox/dashboard`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleLogout();
          return;
        }
        throw new Error("Failed to fetch dashboard data");
      }
      const data = await res.json();
      setDashboardData(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("백엔드 서버와 통신할 수 없습니다. FastAPI 서버 실행 상태를 확인해 주세요.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Fetch Credentials
  const fetchCredentials = async () => {
    if (!session) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/servers`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
      }
    } catch (err) {
      console.error("Error fetching credentials:", err);
    }
  };

  // Fetch Images Catalog
  const fetchImages = async () => {
    if (!session) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/images`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setImagesList(data);
      }
    } catch (err) {
      console.error("Error fetching images:", err);
    }
  };

  // Trigger loading when session initializes
  useEffect(() => {
    if (session) {
      fetchDashboardData(true);
      fetchCredentials();
      fetchImages();
    }
  }, [session]);

  // Polling setup
  useEffect(() => {
    let timer: any = null;
    if (session && autoRefresh) {
      timer = setInterval(() => {
        fetchDashboardData(false);
      }, pollingInterval);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [session, autoRefresh, pollingInterval]);

  // Modal selector triggers (Server changes / Nodes changes)
  const handleModalServerChange = (selServerId: string) => {
    const serverObj = dashboardData?.servers?.find((s: any) => s.id === selServerId) || credentials?.find((s: any) => s.id === selServerId);
    const nodes = serverObj?.nodes || [];
    setModalNodesList(nodes);

    if (nodes.length > 0) {
      const defaultNode = nodes[0].name || nodes[0].node || "";
      const filteredStorages = (serverObj?.storages || []).filter((s: any) => s.node === defaultNode);
      setModalStoragesList(filteredStorages);
    } else {
      setModalStoragesList([]);
    }
  };

  const handleModalNodeChange = (selNode: string, currentServerId: string) => {
    const serverObj = dashboardData?.servers?.find((s: any) => s.id === currentServerId) || credentials?.find((s: any) => s.id === currentServerId);
    const filteredStorages = (serverObj?.storages || []).filter((s: any) => s.node === selNode);
    setModalStoragesList(filteredStorages);
  };

  // Server CRUD handlers
  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/api/servers`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(newServerPayload)
      });
      if (!res.ok) throw new Error("서버 설정을 추가할 수 없습니다.");
      
      setNewServerPayload({
        name: "",
        host: "",
        port: 8006,
        username: "",
        token_name: "",
        token_value: "",
        verify_ssl: false,
        cpu_overcommit_ratio: 100
      });
      setShowAddServerModal(false);
      fetchCredentials();
      fetchDashboardData(true);
    } catch (err: any) {
      alert(`서버 추가 실패: ${err.message}`);
    }
  };

  const handleEditServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServerCredential?.id) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/servers/${selectedServerCredential.id}`, {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(selectedServerCredential)
      });
      if (!res.ok) throw new Error("서버 설정을 수정할 수 없습니다.");
      
      setShowEditServerModal(false);
      setSelectedServerCredential(null);
      fetchCredentials();
      fetchDashboardData(true);
    } catch (err: any) {
      alert(`서버 수정 실패: ${err.message}`);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!confirm("정말 이 Proxmox 서버 설정을 삭제하시겠습니까? 관련 자원 수집이 중단됩니다.")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/servers/${serverId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("서버 설정을 삭제할 수 없습니다.");
      
      fetchCredentials();
      fetchDashboardData(true);
    } catch (err: any) {
      alert(`서버 삭제 실패: ${err.message}`);
    }
  };

  // VM Power actions (Start/Shutdown/Stop/Reboot)
  const handleVmPowerAction = async (serverId: string, nodeName: string, guestType: "qemu" | "lxc", vmid: number, action: string) => {
    if (action === "stop" || action === "shutdown") {
      if (!confirm(`정말 ID ${vmid} 장비를 ${action === "stop" ? "강제 중지" : "전원 종료"} 하시겠습니까?`)) return;
    }
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/servers/${serverId}/vms/${vmid}/status`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          node: nodeName,
          type: guestType,
          action: action
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Power action failed");
      }
      
      fetchDashboardData(false);
    } catch (err: any) {
      alert(`제어 명령 실패 [API: POST /api/servers/${serverId}/vms/${vmid}/status]: ${err.message}`);
    }
  };

  // Delete safety checks triggers
  const triggerDeleteVmSafety = (guest: any, serverId: string, serverName: string) => {
    setGuestToDelete({
      serverId,
      serverName,
      vmid: guest.vmid,
      name: guest.name,
      node: guest.node,
      type: guest.type
    });
    setDeleteConfirmInput("");
    setShowDeleteVmModal(true);
  };

  const handleExecuteDeleteVm = async () => {
    if (!guestToDelete) return;
    if (deleteConfirmInput !== guestToDelete.name) {
      alert("VM 이름이 일치하지 않습니다.");
      return;
    }
    
    setIsDeletingVm(true);
    const targetUrl = `${BACKEND_URL}/api/servers/${guestToDelete.serverId}/vms/${guestToDelete.vmid}`;
    try {
      const queryParams = new URLSearchParams({
        node: guestToDelete.node,
        type: guestToDelete.type,
        confirm_name: deleteConfirmInput
      });
      
      const res = await fetch(`${targetUrl}?${queryParams.toString()}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Deletion failed");
      }
      
      setShowDeleteVmModal(false);
      setGuestToDelete(null);
      fetchDashboardData(false);
      alert("성공적으로 삭제되었습니다.");
    } catch (err: any) {
      alert(`자원 삭제 실패 [API: DELETE ${targetUrl}]: ${err.message}`);
    } finally {
      setIsDeletingVm(false);
    }
  };

  // Image Upload handler
  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert("업로드할 파일을 선택해 주세요.");
      return;
    }
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("image_type", uploadType);
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/images/upload`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      alert("이미지가 성공적으로 업로드되었습니다.");
      setUploadFile(null);
      const fileInput = document.getElementById("file-upload-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      fetchImages();
    } catch (err: any) {
      alert(`업로드 실패: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Distribute image triggers
  const handleDistributeImageTrigger = (image: ImageModel) => {
    setSelectedImageForDistribute(image);
    const defaultServerId = dashboardData?.servers?.[0]?.id || credentials?.[0]?.id || "";
    setDistributePayload({
      serverId: defaultServerId,
      node: "",
      storage: ""
    });
    handleModalServerChange(defaultServerId);
    setShowDistributeModal(true);
  };

  const handleExecuteDistributeImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImageForDistribute || !distributePayload.serverId || !distributePayload.node || !distributePayload.storage) {
      alert("배포 대상 필드를 채워주세요.");
      return;
    }
    
    setIsDistributing(true);
    try {
      const { serverId, node, storage } = distributePayload;
      const res = await fetch(`${BACKEND_URL}/api/images/distribute/${serverId}/${node}/${storage}`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ image_id: selectedImageForDistribute.id })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Distribution failed");
      }
      
      alert("배포 명령이 전송되었습니다. 백엔드에서 다운로드를 시작합니다.");
      setShowDistributeModal(false);
    } catch (err: any) {
      alert(`배포 실패: ${err.message}`);
    } finally {
      setIsDistributing(false);
    }
  };

  // Deploy Guest VM/LXC Container
  const handleCreateGuest = async (payload: any) => {
    setIsCreatingGuest(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/servers/${payload.serverId}/vms`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Guest creation failed");
      }
      
      alert(`가상 장비 ${payload.name} (VMID: ${payload.vmid}) 생성 명령이 전송되었습니다.`);
      setShowCreateGuestModal(false);
      fetchDashboardData(false);
    } catch (err: any) {
      alert(`가상 장비 생성 실패: ${err.message}`);
    } finally {
      setIsCreatingGuest(false);
    }
  };

  // Build VM OS Template from ISO file
  const handleCreateTemplate = async (payload: any) => {
    setIsCreatingTemplate(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/images/create-template`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Template creation failed");
      }
      
      alert(`템플릿 ${payload.name} (VMID: ${payload.vmid}) 생성 명령이 전송되었습니다.`);
      setShowCreateTemplateModal(false);
      fetchDashboardData(false);
    } catch (err: any) {
      alert(`템플릿 생성 실패: ${err.message}`);
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  // Open modals setup helpers
  const openCreateGuestModalTrigger = () => {
    const defaultServerId = dashboardData?.servers?.[0]?.id || credentials?.[0]?.id || "";
    handleModalServerChange(defaultServerId);
    setShowCreateGuestModal(true);
  };

  const openCreateTemplateModalTrigger = () => {
    const defaultServerId = dashboardData?.servers?.[0]?.id || credentials?.[0]?.id || "";
    handleModalServerChange(defaultServerId);
    setShowCreateTemplateModal(true);
  };

  if (!session) {
    return <LoginOverlay backendUrl={BACKEND_URL} onLoginSuccess={handleLoginSuccess} />;
  }

  const roleLabel = session.role.toUpperCase();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#070913] text-gray-100 font-sans">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none -z-10"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0d0f17]/80 backdrop-blur-md border-b border-indigo-500/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-bold text-white text-xl">P</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Proxmox Datacenter Manager
            </h1>
            <p className="text-xs text-slate-400">Real-time Datacenter Monitor</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-6">
          <nav className="flex bg-[#151926] p-1 rounded-lg border border-indigo-500/5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("clusters")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "clusters"
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Cluster Control
            </button>
            <button
              onClick={() => setActiveTab("images")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "images"
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Images
            </button>
            <button
              onClick={() => setActiveTab("servers")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "servers"
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Servers ({credentials.length})
            </button>
            {session.role === "admin" && (
              <button
                onClick={() => setActiveTab("users")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === "users"
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Users
              </button>
            )}
          </nav>

          {/* Action buttons */}
          {session.role !== "reader" && (
            <button
              onClick={openCreateGuestModalTrigger}
              className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-sm transition-all shadow-md shadow-indigo-500/10 flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Guest
            </button>
          )}

          {/* Refresh controls */}
          <div className="flex items-center gap-2 bg-[#151926] px-3 py-1.5 rounded-lg border border-indigo-500/5 text-xs text-gray-300">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-indigo-500 cursor-pointer"
              />
              Auto Refresh
            </label>
            <span className="text-gray-600">|</span>
            <select
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
              disabled={!autoRefresh}
              className="bg-transparent border-none text-indigo-400 focus:outline-none cursor-pointer disabled:text-gray-500"
            >
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
            </select>
            <button
              onClick={() => fetchDashboardData(true)}
              className="p-1 text-gray-400 hover:text-indigo-400 transition"
              title="Refresh Now"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.247 8H18" />
              </svg>
            </button>
          </div>

          {/* Active Profile Info */}
          <div className="flex items-center gap-3 border-l border-indigo-500/10 pl-4">
            <div className="text-right">
              <p className="text-xs font-bold text-white">{session.username}</p>
              <span className={`text-xs font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded ${
                session.role === "admin" 
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/10" 
                  : session.role === "operator" 
                    ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/10" 
                    : "bg-slate-800 text-slate-300 border border-slate-700/50"
              }`}>{roleLabel}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition text-xs font-medium"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-center gap-3 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Tab Routing Renders */}
        {activeTab === "dashboard" && (
          <DashboardTab
            dashboardData={dashboardData}
            userRole={session.role}
            loading={loading}
            expandedServers={expandedServers}
            onToggleExpand={(id) => setExpandedServers(prev => ({ ...prev, [id]: !prev[id] }))}
            onPowerAction={handleVmPowerAction}
            onDeleteGuest={triggerDeleteVmSafety}
            onSetActiveTab={setActiveTab as any}
            authToken={session.token}
            simplified={true}
          />
        )}

        {activeTab === "clusters" && (
          <DashboardTab
            dashboardData={dashboardData}
            userRole={session.role}
            loading={loading}
            expandedServers={expandedServers}
            onToggleExpand={(id) => setExpandedServers(prev => ({ ...prev, [id]: !prev[id] }))}
            onPowerAction={handleVmPowerAction}
            onDeleteGuest={triggerDeleteVmSafety}
            onSetActiveTab={setActiveTab as any}
            authToken={session.token}
            simplified={false}
          />
        )}

        {activeTab === "images" && (
          <ImagesTab
            imagesList={imagesList}
            userRole={session.role}
            uploadType={uploadType}
            setUploadType={setUploadType}
            uploadFile={uploadFile}
            setUploadFile={setUploadFile}
            isUploading={isUploading}
            onUpload={handleUploadImage}
            onDistributeTrigger={handleDistributeImageTrigger}
            onCreateTemplateTrigger={openCreateTemplateModalTrigger}
          />
        )}

        {activeTab === "servers" && (
          <ServersTab
            credentials={credentials}
            userRole={session.role}
            onAddTrigger={() => {
              setNewServerPayload({
                name: "",
                host: "",
                port: 8006,
                username: "",
                token_name: "",
                token_value: "",
                verify_ssl: false,
                cpu_overcommit_ratio: 100
              });
              setShowAddServerModal(true);
            }}
            onEditTrigger={(cred) => {
              setSelectedServerCredential(cred);
              setShowEditServerModal(true);
            }}
            onDelete={handleDeleteServer}
          />
        )}

        {activeTab === "users" && session.role === "admin" && (
          <UsersTab
            backendUrl={BACKEND_URL}
            authToken={session.token}
            currentUser={session.username}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-indigo-500/10 py-6 text-center text-xs text-slate-400 bg-[#0d0f17]/30">
        <p>© 2026 Proxmox Multi-Manager Project. All rights reserved.</p>
      </footer>

      {/* RENDER MODALS */}
      
      {/* 1. Add Server Modal */}
      <ServerCredentialModal
        isOpen={showAddServerModal}
        onClose={() => setShowAddServerModal(false)}
        onSubmit={handleAddServer}
        title="Proxmox 서버 설정 추가"
        serverData={newServerPayload}
        onChange={setNewServerPayload}
      />

      {/* 2. Edit Server Modal */}
      {selectedServerCredential && (
        <ServerCredentialModal
          isOpen={showEditServerModal}
          onClose={() => {
            setShowEditServerModal(false);
            setSelectedServerCredential(null);
          }}
          onSubmit={handleEditServer}
          title="서버 설정 수정"
          serverData={selectedServerCredential}
          onChange={setSelectedServerCredential}
          isEdit={true}
        />
      )}

      {/* 3. Create Guest Modal */}
      <CreateGuestModal
        isOpen={showCreateGuestModal}
        onClose={() => setShowCreateGuestModal(false)}
        onSubmit={handleCreateGuest}
        servers={credentials}
        nodes={modalNodesList}
        storages={modalStoragesList}
        imagesList={imagesList}
        isCreating={isCreatingGuest}
        onServerChange={handleModalServerChange}
        onNodeChange={(node) => handleModalNodeChange(node, distributePayload.serverId)}
      />

      {/* 4. Create OS Template Modal */}
      <CreateTemplateModal
        isOpen={showCreateTemplateModal}
        onClose={() => setShowCreateTemplateModal(false)}
        onSubmit={handleCreateTemplate}
        servers={credentials}
        nodes={modalNodesList}
        storages={modalStoragesList}
        imagesList={imagesList}
        isCreating={isCreatingTemplate}
        onServerChange={handleModalServerChange}
        onNodeChange={(node) => handleModalNodeChange(node, distributePayload.serverId)}
      />

      {/* 5. Distribute Image Modal */}
      {selectedImageForDistribute && (
        <DistributeImageModal
          isOpen={showDistributeModal}
          onClose={() => {
            setShowDistributeModal(false);
            setSelectedImageForDistribute(null);
          }}
          onSubmit={handleExecuteDistributeImage}
          selectedImage={selectedImageForDistribute}
          servers={credentials}
          nodes={modalNodesList}
          storages={modalStoragesList}
          serverId={distributePayload.serverId}
          node={distributePayload.node}
          storage={distributePayload.storage}
          isDistributing={isDistributing}
          onServerChange={(serverId) => {
            setDistributePayload({ ...distributePayload, serverId, node: "", storage: "" });
            handleModalServerChange(serverId);
          }}
          onNodeChange={(node) => {
            setDistributePayload({ ...distributePayload, node, storage: "" });
            handleModalNodeChange(node, distributePayload.serverId);
          }}
          onStorageChange={(storage) => {
            setDistributePayload({ ...distributePayload, storage });
          }}
        />
      )}

      {/* 6. Delete Confirm Modal */}
      {guestToDelete && (
        <DeleteGuestConfirmModal
          isOpen={showDeleteVmModal}
          onClose={() => {
            setShowDeleteVmModal(false);
            setGuestToDelete(null);
          }}
          onConfirm={handleExecuteDeleteVm}
          guestName={guestToDelete.name}
          vmid={guestToDelete.vmid}
          serverName={guestToDelete.serverName}
          nodeName={guestToDelete.node}
          guestType={guestToDelete.type}
          confirmInput={deleteConfirmInput}
          setConfirmInput={setDeleteConfirmInput}
          isDeleting={isDeletingVm}
        />
      )}
    </div>
  );
}
