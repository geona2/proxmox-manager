import React from "react";
import { ImageModel } from "../../types";

interface ImagesTabProps {
  imagesList: ImageModel[];
  userRole: string;
  uploadType: "iso" | "vztmpl";
  setUploadType: (type: "iso" | "vztmpl") => void;
  uploadFile: File | null;
  setUploadFile: (file: File | null) => void;
  isUploading: boolean;
  onUpload: (e: React.FormEvent) => void;
  onDistributeTrigger: (image: ImageModel) => void;
  onCreateTemplateTrigger: () => void;
}

export default function ImagesTab({
  imagesList,
  userRole,
  uploadType,
  setUploadType,
  uploadFile,
  setUploadFile,
  isUploading,
  onUpload,
  onDistributeTrigger,
  onCreateTemplateTrigger
}: ImagesTabProps) {
  const isReader = userRole === "reader";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">통합 이미지 저장소 (Unified Image Storage)</h2>
          <p className="text-xs text-slate-300 font-medium">여러 Proxmox 클러스터에 배포할 수 있는 OS 이미지(ISO)와 컨테이너 템플릿을 관리합니다.</p>
        </div>
        
        {!isReader && (
          <button
            onClick={onCreateTemplateTrigger}
            className="px-4 py-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-xs transition shadow-md shadow-orange-500/10 flex items-center gap-1.5"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Cloud-Init OS 템플릿 생성
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Uploader Card */}
        <div className="glass-card rounded-2xl p-6 border border-indigo-500/10 flex flex-col gap-4">
          <h3 className="font-bold text-sm text-white">새 이미지 업로드</h3>
          
          {isReader ? (
            <p className="text-xs text-slate-400 py-4 text-center font-medium">
              업로드 권한이 없습니다. (Reader 계정)
            </p>
          ) : (
            <form onSubmit={onUpload} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">이미지 타입</label>
                <div className="grid grid-cols-2 gap-2 bg-[#151926] p-1 rounded-lg border border-indigo-500/5">
                  <button
                    type="button"
                    onClick={() => setUploadType("iso")}
                    className={`py-1.5 rounded-md text-xs font-medium transition ${
                      uploadType === "iso" ? "bg-indigo-500 text-white" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    ISO (VM OS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadType("vztmpl")}
                    className={`py-1.5 rounded-md text-xs font-medium transition ${
                      uploadType === "vztmpl" ? "bg-indigo-500 text-white" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    LXC Template (컨테이너)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">파일 선택</label>
                <div className="border border-dashed border-indigo-500/20 hover:border-indigo-500/40 transition rounded-xl p-6 text-center cursor-pointer relative bg-slate-955/20">
                  <input
                    type="file"
                    id="file-upload-input"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-indigo-400/60 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {uploadFile ? (
                    <div>
                      <p className="text-xs font-semibold text-white truncate max-w-xs">{uploadFile.name}</p>
                      <p className="text-xs text-slate-300 mt-0.5">{(uploadFile.size / (1024*1024)).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 font-medium">마우스 드래그 앤 드롭 또는 클릭하여 업로드</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!uploadFile || isUploading}
                className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition disabled:opacity-30 disabled:hover:bg-indigo-500 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    업로드 중...
                  </>
                ) : (
                  "저장소에 업로드"
                )}
              </button>
            </form>
          )}
        </div>

        {/* Catalog Grid */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h3 className="font-bold text-sm text-white">등록된 이미지 카탈로그</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {imagesList.map((img) => (
              <div key={img.id} className="glass-card rounded-2xl p-5 border border-indigo-500/10 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-sm text-white line-clamp-1 break-all" title={img.name}>{img.name}</h4>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      img.type === "iso" ? "bg-indigo-500/10 text-indigo-400" : "bg-teal-500/10 text-teal-400"
                    }`}>
                      {img.type === "iso" ? "ISO" : "LXC Template"}
                    </span>
                  </div>
                  
                  <div className="mt-3 flex flex-col gap-1 text-xs text-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">파일 크기</span>
                      <span className="font-semibold text-white">{img.size_gb.toFixed(3)} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">식별값 ID</span>
                      <span className="font-mono text-slate-300">{img.id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-indigo-500/5 pt-3 mt-1">
                  <button
                    onClick={() => onDistributeTrigger(img)}
                    disabled={isReader}
                    className="w-full py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold transition disabled:opacity-20 disabled:hover:bg-indigo-500/10 flex items-center justify-center gap-1.5"
                    title={isReader ? "배포 권한이 없습니다 (Reader)" : "Proxmox 서버로 배포"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
                    </svg>
                    Proxmox 서버로 배포
                  </button>
                </div>
              </div>
            ))}
            
            {imagesList.length === 0 && (
              <div className="col-span-2 py-10 text-center text-slate-300 font-medium">
                등록된 OS 파일 및 템플릿이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
