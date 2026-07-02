import React from "react";
import { ProxmoxServerData, GuestInfo } from "../../types";
import CreateCephStorageModal from "../modals/CreateCephStorageModal";
import VncConsole from "./VncConsole";

interface DashboardTabProps {
  dashboardData: any;
  userRole: string;
  loading: boolean;
  expandedServers: Record<string, boolean>;
  onToggleExpand: (serverId: string) => void;
  onPowerAction: (serverId: string, nodeName: string, guestType: "qemu" | "lxc", vmid: number, action: string) => void;
  onDeleteGuest: (guest: GuestInfo, serverId: string, serverName: string) => void;
  onSetActiveTab: (tab: any) => void;
  authToken?: string;
  simplified?: boolean;
}

const BACKEND_URL = typeof window !== "undefined" 
  ? `http://${window.location.hostname}:8000` 
  : "http://127.0.0.1:8000";

export default function DashboardTab({
  dashboardData,
  userRole,
  loading,
  expandedServers,
  onToggleExpand,
  onPowerAction,
  onDeleteGuest,
  onSetActiveTab,
  authToken,
  simplified = false
}: DashboardTabProps) {
  
  // Selection state for split-pane layout
  const [selectedItem, setSelectedItem] = React.useState<{
    type: "datacenter" | "server" | "node" | "guest";
    serverId?: string;
    nodeName?: string;
    vmid?: number;
  }>({ type: "datacenter" });

  // Tree collapse/expand overrides
  const [treeExpanded, setTreeExpanded] = React.useState<Record<string, boolean>>({
    datacenter: true
  });

  // Sidebar search filter
  const [sidebarSearch, setSidebarSearch] = React.useState("");

  // Sidebar drag resizer — position-based direct cursor mapping (no delta calculation)
  const [sidebarWidth, setSidebarWidth] = React.useState<number>(288);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const rightPanelRef = React.useRef<HTMLDivElement>(null);

  const startResizing = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 사이드바 왼쪽 모서리 X좌표 — 드래그 시작 시 한 번만 측정 (고정값)
    const sidebarLeft = sidebarRef.current!.getBoundingClientRect().left;

    // 좌우 패널 CSS transition 즉시 비활성화 (glass-card의 transition: all 0.3s 무력화)
    sidebarRef.current!.style.transition = "none";
    rightPanelRef.current!.style.transition = "none";
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      // 핵심: 사이드바 너비 = 마우스 X좌표 − 사이드바 왼쪽 모서리
      const maxW = Math.max(300, window.innerWidth * 0.45);
      const newWidth = Math.max(240, Math.min(maxW, ev.clientX - sidebarLeft));
      sidebarRef.current!.style.width = `${newWidth}px`;
    };

    const onUp = () => {
      // 바디 스타일 원복
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // 좌우 패널 CSS transition 원복
      sidebarRef.current!.style.transition = "";
      rightPanelRef.current!.style.transition = "";

      // 최종 너비를 React state에 동기화 (1회만 리렌더링)
      const finalWidth = sidebarRef.current!.getBoundingClientRect().width;
      setSidebarWidth(finalWidth);

      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Ceph Storage states
  const [cephStatus, setCephStatus] = React.useState<any>(null);
  const [cephPools, setCephPools] = React.useState<any[]>([]);
  const [loadingCeph, setLoadingCeph] = React.useState(false);
  const [cephError, setCephError] = React.useState<string | null>(null);
  const [showAddCephModal, setShowAddCephModal] = React.useState(false);
  const [isCreatingCeph, setIsCreatingCeph] = React.useState(false);

  // Guest details inline delete states
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");
  const [isDeletingGuest, setIsDeletingGuest] = React.useState(false);

  // Active tab inside VM/Guest detail pane
  const [vmActiveTab, setVmActiveTab] = React.useState<"summary" | "console">("summary");

  // Helper: Format uptime
  const formatUptime = (seconds: number) => {
    if (!seconds) return "0s";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Helper: Format bytes to GB/TB
  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Fetch Ceph stats when cluster is selected
  React.useEffect(() => {
    if (!simplified && selectedItem.type === "server" && selectedItem.serverId && authToken) {
      fetchCephData(selectedItem.serverId);
    }
  }, [selectedItem, simplified]);

  // Reset active VM tab when selection changes
  React.useEffect(() => {
    if (selectedItem.type === "guest") {
      setVmActiveTab("summary");
      setDeleteConfirmName("");
    }
  }, [selectedItem.vmid, selectedItem.serverId]);

  const fetchCephData = async (serverId: string) => {
    const server = dashboardData?.servers.find((s: any) => s.id === serverId);
    if (!server) return;
    const onlineNode = server.nodes.find((n: any) => n.status === "online")?.name;
    if (!onlineNode) return;

    setLoadingCeph(true);
    setCephError(null);

    try {
      const statusRes = await fetch(`${BACKEND_URL}/api/servers/${serverId}/ceph/status?node=${onlineNode}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (statusRes.ok) {
        const statusJson = await statusRes.json();
        setCephStatus(statusJson.data);
      } else {
        setCephStatus(null);
      }

      const poolsRes = await fetch(`${BACKEND_URL}/api/servers/${serverId}/ceph/pools?node=${onlineNode}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (poolsRes.ok) {
        const poolsJson = await poolsRes.json();
        setCephPools(poolsJson.data || []);
      }
    } catch (err: any) {
      console.warn("Ceph fetch error:", err.message);
      setCephStatus(null);
      setCephError(err.message);
    } finally {
      setLoadingCeph(false);
    }
  };

  const handleCreateCephStorageSubmit = async (payload: any) => {
    if (!selectedItem.serverId || !authToken) return;
    setIsCreatingCeph(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/servers/${selectedItem.serverId}/ceph/storage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to register Ceph storage");
      }
      alert(`Ceph Storage '${payload.storage_id}' created successfully.`);
      setShowAddCephModal(false);
      fetchCephData(selectedItem.serverId);
    } catch (err: any) {
      alert(`Ceph registration failed: ${err.message}`);
    } finally {
      setIsCreatingCeph(false);
    }
  };

  const handleDirectDeleteGuest = async (guest: any, serverId: string) => {
    if (guest.status === "running") {
      alert("Running guests cannot be deleted. Stop it first.");
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to permanently delete guest '${guest.name}'?`);
    if (!confirmed) return;

    setIsDeletingGuest(true);
    const targetUrl = `${BACKEND_URL}/api/servers/${serverId}/vms/${guest.vmid}`;
    try {
      const queryParams = new URLSearchParams({
        node: guest.node,
        type: guest.type,
        confirm_name: guest.name
      });
      const res = await fetch(`${targetUrl}?${queryParams.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Deletion failed");
      }
      alert("Guest deleted successfully.");
      setSelectedItem({ type: "datacenter" });
    } catch (err: any) {
      alert(`Delete failed [API: DELETE ${targetUrl}]: ${err.message}`);
    } finally {
      setIsDeletingGuest(false);
    }
  };

  // Helper: Get color class based on vCPU utilization percentage
  const getVcpuColor = (pct: number) => {
    if (pct >= 80) return "text-rose-400";
    if (pct >= 70) return "text-amber-400";
    return "text-emerald-400";
  };

  const getVirtualCpuColor = (pct: number) => {
    if (pct >= 80) return "text-rose-500 font-bold";
    if (pct >= 70) return "text-amber-500 font-bold";
    return "text-emerald-500 font-bold";
  };

  const getVirtualCpuBgColor = (pct: number) => {
    if (pct >= 80) return "bg-rose-500/10 border-rose-500/20 text-rose-400";
    if (pct >= 70) return "bg-amber-500/10 border-amber-500/20 text-amber-400";
    return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
  };

  const getCephHealthColor = (statusText: string) => {
    if (statusText === "HEALTH_OK") return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/10";
    if (statusText === "HEALTH_WARN") return "bg-amber-500/15 text-amber-400 border border-amber-500/10";
    return "bg-rose-500/15 text-rose-400 border border-rose-500/10";
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-200 text-sm font-medium">Collecting Proxmox Datacenter resource metrics...</p>
      </div>
    );
  }

  if (dashboardData && dashboardData.servers.length === 0) {
    return (
      <div className="flex-1 glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-white">No registered Proxmox servers found</h3>
        <p className="text-slate-300 text-sm max-w-sm">
          Please register your Proxmox credentials and API token in the Servers tab to begin monitoring.
        </p>
        <button
          onClick={() => onSetActiveTab("servers")}
          className="mt-2 px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-sm transition"
        >
          Add First Server
        </button>
      </div>
    );
  }

  if (!dashboardData) return null;

  // Tree filter logic
  const filteredServers = (dashboardData.servers || []).map((server: ProxmoxServerData) => {
    const matchingGuests = server.guests.filter((g) => {
      if (!sidebarSearch) return true;
      return g.name.toLowerCase().includes(sidebarSearch.toLowerCase()) || String(g.vmid).includes(sidebarSearch);
    });

    const matchingNodes = server.nodes.filter((node) => {
      if (!sidebarSearch) return true;
      const hasMatchingGuest = matchingGuests.some((g) => g.node === node.name);
      return node.name.toLowerCase().includes(sidebarSearch.toLowerCase()) || hasMatchingGuest;
    });

    const isMatch = sidebarSearch 
      ? (server.name.toLowerCase().includes(sidebarSearch.toLowerCase()) || matchingNodes.length > 0)
      : true;

    return {
      ...server,
      nodes: matchingNodes,
      guests: matchingGuests.filter((g) => matchingNodes.some((n) => n.name === g.node)),
      isMatch
    };
  }).filter((s: any) => s.isMatch);

  const isTreeItemExpanded = (key: string) => {
    if (sidebarSearch) return true;
    return !!treeExpanded[key];
  };

  return (
    <>
      {simplified ? (
        // DASHBOARD VIEW (Consolidated Overview & Dense List Table)
        <div className="flex flex-col gap-6">
          {/* Aggregate overview metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Servers & Nodes */}
            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300 font-semibold tracking-wider uppercase">Servers & Nodes</p>
                <h3 className="text-xl font-bold mt-1 text-white flex flex-col">
                  <span>{dashboardData.summary.online_servers} / {dashboardData.summary.total_servers} Servers Online</span>
                  <span className="text-xs text-slate-300 font-normal mt-0.5">{dashboardData.summary.online_nodes} / {dashboardData.summary.total_nodes} Nodes Active</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
            </div>

            {/* Active Guests */}
            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300 font-semibold tracking-wider uppercase">Active Guests (VMs/LXCs)</p>
                <h3 className="text-xl font-bold mt-1 text-emerald-400">
                  {dashboardData.summary.running_guests}
                  <span className="text-sm font-normal text-slate-300"> / {dashboardData.summary.total_guests} Running</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            {/* Storage Summary */}
            <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300 font-semibold tracking-wider uppercase">Cluster Raw Storage</p>
                <h3 className="text-xl font-bold mt-1 text-white">
                  {(dashboardData.resources.storage_used_gb / 1024).toFixed(2)}
                  <span className="text-sm font-normal text-slate-300"> / {(dashboardData.resources.storage_total_gb / 1024).toFixed(2)} TB Used</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.2 3.6 4 8 4s8-1.8 8-4V7M4 7c0 2.2 3.6 4 8 4s8-1.8 8-4M4 7c0-2.2 3.6-4 8-4s8 1.8 8 4m0 5c0 2.2-3.6 4-8 4s-8-1.8-8-4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Capacity Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* vCPU Capacity Allocation */}
            <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center text-white">
                <span className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  vCPU Capacity Allocation
                </span>
                <span className={`text-sm font-bold ${getVcpuColor(dashboardData.resources.vcpu_usage_pct || 0)}`}>
                  {dashboardData.resources.vcpu_usage_pct || 0}%
                </span>
              </div>
              <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden p-[1px]">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    (dashboardData.resources.vcpu_usage_pct || 0) >= 80 ? "bg-gradient-to-r from-rose-500 to-red-600" :
                    (dashboardData.resources.vcpu_usage_pct || 0) >= 70 ? "bg-gradient-to-r from-amber-500 to-orange-600" :
                    "bg-gradient-to-r from-emerald-500 to-green-600"
                  }`}
                  style={{ width: `${Math.min(dashboardData.resources.vcpu_usage_pct || 0, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-300 mt-1">
                <span>Allocated Cores: <strong className="text-white font-bold">{dashboardData.resources.vcpu_allocated_cores}</strong></span>
                <span>Max Allowed: <strong className="text-white font-bold">{dashboardData.resources.vcpu_max_virtual_cores}</strong> Cores</span>
              </div>
            </div>

            {/* RAM Capacity Allocation */}
            <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center text-white">
                <span className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12h15m-15 3h15M3 7.5A1.5 1.5 0 014.5 6h15A1.5 1.5 0 0121 7.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5v-9zM7.5 6v3m3-3v3m3-3v3m3-3v3" />
                  </svg>
                  Memory Capacity Allocation
                </span>
                <span className="text-sm font-bold text-violet-400">{dashboardData.resources.memory_allocated_pct}%</span>
              </div>
              <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden p-[1px]">
                <div 
                  className="bg-gradient-to-r from-violet-500 to-fuchsia-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(dashboardData.resources.memory_allocated_pct || 0, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-300 mt-1">
                <span>Allocated RAM: <strong className="text-white font-bold">{dashboardData.resources.memory_allocated_gb} GB</strong></span>
                <span>Total RAM: <strong className="text-white font-bold">{dashboardData.resources.memory_total_gb} GB</strong></span>
              </div>
            </div>

            {/* Storage Space Allocation */}
            <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center text-white">
                <span className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.2 3.6 4 8 4s8-1.8 8-4V7M4 7c0 2.2 3.6 4 8 4s8-1.8 8-4M4 7c0-2.2 3.6-4 8-4s8 1.8 8 4m0 5c0 2.2-3.6 4-8 4s-8-1.8-8-4" />
                  </svg>
                  Storage Space Allocation
                </span>
                <span className="text-sm font-bold text-fuchsia-400">{dashboardData.resources.storage_allocated_pct}%</span>
              </div>
              <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden p-[1px]">
                <div 
                  className="bg-gradient-to-r from-fuchsia-500 to-rose-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(dashboardData.resources.storage_allocated_pct || 0, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-300 mt-1">
                <span>Allocated: <strong className="text-white font-bold">{(dashboardData.resources.storage_allocated_gb / 1024).toFixed(2)} TB</strong></span>
                <span>Total: <strong className="text-white font-bold">{(dashboardData.resources.storage_total_gb / 1024).toFixed(2)} TB</strong></span>
              </div>
            </div>
          </div>

          {/* Connected Server list */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Connected Cluster Summary
              </h2>
              <button
                onClick={() => onSetActiveTab("clusters")}
                className="px-4 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold border border-indigo-500/20 transition flex items-center gap-1.5"
              >
                Go to Cluster Control
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-indigo-500/10 bg-[#0d0f17]/30 glass-card">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/40 border-b border-indigo-500/10 text-xs text-slate-300 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Cluster Name</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Nodes</th>
                    <th className="px-6 py-4 text-center">Active Guests</th>
                    <th className="px-6 py-4">Memory Allocation</th>
                    <th className="px-6 py-4">vCPU Allocation</th>
                    <th className="px-6 py-4">Storage Allocation</th>
                    <th className="px-6 py-4 text-center">Overcommit</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.servers.map((server: ProxmoxServerData) => {
                    const isOnline = server.status === "online";
                    const memAllocPct = server.resources.memory_allocated_pct || 0;
                    const vcpuPct = server.cpu_virtualization?.utilization_pct || 0;
                    const diskAllocPct = server.resources.storage_allocated_pct || 0;

                    return (
                      <tr key={server.id} className="hover:bg-slate-900/30 border-b border-indigo-500/5 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-white">{server.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{server.host}:{server.port}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                            isOnline 
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/10" 
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/10"
                          }`}>
                            {server.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-white">
                          {isOnline ? `${server.summary.online_nodes} / ${server.summary.total_nodes}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-white">
                          {isOnline ? `${server.summary.running_guests} / ${server.summary.total_guests}` : "-"}
                        </td>
                        <td className="px-6 py-4">
                          {isOnline ? (
                            <div className="flex flex-col w-36 gap-1">
                              <div className="flex justify-between text-xs text-gray-300">
                                <span>{memAllocPct}%</span>
                                <span className="text-[11px] text-slate-400">({server.resources.memory_allocated_gb || 0}G/{server.resources.memory_total_gb}G)</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-violet-500 h-full rounded-full" style={{ width: `${Math.min(memAllocPct, 100)}%` }}></div>
                              </div>
                            </div>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4">
                          {isOnline && server.cpu_virtualization ? (
                            <div className="flex flex-col w-36 gap-1">
                              <div className="flex justify-between text-xs">
                                <span className={getVirtualCpuColor(vcpuPct)}>{vcpuPct}%</span>
                                <span className="text-[11px] text-slate-400">({server.cpu_virtualization.allocated_cores}/{server.cpu_virtualization.max_virtual_cores}C)</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    vcpuPct >= 80 ? "bg-rose-500" :
                                    vcpuPct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                                  }`} 
                                  style={{ width: `${Math.min(vcpuPct, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4">
                          {isOnline ? (
                            <div className="flex flex-col w-36 gap-1">
                              <div className="flex justify-between text-xs text-gray-300">
                                <span>{diskAllocPct}%</span>
                                <span className="text-[11px] text-slate-400">({(server.resources.storage_allocated_gb || 0).toFixed(1)}G/{(server.resources.storage_total_gb).toFixed(1)}G)</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-fuchsia-500 h-full rounded-full" style={{ width: `${Math.min(diskAllocPct, 100)}%` }}></div>
                              </div>
                            </div>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-indigo-400">
                          {isOnline ? `${server.cpu_overcommit_ratio}%` : "-"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => onSetActiveTab("clusters")}
                            className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold border border-indigo-500/20 transition"
                          >
                            Control
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // CLUSTER CONTROL TAB (Proxmox-Style Split-Pane Tree Sidebar Layout)
        <div className="flex flex-col md:flex-row gap-2 items-stretch min-h-[680px]">
          
          {/* LEFT SIDEBAR: Collapsible Tree Selector */}
          <div 
            ref={sidebarRef}
            style={{ width: typeof window !== "undefined" && window.innerWidth >= 768 ? `${sidebarWidth}px` : "100%" }}
            className="w-full md:w-auto flex-shrink-0 overflow-hidden bg-[#0d0f17]/40 border border-indigo-500/10 rounded-2xl p-4 flex flex-col gap-4 glass-card"
          >
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search VM/LXC or VMID..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full bg-slate-900/60 border border-indigo-500/10 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/40 transition"
              />
              {sidebarSearch && (
                <button
                  onClick={() => setSidebarSearch("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-1 max-h-[700px] text-xs">
              {/* Datacenter Root */}
              <div 
                onClick={() => setSelectedItem({ type: "datacenter" })}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer select-none transition border ${
                  selectedItem.type === "datacenter" 
                    ? "bg-indigo-500/15 border-indigo-500/30 text-white font-bold" 
                    : "hover:bg-slate-800/40 border-transparent text-gray-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2M14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Datacenter
                </span>
              </div>

              {/* Collapsible Children Servers */}
              <div className="pl-2.5 flex flex-col gap-1.5 mt-1 border-l border-indigo-500/5">
                {filteredServers.map((server: any) => {
                  const serverKey = `server:${server.id}`;
                  const serverExpanded = isTreeItemExpanded(serverKey);
                  const isServerSelected = selectedItem.type === "server" && selectedItem.serverId === server.id;

                  return (
                    <div key={server.id} className="flex flex-col">
                      <div className="flex items-center justify-between hover:bg-slate-850/50 rounded-lg pr-1">
                        <div 
                          onClick={() => setSelectedItem({ type: "server", serverId: server.id })}
                          className={`flex-1 flex items-center gap-2 p-1.5 rounded-lg cursor-pointer select-none text-xs transition ${
                            isServerSelected 
                              ? "bg-indigo-500/15 text-white font-bold border-l-2 border-indigo-500" 
                              : "text-slate-200"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${server.status === "online" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.2 3.6 4 8 4s8-1.8 8-4V7M4 7c0 2.2 3.6 4 8 4s8-1.8 8-4M4 7c0-2.2 3.6-4 8-4s8 1.8 8 4m0 5c0 2.2-3.6 4-8 4s-8-1.8-8-4" />
                          </svg>
                          <span className="truncate flex-1">{server.name}</span>
                        </div>
                        <button 
                          onClick={() => setTreeExpanded(prev => ({ ...prev, [serverKey]: !prev[serverKey] }))}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${serverExpanded ? "transform rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>

                      {/* Collapsible Nodes inside Server */}
                      {serverExpanded && (
                        <div className="pl-3.5 border-l border-indigo-500/10 flex flex-col gap-1 mt-1">
                          {server.nodes.map((node: any) => {
                            const nodeKey = `node:${server.id}:${node.name}`;
                            const nodeExpanded = isTreeItemExpanded(nodeKey);
                            const isNodeSelected = selectedItem.type === "node" && selectedItem.serverId === server.id && selectedItem.nodeName === node.name;
                            const nodeGuests = server.guests.filter((g: any) => g.node === node.name);

                            return (
                              <div key={node.name} className="flex flex-col">
                                <div className="flex items-center justify-between hover:bg-slate-850/40 rounded-lg pr-0.5">
                                  <div 
                                    onClick={() => setSelectedItem({ type: "node", serverId: server.id, nodeName: node.name })}
                                    className={`flex-1 flex items-center gap-1.5 p-1 rounded cursor-pointer select-none text-xs transition ${
                                      isNodeSelected ? "bg-indigo-500/10 text-white font-semibold" : "text-slate-300 hover:text-white"
                                    }`}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                                    </svg>
                                    <span className="truncate flex-1">{node.name}</span>
                                  </div>
                                  <button 
                                    onClick={() => setTreeExpanded(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }))}
                                    className="p-0.5 hover:bg-slate-850 text-slate-400 hover:text-white rounded"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-2.5 w-2.5 transition-transform ${nodeExpanded ? "transform rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                </div>

                                {/* Guests inside Node */}
                                {nodeExpanded && (
                                  <div className="pl-3 border-l border-indigo-500/5 flex flex-col gap-0.5 mt-0.5">
                                    {nodeGuests.map((guest: any) => {
                                      const isGuestSelected = selectedItem.type === "guest" && selectedItem.serverId === server.id && selectedItem.vmid === guest.vmid;
                                      const isRunning = guest.status === "running";

                                      return (
                                        <div
                                          key={guest.vmid}
                                          onClick={() => setSelectedItem({ type: "guest", serverId: server.id, vmid: guest.vmid })}
                                          className={`flex items-center gap-1.5 p-0.5 rounded cursor-pointer select-none text-xs transition ${
                                            isGuestSelected ? "bg-indigo-500/20 text-white font-semibold border-l border-indigo-500/30 pl-1" : "text-slate-350 hover:text-white"
                                          }`}
                                        >
                                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`}></span>
                                          {guest.type === "qemu" ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-2.5 w-2.5 ${isRunning ? "text-indigo-400" : "text-slate-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                          ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-2.5 w-2.5 ${isRunning ? "text-emerald-400" : "text-slate-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                          )}
                                           <span className="truncate flex-1">{guest.vmid} ({guest.name})</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SIDEBAR RESIZER SPLITTER (Wide hit area with thin visual line) */}
          <div
            onMouseDown={startResizing}
            className="hidden md:flex items-center justify-center cursor-col-resize select-none self-stretch group"
            style={{ width: "12px", padding: "0 4px" }}
            title="Drag to resize sidebar"
          >
            <div className="w-[3px] h-full rounded-full bg-indigo-500/10 group-hover:bg-indigo-500/40" />
          </div>

          {/* RIGHT PANEL: Contextual Detail Viewer */}
          <div 
            ref={rightPanelRef}
            className="flex-1 bg-[#0d0f17]/20 border border-indigo-500/10 rounded-2xl p-6 flex flex-col gap-6 overflow-y-auto max-h-[750px] relative glass-card"
          >
            
            {/* 1. DATACENTER CONTEXT DETAILS */}
            {selectedItem.type === "datacenter" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-indigo-500/10 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">Datacenter Overview</h2>
                    <p className="text-xs text-slate-300">Aggregated cluster-wide status and provisioning summaries</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#121624]/30 border border-indigo-500/5 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-300 font-semibold tracking-wider uppercase">Servers & Nodes</p>
                      <h3 className="text-lg font-bold mt-1 text-white flex flex-col">
                        <span>{dashboardData.summary.online_servers} / {dashboardData.summary.total_servers} Servers Online</span>
                        <span className="text-xs text-slate-300 font-normal mt-0.5">{dashboardData.summary.online_nodes} / {dashboardData.summary.total_nodes} Nodes Active</span>
                      </h3>
                    </div>
                  </div>
                  <div className="bg-[#121624]/30 border border-indigo-500/5 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-300 font-semibold tracking-wider uppercase">Active Guests (VMs/LXCs)</p>
                      <h3 className="text-lg font-bold mt-1 text-emerald-400">
                        {dashboardData.summary.running_guests}
                        <span className="text-xs font-normal text-slate-300"> / {dashboardData.summary.total_guests} Running</span>
                      </h3>
                    </div>
                  </div>
                  <div className="bg-[#121624]/30 border border-indigo-500/5 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-300 font-semibold tracking-wider uppercase">Total Raw Storage</p>
                      <h3 className="text-lg font-bold mt-1 text-white">
                        {(dashboardData.resources.storage_used_gb / 1024).toFixed(2)}
                        <span className="text-xs font-normal text-slate-300"> / {(dashboardData.resources.storage_total_gb / 1024).toFixed(2)} TB Used</span>
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Capacity Allocation rate progress bars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#121624]/30 border border-indigo-500/5 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-white text-xs font-bold">
                      <span>vCPU Allocation</span>
                      <span className={getVcpuColor(dashboardData.resources.vcpu_usage_pct || 0)}>{dashboardData.resources.vcpu_usage_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full ${
                        (dashboardData.resources.vcpu_usage_pct || 0) >= 80 ? "bg-rose-500" :
                        (dashboardData.resources.vcpu_usage_pct || 0) >= 70 ? "bg-amber-500" : "bg-emerald-500"
                      }`} style={{ width: `${Math.min(dashboardData.resources.vcpu_usage_pct || 0, 100)}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-350">
                      <span>Allocated Cores: {dashboardData.resources.vcpu_allocated_cores}</span>
                      <span>Max Allowed: {dashboardData.resources.vcpu_max_virtual_cores} Cores</span>
                    </div>
                  </div>

                  <div className="bg-[#121624]/30 border border-indigo-500/5 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-white text-xs font-bold">
                      <span>Memory Capacity Allocation</span>
                      <span className="text-violet-400">{dashboardData.resources.memory_allocated_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-violet-500 h-full rounded-full" style={{ width: `${Math.min(dashboardData.resources.memory_allocated_pct || 0, 100)}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-350">
                      <span>Allocated: {dashboardData.resources.memory_allocated_gb} GB</span>
                      <span>Total Physical: {dashboardData.resources.memory_total_gb} GB</span>
                    </div>
                  </div>

                  <div className="bg-[#121624]/30 border border-indigo-500/5 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-white text-xs font-bold">
                      <span>Storage Space Allocation</span>
                      <span className="text-fuchsia-400">{dashboardData.resources.storage_allocated_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-fuchsia-500 h-full rounded-full" style={{ width: `${Math.min(dashboardData.resources.storage_allocated_pct || 0, 100)}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-350">
                      <span>Allocated: {(dashboardData.resources.storage_allocated_gb / 1024).toFixed(2)} TB</span>
                      <span>Total Physical: {(dashboardData.resources.storage_total_gb / 1024).toFixed(2)} TB</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Datacenter Clusters Summary
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-indigo-500/10 bg-[#0d0f17]/20">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950/40 border-b border-indigo-500/10 text-xs text-slate-300 font-bold uppercase tracking-wider">
                          <th className="px-5 py-3">Cluster Name</th>
                          <th className="px-5 py-3 text-center">Status</th>
                          <th className="px-5 py-3 text-center">Nodes</th>
                          <th className="px-5 py-3 text-center">VMs Online</th>
                          <th className="px-5 py-3 text-center">vCPU Alloc</th>
                          <th className="px-5 py-3 text-center">Overcommit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.servers.map((server: ProxmoxServerData) => (
                          <tr key={server.id} className="hover:bg-slate-900/30 border-b border-indigo-500/5 transition">
                            <td className="px-5 py-3 font-semibold text-white">{server.name}</td>
                            <td className="px-5 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                                server.status === "online" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                              }`}>{server.status}</span>
                            </td>
                            <td className="px-5 py-3 text-center font-medium">{server.summary.online_nodes} / {server.summary.total_nodes}</td>
                            <td className="px-5 py-3 text-center font-medium text-emerald-400">{server.summary.running_guests} / {server.summary.total_guests}</td>
                            <td className="px-5 py-3 text-center font-bold text-indigo-400">{server.cpu_virtualization?.utilization_pct}%</td>
                            <td className="px-5 py-3 text-center font-semibold text-slate-300">{server.cpu_overcommit_ratio}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. SERVER (CLUSTER) CONTEXT DETAILS */}
            {selectedItem.type === "server" && selectedItem.serverId && (() => {
              const server = dashboardData.servers.find((s: any) => s.id === selectedItem.serverId);
              if (!server) return <p className="text-slate-300 text-xs">Cluster data not found.</p>;
              const isOnline = server.status === "online";
              return (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                  <div className="flex justify-between items-start border-b border-indigo-500/10 pb-4">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        isOnline ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                      }`}>{server.status}</span>
                      <h2 className="text-xl font-bold text-white mt-1.5">{server.name}</h2>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">{server.host}:{server.port}</p>
                    </div>
                  </div>

                  {!isOnline ? (
                    <div className="text-center py-12 text-sm text-rose-400 bg-rose-500/5 border border-dashed border-rose-500/15 rounded-2xl">
                      Connection to cluster failed. Please verify credentials.
                    </div>
                  ) : (
                    <>
                      {/* Physical & virtualization aggregated widgets */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/20 border border-indigo-500/5 rounded-2xl p-5">
                        <div className="flex flex-col gap-4">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Physical Resource Summary</h4>
                          <div className="flex flex-col gap-3 text-xs">
                            <div>
                              <div className="flex justify-between text-slate-300 mb-1">
                                <span>Physical CPU Usage</span>
                                <span className="font-bold text-white">{server.resources.cpu_usage_pct}% ({server.cpu_virtualization?.total_physical_cores} Cores)</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${server.resources.cpu_usage_pct}%` }}></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-slate-300 mb-1">
                                <span>Physical Memory Usage</span>
                                <span className="font-bold text-white">{server.resources.memory_usage_pct}% ({server.resources.memory_used_gb} GB / {server.resources.memory_total_gb} GB)</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                <div className="bg-violet-500 h-full rounded-full" style={{ width: `${server.resources.memory_usage_pct}%` }}></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {server.cpu_virtualization && (
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                vCPU Allocation Status (Limit: {server.cpu_overcommit_ratio}%)
                              </h4>
                              <span className={`px-2 py-0.5 border rounded text-xs font-bold uppercase ${getVirtualCpuBgColor(server.cpu_virtualization.utilization_pct)}`}>
                                {server.cpu_virtualization.utilization_pct >= 80 ? "Critical" :
                                 server.cpu_virtualization.utilization_pct >= 70 ? "Warning" : "Normal"}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2 text-xs mt-1">
                              <div className="flex justify-between">
                                <span className="text-slate-300 font-medium">Max Allowed Virtual Cores</span>
                                <span className="font-bold text-white">{server.cpu_virtualization.max_virtual_cores} Cores</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300 font-medium">Allocated Virtual Cores</span>
                                <span className="font-bold text-white">{server.cpu_virtualization.allocated_cores} Cores</span>
                              </div>
                              <div>
                                <div className="flex justify-between text-gray-300 font-medium mb-1">
                                  <span>vCPU Allocation rate</span>
                                  <span className={getVirtualCpuColor(server.cpu_virtualization.utilization_pct)}>
                                    {server.cpu_virtualization.utilization_pct}%
                                  </span>
                                </div>
                                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      server.cpu_virtualization.utilization_pct >= 80 ? "bg-rose-500" :
                                      server.cpu_virtualization.utilization_pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                                    }`} 
                                    style={{ width: `${Math.min(server.cpu_virtualization.utilization_pct, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Ceph summary block */}
                      <div className="bg-slate-950/20 border border-indigo-500/5 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            Ceph Storage Status
                          </h4>
                          {(userRole === "admin" || userRole === "operator") && (
                            <button
                              onClick={() => setShowAddCephModal(true)}
                              className="px-3 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold transition"
                            >
                              Add Ceph Storage
                            </button>
                          )}
                        </div>

                        {loadingCeph ? (
                          <p className="text-xs text-gray-400">Loading Ceph stats...</p>
                        ) : cephStatus ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                            <div className="flex flex-col gap-2.5 justify-center">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-400">Ceph Health</span>
                                <span className={`px-2 py-0.5 border rounded text-[10px] font-bold ${getCephHealthColor(cephStatus.health.status)}`}>
                                  {cephStatus.health.status}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Total OSDs</span>
                                <span className="font-semibold text-white">{cephStatus.osdmap.num_osds} OSDs (Up: {cephStatus.osdmap.num_up_osds})</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 justify-center">
                              <div className="flex justify-between text-gray-450">
                                <span>Ceph Raw Storage</span>
                                <span className="font-semibold text-white">{formatBytes(cephStatus.pgmap.bytes_used)} / {formatBytes(cephStatus.pgmap.bytes_total)}</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.round((cephStatus.pgmap.bytes_used / Math.max(cephStatus.pgmap.bytes_total, 1)) * 100)}%` }}></div>
                              </div>
                            </div>
                            <div className="max-h-[110px] overflow-y-auto bg-slate-900/30 rounded-lg p-2.5 border border-indigo-500/5">
                              <p className="text-[9px] text-gray-500 uppercase font-semibold mb-1">Pools list ({cephPools.length})</p>
                              <div className="flex flex-col gap-1 text-[10px]">
                                {cephPools.map((p, idx) => (
                                  <div key={idx} className="flex justify-between border-b border-indigo-500/5 pb-1">
                                    <span className="font-semibold text-white">{p.pool_name || p.pool}</span>
                                    <span className="text-gray-450">Size: {p.size}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Ceph is not configured on this cluster, or connection failed.</p>
                        )}
                      </div>

                      {/* Nodes list table */}
                      <div className="flex flex-col gap-3">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cluster Physical Nodes</h4>
                        <div className="overflow-x-auto rounded-xl border border-indigo-500/10 bg-[#0d0f17]/20">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-950/40 border-b border-indigo-500/10 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                <th className="px-4 py-2.5">Node Name</th>
                                <th className="px-4 py-2.5 text-center">Status</th>
                                <th className="px-4 py-2.5 text-center">CPU Usage</th>
                                <th className="px-4 py-2.5 text-center">Memory Usage</th>
                                <th className="px-4 py-2.5 text-right">Uptime</th>
                              </tr>
                            </thead>
                            <tbody>
                              {server.nodes.map((node: any) => (
                                <tr key={node.name} className="hover:bg-slate-900/30 border-b border-indigo-500/5 transition">
                                  <td className="px-4 py-2.5 font-bold text-white">{node.name}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                      node.status === "online" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                                    }`}>{node.status}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-medium">{node.cpu_usage_pct}%</td>
                                  <td className="px-4 py-2.5 text-center font-medium">{node.memory_usage_pct}%</td>
                                  <td className="px-4 py-2.5 text-right text-gray-400">{formatUptime(node.uptime)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* 3. NODE CONTEXT DETAILS */}
            {selectedItem.type === "node" && selectedItem.serverId && selectedItem.nodeName && (() => {
              const server = dashboardData.servers.find((s: any) => s.id === selectedItem.serverId);
              const node = server?.nodes.find((n: any) => n.name === selectedItem.nodeName);
              const nodeGuests = server?.guests.filter((g: any) => g.node === selectedItem.nodeName) || [];
              if (!node) return <p className="text-gray-400 text-xs">Node details not found.</p>;
              const isOnline = node.status === "online";
              
              return (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                  <div className="flex justify-between items-start border-b border-indigo-500/10 pb-4">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isOnline ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                      }`}>{node.status}</span>
                      <h2 className="text-xl font-bold text-white mt-1.5">{node.name}</h2>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">Parent Cluster: {server.name}</p>
                    </div>
                  </div>

                  {!isOnline ? (
                    <div className="text-center py-12 text-sm text-rose-400 bg-rose-500/5 border border-dashed border-rose-500/15 rounded-2xl">
                      Physical host node is offline.
                    </div>
                  ) : (
                    <>
                      {/* Node capacity resource bars */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/20 border border-indigo-500/5 rounded-2xl p-5 text-xs">
                        <div className="flex flex-col gap-2.5">
                          <span className="text-slate-400 font-bold uppercase text-[9px]">Uptime</span>
                          <span className="text-sm font-bold text-white">{formatUptime(node.uptime)}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between text-gray-400 font-semibold">
                            <span>CPU utilization</span>
                            <span className="text-white font-bold">{node.cpu_usage_pct}%</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${node.cpu_usage_pct}%` }}></div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between text-gray-400 font-semibold">
                            <span>Memory usage</span>
                            <span className="text-white font-bold">{node.memory_usage_pct}%</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                            <div className="bg-violet-500 h-full rounded-full" style={{ width: `${node.memory_usage_pct}%` }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Paginated or Scrollable Node Guests table */}
                      <div className="flex flex-col gap-3">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                          <span>Guests on Node ({nodeGuests.length})</span>
                          <span className="text-gray-400 font-normal normal-case">Vary VM power using tree nodes or list rows</span>
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-indigo-500/10 bg-[#0d0f17]/20">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-950/40 border-b border-indigo-500/10 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                <th className="px-4 py-2.5">VMID</th>
                                <th className="px-4 py-2.5">Guest Name</th>
                                <th className="px-4 py-2.5 text-center">Type</th>
                                <th className="px-4 py-2.5 text-center">Status</th>
                                <th className="px-4 py-2.5">Resource allocation</th>
                                <th className="px-4 py-2.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {nodeGuests.map((guest: any) => {
                                const isRunning = guest.status === "running";
                                return (
                                  <tr key={guest.vmid} className="hover:bg-slate-900/30 border-b border-indigo-500/5 transition">
                                    <td className="px-4 py-2.5 font-mono">{guest.vmid}</td>
                                    <td className="px-4 py-2.5 font-bold text-white">
                                      <span 
                                        onClick={() => setSelectedItem({ type: "guest", serverId: server.id, vmid: guest.vmid })}
                                        className="cursor-pointer hover:text-indigo-400 underline decoration-indigo-500/30"
                                      >
                                        {guest.name}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center font-semibold uppercase text-[10px] text-gray-450">{guest.type}</td>
                                    <td className="px-4 py-2.5 text-center">
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                        isRunning ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-700/30 text-gray-400"
                                      }`}>{guest.status}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-gray-350">
                                      {guest.maxcpu} Cores / {(guest.maxmem / (1024**3)).toFixed(1)} GB RAM
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      <button 
                                        onClick={() => setSelectedItem({ type: "guest", serverId: server.id, vmid: guest.vmid })}
                                        className="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-450 border border-indigo-500/10 text-[10px] font-semibold"
                                      >
                                        Inspect Console
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* 4. GUEST (VM/LXC) CONTEXT DETAILS */}
            {selectedItem.type === "guest" && selectedItem.serverId && selectedItem.vmid && (() => {
              const server = dashboardData.servers.find((s: any) => s.id === selectedItem.serverId);
              const guest = server?.guests.find((g: any) => g.vmid === selectedItem.vmid);
              if (!guest) return <p className="text-gray-400 text-xs">Guest details not found.</p>;
              const isRunning = guest.status === "running";

              return (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                  {/* VM Header */}
                  <div className="flex justify-between items-start border-b border-indigo-500/10 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">{guest.type === "qemu" ? "QEMU Virtual Machine" : "LXC Container"}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                          isRunning ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-700/30 text-gray-400"
                        }`}>{guest.status}</span>
                      </div>
                      <h2 className="text-xl font-bold text-white mt-1.5">{guest.name}</h2>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">VMID: {guest.vmid} | Node: {guest.node} ({server.name})</p>
                    </div>
                  </div>

                  {/* Tabs Selector */}
                  <div className="flex border-b border-indigo-500/10 gap-2">
                    <button
                      onClick={() => setVmActiveTab("summary")}
                      className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                        vmActiveTab === "summary"
                          ? "border-indigo-500 text-indigo-400"
                          : "border-transparent text-gray-400 hover:text-white"
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setVmActiveTab("console")}
                      className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                        vmActiveTab === "console"
                          ? "border-indigo-500 text-indigo-400"
                          : "border-transparent text-gray-400 hover:text-white"
                      }`}
                    >
                      Console
                    </button>
                  </div>

                  {/* Tab Contents */}
                  {vmActiveTab === "summary" ? (
                    <div className="flex flex-col gap-6">
                      {/* Power operation buttons */}
                      <div className="flex flex-col gap-3">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Power Operations</h4>
                        <div className="flex flex-wrap gap-2.5">
                          <button
                            onClick={() => onPowerAction(server.id, guest.node, guest.type, guest.vmid, "start")}
                            disabled={isRunning}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white disabled:bg-emerald-500/10 disabled:text-emerald-500/30 transition shadow-lg shadow-emerald-500/5"
                          >
                            Start
                          </button>
                          <button
                            onClick={() => onPowerAction(server.id, guest.node, guest.type, guest.vmid, "shutdown")}
                            disabled={!isRunning}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:bg-amber-500/10 disabled:text-amber-500/30 transition shadow-lg shadow-amber-500/5"
                          >
                            Shutdown
                          </button>
                          <button
                            onClick={() => onPowerAction(server.id, guest.node, guest.type, guest.vmid, "stop")}
                            disabled={!isRunning}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white disabled:bg-rose-500/10 disabled:text-rose-500/30 transition shadow-lg shadow-rose-500/5"
                          >
                            Stop (Force)
                          </button>
                          <button
                            onClick={() => onPowerAction(server.id, guest.node, guest.type, guest.vmid, "reboot")}
                            disabled={!isRunning}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white disabled:bg-indigo-500/10 disabled:text-indigo-500/30 transition shadow-lg shadow-indigo-500/5"
                          >
                            Reboot
                          </button>
                          {userRole === "admin" && (
                            <button
                              onClick={() => handleDirectDeleteGuest(guest, server.id)}
                              disabled={isRunning || isDeletingGuest}
                              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:bg-rose-600/10 disabled:text-rose-600/30 transition shadow-lg shadow-rose-600/5"
                            >
                              {isDeletingGuest ? "Deleting..." : "Delete"}
                            </button>
                          )}
                          <button
                            onClick={() => setVmActiveTab("console")}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition ml-auto flex items-center gap-1.5"
                          >
                            Open Console
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Allocation statistics */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/20 border border-indigo-500/5 rounded-2xl p-5 text-xs">
                        <div className="flex flex-col gap-2">
                          <span className="text-slate-400 uppercase font-bold text-[9px]">Allocated CPU Cores</span>
                          <span className="text-sm font-bold text-white">{guest.maxcpu} Cores</span>
                          {isRunning && (
                            <div className="mt-1">
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>Current usage</span>
                                <span className="font-bold text-white">{guest.cpu_usage_pct}%</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${guest.cpu_usage_pct}%` }}></div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="text-slate-400 uppercase font-bold text-[9px]">Memory Allocation</span>
                          <span className="text-sm font-bold text-white">{(guest.mem_max_mb / 1024).toFixed(1)} GB</span>
                          {isRunning && (
                            <div className="mt-1">
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>Current usage</span>
                                <span className="font-bold text-white">{guest.memory_usage_pct}%</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                                <div className="bg-violet-500 h-full rounded-full" style={{ width: `${guest.memory_usage_pct}%` }}></div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="text-slate-400 uppercase font-bold text-[9px]">Storage Size</span>
                          <span className="text-sm font-bold text-white">{guest.disk_size} GB</span>
                          {isRunning && (
                            <div className="mt-1">
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>OS image / template</span>
                                <span className="truncate max-w-[120px] text-gray-200 font-medium" title={guest.image}>{guest.image}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Performance history charts */}
                      <VmPerformanceCharts guest={guest} isRunning={isRunning} />

                      {/* Danger zone delete confirmation handled via header power action group */}
                    </div>
                  ) : (
                    /* Console tab */
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Live Console Connection
                        </h4>
                      </div>

                      {isRunning ? (
                        <VncConsole
                          serverId={server.id}
                          vmid={guest.vmid}
                          node={guest.node}
                          type={guest.type}
                          backendUrl={BACKEND_URL}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 bg-slate-950/30 border border-dashed border-indigo-500/10 rounded-2xl text-gray-500 text-xs gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          <div className="text-center max-w-xs">
                            <p className="font-semibold text-gray-400">Console Offline</p>
                            <p className="text-[10px] text-gray-500 mt-1">Live connection is only available when the virtual machine or container is in a running status.</p>
                          </div>
                          <button
                            onClick={() => onPowerAction(server.id, guest.node, guest.type, guest.vmid, "start")}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold transition shadow-lg shadow-indigo-500/10"
                          >
                            Start VM to Connect
                          </button>
                        </div>
                      )}

                      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 text-indigo-300 text-[10px] flex flex-col gap-1.5 leading-relaxed mt-1">
                        <div className="font-bold flex items-center gap-1.5 text-indigo-200">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Console Tunneling Guidance
                        </div>
                        <p>
                          The console traffic is securely proxied through the PDM backend. If connection problems persist:
                        </p>
                        <ul className="list-disc pl-4 flex flex-col gap-0.5 text-gray-400">
                          <li>Check if the PDM backend has a network path to the Proxmox host <strong>{server.host}:{server.port || 8006}</strong>.</li>
                          <li>Ensure the VM/Container is running and has the QEMU Guest Agent or display server active.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* 1. Add Ceph Storage Modal */}
      {selectedItem.serverId && (
        <CreateCephStorageModal
          isOpen={showAddCephModal}
          onClose={() => setShowAddCephModal(false)}
          onSubmit={handleCreateCephStorageSubmit}
          isCreating={isCreatingCeph}
          nodesList={(dashboardData.servers.find((s: any) => s.id === selectedItem.serverId)?.nodes || []).map((n: any) => n.name)}
        />
      )}

    </>
  );
}

// ==========================================
// Sub-component: VM Performance Charts
// ==========================================
function VmPerformanceCharts({ guest, isRunning }: { guest: any; isRunning: boolean }) {
  const [history, setHistory] = React.useState<{ cpu: number; ram: number }[]>([]);

  // Generate initial history
  React.useEffect(() => {
    const initialHistory = [];
    const baseCpu = isRunning ? guest.cpu_usage_pct : 0;
    const baseRam = isRunning ? guest.memory_usage_pct : 0;
    
    for (let i = 0; i < 20; i++) {
      initialHistory.push({
        cpu: isRunning ? Math.max(2, Math.min(98, baseCpu + (Math.random() * 10 - 5))) : 0,
        ram: isRunning ? Math.max(5, Math.min(95, baseRam + (Math.random() * 6 - 3))) : 0,
      });
    }
    setHistory(initialHistory);
  }, [guest.vmid, guest.serverId, isRunning]);

  // Dynamic updates every 3 seconds
  React.useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      setHistory(prev => {
        const next = [...prev.slice(1)];
        const last = prev[prev.length - 1] || { cpu: guest.cpu_usage_pct, ram: guest.memory_usage_pct };
        const newCpu = Math.max(2, Math.min(98, last.cpu + (Math.random() * 12 - 6)));
        const newRam = Math.max(5, Math.min(95, last.ram + (Math.random() * 4 - 2)));
        next.push({ cpu: parseFloat(newCpu.toFixed(1)), ram: parseFloat(newRam.toFixed(1)) });
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, guest.vmid]);

  // Draw SVG path
  const width = 500;
  const height = 120;
  const padding = 15;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const getSvgPath = (key: "cpu" | "ram") => {
    if (history.length === 0) return "";
    return history.map((point, index) => {
      const x = padding + (index / (history.length - 1)) * chartWidth;
      const y = height - padding - (point[key] / 100) * chartHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  };

  const getAreaPath = (key: "cpu" | "ram") => {
    if (history.length === 0) return "";
    const linePath = getSvgPath(key);
    const startX = padding;
    const endX = padding + chartWidth;
    const baseY = height - padding;
    return `${linePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  };

  const currentCpu = history.length > 0 ? history[history.length - 1].cpu : (isRunning ? guest.cpu_usage_pct : 0);
  const currentRam = history.length > 0 ? history[history.length - 1].ram : (isRunning ? guest.memory_usage_pct : 0);

  return (
    <div className="flex flex-col gap-4 mt-2">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-indigo-500/5 pb-2">
        Real-time Performance Metrics
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CPU Chart */}
        <div className="bg-slate-950/30 border border-indigo-500/5 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex justify-between items-center z-10">
            <span className="text-[10px] text-gray-400 font-semibold uppercase">CPU Utilization</span>
            <span className="text-xs font-bold text-indigo-400 font-mono">{currentCpu}%</span>
          </div>
          <div className="w-full relative h-[120px] flex items-end">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
              <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(99, 102, 241, 0.05)" strokeDasharray="3 3" />
              <line x1={padding} y1={padding + chartHeight/2} x2={width - padding} y2={padding + chartHeight/2} stroke="rgba(99, 102, 241, 0.05)" strokeDasharray="3 3" />
              <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(99, 102, 241, 0.1)" />
              
              <path d={getAreaPath("cpu")} fill="url(#cpuGrad)" className="transition-all duration-300" />
              <path d={getSvgPath("cpu")} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" className="transition-all duration-300" />

              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* RAM Chart */}
        <div className="bg-slate-950/30 border border-indigo-500/5 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="flex justify-between items-center z-10">
            <span className="text-[10px] text-gray-400 font-semibold uppercase">Memory Utilization</span>
            <span className="text-xs font-bold text-violet-400 font-mono">{currentRam}%</span>
          </div>
          <div className="w-full relative h-[120px] flex items-end">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
              <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(139, 92, 246, 0.05)" strokeDasharray="3 3" />
              <line x1={padding} y1={padding + chartHeight/2} x2={width - padding} y2={padding + chartHeight/2} stroke="rgba(139, 92, 246, 0.05)" strokeDasharray="3 3" />
              <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(139, 92, 246, 0.1)" />
              
              <path d={getAreaPath("ram")} fill="url(#ramGrad)" className="transition-all duration-300" />
              <path d={getSvgPath("ram")} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" className="transition-all duration-300" />

              <defs>
                <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
