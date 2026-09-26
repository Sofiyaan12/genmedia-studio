import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Music,
  Play,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  Volume2,
} from 'lucide-react';
import { Campaign } from '../types/campaign';

interface Props {
  campaign: Campaign;
  isGeneratingAudio: boolean;
  isRenderingFinal: boolean;
  onGenerateSoundtrack: (mood: string, prompt: string) => Promise<void>;
  onAssembleFinalVideo: (includeInFinalMix: boolean, volumeLevel: number) => Promise<void>;
}

const MUSICAL_MOODS = [
  'Uplifting Commercial Electronic',
  'Warm Acoustic & Tactile Lo-Fi',
  'Cinematic Anamorphic Orchestral',
  'High-Energy Percussion & Synth',
  'Minimalist Luxury Ambient',
];

export const SoundtrackAndRenderStage: React.FC<Props> = ({
  campaign,
  isGeneratingAudio,
  isRenderingFinal,
  onGenerateSoundtrack,
  onAssembleFinalVideo,
}) => {
  const [mood, setMood] = useState(campaign.soundtrack?.mood || MUSICAL_MOODS[0]);
  const [prompt, setPrompt] = useState(
    campaign.soundtrack?.prompt ||
      `Instrumental ${campaign.creativeStyle} commercial score for ${campaign.brandName}`
  );
  const [includeAudio, setIncludeAudio] = useState(
    campaign.soundtrack?.includeInFinalMix !== false
  );
  const [volumeLevel, setVolumeLevel] = useState(campaign.soundtrack?.volumeLevel || 0.85);
  const [showFfmpegLogs, setShowFfmpegLogs] = useState(false);

  const handleSoundtrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGenerateSoundtrack(mood, prompt);
  };

  const approvedScenes = campaign.scenes.filter((s) => s.approved !== false);
  const validation = campaign.finalRender?.validationReport;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left 5 Cols: Stage 5 — Adaptive Soundtrack Generation (Lyria 3.5) */}
      <div className="xl:col-span-5 bg-[#111318] border border-white/10 rounded-sm p-5 space-y-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                STAGE 05 • ADAPTIVE SOUNDTRACK GENERATION
              </span>
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-sm text-[10px] font-mono text-emerald-300">
                lyria-3.5
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-display mt-0.5">
              Lyria 3.5 Commercial Scoring Deck
            </h2>
            <p className="text-xs text-[#9499A6]">
              Generate a custom instrumental soundtrack matching your campaign mood and pacing. FFmpeg normalizes gain and applies fade-in/out envelopes during master assembly.
            </p>
          </div>

          <form onSubmit={handleSoundtrackSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1.5">
                Select Musical Mood
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MUSICAL_MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`px-2.5 py-1.5 rounded-sm text-xs font-mono border transition cursor-pointer ${
                      mood === m
                        ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 font-semibold'
                        : 'bg-[#090A0D] border-white/10 text-[#9499A6] hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
                Lyria 3.5 Direction & Instrumentation Prompt
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 bg-[#090A0D] border border-white/10 focus:border-emerald-400 rounded-sm text-xs text-white outline-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isGeneratingAudio}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold text-xs rounded-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {isGeneratingAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Soundtrack via lyria-3.5...</span>
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  <span>
                    {campaign.soundtrack?.audioUrl
                      ? 'Regenerate Soundtrack (lyria-3.5)'
                      : 'Generate Custom Soundtrack (lyria-3.5)'}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Audio Player & Mix Controls */}
          {campaign.soundtrack?.audioUrl && (
            <div className="p-4 bg-[#171A21] border border-white/10 rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 font-semibold">
                  <Volume2 className="w-4 h-4" /> Active Soundtrack ({campaign.soundtrack.modelUsed || 'lyria-3.5'})
                </span>
                <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAudio}
                    onChange={(e) => setIncludeAudio(e.target.checked)}
                    className="accent-emerald-400"
                  />
                  Mix into Final Video
                </label>
              </div>

              <audio
                key={campaign.soundtrack.audioUrl}
                src={campaign.soundtrack.audioUrl}
                controls
                className="w-full h-10"
              />

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#9499A6]">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3 h-3" /> Master Mix Gain Envelope
                  </span>
                  <span className="text-white">{Math.round(volumeLevel * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={volumeLevel}
                  onChange={(e) => setVolumeLevel( parseFloat(e.target.value) )}
                  className="w-full accent-emerald-400"
                />
              </div>

              {campaign.soundtrack.generatedLyricsOrNotes && (
                <div className="p-2.5 bg-[#090A0D] border border-white/5 rounded-sm text-[11px] font-mono text-[#9499A6] max-h-24 overflow-y-auto">
                  {campaign.soundtrack.generatedLyricsOrNotes}
                </div>
              )}
            </div>
          )}

          {campaign.soundtrack?.error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-sm text-xs text-red-300 font-mono">
              {campaign.soundtrack.error}
            </div>
          )}
        </div>

        {/* Approved Scene Assembly Queue Summary */}
        <div className="p-3.5 bg-[#171A21] border border-white/10 rounded-sm space-y-2">
          <div className="text-[11px] font-mono uppercase text-[#9499A6]">
            FFmpeg Assembly Sequence ({approvedScenes.length} Approved Scenes):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {approvedScenes.map((s) => (
              <span
                key={s.id}
                className="px-2 py-1 bg-[#090A0D] border border-white/10 rounded-sm text-[11px] font-mono text-zinc-300"
              >
                0{s.sceneNumber}: {s.videoUrl ? 'MP4 Clip' : 'Motion Still'} ({s.durationSeconds}s • {s.transitionType})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right 7 Cols: Stage 6 & 7 — Final FFmpeg Video Assembly, Stream Validation & Export */}
      <div className="xl:col-span-7 bg-[#111318] border border-white/10 rounded-sm p-5 space-y-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400">
                STAGE 06 & 07 • FINAL VIDEO ASSEMBLY & VALIDATED EXPORT
              </span>
              <h2 className="text-lg font-bold text-white font-display mt-0.5">
                FFmpeg Master Commercial Theatre ({campaign.aspectRatio} @ 24fps)
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isRenderingFinal}
                onClick={() => onAssembleFinalVideo(includeAudio, volumeLevel)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-xs rounded-sm flex items-center gap-2 transition cursor-pointer"
              >
                {isRenderingFinal ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rendering & Validating via FFmpeg...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {campaign.finalRender?.videoUrl
                        ? 'Re-Assemble Final MP4 (FFmpeg)'
                        : 'Assemble Final Advertisement MP4'}
                    </span>
                  </>
                )}
              </button>

              {campaign.finalRender?.videoUrl && (
                <a
                  href={campaign.finalRender.videoUrl}
                  download={`${campaign.brandName.toLowerCase().replace(/\s+/g, '_')}_ad.mp4`}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-sm flex items-center gap-1.5 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Export MP4</span>
                </a>
              )}
            </div>
          </div>

          {/* Master Video Player */}
          <div className="relative aspect-video bg-black border border-white/15 rounded-sm overflow-hidden flex items-center justify-center">
            {isRenderingFinal ? (
              <div className="flex flex-col items-center gap-3 text-amber-400 p-6 text-center">
                <Loader2 className="w-9 h-9 animate-spin" />
                <div className="text-sm font-semibold text-white">
                  FFmpeg is normalizing resolution, burning overlays, and mixing Lyria 3.5 audio...
                </div>
                <p className="text-xs font-mono text-[#9499A6]">
                  Target: {campaign.aspectRatio} • 24 fps • libx264 (yuv420p) + AAC 192kbps
                </p>
              </div>
            ) : campaign.finalRender?.videoUrl ? (
              <video
                key={campaign.finalRender.videoUrl}
                src={campaign.finalRender.videoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#9499A6] p-8 text-center">
                <Film className="w-9 h-9 opacity-40" />
                <div className="text-sm font-semibold text-white">
                  Ready for Master FFmpeg Assembly
                </div>
                <p className="text-xs max-w-md">
                  Click &ldquo;Assemble Final Advertisement MP4&rdquo; above to normalize all approved scene clips, apply transitions and text overlays, mix the Lyria 3.5 soundtrack, and run `ffprobe` validation.
                </p>
              </div>
            )}
          </div>

          {/* Post-Render ffprobe Stream Validation Report */}
          {validation && (
            <div className="p-4 bg-[#171A21] border border-emerald-500/30 rounded-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase text-emerald-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> FFPROBE POST-RENDER STREAM VALIDATION PASSED
                </span>
                <span className="text-[11px] font-mono text-[#9499A6]">
                  Checked at {new Date(validation.checkedAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs font-mono">
                <div className="p-2 bg-[#090A0D] border border-white/5 rounded-sm">
                  <div className="text-[10px] text-[#9499A6]">VIDEO CODEC</div>
                  <div className="text-white font-semibold uppercase mt-0.5">{validation.videoCodec}</div>
                </div>
                <div className="p-2 bg-[#090A0D] border border-white/5 rounded-sm">
                  <div className="text-[10px] text-[#9499A6]">AUDIO CODEC</div>
                  <div className="text-emerald-400 font-semibold uppercase mt-0.5">{validation.audioCodec}</div>
                </div>
                <div className="p-2 bg-[#090A0D] border border-white/5 rounded-sm">
                  <div className="text-[10px] text-[#9499A6]">RESOLUTION</div>
                  <div className="text-white font-semibold mt-0.5">
                    {validation.width}x{validation.height}
                  </div>
                </div>
                <div className="p-2 bg-[#090A0D] border border-white/5 rounded-sm">
                  <div className="text-[10px] text-[#9499A6]">DURATION</div>
                  <div className="text-amber-400 font-semibold mt-0.5">{validation.durationSeconds}s</div>
                </div>
                <div className="p-2 bg-[#090A0D] border border-white/5 rounded-sm">
                  <div className="text-[10px] text-[#9499A6]">FRAMES</div>
                  <div className="text-white font-semibold mt-0.5">{validation.frameCount} (@24fps)</div>
                </div>
                <div className="p-2 bg-[#090A0D] border border-white/5 rounded-sm">
                  <div className="text-[10px] text-[#9499A6]">FILE SIZE</div>
                  <div className="text-white font-semibold mt-0.5">
                    {(validation.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              </div>

              {campaign.finalRender?.ffmpegCommandLog && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowFfmpegLogs(!showFfmpegLogs)}
                    className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>
                      {showFfmpegLogs
                        ? 'Hide Executed FFmpeg Pipeline Commands'
                        : 'Inspect Executed FFmpeg Pipeline Commands'}
                    </span>
                  </button>
                  {showFfmpegLogs && (
                    <pre className="mt-2 p-3 bg-[#090A0D] border border-white/10 rounded-sm text-[11px] font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-44">
                      {campaign.finalRender.ffmpegCommandLog}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {campaign.finalRender?.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-sm text-xs text-red-300 font-mono">
              {campaign.finalRender.error}
            </div>
          )}
        </div>

        {/* Complete Multimodal Asset Gallery */}
        <div className="pt-4 border-t border-white/10 space-y-2.5">
          <div className="text-xs font-mono uppercase text-[#9499A6]">
            Campaign Multimodal Asset Gallery (Images • Video Takes • Audio • Master MP4)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {campaign.scenes.map((s) => (
              <div
                key={s.id}
                className="p-2 bg-[#171A21] border border-white/10 rounded-sm space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-amber-400 font-bold">SCENE 0{s.sceneNumber}</span>
                  <span className="text-emerald-400">
                    {s.videoUrl ? `v${(s.versionHistory?.length || 0) + 1} MP4` : 'JPG'}
                  </span>
                </div>
                {s.imageUrl && (
                  <img
                    src={s.imageUrl}
                    alt={s.title}
                    className="w-full h-16 object-cover rounded-xs border border-white/10"
                  />
                )}
                <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
                  {s.imageUrl && (
                    <a
                      href={s.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 hover:text-white underline"
                    >
                      Image
                    </a>
                  )}
                  {s.videoUrl && (
                    <a
                      href={s.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:text-sky-300 underline"
                    >
                      Video Clip
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
