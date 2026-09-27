import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  FileCode,
  Film,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Music,
  PlayCircle,
  Search,
  Users,
  Wand2,
} from 'lucide-react';

type StudioTab = 'agent' | 'brief' | 'storyboard' | 'video' | 'master' | 'docs' | 'profile';

interface Props {
  onNavigateTab: (tab: StudioTab) => void;
  onOpenModelVerification: () => void;
}

type DocSectionId =
  | 'all'
  | 'user-guide'
  | 'models-ffmpeg'
  | 'architecture-api'
  | 'team'
  | 'kaggle'
  | 'quickstart-faq';

const KAGGLE_WRITEUP_TEXT = `# GenMedia Studio: End-to-End Multimodal AI Advertisement Production Pipeline

Track: Problem Statement 3 — Multimodal Creative Pipelines with GenMedia
Team: Mohammed Sofiyaan, Syed Saad Ahmed, Mohd Rayyan Bin Mohd Jaweed, Mohamed Mustafa Ali Khan

## 1. Executive Summary
Advertising production traditionally requires disconnected tools for scripting, storyboarding, motion synthesis, musical scoring, and non-linear video editing. When generative AI is applied piecemeal to these stages, two critical problems emerge: visual discontinuity across scenes and destructive regeneration whenever a creative director wants to tweak a single shot.

GenMedia Studio solves both problems by unifying Google DeepMind's latest multimodal models into a cohesive, non-destructive production workstation:
1. Nano Banana 2 Lite (gemini-3.1-flash-lite-image) for reference-anchored rapid storyboarding.
2. Gemini Omni Flash (gemini-omni-1.1-flash) via the Interactions API for native MP4 scene video generation and stateful conversational editing.
3. Lyria 3.5 (lyria-3.5) for mood-matched commercial soundtrack generation.
4. FFmpeg + ffprobe for automated resolution/framerate normalization, typography burn-in, stereo AAC soundtrack mixing, and post-render stream validation.`;

const FAQ_ITEMS = [
  {
    q: 'Are all model outputs generated live rather than mocked?',
    a: 'Yes. Every storyboard frame (gemini-3.1-flash-lite-image), scene video clip and conversational edit (gemini-omni-1.1-flash), soundtrack (lyria-3.5), and final commercial (FFmpeg) is produced by live API calls and real FFmpeg media rendering.',
  },
  {
    q: 'Why is Gemini Omni Flash called via ai.interactions.create?',
    a: 'Live verification confirmed that gemini-omni-1.1-flash uses the Interactions API. Calling ai.interactions.create({ model: "gemini-omni-1.1-flash", response_modalities: ["video"] }) returns a native H.264 video/mp4 stream along with an interaction.id that supports stateful conversational editing via previous_interaction_id.',
  },
  {
    q: 'How does GenMedia Studio maintain visual consistency across scenes?',
    a: 'Visual continuity is enforced at two levels: (1) Prompt-level continuity anchors—the AI Campaign Planner generates explicit color palettes, lighting style, and lens framing injected into every scene prompt; and (2) Reference-image chaining—Scene 1’s approved keyframe is passed as multimodal inlineData to Nano Banana 2 Lite when generating Scenes 2 through N.',
  },
  {
    q: 'What happens when I conversationally edit a video scene?',
    a: 'Conversational edits are strictly scene-isolated and non-destructive. Before invoking gemini-omni-1.1-flash with your edit instruction, the current video URL, camera movement, prompt, and interactionId are pushed into scene.versionHistory (v1, v2, etc.) so you can compare or restore any historical take.',
  },
];

