import React from 'react';
import { CheckCircle2, Cpu, Film, Image as ImageIcon, Music, Terminal, X } from 'lucide-react';
import { ModelVerificationReport } from '../types/campaign';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  report: ModelVerificationReport | null;
}

export const ModelVerificationModal: React.FC<Props> = ({ isOpen, onClose, report }) => {
  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-[#111318] border border-white/15 rounded-md shadow-2xl text-[#F4F5F8]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#111318]/95 backdrop-blur border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-sm text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight font-display">
                MILESTONE 1 — VERIFIED GOOGLE AI MODELS & FFMPEG ENGINE
              </h2>
              <p className="text-xs text-[#9499A6] font-mono">
                Live credential verification report • Zero mocked outputs • Verified at {new Date(report.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#9499A6] hover:text-white border border-white/10 hover:border-white/25 rounded-sm transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 3 Models Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. Nano Banana 2 Lite */}
            <div className="bg-[#171A21] border border-white/10 rounded-sm p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Live
                  </span>
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs text-[#9499A6] uppercase tracking-wider font-mono">1. Storyboard Image Model</div>
                  <h3 className="text-base font-bold text-white mt-0.5">Nano Banana 2 Lite</h3>
                  <code className="text-xs text-amber-400 font-mono block mt-1">{report.imageModel.verifiedId}</code>
                </div>
                <div className="p-2 bg-[#090A0D] border border-white/5 rounded-sm text-[11px] font-mono text-[#9499A6] break-all">
                  {report.imageModel.sdkMethod}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase text-[#9499A6]">Verified Capabilities:</div>
                  <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                    {report.imageModel.capabilities.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase text-amber-400/80">Documented Limitations:</div>
                  <ul className="text-xs text-[#9499A6] space-y-1 list-disc list-inside">
                    {report.imageModel.limitations.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {report.imageModel.sampleAssetUrl && (
                <div className="pt-3 border-t border-white/10">
                  <div className="text-[11px] font-mono text-[#9499A6] mb-1.5">Verified Live Output Sample:</div>
                  <img
                    src={report.imageModel.sampleAssetUrl}
                    alt="Verified Nano Banana 2 Lite output"
                    className="w-full h-36 object-cover rounded-sm border border-white/10"
                  />
                </div>
              )}
            </div>

            {/* 2. Gemini Omni Flash */}
            <div className="bg-[#171A21] border border-white/10 rounded-sm p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Live
                  </span>
                  <Film className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <div className="text-xs text-[#9499A6] uppercase tracking-wider font-mono">2. Video & Editing Model</div>
                  <h3 className="text-base font-bold text-white mt-0.5">Gemini Omni Flash</h3>
                  <code className="text-xs text-sky-400 font-mono block mt-1">{report.videoOmniModel.verifiedId}</code>
                </div>
                <div className="p-2 bg-[#090A0D] border border-white/5 rounded-sm text-[11px] font-mono text-[#9499A6] break-all">
                  {report.videoOmniModel.sdkMethod}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase text-[#9499A6]">Verified Capabilities:</div>
                  <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                    {report.videoOmniModel.capabilities.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase text-amber-400/80">Documented Limitations:</div>
                  <ul className="text-xs text-[#9499A6] space-y-1 list-disc list-inside">
                    {report.videoOmniModel.limitations.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {report.videoOmniModel.sampleVideoUrl && (
                <div className="pt-3 border-t border-white/10">
                  <div className="text-[11px] font-mono text-[#9499A6] mb-1.5">Verified Native MP4 Output:</div>
                  <video
                    src={report.videoOmniModel.sampleVideoUrl}
                    controls
                    muted
                    loop
                    className="w-full h-36 object-cover bg-black rounded-sm border border-white/10"
                  />
                </div>
              )}
            </div>

            {/* 3. Lyria 3.5 */}
            <div className="bg-[#171A21] border border-white/10 rounded-sm p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Live
                  </span>
                  <Music className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs text-[#9499A6] uppercase tracking-wider font-mono">3. Adaptive Music Model</div>
                  <h3 className="text-base font-bold text-white mt-0.5">Lyria 3.5</h3>
                  <code className="text-xs text-emerald-400 font-mono block mt-1">{report.musicModel.verifiedId}</code>
                </div>
                <div className="p-2 bg-[#090A0D] border border-white/5 rounded-sm text-[11px] font-mono text-[#9499A6] break-all">
                  {report.musicModel.sdkMethod}
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase text-[#9499A6]">Verified Capabilities:</div>
                  <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                    {report.musicModel.capabilities.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase text-amber-400/80">Documented Limitations:</div>
                  <ul className="text-xs text-[#9499A6] space-y-1 list-disc list-inside">
                    {report.musicModel.limitations.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {report.musicModel.sampleAudioUrl && (
                <div className="pt-3 border-t border-white/10">
                  <div className="text-[11px] font-mono text-[#9499A6] mb-1.5">Verified Lyria 3.5 Audio Sample:</div>
                  <audio src={report.musicModel.sampleAudioUrl} controls className="w-full h-10" />
                </div>
              )}
            </div>
          </div>

          {/* FFmpeg Post-Production Engine */}
          <div className="bg-[#171A21] border border-white/10 rounded-sm p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono uppercase text-white font-semibold">
                  FFmpeg Rendering & Stream Validation Engine
                </span>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20">
                  {report.ffmpegEngine.binaryPath} • {report.ffmpegEngine.version}
                </span>
              </div>
              <p className="text-xs text-[#9499A6]">
                {report.ffmpegEngine.capabilities.join(' • ')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
