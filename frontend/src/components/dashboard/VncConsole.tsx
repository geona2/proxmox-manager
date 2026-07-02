"use client";

import React, { useEffect, useRef, useState } from "react";

interface VncConsoleProps {
  serverId: string;
  vmid: number;
  node: string;
  type: "qemu" | "lxc";
  backendUrl: string; // e.g. http://localhost:8000
}

export default function VncConsole({ serverId, vmid, node, type, backendUrl }: VncConsoleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let active = true;

    async function initVnc() {
      try {
        setStatus("connecting");
        setErrorMessage("");

        // 1. VNC Proxy Ticket 발급 요청
        const token = localStorage.getItem("token");
        const res = await fetch(`${backendUrl}/api/servers/${serverId}/vms/${vmid}/vncproxy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ node, type }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to generate VNC ticket");
        }

        const json = await res.json();
        const { ticket, port } = json.data;

        if (!active) return;

        // 2. HTTP URL을 WebSocket URL (ws:// 또는 wss://)로 변환
        const parsedUrl = new URL(backendUrl);
        const wsProtocol = parsedUrl.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${parsedUrl.host}/api/servers/${serverId}/vms/${vmid}/vncwebsocket?node=${node}&type=${type}&ticket=${encodeURIComponent(ticket)}&port=${port}`;

        // 3. noVNC RFB 클라이언트 동적 로드 (Next.js SSR 방지)
        // @ts-ignore
        const RFBModule = await import("@novnc/novnc/core/rfb");
        const RFB = RFBModule.default;

        if (!active || !containerRef.current) return;

        // 기존 인스턴스 정리
        if (rfbRef.current) {
          try {
            rfbRef.current.disconnect();
          } catch (e) {}
          rfbRef.current = null;
        }

        // 4. RFB 인스턴스 생성
        const rfb = new RFB(containerRef.current, wsUrl, {
          wsProtocols: ["binary"],
        });

        rfbRef.current = rfb;

        // 5. RFB 이벤트 리스너 등록
        rfb.addEventListener("connect", () => {
          setStatus("connected");
          rfb.scaleViewport = true; // 브라우저 크기에 맞춤
          rfb.resizeSession = true; // VM 해상도를 세션에 맞게 조정 시도
        });

        rfb.addEventListener("disconnect", (e: any) => {
          setStatus("disconnected");
          if (e.detail?.clean === false) {
            setStatus("error");
            setErrorMessage("VNC connection disconnected unexpectedly.");
          }
        });

        rfb.addEventListener("credentialsrequired", () => {
          rfb.sendCredentials({ password: ticket });
        });

      } catch (err: any) {
        console.error("VNC initialization error:", err);
        if (active) {
          setStatus("error");
          setErrorMessage(err.message || "Failed to connect to guest console.");
        }
      }
    }

    initVnc();

    return () => {
      active = false;
      if (rfbRef.current) {
        try {
          rfbRef.current.disconnect();
        } catch (e) {}
        rfbRef.current = null;
      }
    };
  }, [serverId, vmid, node, type, backendUrl]);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* 상태 표시줄 */}
      <div className="flex justify-between items-center px-4 py-2 bg-slate-900/80 border border-indigo-500/10 rounded-xl">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-400">Status:</span>
          {status === "connecting" && (
            <span className="text-yellow-400 font-bold animate-pulse flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
              Connecting to Console...
            </span>
          )}
          {status === "connected" && (
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Connected (HTML5 noVNC)
            </span>
          )}
          {status === "disconnected" && (
            <span className="text-gray-400 font-bold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gray-500" />
              Disconnected
            </span>
          )}
          {status === "error" && (
            <span className="text-rose-400 font-bold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Error: {errorMessage}
            </span>
          )}
        </div>
        {status === "connected" && (
          <button
            onClick={() => rfbRef.current?.sendCtrlAltDel()}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-gray-300 text-[10px] font-mono border border-indigo-500/15 active:scale-95 transition"
            title="Send Ctrl+Alt+Del"
          >
            Ctrl+Alt+Del
          </button>
        )}
      </div>

      {/* noVNC 화면 영역 */}
      <div className="w-full h-[520px] bg-slate-950 border border-indigo-500/10 rounded-2xl overflow-hidden relative shadow-inner flex items-center justify-center">
        {/* RFB가 캔버스를 주입할 컨테이너 */}
        <div
          ref={containerRef}
          className="w-full h-full [&>div]:w-full [&>div]:h-full [&>canvas]:mx-auto [&>canvas]:block"
          id="novnc-canvas-container"
        />

        {/* 로딩/에러 레이어 */}
        {status === "connecting" && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-400 text-xs font-semibold">Creating secure VNC tunnel...</p>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-rose-400 font-semibold text-sm">Failed to connect</p>
            <p className="text-gray-400 text-xs max-w-xs">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