export const DocumentationStage: React.FC<Props> = ({
  onNavigateTab,
  onOpenModelVerification,
}) => {
  const [activeSection, setActiveSection] = useState<DocSectionId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const navItems: Array<{ id: DocSectionId; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'Complete Overview', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'user-guide', label: '01. Studio Workflow', icon: <PlayCircle className="w-3.5 h-3.5" /> },
    { id: 'models-ffmpeg', label: '02. Multimodal Engines', icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: 'architecture-api', label: '03. System Architecture', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'team', label: '04. Engineering Team', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'kaggle', label: '05. Executive Write-Up', icon: <FileCode className="w-3.5 h-3.5" /> },
    { id: 'quickstart-faq', label: '06. Quick Start & FAQ', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  ];

  const showSection = (id: DocSectionId) => activeSection === 'all' || activeSection === id;

  const filteredFaqs = FAQ_ITEMS.filter(
    (item) =>
      !searchQuery.trim() ||
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
    >
      {/* Left Sticky Navigation Rail (3 Cols) */}
      <aside className="lg:col-span-3 lg:sticky lg:top-20 glass-panel rounded-2xl p-5 space-y-4">
        <div className="border-b border-white/[0.08] pb-3">
          <div className="text-xs text-[#E2B86B] font-medium">Studio Guide</div>
          <h2 className="text-xl font-semibold text-[#F5F3EF] font-display mt-0.5">
            Architecture &amp; Manual
          </h2>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#9A9893] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter FAQ..."
            className="w-full pl-8 pr-3 py-2 glass-input rounded-xl text-xs"
          />
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs flex items-center gap-2.5 transition cursor-pointer ${
                activeSection === item.id
                  ? 'bg-[#E2B86B]/20 border border-[#E2B86B]/50 text-[#E2B86B] font-medium'
                  : 'text-[#9A9893] hover:text-[#F5F3EF] hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onOpenModelVerification}
            className="w-full py-2.5 px-3 btn-glass rounded-xl text-xs text-[#E2B86B] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Verified Engine Samples</span>
          </button>
        </div>
      </aside>

      {/* Main Content (9 Cols) */}
      <div className="lg:col-span-9 space-y-6">
        {/* Hero Card */}
        <div className="glass-panel rounded-2xl p-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#9A9893]">
            <span className="text-[#E2B86B] font-medium">Multimodal Creative Pipeline</span>
            <span aria-hidden="true">·</span>
            <span>Nano Banana 2 Lite</span>
            <span aria-hidden="true">·</span>
            <span>Gemini Omni Flash</span>
            <span aria-hidden="true">·</span>
            <span>Lyria 3.5</span>
            <span aria-hidden="true">·</span>
            <span>FFmpeg 24fps Cinema</span>
          </div>
          <h1 className="text-3xl font-semibold text-[#F5F3EF] font-display">
            GenMedia Studio — Production Guide &amp; System Reference
          </h1>
          <p className="text-xs text-[#D6D3CD] leading-relaxed max-w-4xl">
            GenMedia Studio unifies campaign planning, reference-anchored 1K storyboarding, non-destructive conversational video direction, and adaptive musical scoring into a single cohesive film studio.
          </p>
        </div>

        {/* SECTION 1: WORKFLOW GUIDE */}
        {showSection('user-guide') && (
          <section className="glass-panel rounded-2xl p-6 space-y-5">
            <div className="border-b border-white/[0.08] pb-3">
              <div className="text-xs text-[#E2B86B] font-medium">01. Studio Workflow</div>
              <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                Four Stages from Brief to Broadcast Master
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-subpanel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#E2B86B]">
                    <span className="font-medium">01. Brief &amp; Blueprint</span>
                    <Wand2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#F5F3EF] font-display">
                    Creative Brief &amp; Shooting Script
                  </h3>
                  <p className="text-xs text-[#9A9893] leading-relaxed">
                    Choose a curated brand template or compose a custom brief, select an optical look, and generate a structured visual identity, color palette, and printable shooting script.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('brief')}
                  className="w-full py-2 px-3 btn-glass rounded-xl text-xs text-[#E2B86B] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open Brief &amp; Planner</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="glass-subpanel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#E2B86B]">
                    <span className="font-medium">02. Storyboard Studio</span>
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#F5F3EF] font-display">
                    Reference-Chained 1K Keyframes &amp; Animatic
                  </h3>
                  <p className="text-xs text-[#9A9893] leading-relaxed">
                    Synthesize 1K frames where Scene 01 anchors visual continuity across all subsequent shots. Preview the timed Animatic Reel or inspect frames in the Cinema Lightbox.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('storyboard')}
                  className="w-full py-2 px-3 btn-glass rounded-xl text-xs text-[#E2B86B] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open Storyboard Studio</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="glass-subpanel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#E2B86B]">
                    <span className="font-medium">03. Motion &amp; Direction</span>
                    <Film className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#F5F3EF] font-display">
                    Conversational Editing &amp; Split A/B Compare
                  </h3>
                  <p className="text-xs text-[#9A9893] leading-relaxed">
                    Animate keyframes with Gemini Omni Flash, burn in timed broadcast captions, preview live optical LUTs, and compare historical takes side-by-side.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('video')}
                  className="w-full py-2 px-3 btn-glass rounded-xl text-xs text-[#E2B86B] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open Motion Director</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="glass-subpanel rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#E2B86B]">
                    <span className="font-medium">04. Score &amp; Master</span>
                    <Music className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#F5F3EF] font-display">
                    Lyria 3.5 Scoring &amp; Cinema Theatre
                  </h3>
                  <p className="text-xs text-[#9A9893] leading-relaxed">
                    Compose an adaptive soundtrack, balance the gain envelope, localize into global languages, and assemble a validated 24fps H.264 commercial.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('master')}
                  className="w-full py-2 px-3 btn-glass rounded-xl text-xs text-[#E2B86B] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Open Score &amp; Master</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: MULTIMODAL ENGINES */}
        {showSection('models-ffmpeg') && (
          <section className="glass-panel rounded-2xl p-6 space-y-5">
            <div className="border-b border-white/[0.08] pb-3">
              <div className="text-xs text-[#E2B86B] font-medium">02. Multimodal Engines</div>
              <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                SDK Integration &amp; Chained Continuity
              </h2>
            </div>

            <div className="space-y-4">
              <div className="glass-subpanel rounded-2xl p-5 space-y-2.5">
                <div className="text-xs font-medium text-[#E2B86B]">
                  01. Nano Banana 2 Lite · <code>gemini-3.1-flash-lite-image</code>
                </div>
                <p className="text-xs text-[#D6D3CD] leading-relaxed">
                  Passes Scene 01&apos;s keyframe inline as base64 alongside the campaign&apos;s continuity anchors so subsequent frames preserve product geometry and lighting.
                </p>
                <pre className="p-3.5 bg-black/50 border border-white/[0.08] rounded-xl text-[11px] font-mono text-[#E2B86B] overflow-x-auto">
{`const response = await ai.models.generateContent({
  model: 'gemini-3.1-flash-lite-image',
  contents: [
    { inlineData: { data: anchorImageBase64, mimeType: 'image/jpeg' } },
    \`Maintain visual consistency with this reference image. \${scene.imagePrompt}\`
  ],
  config: { responseModalities: ['IMAGE'] },
});`}
                </pre>
              </div>

              <div className="glass-subpanel rounded-2xl p-5 space-y-2.5">
                <div className="text-xs font-medium text-[#E2B86B]">
                  02. Gemini Omni Flash · <code>gemini-omni-1.1-flash</code>
                </div>
                <p className="text-xs text-[#D6D3CD] leading-relaxed">
                  Invoked via the Interactions API (<code>ai.interactions.create</code>) to synthesize H.264 MP4 clips and chain multi-turn conversational edits via <code>previous_interaction_id</code>.
                </p>
                <pre className="p-3.5 bg-black/50 border border-white/[0.08] rounded-xl text-[11px] font-mono text-[#E2B86B] overflow-x-auto">
{`const interaction = await ai.interactions.create({
  model: 'gemini-omni-1.1-flash',
  previous_interaction_id: conversationalInstruction ? scene.interactionId : undefined,
  input: [
    { type: 'image', data: keyframeBase64, mime_type: 'image/jpeg' },
    { type: 'text', text: promptForOmni }
  ],
  response_modalities: ['video'],
});`}
                </pre>
              </div>

              <div className="glass-subpanel rounded-2xl p-5 space-y-2.5">
                <div className="text-xs font-medium text-[#E2B86B]">
                  03. Lyria 3.5 · <code>lyria-3.5</code>
                </div>
                <p className="text-xs text-[#D6D3CD] leading-relaxed">
                  Generates stereo MP3 commercial scores and orchestration notes matched to the campaign&apos;s emotional cadence.
                </p>
                <pre className="p-3.5 bg-black/50 border border-white/[0.08] rounded-xl text-[11px] font-mono text-[#E2B86B] overflow-x-auto">
{`const response = await ai.models.generateContent({
  model: 'lyria-3.5',
  contents: \`Create an advertisement soundtrack for "\${brandName}". Mood: \${mood}. \${prompt}\`,
  config: { responseModalities: ['AUDIO'] },
});`}
                </pre>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: SYSTEM ARCHITECTURE */}
        {showSection('architecture-api') && (
          <section className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="border-b border-white/[0.08] pb-3">
              <div className="text-xs text-[#E2B86B] font-medium">03. System Architecture</div>
              <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                Full-Stack Media &amp; Cloud Sync Pipeline
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[#9A9893]">
                    <th className="py-2.5 px-3 font-medium">Layer</th>
                    <th className="py-2.5 px-3 font-medium">Stack</th>
                    <th className="py-2.5 px-3 font-medium">Responsibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-[#D6D3CD]">
                  <tr>
                    <td className="py-2.5 px-3 text-[#E2B86B] font-medium">Frontend Studio</td>
                    <td className="py-2.5 px-3">React 19, TypeScript, Tailwind v4, Motion</td>
                    <td className="py-2.5 px-3">Editorial glass workstation, Animatic player, A/B take comparison, and Cinema Theatre.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-[#E2B86B] font-medium">Orchestration</td>
                    <td className="py-2.5 px-3">Node.js + Express (<code>server.ts</code>)</td>
                    <td className="py-2.5 px-3">Chained model orchestration, SSE render telemetry, and automatic asset compression.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-[#E2B86B] font-medium">Cloud Persistence</td>
                    <td className="py-2.5 px-3">Firebase Auth + Cloud Firestore</td>
                    <td className="py-2.5 px-3">Per-user isolated campaign &amp; job collections with zero-trust security rules.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-[#E2B86B] font-medium">Cinema Mastering</td>
                    <td className="py-2.5 px-3">FFmpeg (<code>libx264</code>, <code>libass</code>, <code>aac</code>) + <code>ffprobe</code></td>
                    <td className="py-2.5 px-3">24fps normalization, burned-in Unicode subtitles, audio fade mixing, and stream verification.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* SECTION 4: TEAM */}
        {showSection('team') && (
          <section className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="border-b border-white/[0.08] pb-3">
              <div className="text-xs text-[#E2B86B] font-medium">04. Engineering Team</div>
              <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                Module Ownership &amp; Contributions
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-subpanel rounded-2xl p-5 space-y-2">
                <div className="text-xs text-[#E2B86B]">Frontend, Backend, Orchestration, Agentic AI &amp; AI Campaign Planner</div>
                <h3 className="text-lg font-semibold text-[#F5F3EF] font-display">
                  Mohammed Sofiyaan
                </h3>
                <p className="text-xs text-[#9A9893] leading-relaxed">
                  Architected the GenMedia Studio frontend and backend, multi-agent orchestration server, autonomous Agentic AI model build, structured AI Campaign Planner, regional localization engine, live model verification suite, and end-to-end QA pipeline.
                </p>
              </div>

              <div className="glass-subpanel rounded-2xl p-5 space-y-2">
                <div className="text-xs text-[#E2B86B]">Storyboard &amp; Motion Synthesis</div>
                <h3 className="text-lg font-semibold text-[#F5F3EF] font-display">
                  Syed Saad Ahmed
                </h3>
                <p className="text-xs text-[#9A9893] leading-relaxed">
                  Integrated Nano Banana 2 Lite reference-chained storyboarding and Gemini Omni Flash conversational video editing with non-destructive take history.
                </p>
              </div>

              <div className="glass-subpanel rounded-2xl p-5 space-y-2">
                <div className="text-xs text-[#E2B86B]">Adaptive Scoring &amp; FFmpeg Mastering</div>
                <h3 className="text-lg font-semibold text-[#F5F3EF] font-display">
                  Mohd Rayyan Bin Mohd Jaweed
                </h3>
                <p className="text-xs text-[#9A9893] leading-relaxed">
                  Integrated Lyria 3.5 musical scoring, engineered the FFmpeg 24fps assembly and subtitle burn-in pipeline, and built the ffprobe stream validator.
                </p>
              </div>

              <div className="glass-subpanel rounded-2xl p-5 space-y-2">
                <div className="text-xs text-[#E2B86B]">Cloud Sync, Database &amp; Authentication</div>
                <h3 className="text-lg font-semibold text-[#F5F3EF] font-display">
                  Mohamed Mustafa Ali Khan
                </h3>
                <p className="text-xs text-[#9A9893] leading-relaxed">
                  Engineered the Cloud Sync architecture, Firebase Authentication, and Cloud Firestore database persistence layer.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 5: WRITE-UP */}
        {showSection('kaggle') && (
          <section className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
              <div>
                <div className="text-xs text-[#E2B86B] font-medium">05. Executive Write-Up</div>
                <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                  Project Submission Summary
                </h2>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('kaggle', KAGGLE_WRITEUP_TEXT)}
                className="px-3.5 py-2 btn-glass rounded-xl text-xs text-[#E2B86B] flex items-center gap-1.5 cursor-pointer"
              >
                {copiedId === 'kaggle' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Write-Up</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 bg-black/50 border border-white/[0.08] rounded-xl text-xs font-mono text-[#D6D3CD] whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {KAGGLE_WRITEUP_TEXT}
            </pre>
          </section>
        )}

        {/* SECTION 6: FAQ */}
        {showSection('quickstart-faq') && (
          <section className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="border-b border-white/[0.08] pb-3">
              <div className="text-xs text-[#E2B86B] font-medium">06. Frequently Asked Questions</div>
              <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                Technical Architecture FAQ
              </h2>
            </div>

            <div className="space-y-2.5">
              {filteredFaqs.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={idx}
                    className="glass-subpanel rounded-2xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-xs font-medium text-[#F5F3EF] cursor-pointer"
                    >
                      <span>{item.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#E2B86B] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#9A9893] shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 text-xs text-[#9A9893] leading-relaxed border-t border-white/[0.06]">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </motion.div>
  );
};
