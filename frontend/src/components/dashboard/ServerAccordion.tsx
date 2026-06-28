import React, { useState, useEffect } from "react";
import { ProxmoxServerData, GuestInfo } from "../../types";
import GuestRow from "./GuestRow";
import CreateCephStorageModal from "../modals/CreateCephStorageModal";

interface ServerAccordionProps {
  server: ProxmoxServerData;
  userRole: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onPowerAction: (serverId: string, nodeName: string, guestType: "qemu" | "lxc", vmid: number, action: string) => void;
  onDeleteGuest: (guest: GuestInfo) => void;
  authToken?: string;
}

const BACKEND_URL = typeof window !== "undefined" 
  ? `http://${window.location.hostname}:8000` 
  : "http://127.0.0.1:8000";

export default function ServerAccordion({
  server,
  userRole,
  expanded,
  onToggleExpand,
  onPowerAction,
  onDeleteGuest,
  authToken
}: ServerAccordionProps) {
  const isOnline = server.status === "online";
  const hasError = server.status === "error";
  const isAdminOrOperator = userRole === "admin" || userRole === "operator";

  // Ceph Specific States
  const [cephStatus, setCephStatus] = useState<any>(null);
  const [cephPools, setCephPools] = useState<any[]>([]);
  const [loadingCeph, setLoadingCeph] = useState(false);
  const [cephError, setCephError] = useState<string | null>(null);
  const [showAddCephModal, setShowAddCephModal] = useState(false);
  const [isCreatingCeph, setIsCreatingCeph] = useState(false);

  // Node collapsing and filtering
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "stopped">("all");

  // VNC Console modal state
  const [selectedVncGuest, setSelectedVncGuest] = useState<any | null>(null);

  const toggleNodeExpanded = (nodeName: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeName]: prev[nodeName] === false ? true : false
    }));
  };

  const isNodeExpanded = (nodeName: string) => {
    return expandedNodes[nodeName] !== false; // default to expanded (true)
  };

  const collapseAllNodes = () => {
    const collapsedMap: Record<string, boolean> = {};
    server.nodes.forEach(n => {
      collapsedMap[n.name] = false;
    });
    setExpandedNodes(collapsedMap);
  };

  const expandAllNodes = () => {
    setExpandedNodes({}); // empty map resets all to true
  };

  // Fetch Ceph stats when expanded
  useEffect(() => {
    if (expanded && isOnline && authToken) {
      fetchCephData();
    }
  }, [expanded, isOnline]);

  const fetchCephData = async () => {
    const onlineNode = server.nodes.find(n => n.status === "online")?.name;
    if (!onlineNode) return;

    setLoadingCeph(true);
    setCephError(null);

    try {
      // 1. Fetch Ceph Status
      const statusRes = await fetch(`${BACKEND_URL}/api/servers/${server.id}/ceph/status?node=${onlineNode}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (!statusRes.ok) {
        throw new Error("Ceph가 활성화되지 않았거나 설정 오류가 발생했습니다.");
      }
      
      const statusJson = await statusRes.json();
      setCephStatus(statusJson.data);

      // 2. Fetch Ceph Pools
      const poolsRes = await fetch(`${BACKEND_URL}/api/servers/${server.id}/ceph/pools?node=${onlineNode}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (poolsRes.ok) {
        const poolsJson = await poolsRes.json();
        setCephPools(poolsJson.data);
      }
    } catch (err: any) {
      console.warn("Ceph data fetch failed:", err.message);
      setCephStatus(null);
      setCephError(err.message);
    } finally {
      setLoadingCeph(false);
    }
  };

  const handleCreateCephStorageSubmit = async (payload: any) => {
    setIsCreatingCeph(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/servers/${server.id}/ceph/storage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Ceph 스토리지 등록에 실패했습니다.");
      }

      alert(`Ceph 스토리지 '${payload.storage_id}' 등록이 완료되었습니다.`);
      setShowAddCephModal(false);
      fetchCephData();
    } catch (err: any) {
      alert(`스토리지 등록 실패: ${err.message}`);
    } finally {
      setIsCreatingCeph(false);
    }
  };

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

  // Helper: Get color class based on vCPU utilization percentage
  const getVirtualCpuColor = (pct: number) => {
    if (pct >= 80) return "text-rose-500 font-bold";
    if (pct >= 70) return "text-amber-500 font-bold";
    return "text-emerald-500 font-bold";
  };

  const getVirtualCpuBgColor = (pct: number) => {
    if (pct >= 80) return "bg-rose-500/10 border-rose-500/20";
    if (pct >= 70) return "bg-amber-500/10 border-amber-500/20";
    return "bg-emerald-500/10 border-emerald-500/20";
  };

  const getCephHealthColor = (statusText: string) => {
    if (statusText === "HEALTH_OK") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (statusText === "HEALTH_WARN") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  };

  return (
    <div className={`glass-card rounded-2xl border transition-all ${
      expanded ? "border-indigo-500/25 shadow-lg shadow-indigo-500/5" : "border-indigo-500/10 hover:border-indigo-500/20"
    }`}>
      {/* Accordion Header */}
      <div 
        onClick={onToggleExpand}
        className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full ${
            isOnline ? "bg-emerald-500 animate-pulse" : hasError ? "bg-rose-500" : "bg-gray-500"
          }`}></div>
          <div>
            <h3 className="font-bold text-base text-white">{server.name}</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{server.host}</p>
          </div>
        </div>

        {/* Global capacities summaries */}
        {isOnline && (
          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-300">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400 uppercase font-semibold">Nodes</span>
              <span className="font-bold">{server.summary.online_nodes} / {server.summary.total_nodes}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400 uppercase font-semibold">Running VMs</span>
              <span className="font-bold text-emerald-400">{server.summary.running_guests} / {server.summary.total_guests}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400 uppercase font-semibold">CPU Usage</span>
              <span className="font-bold">
                {server.resources.cpu_usage_pct}% 
                {server.cpu_virtualization && (
                  <span className="font-normal text-slate-400 ml-1">({server.cpu_virtualization.total_physical_cores} Cores)</span>
                )}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-400 uppercase font-semibold">RAM Usage</span>
              <span className="font-bold">
                {server.resources.memory_usage_pct}% 
                <span className="font-normal text-slate-400 ml-1">({server.resources.memory_used_gb}G / {server.resources.memory_total_gb}G)</span>
              </span>
            </div>
            {server.cpu_virtualization && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-slate-400 uppercase font-semibold">vCPU Allocation</span>
                <span className={getVirtualCpuColor(server.cpu_virtualization.utilization_pct)}>
                  {server.cpu_virtualization.utilization_pct}%
                  <span className="font-normal text-slate-400 ml-1">
                    ({server.cpu_virtualization.allocated_cores}/{server.cpu_virtualization.max_virtual_cores}C)
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {hasError && (
          <span className="text-xs text-rose-400 font-medium">연결 실패: {server.error_detail || "오류"}</span>
        )}

        <div className="flex items-center gap-2">
          <button 
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition"
            type="button"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 transition-transform duration-200 ${expanded ? "transform rotate-180" : ""}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Accordion Body */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-indigo-500/5 pt-5 flex flex-col gap-6 animate-in slide-in-from-top-2 duration-150">
          {!isOnline ? (
            <div className="text-center py-4 text-xs text-slate-400">
              {hasError ? "Proxmox 서버 인증 토큰 정보 혹은 호스트 IP 상태를 진단하십시오." : "서버에 접근할 수 없습니다."}
            </div>
          ) : (
            <>
              {/* Cluster Hardware Resource Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/20 border border-indigo-500/5 rounded-xl p-5">
                {/* Physical Resource Summary Card */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Physical Resource Summary</h4>
                  <div className="flex flex-col gap-3 text-sm">
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Physical CPU Usage</span>
                        <span className="font-bold text-white">{server.resources.cpu_usage_pct}% ({server.cpu_virtualization?.total_physical_cores} Cores)</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${server.resources.cpu_usage_pct}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Physical Memory Usage</span>
                        <span className="font-bold text-white">{server.resources.memory_usage_pct}% ({server.resources.memory_used_gb} GB / {server.resources.memory_total_gb} GB)</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div className="bg-violet-500 h-full rounded-full" style={{ width: `${server.resources.memory_usage_pct}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Virtualization CPU Resource Card */}
                {server.cpu_virtualization && (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        vCPU Overcommit Management (Ratio: {server.cpu_overcommit_ratio}%)
                      </h4>
                      <span className={`px-2 py-0.5 border rounded text-[11px] font-bold uppercase ${getVirtualCpuBgColor(server.cpu_virtualization.utilization_pct)}`}>
                        {server.cpu_virtualization.utilization_pct >= 80 ? "Critical" :
                         server.cpu_virtualization.utilization_pct >= 70 ? "Warning" : "Normal"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 text-sm mt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Physical CPU Cores</span>
                        <span className="font-bold text-white">{server.cpu_virtualization.total_physical_cores} Cores</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Max Allowed Virtual Cores</span>
                        <span className="font-bold text-white">{server.cpu_virtualization.max_virtual_cores} Cores</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Allocated Virtual Cores</span>
                        <span className="font-bold text-white">{server.cpu_virtualization.allocated_cores} Cores</span>
                      </div>
                      <div className="mt-1">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>vCPU Allocation Rate</span>
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

              {/* Ceph Storage Integration Section */}
              <div className="bg-slate-950/20 border border-indigo-500/5 rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Ceph Storage Status
                  </h4>

                  {isAdminOrOperator && (
                    <button
                      onClick={() => setShowAddCephModal(true)}
                      className="px-3 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition"
                    >
                      Add Ceph Storage
                    </button>
                  )}
                </div>

                {loadingCeph ? (
                  <div className="text-center py-4 text-xs text-slate-400 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    Fetching Ceph Status...
                  </div>
                ) : cephStatus ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    {/* Status summary */}
                    <div className="flex flex-col gap-3 justify-center">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Ceph Health</span>
                        <span className={`px-2 py-0.5 border rounded text-xs font-bold ${getCephHealthColor(cephStatus.health.status)}`}>
                          {cephStatus.health.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Total OSDs</span>
                        <span className="font-semibold text-white">{cephStatus.osdmap.num_osds} OSDs (Up: {cephStatus.osdmap.num_up_osds})</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Placement Groups (PG)</span>
                        <span className="font-semibold text-white">{cephStatus.pgmap.num_pgs} PGs</span>
                      </div>
                    </div>

                    {/* Capacity chart */}
                    <div className="flex flex-col gap-2 justify-center">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Raw Storage Usage</span>
                        <span className="font-semibold text-white">
                          {formatBytes(cephStatus.pgmap.bytes_used)} / {formatBytes(cephStatus.pgmap.bytes_total)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full" 
                          style={{ width: `${Math.round((cephStatus.pgmap.bytes_used / Math.max(cephStatus.pgmap.bytes_total, 1)) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-slate-400">
                        Data Allocated: {formatBytes(cephStatus.pgmap.data_bytes)}
                      </span>
                    </div>

                    {/* Pools list */}
                    <div className="max-h-[120px] overflow-y-auto border border-indigo-500/5 rounded-lg bg-slate-950/20 p-2">
                      <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Active Pools ({cephPools.length})</p>
                      <div className="flex flex-col gap-1 text-xs">
                        {cephPools.map((p, index) => (
                          <div key={index} className="flex justify-between border-b border-indigo-500/5 pb-1">
                            <span className="font-semibold text-white">{p.pool_name || p.pool || "unknown"}</span>
                            <span className="text-slate-400">Size: {p.size} (min: {p.min_size}) PG: {p.pg_num}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400">
                    Ceph is not configured on this cluster, or connection failed. (A Ceph-enabled Proxmox node is required to retrieve status)
                  </div>
                )}
              </div>

              {/* Toolbar: Search, Status Filter, and Expand/Collapse All */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/30 border border-indigo-500/10 rounded-2xl p-4">
                {/* Search Bar */}
                <div className="flex-1 min-w-[200px] relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search VM/LXC name or VMID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900/60 border border-indigo-500/10 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/40 transition"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                      type="button"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Status Segment Control */}
                <div className="flex bg-slate-900/60 border border-indigo-500/10 p-0.5 rounded-xl text-xs">
                  {(["all", "running", "stopped"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                      className={`px-3 py-1 rounded-lg font-semibold transition uppercase ${
                        statusFilter === filter
                          ? "bg-indigo-500 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {filter === "all" ? "All" : filter === "running" ? "Running" : "Stopped"}
                    </button>
                  ))}
                </div>

                {/* Collapse/Expand All Buttons */}
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={collapseAllNodes}
                    type="button"
                    className="px-3 py-1.5 rounded-xl border border-indigo-500/10 hover:border-indigo-500/25 hover:bg-slate-800 text-slate-300 transition font-medium"
                  >
                    Collapse All
                  </button>
                  <button
                    onClick={expandAllNodes}
                    type="button"
                    className="px-3 py-1.5 rounded-xl border border-indigo-500/10 hover:border-indigo-500/25 hover:bg-slate-800 text-slate-300 transition font-medium"
                  >
                    Expand All
                  </button>
                </div>
              </div>

              {/* Hierarchical Nodes and Guests */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Infrastructure Topology (Nodes & Guests)
                </h4>
                <div className="flex flex-col gap-4">
                  {server.nodes.map((node) => {
                    // Filter guests by search term, status filter, and node ownership
                    const filteredGuests = server.guests.filter((g) => {
                      const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                            String(g.vmid).includes(searchTerm);
                      const matchesStatus = statusFilter === "all" ? true :
                                            statusFilter === "running" ? g.status === "running" :
                                            g.status !== "running";
                      return matchesSearch && matchesStatus;
                    });
                    const nodeGuests = filteredGuests.filter((g) => g.node === node.name);
                    const totalNodeGuests = server.guests.filter((g) => g.node === node.name).length;
                    const isNodeOnline = node.status === "online";
                    const isExpanded = isNodeExpanded(node.name);
                    
                    return (
                      <div 
                        key={node.name} 
                        className="bg-slate-950/40 border border-indigo-500/5 rounded-2xl overflow-hidden transition-all duration-200 hover:border-indigo-500/10 shadow-sm"
                      >
                        {/* Node header info (Clickable to collapse/expand) */}
                        <div 
                          onClick={() => toggleNodeExpanded(node.name)}
                          className="bg-slate-950/60 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-500/5 cursor-pointer select-none hover:bg-slate-950/80 transition"
                        >
                          <div className="flex items-center gap-3">
                            {/* Rotating chevron */}
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "transform rotate-90" : ""}`} 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="font-bold text-sm text-white flex items-center gap-1.5">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              {node.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                              isNodeOnline ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "bg-rose-500/10 text-rose-400 border border-rose-500/10"
                            }`}>
                              {node.status}
                            </span>
                          </div>

                          {isNodeOnline && (
                            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400 uppercase font-semibold">CPU</span>
                                <span className="font-bold text-white">{node.cpu_usage_pct}%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400 uppercase font-semibold">Memory</span>
                                <span className="font-bold text-white">{node.memory_usage_pct}%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400 uppercase font-semibold">Uptime</span>
                                <span className="font-semibold text-slate-300">{formatUptime(node.uptime)}</span>
                              </div>
                              <div className="px-2 py-0.5 bg-slate-900 border border-indigo-500/5 rounded text-xs font-semibold text-slate-400 uppercase">
                                Guests: {nodeGuests.length} / {totalNodeGuests}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Nested Guests Table (Toggled by collapse state) */}
                        {isExpanded && (
                          <div className="p-2 bg-slate-950/10 animate-in slide-in-from-top-1 duration-150">
                            {!isNodeOnline ? (
                              <div className="text-center py-4 text-xs text-rose-400/80 bg-rose-500/5 border border-dashed border-rose-500/10 rounded-xl my-2 mx-3">
                                Node is offline. Unable to retrieve guest resources.
                              </div>
                            ) : nodeGuests.length === 0 ? (
                              <div className="text-center py-4 text-xs text-slate-400 bg-slate-950/20 border border-dashed border-indigo-500/5 rounded-xl my-2 mx-3">
                                No guest resources found on this node.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-indigo-500/5">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-950/50 border-b border-indigo-500/5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                                      <th className="px-4 py-2.5">VMID</th>
                                      <th className="px-4 py-2.5">Name</th>
                                      <th className="px-4 py-2.5">Type</th>
                                      <th className="px-4 py-2.5">Status</th>
                                      <th className="px-4 py-2.5">Resource Usage</th>
                                      <th className="px-4 py-2.5">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {nodeGuests.map((guest) => (
                                      <GuestRow
                                        key={guest.vmid}
                                        guest={guest}
                                        serverId={server.id}
                                        userRole={userRole}
                                        onPowerAction={onPowerAction}
                                        onDeleteAction={onDeleteGuest}
                                        onOpenConsole={(g) => setSelectedVncGuest(g)}
                                      />
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ceph Storage Add Modal */}
              <CreateCephStorageModal
                isOpen={showAddCephModal}
                onClose={() => setShowAddCephModal(false)}
                onSubmit={handleCreateCephStorageSubmit}
                isCreating={isCreatingCeph}
                nodesList={server.nodes.map(n => n.name)}
              />

              {/* VNC Console Connection Guide Modal */}
              {selectedVncGuest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
                  <div className="bg-[#151926] border border-indigo-500/25 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-6 py-5 bg-[#1b2031] border-b border-indigo-500/10 flex justify-between items-center">
                      <h3 className="font-bold text-base text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Proxmox noVNC 콘솔 연결 안내
                      </h3>
                      <button onClick={() => setSelectedVncGuest(null)} className="text-slate-400 hover:text-white" type="button">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="p-6 flex flex-col gap-5">
                      {/* Metadata Display */}
                      <div className="bg-slate-950/40 border border-indigo-500/5 rounded-2xl p-4 flex flex-col gap-2.5 text-xs text-slate-300">
                        <div className="flex justify-between border-b border-indigo-500/5 pb-2">
                          <span className="text-slate-500">대상 가상 장비</span>
                          <span className="font-bold text-white">#{selectedVncGuest.vmid} ({selectedVncGuest.name})</span>
                        </div>
                        <div className="flex justify-between border-b border-indigo-500/5 pb-2">
                          <span className="text-slate-500">장비 종류</span>
                          <span className="font-semibold text-white uppercase">{selectedVncGuest.type === "qemu" ? "가상 머신 (QEMU VM)" : "LXC 컨테이너"}</span>
                        </div>
                        <div className="flex justify-between border-b border-indigo-500/5 pb-2">
                          <span className="text-slate-500">실행 중인 노드</span>
                          <span className="font-semibold text-white">{selectedVncGuest.node}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Proxmox 호스트 주소</span>
                          <span className="font-semibold text-indigo-400">{server.host}:{server.port}</span>
                        </div>
                      </div>

                      {/* Network Firewall Warning Info */}
                      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 text-xs text-indigo-300 flex flex-col gap-2">
                        <div className="font-bold flex items-center gap-1.5 text-indigo-200">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          네트워크 방화벽 및 포트 안내
                        </div>
                        <p className="leading-relaxed">
                          Proxmox VE의 noVNC 및 웹 API 서비스는 <strong>8006 포트 하나만을 공동으로 사용</strong>합니다. 
                          따라서 별도의 VNC 포트(예: 5900번대)를 방화벽에서 추가로 열 필요가 없으며, <strong>8006 포트만 열려 있다면 콘솔 연결이 완벽하게 지원</strong>됩니다.
                        </p>
                        <p className="leading-relaxed text-slate-400">
                          ※ 브라우저가 Proxmox 호스트 IP({server.host})의 8006 포트에 보안 통신(HTTPS)으로 직접 접속할 수 있어야 합니다. 
                          사설망 혹은 VPN 외부 환경인 경우, 게이트웨이 및 방화벽 허용 규칙을 한 번 더 확인해주십시오.
                        </p>
                      </div>

                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedVncGuest(null)}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-400 text-sm font-semibold transition"
                        >
                          닫기
                        </button>
                        <a
                          href={`https://${server.host}:${server.port}/?console=${selectedVncGuest.type}&novnc=1&vmid=${selectedVncGuest.vmid}&node=${selectedVncGuest.node}&activeTab=console`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setSelectedVncGuest(null)}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold transition flex items-center gap-1.5 shadow-lg shadow-indigo-500/15"
                        >
                          콘솔 새 창 열기
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      )}
    </div>
  );
}
