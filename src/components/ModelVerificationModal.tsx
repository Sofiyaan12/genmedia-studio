import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Film, Image as ImageIcon, Music, Terminal, X } from 'lucide-react';
import { ModelVerificationReport } from '../types/campaign';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  report: ModelVerificationReport | null;
}

export const ModelVerificationModal: React.FC<Props> = ({ isOpen, onClose, report }) => {
  return (
    <AnimatePresence>
      {isOpen && report && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl max-h-[90vh] overflow-y-auto glass-panel rounded-2xl text-[#F5F3EF]"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 bg-[#0D0D12]/90 backdrop-blur-xl border-b border-white/[0.08]">
              <div>
                <div className="text-xs text-[#E2B86B]">
                  Live Studio Engine Verification · Verified at{' '}
                  <span className="font-mono tabular-nums">
                    {new Date(report.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight font-display mt-0.5">
                  Multimodal Generation &amp; Rendering Engines
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-[#9A9893] hover:text-[#F5F3EF] btn-glass rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 3 Models Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. Nano Banana 2 Lite */}
                <div className="glass-subpanel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#9A9893]">
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active &amp; Verified
                      </span>
                      <ImageIcon className="w-4 h-4 text-[#E2B86B]" />
                    </div>
                    <div>
                      <div className="text-xs text-[#9A9893]">01. Storyboard Synthesis</div>
                      <h3 className="text-xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                        Nano Banana 2 Lite
                      </h3>
                      <code className="text-xs text-[#E2B86B] font-mono block mt-1">
                        {report.imageModel.verifiedId}
                      </code>
                    </div>
                    <div className="p-2.5 bg-black/40 border border-white/[0.06] rounded-xl text-[11px] font-mono text-[#9A9893] break-all">
                      {report.imageModel.sdkMethod}
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-[#F5F3EF]">Capabilities</div>
                      <ul className="text-xs text-[#9A9893] space-y-1 list-disc list-inside leading-relaxed">
                        {report.imageModel.capabilities.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {report.imageModel.sampleAssetUrl && (
                    <div className="pt-3 border-t border-white/[0.07]">
                      <div className="text-[11px] text-[#9A9893] mb-2">Verified Output Sample</div>
                      <img
                        src={report.imageModel.sampleAssetUrl}
                        alt="Verified Nano Banana 2 Lite output"
                        referrerPolicy="no-referrer"
                        className="w-full h-36 object-cover rounded-xl border border-white/[0.08]"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Gemini Omni Flash */}
                <div className="glass-subpanel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#9A9893]">
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active &amp; Verified
                      </span>
                      <Film className="w-4 h-4 text-[#E2B86B]" />
                    </div>
                    <div>
                      <div className="text-xs text-[#9A9893]">02. Motion &amp; Direction</div>
                      <h3 className="text-xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                        Gemini Omni Flash
                      </h3>
                      <code className="text-xs text-[#E2B86B] font-mono block mt-1">
                        {report.videoOmniModel.verifiedId}
                      </code>
                    </div>
                    <div className="p-2.5 bg-black/40 border border-white/[0.06] rounded-xl text-[11px] font-mono text-[#9A9893] break-all">
                      {report.videoOmniModel.sdkMethod}
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-[#F5F3EF]">Capabilities</div>
                      <ul className="text-xs text-[#9A9893] space-y-1 list-disc list-inside leading-relaxed">
                        {report.videoOmniModel.capabilities.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {report.videoOmniModel.sampleVideoUrl && (
                    <div className="pt-3 border-t border-white/[0.07]">
                      <div className="text-[11px] text-[#9A9893] mb-2">Verified Native MP4 Sample</div>
                      <video
                        src={report.videoOmniModel.sampleVideoUrl}
                        controls
                        muted
                        loop
                        className="w-full h-36 object-cover bg-black rounded-xl border border-white/[0.08]"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Lyria 3.5 */}
                <div className="glass-subpanel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#9A9893]">
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active &amp; Verified
                      </span>
                      <Music className="w-4 h-4 text-[#E2B86B]" />
                    </div>
                    <div>
                      <div className="text-xs text-[#9A9893]">03. Musical Scoring</div>
                      <h3 className="text-xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                        Lyria 3.5
                      </h3>
                      <code className="text-xs text-[#E2B86B] font-mono block mt-1">
                        {report.musicModel.verifiedId}
                      </code>
                    </div>
                    <div className="p-2.5 bg-black/40 border border-white/[0.06] rounded-xl text-[11px] font-mono text-[#9A9893] break-all">
                      {report.musicModel.sdkMethod}
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-[#F5F3EF]">Capabilities</div>
                      <ul className="text-xs text-[#9A9893] space-y-1 list-disc list-inside leading-relaxed">
                        {report.musicModel.capabilities.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {report.musicModel.sampleAudioUrl && (
                    <div className="pt-3 border-t border-white/[0.07]">
                      <div className="text-[11px] text-[#9A9893] mb-2">Verified Audio Sample</div>
                      <audio src={report.musicModel.sampleAudioUrl} controls className="w-full h-10" />
                    </div>
                  )}
                </div>
              </div>

              {/* FFmpeg Post-Production Engine */}
              <div className="glass-subpanel rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Terminal className="w-4 h-4 text-[#E2B86B]" />
                    <span className="text-[#F5F3EF] font-medium">
                      FFmpeg Cinema Assembly &amp; Stream Validation
                    </span>
                    <span aria-hidden="true" className="text-white/20">·</span>
                    <span className="font-mono text-emerald-400">
                      {report.ffmpegEngine.binaryPath} · {report.ffmpegEngine.version}
                    </span>
                  </div>
                  <p className="text-xs text-[#9A9893]">
                    {report.ffmpegEngine.capabilities.join(' · ')}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
