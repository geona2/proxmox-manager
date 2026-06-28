import React from "react";
import { GuestInfo } from "../../types";

interface GuestRowProps {
  guest: GuestInfo;
  serverId: string;
  userRole: string;
  onPowerAction: (serverId: string, nodeName: string, guestType: "qemu" | "lxc", vmid: number, action: string) => void;
  onDeleteAction: (guest: GuestInfo) => void;
  onOpenConsole: (guest: GuestInfo) => void;
}

export default function GuestRow({ guest, serverId, userRole, onPowerAction, onDeleteAction, onOpenConsole }: GuestRowProps) {
  const isTemplate = guest.template === 1;
  const isReader = userRole === "reader";
  const isAdmin = userRole === "admin";

  return (
    <tr className="hover:bg-slate-900/40 border-b border-indigo-500/5 transition">
      <td className="px-4 py-3.5 text-xs font-semibold text-slate-300 font-mono">#{guest.vmid}</td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-white">{guest.name}</span>
          {isTemplate && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/10 uppercase">
              Template
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Node: {guest.node}</p>
      </td>
      <td className="px-4 py-3.5">
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
          guest.type === "qemu" ? "bg-indigo-500/10 text-indigo-400" : "bg-teal-500/10 text-teal-400"
        }`}>
          {guest.type === "qemu" ? "VM (Qemu)" : "Container"}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            isTemplate
              ? "bg-amber-400"
              : guest.status === "running"
                ? "bg-emerald-500 shadow-lg shadow-emerald-500/20"
                : "bg-slate-600"
          }`}></span>
          <span className={`text-xs font-semibold uppercase ${
            isTemplate
              ? "text-amber-400"
              : guest.status === "running"
                ? "text-emerald-400 font-bold"
                : "text-slate-400"
          }`}>
            {isTemplate ? "template" : guest.status}
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        {!isTemplate && guest.status === "running" ? (
          <div className="flex flex-col gap-1 text-[11px] text-gray-300">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">CPU</span>
              <span>{guest.cpu_usage_pct}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Memory</span>
              <span>{guest.mem_used_mb} / {guest.mem_max_mb} MB</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {/* Guest actions */}
        <div className="flex items-center gap-1">
          {/* Start */}
          <button
            onClick={() => onPowerAction(serverId, guest.node, guest.type, guest.vmid, "start")}
            disabled={isTemplate || guest.status === "running" || isReader}
            className="p-1.5 text-gray-400 hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-gray-400 rounded-md transition"
            title="시작 (Start)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Shutdown */}
          <button
            onClick={() => onPowerAction(serverId, guest.node, guest.type, guest.vmid, "shutdown")}
            disabled={isTemplate || guest.status !== "running" || isReader}
            className="p-1.5 text-gray-400 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-gray-400 rounded-md transition"
            title="종료 (Shutdown)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </button>
          
          {/* Stop */}
          <button
            onClick={() => onPowerAction(serverId, guest.node, guest.type, guest.vmid, "stop")}
            disabled={isTemplate || guest.status !== "running" || isReader}
            className="p-1.5 text-gray-400 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-gray-400 rounded-md transition"
            title="강제중지 (Stop)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Reboot */}
          <button
            onClick={() => onPowerAction(serverId, guest.node, guest.type, guest.vmid, "reboot")}
            disabled={isTemplate || guest.status !== "running" || isReader}
            className="p-1.5 text-gray-400 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-gray-400 rounded-md transition"
            title="재부팅 (Reboot)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.247 8H18" />
            </svg>
          </button>
          
          {/* Console */}
          <button
            onClick={() => onOpenConsole(guest)}
            disabled={isTemplate || guest.status !== "running"}
            className="p-1.5 text-gray-400 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-gray-400 rounded-md transition"
            title="콘솔 연결 (Console)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>
          
          <span className="w-[1px] bg-slate-800 mx-1 h-4"></span>

          {/* Delete */}
          <button
            onClick={() => onDeleteAction(guest)}
            disabled={!isAdmin}
            className="p-1.5 text-rose-500/70 hover:text-rose-500 disabled:opacity-20 disabled:hover:text-rose-500/70 rounded-md transition"
            title={isAdmin ? "자원 삭제" : "삭제 권한 없음 (Admin 전용)"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
