export interface ServerResources {
  cpu_usage_pct: number;
  memory_used_gb: number;
  memory_total_gb: number;
  memory_usage_pct: number;
  memory_allocated_gb?: number;
  memory_allocated_pct?: number;
  storage_used_gb: number;
  storage_total_gb: number;
  storage_usage_pct: number;
  storage_allocated_gb?: number;
  storage_allocated_pct?: number;
}

export interface ServerSummary {
  total_nodes: number;
  online_nodes: number;
  total_guests: number;
  running_guests: number;
  stopped_guests: number;
}

export interface NodeInfo {
  name: string;
  status: string;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  uptime: number;
}

export interface GuestInfo {
  vmid: number;
  name: string;
  node: string;
  type: "qemu" | "lxc";
  status: "running" | "stopped" | string;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  mem_used_mb: number;
  mem_max_mb: number;
  uptime: number;
  template?: number;
  cloudinit?: {
    enabled: boolean;
    ciuser: string;
    sshkeys: string;
    ipconfig0: string;
  };
}

export interface CpuVirtualization {
  total_physical_cores: number;
  max_virtual_cores: number;
  allocated_cores: number;
  utilization_pct: number;
}

export interface ProxmoxServerData {
  id: string;
  name: string;
  host: string;
  port?: number;
  status: "online" | "offline" | "error";
  nodes: NodeInfo[];
  guests: GuestInfo[];
  storages?: any[];
  resources: ServerResources;
  summary: ServerSummary;
  error_detail?: string;
  cpu_overcommit_ratio?: number;
  cpu_virtualization?: CpuVirtualization;
}

export interface ServerCredential {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  token_name: string;
  token_value: string;
  verify_ssl: boolean;
  cpu_overcommit_ratio?: number;
}

export interface ImageModel {
  id: string;
  name: string;
  type: "iso" | "vztmpl";
  url: string;
  size_gb: number;
}

export interface UserSession {
  username: string;
  role: "admin" | "operator" | "reader";
  token: string;
}
