import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  Mic,
  MicOff,
  Music,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from 'lucide-react';
import {
  AgentOrchestrationState,
  AgentTaskNode,
  Campaign,
  SceneItem,
  SpecializedAgentId,
} from '../types/campaign';

interface AgenticCommandCenterProps {
  activeCampaign: Campaign | null;
  orchestrationState: AgentOrchestrationState | null;
  isOrchestrating: boolean;
  onExecuteAgentPrompt: (options: {
    prompt: string;
    forceNewCampaign?: boolean;
    referenceImageBase64?: string;
    referenceImageMimeType?: string;
  }) => Promise<void>;
  onResumeCheckpoint: () => Promise<void>;
  onNavigateToStage: (stage: 'brief' | 'storyboard' | 'video' | 'master', sceneId?: string) => void;
}

const FULL_CAMPAIGN_PROMPTS = [
  {
    label: 'Aether Chronometer',
    prompt:
      'Create a 15-second luxury commercial for Aether Tourbillon sapphire watch with macro water droplets, warm champagne rim lighting, and an orchestral electronic score.',
  },
  {
    label: 'Obsidian Noir Parfum',
    prompt:
      'Create a 15-second commercial for Maison Lumière Obsidian Noir perfume on wet volcanic slate with golden amber mist, slow-motion glass refraction, and a warm cello soundtrack.',
  },
  {
    label: 'Kona Reserve Espresso',
    prompt:
      'Create a 15-second commercial for Kona Reserve dark roast espresso featuring golden crema pouring in macro slow motion, rising thermal steam, and an acoustic lounge score.',
  },
  {
    label: 'Veloce GT Hypercar',
    prompt:
      'Create a 15-second commercial for Veloce GT electric coupe speeding through an illuminated alpine tunnel at dusk with rain streaks and a driving synthwave score.',
  },
];

const SELECTIVE_EDIT_PROMPTS = [
  {
    label: 'Modify Scene 2 Visuals',
    prompt:
      'Change Scene 2 to an ultra-close macro shot with golden light refraction and slow orbital pan right.',
  },
  {
    label: 'Replace Soundtrack',
    prompt:
      'Change the music to a warm cinematic ambient piano and cello score without regenerating the scenes.',
  },
  {
    label: 'Adjust Duration to 18s',
    prompt: 'Change the total video duration to 18 seconds so each scene breathes longer.',
  },
  {
    label: 'Update Scene 1 Subtitle',
    prompt: 'Update Scene 1 subtitle to "CRAFTED BEYOND TIME" in cinema yellow style.',
  },
  {
    label: 'Update Voiceover Script',
    prompt:
      'Change the voiceover narration to "Precision engineered in every detail. Experience the new flagship standard."',
  },
  {
    label: 'Add Closing Scene',
    prompt: 'Add a new closing scene showing the hero product resting on dark obsidian velvet.',
  },
];

const PIPELINE_STAGES_CATALOG: Array<{
  agentId: SpecializedAgentId;
  shortTitle: string;
  roleTitle: string;
  modelBadge: string;
}> = [
  {
    agentId: 'orchestrator',
    shortTitle: '01. Orchestrator',
    roleTitle: 'Intent & DAG Router',
    modelBadge: 'gemini-3-flash-preview',
  },
  {
    agentId: 'campaign_planner',
    shortTitle: '02. Strategy',
    roleTitle: 'Campaign & Visual Identity',
    modelBadge: 'gemini-3-flash-preview',
  },
  {
    agentId: 'scriptwriter',
    shortTitle: '03. Scriptwriter',
    roleTitle: 'Copy & Voiceover Script',
    modelBadge: 'gemini-3-flash-preview',
  },
  {
    agentId: 'storyboard_architect',
    shortTitle: '04. Storyboard',
    roleTitle: 'Optics & Camera Choreography',
    modelBadge: 'gemini-3-flash-preview',
  },
  {
    agentId: 'visual_continuity',
    shortTitle: '05. Continuity',
    roleTitle: '1K Anchor & Palette Lock',
    modelBadge: 'gemini-3.1-flash-lite-image',
  },
  {
    agentId: 'image_generator',
    shortTitle: '06. Keyframes',
    roleTitle: '1K Storyboard Synthesis',
    modelBadge: 'gemini-3.1-flash-lite-image',
  },
  {
    agentId: 'video_generator',
    shortTitle: '07. Motion',
    roleTitle: 'Omni Flash Physics Video',
    modelBadge: 'gemini-omni-1.1-flash',
  },
  {
    agentId: 'audio_generator',
    shortTitle: '08. Score & Voice',
    roleTitle: 'Lyria 3.5 + Gemini TTS',
    modelBadge: 'lyria-3.5 / flash-lite-tts',
  },
  {
    agentId: 'editor',
    shortTitle: '09. Editor',
    roleTitle: 'Subtitles & Transitions',
    modelBadge: 'ffmpeg-libass',
  },
  {
    agentId: 'renderer',
    shortTitle: '10. Master Render',
    roleTitle: '24fps H.264/AAC Assembly',
    modelBadge: 'ffmpeg-static',
  },
  {
    agentId: 'qa_inspector',
    shortTitle: '11. QA Inspector',
    roleTitle: 'Stream & Codec Verifier',
    modelBadge: 'ffprobe / validator',
  },
];

export const AgenticCommandCenter: React.FC<AgenticCommandCenterProps> = ({
  activeCampaign,
  orchestrationState,
  isOrchestrating,
  onExecuteAgentPrompt,
  onResumeCheckpoint,
  onNavigateToStage,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [commandMode, setCommandMode] = useState<'auto' | 'new' | 'modify'>('auto');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceLevels, setVoiceLevels] = useState<number[]>([18, 32, 48, 28, 60, 38, 22]);
  const [selectedAgentId, setSelectedAgentId] = useState<SpecializedAgentId | null>(null);
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null);

  const [refImageBase64, setRefImageBase64] = useState<string | undefined>(undefined);
  const [refImageMime, setRefImageMime] = useState<string | undefined>(undefined);
  const [refImagePreview, setRefImagePreview] = useState<string | undefined>(undefined);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioAnalyserIntervalRef = useRef<number | null>(null);
  const lastSpokenTextRef = useRef<string>('');
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveState = orchestrationState || activeCampaign?.orchestrationState || null;

  // Speak assistant response when spokenResponse updates
  const speakAssistantText = (text: string, audioUrl?: string) => {
    if (!voiceEnabled || !text) return;

    if (audioUrl) {
      try {
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause();
        }
        const audio = new Audio(audioUrl);
        ttsAudioRef.current = audio;
        setIsSpeaking(true);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        audio.play().catch(() => {
          setIsSpeaking(false);
        });
        return;
      } catch {
        // Fallback to Web Speech API below
      }
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.02;
        utter.pitch = 1.0;
        utter.onstart = () => setIsSpeaking(true);
        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utter);
      } catch {
        setIsSpeaking(false);
      }
    }
  };

  useEffect(() => {
    const resp = effectiveState?.spokenResponse;
    if (resp && resp !== lastSpokenTextRef.current) {
      lastSpokenTextRef.current = resp;
      speakAssistantText(resp, effectiveState?.spokenAudioUrl);
    }
  }, [effectiveState?.spokenResponse, effectiveState?.spokenAudioUrl, voiceEnabled]);

  useEffect(() => {
    return () => {
      if (audioAnalyserIntervalRef.current) {
        window.clearInterval(audioAnalyserIntervalRef.current);
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopVoiceCapture = () => {
    setIsListening(false);
    if (audioAnalyserIntervalRef.current) {
      window.clearInterval(audioAnalyserIntervalRef.current);
      audioAnalyserIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
  };

  const toggleVoiceInput = async () => {
    if (isListening) {
      stopVoiceCapture();
      return;
    }

    setIsListening(true);
    audioAnalyserIntervalRef.current = window.setInterval(() => {
      setVoiceLevels(
        Array.from({ length: 7 }, () => Math.floor(22 + Math.random() * 72))
      );
    }, 120);

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      try {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            setPromptInput(transcript.trim());
          }
        };

        recognition.onend = () => {
          stopVoiceCapture();
        };

        recognition.onerror = () => {
          stopVoiceCapture();
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch {
        // Fall through to MediaRecorder + gemini-3.5-transcribe
      }
    }

    // Fallback: Record microphone audio and transcribe via server gemini-3.5-transcribe
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 500) return;

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          const b64: string = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/agent/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Audio: b64, mimeType: blob.type }),
          });
          const data = await res.json();
          if (res.ok && data.transcript) {
            setPromptInput(data.transcript);
          }
        } catch {
          // ignore
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      stopVoiceCapture();
    }
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      setRefImagePreview(dataUrl);
      setRefImageBase64(dataUrl);
      setRefImageMime(file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPrompt = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const text = (customPrompt ?? promptInput).trim();
    if (!text || isOrchestrating) return;

    if (isListening) stopVoiceCapture();

    const forceNewCampaign =
      commandMode === 'new'
        ? true
        : commandMode === 'modify'
          ? false
          : !activeCampaign;

    await onExecuteAgentPrompt({
      prompt: text,
      forceNewCampaign,
      referenceImageBase64: refImageBase64,
      referenceImageMimeType: refImageMime,
    });
    if (!customPrompt) {
      setPromptInput('');
    }
  };

  // Determine predicted mode badge for live input
  const isLikelySelectiveEdit =
    Boolean(activeCampaign) &&
    commandMode !== 'new' &&
    (commandMode === 'modify' ||
      /\b(change|replace|modify|update|adjust|scene\s*\d|shot\s*\d|music|soundtrack|score|voiceover|duration|seconds|subtitle|caption|add\s+a\s+scene)\b/i.test(
        promptInput
      ));

  const tasksByAgentId = new Map<SpecializedAgentId, AgentTaskNode>();
  for (const t of effectiveState?.tasks || []) {
    tasksByAgentId.set(t.agentId, t);
  }

  const activeTask =
    (selectedAgentId && tasksByAgentId.get(selectedAgentId)) ||
    effectiveState?.tasks.find((t) => t.status === 'running') ||
    effectiveState?.tasks[effectiveState.tasks.length - 1] ||
    null;

  const orbStateLabel = isListening
    ? 'Listening to your voice direction...'
    : isTranscribing
      ? 'Transcribing voice via Gemini 3.5 Transcribe...'
      : isOrchestrating
        ? `Orchestrating ${
            effectiveState?.tasks.find((t) => t.status === 'running')?.agentName ||
            'Specialized AI Agents'
          }...`
        : isSpeaking
          ? 'Speaking Creative Director update...'
          : 'AI Creative Director Ready';

  const previewScene: SceneItem | null =
    activeCampaign?.scenes.find((s) => s.id === previewSceneId) ||
    activeCampaign?.scenes[0] ||
    null;

  return (
    <div className="space-y-6">
      {/* 1. Hero Siri-Inspired AI Creative Director Command Console */}
      <section className="glass-panel rounded-3xl p-6 lg:p-8 relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left 4 Cols: Animated Siri-Inspired AI Assistant Orb & Voice Controls */}
          <div className="lg:col-span-4 flex flex-col items-center text-center space-y-4">
            <div className="relative flex items-center justify-center w-36 h-36">
              {/* Outer Ambient Pulse Ring */}
              <motion.div
                animate={{
                  scale: isListening || isOrchestrating || isSpeaking ? [1, 1.24, 1] : [1, 1.06, 1],
                  opacity: isListening || isOrchestrating || isSpeaking ? [0.35, 0.75, 0.35] : [0.2, 0.35, 0.2],
                }}
                transition={{ duration: isListening ? 1.2 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full siri-orb-layer-1"
              />

              {/* Secondary Morphing Iridescent Ring */}
              <motion.div
                animate={{
                  scale: isListening || isSpeaking ? [1.05, 0.9, 1.05] : [1, 1.03, 1],
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-3 rounded-full siri-orb-layer-2"
              />

              {/* Interactive Core Orb Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                title={isListening ? 'Stop voice capture' : 'Click to speak creative direction'}
                className="relative z-10 w-24 h-24 rounded-full bg-[#09090E]/85 backdrop-blur-xl border border-white/20 flex flex-col items-center justify-center gap-1.5 shadow-2xl cursor-pointer group transition-transform hover:scale-105"
              >
                {isListening ? (
                  <div className="flex items-end gap-1 h-7">
                    {voiceLevels.map((lvl, idx) => (
                      <span
                        key={idx}
                        className="w-1 rounded-full bg-gradient-to-t from-[#E2B86B] via-emerald-300 to-purple-300 transition-all duration-100"
                        style={{ height: `${Math.max(20, lvl)}%` }}
                      />
                    ))}
                  </div>
                ) : isOrchestrating ? (
                  <Loader2 className="w-7 h-7 text-[#E2B86B] animate-spin" />
                ) : (
                  <Mic className="w-7 h-7 text-[#E2B86B] group-hover:text-white transition-colors" />
                )}
                <span className="text-[10px] font-medium text-[#D6D3CD] tracking-wide">
                  {isListening ? 'Listening' : 'Tap to Speak'}
                </span>
              </button>
            </div>

            {/* Assistant Status & Spoken Response Transcript */}
            <div className="space-y-1.5 max-w-sm">
              <div className="flex items-center justify-center gap-2 text-xs text-[#E2B86B] font-medium">
                <span>{orbStateLabel}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !voiceEnabled;
                    setVoiceEnabled(next);
                    if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                      window.speechSynthesis.cancel();
                      setIsSpeaking(false);
                    }
                  }}
                  className="p-1 rounded-lg btn-glass text-[#9A9893] hover:text-[#F5F3EF] cursor-pointer"
                  title={voiceEnabled ? 'Mute AI Voice' : 'Unmute AI Voice'}
                >
                  {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#E2B86B]" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>

              <p className="text-xs text-[#D6D3CD] leading-relaxed italic">
                “
                {effectiveState?.spokenResponse ||
                  (activeCampaign
                    ? `Directing ${activeCampaign.brandName}. Speak or type any instruction to create a new commercial or modify specific scenes, visuals, music, or duration.`
                    : 'Tell me what brand or product you want to launch, and I will autonomously plan, storyboard, animate, score, edit, and master your commercial.')}
                ”
              </p>
            </div>
          </div>

          {/* Right 8 Cols: Natural Language Prompt Input & Quick Directives */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl lg:text-3xl font-semibold text-[#F5F3EF] font-display">
                  Autonomous Agentic Creative Studio
                </h1>
                <p className="text-xs text-[#9A9893] mt-0.5">
                  One prompt or voice command coordinates 11 specialized AI agents from concept to validated 24fps MP4 export.
                </p>
              </div>

              {/* Intent Routing Mode Selector */}
              <div className="flex items-center gap-1 p-1 bg-black/50 border border-white/[0.08] rounded-xl">
                <button
                  type="button"
                  onClick={() => setCommandMode('auto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    commandMode === 'auto'
                      ? 'bg-[#E2B86B] text-black'
                      : 'text-[#9A9893] hover:text-[#F5F3EF]'
                  }`}
                >
                  Smart Auto-Route
                </button>
                <button
                  type="button"
                  onClick={() => setCommandMode('new')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    commandMode === 'new'
                      ? 'bg-[#E2B86B] text-black'
                      : 'text-[#9A9893] hover:text-[#F5F3EF]'
                  }`}
                >
                  New Campaign
                </button>
                {activeCampaign && (
                  <button
                    type="button"
                    onClick={() => setCommandMode('modify')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                      commandMode === 'modify'
                        ? 'bg-[#E2B86B] text-black'
                        : 'text-[#9A9893] hover:text-[#F5F3EF]'
                    }`}
                  >
                    Modify Active ({activeCampaign.brandName})
                  </button>
                )}
              </div>
            </div>

            {/* Natural Language Input Form */}
            <form onSubmit={(e) => handleSubmitPrompt(e)} className="space-y-3">
              <div className="relative">
                <textarea
                  rows={3}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={
                    commandMode === 'modify' && activeCampaign
                      ? `Tell the Orchestrator what to change in ${activeCampaign.brandName} (e.g., "Change Scene 2 to a macro shot with water droplets", "Make the music warm jazz piano", or "Change duration to 18 seconds")...`
                      : 'Type or speak a creative prompt (e.g., "Create a 15-second luxury commercial for Aura Horology watch with rain droplets and an orchestral score", or "Change Scene 2 visuals to golden hour lighting")...'
                  }
                  className="w-full rounded-2xl glass-input p-4 pr-36 text-sm text-[#F5F3EF] placeholder-[#9A9893]/70 resize-none leading-relaxed"
                />

                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${
                      isListening
                        ? 'bg-red-500/20 border-red-400 text-red-300'
                        : 'btn-glass text-[#D6D3CD]'
                    }`}
                    title={isListening ? 'Stop listening' : 'Speak prompt'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    type="submit"
                    disabled={isOrchestrating || !promptInput.trim()}
                    className="px-4 py-2.5 btn-champagne rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    {isOrchestrating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Directing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isLikelySelectiveEdit ? 'Apply Delta Update' : 'Launch Agents'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Intent Preview & Optional Reference Frame Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#9A9893]">
                <div className="flex items-center gap-2">
                  <span>Detected Execution Mode:</span>
                  <span className="text-[#E2B86B] font-medium">
                    {isLikelySelectiveEdit
                      ? `Selective Delta Modification on ${activeCampaign?.brandName} (Preserves untouched scenes)`
                      : 'Full 9-Stage Autonomous Campaign Production'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {refImagePreview ? (
                    <div className="flex items-center gap-2 glass-subpanel px-2.5 py-1 rounded-xl">
                      <img
                        src={refImagePreview}
                        alt="Reference anchor"
                        referrerPolicy="no-referrer"
                        className="w-5 h-5 rounded object-cover"
                      />
                      <span className="text-[11px] text-[#F5F3EF]">Reference Anchor Attached</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRefImageBase64(undefined);
                          setRefImageMime(undefined);
                          setRefImagePreview(undefined);
                        }}
                        className="text-[#9A9893] hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="px-3 py-1.5 btn-glass rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                      <Upload className="w-3.5 h-3.5 text-[#E2B86B]" />
                      <span>Attach Product Reference Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleReferenceUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </form>

            {/* Quick Natural Language Presets: Full Production + Selective Modifications */}
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-[#9A9893]">One-Click Full Production Briefs:</span>
                {FULL_CAMPAIGN_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isOrchestrating}
                    onClick={() => {
                      setCommandMode('new');
                      setPromptInput(item.prompt);
                    }}
                    className="px-2.5 py-1 btn-glass rounded-lg text-[11px] text-[#D6D3CD] hover:text-[#F5F3EF] cursor-pointer whitespace-nowrap"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {activeCampaign && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-[#E2B86B]">
                    Selective Natural Language Edits ({activeCampaign.brandName}):
                  </span>
                  {SELECTIVE_EDIT_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      disabled={isOrchestrating}
                      onClick={() => {
                        setCommandMode('modify');
                        setPromptInput(item.prompt);
                      }}
                      className="px-2.5 py-1 btn-glass rounded-lg text-[11px] text-[#D6D3CD] hover:text-[#E2B86B] cursor-pointer whitespace-nowrap"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Visual Multi-Agent Production Pipeline & Real-Time Activity Graph */}
      <section className="glass-panel rounded-3xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#F5F3EF] font-display">
              Multi-Agent Production Pipeline &amp; Dependency Graph
            </h2>
            <p className="text-xs text-[#9A9893]">
              User Prompt → Campaign Planning → Storyboard → Image Generation → Video Generation → Music &amp; Voice-over → Editing → Quality Checks → Final MP4 Export
            </p>
          </div>

          <div className="flex items-center gap-3">
            {effectiveState && (
              <div className="text-xs font-mono tabular-nums text-[#D6D3CD]">
                <span>Mode: </span>
                <span className="text-[#E2B86B]">
                  {effectiveState.mode === 'selective_modification'
                    ? 'Selective Delta Regeneration'
                    : effectiveState.mode === 'resume_checkpoint'
                      ? 'Resumed Checkpoint'
                      : 'Full Autonomous Pipeline'}
                </span>
                <span aria-hidden="true"> · </span>
                <span className="text-emerald-400">{effectiveState.overallProgress}%</span>
              </div>
            )}

            {effectiveState &&
              (effectiveState.status === 'failed' || effectiveState.status === 'paused_checkpoint') && (
                <button
                  type="button"
                  onClick={onResumeCheckpoint}
                  disabled={isOrchestrating}
                  className="px-3.5 py-1.5 btn-champagne rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Resume from Last Checkpoint</span>
                </button>
              )}
          </div>
        </div>

        {/* Overall Pipeline Progress Bar */}
        {effectiveState && (
          <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#E2B86B] via-purple-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.max(4, effectiveState.overallProgress)}%` }}
            />
          </div>
        )}

        {/* 11 Specialized Agent Cards in Responsive Pipeline Flow */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-11 gap-2.5">
          {PIPELINE_STAGES_CATALOG.map((agentMeta) => {
            const task = tasksByAgentId.get(agentMeta.agentId);
            const status = task ? task.status : effectiveState ? 'skipped' : 'pending';
            const isSelected = selectedAgentId === agentMeta.agentId;

            return (
              <button
                key={agentMeta.agentId}
                type="button"
                onClick={() => setSelectedAgentId(agentMeta.agentId)}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  status === 'running'
                    ? 'glass-panel border-[#E2B86B] generation-glow'
                    : status === 'completed'
                      ? 'glass-subpanel border-emerald-400/35'
                      : status === 'failed'
                        ? 'glass-subpanel border-red-400/40'
                        : isSelected
                          ? 'glass-subpanel border-[#E2B86B]/60'
                          : 'glass-subpanel border-white/[0.06] opacity-70'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-[#F5F3EF] truncate">
                    {agentMeta.shortTitle}
                  </span>
                  {status === 'running' ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#E2B86B] animate-spin shrink-0" />
                  ) : status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : status === 'failed' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : (
                    <Clock className="w-3 h-3 text-[#9A9893] shrink-0" />
                  )}
                </div>

                <div>
                  <div className="text-[11px] text-[#D6D3CD] line-clamp-1">{agentMeta.roleTitle}</div>
                  <div className="text-[10px] text-[#9A9893] font-mono tabular-nums truncate mt-0.5">
                    {status === 'running'
                      ? `${task?.progress || 25}% active`
                      : status === 'completed'
                        ? `${((task?.latencyMs || 850) / 1000).toFixed(1)}s`
                        : status === 'skipped'
                          ? 'Preserved (Cached)'
                          : agentMeta.modelBadge}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Agent Inspector + Real-Time Agent Activity Feed + Saved Checkpoints */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
          {/* Left 5 Cols: Active/Selected Agent Task Details & Checkpoints */}
          <div className="lg:col-span-5 glass-subpanel rounded-2xl p-4 flex flex-col justify-between gap-4">
            {activeTask ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#E2B86B] font-semibold">{activeTask.agentName}</span>
                  <span className="font-mono tabular-nums text-[#9A9893]">
                    {activeTask.modelId} · Retries: {activeTask.retries}/{activeTask.maxRetries}
                  </span>
                </div>
                <div className="text-sm font-medium text-[#F5F3EF]">{activeTask.title}</div>
                <p className="text-xs text-[#9A9893] leading-relaxed">{activeTask.description}</p>
                {activeTask.outputSummary && (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-emerald-300 font-mono">
                    {activeTask.outputSummary}
                  </div>
                )}
                {activeTask.dependencies.length > 0 && (
                  <div className="text-[11px] text-[#9A9893] font-mono">
                    Dependencies: {activeTask.dependencies.join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-[#E2B86B] font-medium">Orchestrator Standby</div>
                <p className="text-xs text-[#9A9893] leading-relaxed">
                  Click any specialized agent node above to inspect its model binding, dependency graph, retry state, and execution output.
                </p>
              </div>
            )}

            {/* Saved Workflow Checkpoints */}
            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#D6D3CD] font-medium">
                  Saved Workflow Checkpoints ({effectiveState?.checkpoints?.length || 0})
                </span>
                {effectiveState?.checkpoints && effectiveState.checkpoints.length > 0 && (
                  <button
                    type="button"
                    onClick={onResumeCheckpoint}
                    disabled={isOrchestrating}
                    className="text-[11px] text-[#E2B86B] hover:underline cursor-pointer disabled:opacity-40"
                  >
                    Re-verify / Resume
                  </button>
                )}
              </div>
              {effectiveState?.checkpoints && effectiveState.checkpoints.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {effectiveState.checkpoints.slice(0, 4).map((cp) => (
                    <div
                      key={cp.id}
                      className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-[11px] text-[#D6D3CD] font-mono tabular-nums"
                    >
                      ✓ {cp.label}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-[#9A9893]">
                  Checkpoints are automatically persisted after Planning, Keyframes, Motion, and Master Export.
                </div>
              )}
            </div>
          </div>

          {/* Right 7 Cols: Live Multi-Agent Telemetry & Event Log */}
          <div className="lg:col-span-7 glass-subpanel rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#F5F3EF] font-medium flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#E2B86B]" />
                <span>Real-Time Agent Activity Stream</span>
              </span>
              <span className="text-[#9A9893] font-mono tabular-nums">
                {effectiveState?.logs?.length || 0} events
              </span>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {effectiveState?.logs && effectiveState.logs.length > 0 ? (
                effectiveState.logs.slice(0, 18).map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded-xl bg-black/40 border border-white/[0.05] flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            log.level === 'success'
                              ? 'text-emerald-400'
                              : log.level === 'error'
                                ? 'text-red-400'
                                : log.level === 'checkpoint'
                                  ? 'text-purple-300'
                                  : 'text-[#E2B86B]'
                          }`}
                        >
                          {log.agentName}
                        </span>
                        <span aria-hidden="true" className="text-white/20">
                          ·
                        </span>
                        <span className="text-[#F5F3EF]">{log.message}</span>
                      </div>
                      {log.detail && (
                        <div className="text-[11px] text-[#9A9893] line-clamp-1">{log.detail}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-[#9A9893] font-mono tabular-nums shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[#9A9893] py-8 text-center">
                  Speak or enter a creative brief above to watch the specialized agents collaborate in real time.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Live Campaign Production Monitor: Master Commercial Player + Scene-by-Scene Visual & Motion Cards */}
      {activeCampaign && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 Cols: Master Commercial Preview, Score, Voiceover & Export */}
          <div className="lg:col-span-5 glass-panel rounded-3xl p-6 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-[#E2B86B] font-medium">
                    {activeCampaign.brandName} · {activeCampaign.aspectRatio} · {activeCampaign.durationSeconds}s
                  </div>
                  <h3 className="text-xl font-semibold text-[#F5F3EF] font-display">
                    Master Commercial &amp; Audio Mix
                  </h3>
                </div>

                {activeCampaign.finalRender?.videoUrl && (
                  <a
                    href={activeCampaign.finalRender.videoUrl}
                    download={`${activeCampaign.brandName.toLowerCase().replace(/\s+/g, '_')}_commercial.mp4`}
                    className="px-3.5 py-2 btn-champagne rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export MP4</span>
                  </a>
                )}
              </div>

              {/* Master Video Monitor or Active Scene Video Monitor */}
              <div className="relative rounded-2xl overflow-hidden bg-black border border-white/[0.08] aspect-video flex items-center justify-center">
                {activeCampaign.finalRender?.videoUrl ? (
                  <video
                    key={activeCampaign.finalRender.videoUrl}
                    src={activeCampaign.finalRender.videoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : previewScene?.videoUrl ? (
                  <video
                    key={previewScene.videoUrl}
                    src={previewScene.videoUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : previewScene?.imageUrl ? (
                  <img
                    src={previewScene.imageUrl}
                    alt={previewScene.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <Film className="w-8 h-8 text-[#E2B86B]/60 mx-auto" />
                    <div className="text-xs text-[#9A9893]">
                      {isOrchestrating
                        ? 'Specialized agents are synthesizing keyframes and motion clips...'
                        : 'Master commercial will appear here once rendered.'}
                    </div>
                  </div>
                )}
              </div>

              {/* QA Stream Verification Summary */}
              {activeCampaign.finalRender?.validationReport && (
                <div className="p-3 rounded-2xl glass-subpanel flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>QA Verified MP4</span>
                  </span>
                  <span className="text-[#D6D3CD]">
                    {activeCampaign.finalRender.validationReport.width}×
                    {activeCampaign.finalRender.validationReport.height} ·{' '}
                    {activeCampaign.finalRender.validationReport.videoCodec.toUpperCase()}/
                    {activeCampaign.finalRender.validationReport.audioCodec.toUpperCase()} ·{' '}
                    {activeCampaign.finalRender.validationReport.durationSeconds}s
                  </span>
                </div>
              )}

              {/* Lyria 3.5 Soundtrack & Commercial Voiceover Players */}
              <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#D6D3CD] flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-[#E2B86B]" />
                    <span>Lyria 3.5 Score: {activeCampaign.soundtrack?.mood || 'Adaptive'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateToStage('master')}
                    className="text-[#E2B86B] hover:underline cursor-pointer"
                  >
                    Open Mixer →
                  </button>
                </div>
                {activeCampaign.soundtrack?.audioUrl && (
                  <audio
                    key={activeCampaign.soundtrack.audioUrl}
                    src={activeCampaign.soundtrack.audioUrl}
                    controls
                    className="w-full h-8"
                  />
                )}

                {activeCampaign.voiceover?.script && (
                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#E2B86B]">
                      <span>Commercial Voiceover Script (Gemini TTS)</span>
                      <button
                        type="button"
                        onClick={() =>
                          speakAssistantText(
                            activeCampaign.voiceover!.script,
                            activeCampaign.voiceover?.audioUrl
                          )
                        }
                        className="underline cursor-pointer"
                      >
                        Play Narration
                      </button>
                    </div>
                    <p className="text-xs text-[#D6D3CD] italic leading-relaxed">
                      “{activeCampaign.voiceover.script}”
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => onNavigateToStage('brief')}
                className="px-3 py-1.5 btn-glass rounded-xl text-xs cursor-pointer"
              >
                Edit Brief &amp; Blueprint
              </button>
              <button
                type="button"
                onClick={() => onNavigateToStage('storyboard')}
                className="px-3 py-1.5 btn-glass rounded-xl text-xs cursor-pointer"
              >
                Open Storyboard Studio
              </button>
              <button
                type="button"
                onClick={() => onNavigateToStage('video')}
                className="px-3 py-1.5 btn-glass rounded-xl text-xs cursor-pointer"
              >
                Open Motion Director
              </button>
            </div>
          </div>

          {/* Right 7 Cols: Live Scene Cards with Selective Natural Language Edit Triggers */}
          <div className="lg:col-span-7 glass-panel rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-semibold text-[#F5F3EF] font-display">
                  Generated Scenes &amp; Selective Modification Controls
                </h3>
                <p className="text-xs text-[#9A9893]">
                  Watch each scene materialize live or click “Modify Scene” to update a single shot via natural language without regenerating the rest.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#D6D3CD]">
                {activeCampaign.scenes.length} Scenes ·{' '}
                {activeCampaign.scenes.filter((s) => Boolean(s.videoUrl)).length} Motion Ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeCampaign.scenes.map((scene) => {
                const isSceneBusy =
                  scene.status === 'generating_image' || scene.status === 'generating_video';
                return (
                  <div
                    key={scene.id}
                    className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                      isSceneBusy
                        ? 'glass-panel border-[#E2B86B] generation-glow'
                        : 'glass-subpanel border-white/[0.08]'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#F5F3EF]">
                          Scene 0{scene.sceneNumber} · {scene.title}
                        </span>
                        <span className="font-mono tabular-nums text-[#E2B86B]">
                          {scene.durationSeconds}s · {scene.cameraMovement}
                        </span>
                      </div>

                      {/* Scene Visual / Video Preview */}
                      <div
                        onClick={() => setPreviewSceneId(scene.id)}
                        className="relative rounded-xl overflow-hidden bg-black/70 border border-white/[0.08] aspect-video cursor-pointer group"
                      >
                        {scene.videoUrl ? (
                          <video
                            key={scene.videoUrl}
                            src={scene.videoUrl}
                            muted
                            loop
                            playsInline
                            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : scene.imageUrl ? (
                          <img
                            src={scene.imageUrl}
                            alt={scene.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-[#9A9893]">
                            {isSceneBusy ? (
                              <Loader2 className="w-5 h-5 text-[#E2B86B] animate-spin" />
                            ) : (
                              <span>Queued</span>
                            )}
                          </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between text-[11px]">
                          <span className="text-[#F5F3EF] truncate max-w-[75%]">
                            {scene.overlayText || scene.title}
                          </span>
                          <span className="text-[#E2B86B] font-mono tabular-nums">
                            {scene.videoUrl ? '24fps MP4' : scene.imageUrl ? '1K Frame' : scene.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#9A9893] line-clamp-2 leading-relaxed">
                        {scene.videoPrompt || scene.imagePrompt}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => {
                          setCommandMode('modify');
                          setPromptInput(
                            `Change Scene ${scene.sceneNumber} visuals to `
                          );
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 btn-glass rounded-lg text-[11px] text-[#E2B86B] flex items-center gap-1 cursor-pointer"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Modify Scene {scene.sceneNumber} Only</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigateToStage('video', scene.id)}
                        className="text-[11px] text-[#9A9893] hover:text-[#F5F3EF] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Director Controls</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
