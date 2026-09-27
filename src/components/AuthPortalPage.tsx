import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  Eye,
  Film,
  Lock,
  LogIn,
  Music,
  Sparkles,
} from 'lucide-react';

interface Props {
  onGoogleSignIn: () => Promise<void>;
  onContinueAsGuest: () => void;
  onOpenVerificationReport: () => void;
}

export const AuthPortalPage: React.FC<Props> = ({
  onGoogleSignIn,
  onContinueAsGuest,
  onOpenVerificationReport,
}) => {
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleClick = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await onGoogleSignIn();
    } catch (err: any) {
      setAuthError(
        err?.message || 'Google Sign-In was cancelled or blocked by the browser popup blocker.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-[#F5F3EF] flex flex-col justify-between relative overflow-hidden">
      {/* Ambient Warm Champagne & Violet Studio Light Blooms */}
      <div className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 w-[960px] h-[480px] bg-[#E2B86B]/10 blur-[160px] rounded-full" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 w-[600px] h-[360px] bg-purple-500/5 blur-[150px] rounded-full" />

      {/* Top Studio Header (Strict 3-Zone Contract) */}
      <header className="relative z-10 border-b border-white/[0.08] bg-[#070709]/80 backdrop-blur-xl px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-6">
          {/* Zone 1: Single Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onContinueAsGuest();
            }}
            className="text-2xl font-semibold tracking-tight text-[#F5F3EF] font-display whitespace-nowrap"
          >
            GenMedia Studio
          </a>

          {/* Zone 2: Clean Editorial Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-[#9A9893]">
            <button
              type="button"
              onClick={onContinueAsGuest}
              className="hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer"
            >
              Storyboard Suite
            </button>
            <button
              type="button"
              onClick={onContinueAsGuest}
              className="hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer"
            >
              Motion Director
            </button>
            <button
              type="button"
              onClick={onContinueAsGuest}
              className="hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer"
            >
              Adaptive Scoring
            </button>
            <button
              type="button"
              onClick={onOpenVerificationReport}
              className="hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer"
            >
              Engine Specs
            </button>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenVerificationReport}
              className="px-4 py-2 btn-glass rounded-xl text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              System Verification
            </button>
          </div>
        </div>
      </header>

      {/* Main Editorial Portal Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl w-full space-y-10"
        >
          {/* Editorial Hero Title */}
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2 text-xs text-[#E2B86B] tracking-wide">
              <span>Multimodal Commercial Direction</span>
              <span aria-hidden="true">·</span>
              <span>Private Cloud Workspace</span>
              <span aria-hidden="true">·</span>
              <span>24fps Cinema Master</span>
            </div>
            <h1
              className="text-4xl sm:text-5xl font-semibold text-[#F5F3EF] font-display tracking-tight leading-[1.1]"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              Craft bespoke commercial films from a single creative brief.
            </h1>
            <p className="text-sm text-[#9A9893] leading-relaxed">
              Sign in with Google to unlock live storyboard synthesis, conversational video direction, and adaptive musical scoring in your private library—or enter as a guest to explore the curated showcase.
            </p>
          </div>

          {authError && (
            <div className="max-w-xl mx-auto p-4 glass-panel border-red-400/30 rounded-2xl text-xs text-red-200 text-center">
              {authError}
            </div>
          )}

          {/* Two Access Mode Glass Cards */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* Primary Producer Access Card (7 Cols) */}
            <div className="md:col-span-7 glass-panel rounded-2xl p-8 flex flex-col justify-between space-y-8 border-[#E2B86B]/30 hover:border-[#E2B86B]/50 transition-colors duration-200">
              <div className="space-y-5">
                <div className="flex items-center justify-between text-xs text-[#9A9893]">
                  <span className="text-[#E2B86B] font-medium">Full Creative Director Access</span>
                  <span>Private Cloud Sync</span>
                </div>

                <div>
                  <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display">
                    Sign in with Google
                  </h2>
                  <p className="text-xs text-[#9A9893] mt-1.5 leading-relaxed">
                    Unlocks live generation across all studio stages and automatically preserves every campaign, storyboard frame, video take, and master export in your personal cloud library.
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-white/[0.07] text-xs text-[#D6D3CD]">
                  <div className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#E2B86B] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#F5F3EF] font-medium">Personal Film Library</strong> — Every brief, storyboard frame, and multi-turn video edit is synced privately to your account.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#E2B86B] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#F5F3EF] font-medium">Chained Multimodal Studio</strong> — Generate 1K storyboards with Nano Banana 2 Lite, animate scenes with Gemini Omni Flash, and score with Lyria 3.5.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#E2B86B] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#F5F3EF] font-medium">Broadcast Master &amp; Localization</strong> — Assemble 24fps H.264 commercials with burned-in subtitles and 1-click regional adaptations.
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={handleGoogleClick}
                  className="w-full py-3.5 px-6 btn-champagne rounded-xl text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {signingIn ? 'Connecting with Google...' : 'Continue with Google Account'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="text-[11px] text-[#9A9893] text-center">
                  Authenticated via Firebase · Isolated per-user collection security
                </div>
              </div>
            </div>

            {/* Guest Showcase Access Card (5 Cols) */}
            <div className="md:col-span-5 glass-panel rounded-2xl p-8 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <div className="flex items-center justify-between text-xs text-[#9A9893]">
                  <span>Interactive Showcase</span>
                  <span className="flex items-center gap-1 text-[#9A9893]">
                    <Lock className="w-3 h-3" /> Read-Only Preview
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display">
                    Explore as Guest
                  </h2>
                  <p className="text-xs text-[#9A9893] mt-1.5 leading-relaxed">
                    Browse the studio workspace, inspect pre-rendered flagship campaigns, play the storyboard animatic, and review the architecture guide without signing in.
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-white/[0.07] text-xs text-[#D6D3CD]">
                  <div className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#9A9893] shrink-0 mt-0.5" />
                    <span>
                      Explore pre-built KONA AERO, OUD AL AMEER, and VELOCE CARBON commercial productions.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#9A9893] shrink-0 mt-0.5" />
                    <span>
                      Preview non-destructive video version history, timed captions, and validated master MP4 exports.
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-[#9A9893]">
                    <Lock className="w-4 h-4 text-[#E2B86B] shrink-0 mt-0.5" />
                    <span>
                      Live AI synthesis and cloud saves unlock immediately when you sign in.
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={onContinueAsGuest}
                  className="w-full py-3.5 px-5 btn-glass rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Eye className="w-4 h-4 text-[#E2B86B]" />
                  <span>Enter Studio Showcase</span>
                </button>
                <div className="text-[11px] text-[#9A9893] text-center">
                  Switch to Google Sign-In anytime from the studio header
                </div>
              </div>
            </div>
          </div>

          {/* Quiet Capabilities Footer Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="glass-subpanel rounded-xl p-4 flex items-center gap-3.5">
              <Sparkles className="w-4 h-4 text-[#E2B86B] shrink-0" />
              <div className="text-xs">
                <div className="text-[#F5F3EF] font-medium">Reference-Chained Storyboards</div>
                <div className="text-[#9A9893] mt-0.5">Nano Banana 2 Lite · 1K Continuity</div>
              </div>
            </div>
            <div className="glass-subpanel rounded-xl p-4 flex items-center gap-3.5">
              <Film className="w-4 h-4 text-[#E2B86B] shrink-0" />
              <div className="text-xs">
                <div className="text-[#F5F3EF] font-medium">Conversational Motion &amp; Subtitles</div>
                <div className="text-[#9A9893] mt-0.5">Gemini Omni Flash · Non-Destructive Takes</div>
              </div>
            </div>
            <div className="glass-subpanel rounded-xl p-4 flex items-center gap-3.5">
              <Music className="w-4 h-4 text-[#E2B86B] shrink-0" />
              <div className="text-xs">
                <div className="text-[#F5F3EF] font-medium">Adaptive Scoring &amp; Master Assembly</div>
                <div className="text-[#9A9893] mt-0.5">Lyria 3.5 · FFmpeg 24fps Cinema Mix</div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="relative z-10 border-t border-white/[0.07] bg-[#070709]/80 px-6 py-4 text-xs text-[#9A9893]">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <span>GenMedia Studio · Multimodal Creative Film &amp; Commercial Suite</span>
          <span>Mohammed Sofiyaan · Syed Saad Ahmed · Mohd Rayyan Bin Mohd Jaweed · Mohamed Mustafa Ali Khan</span>
        </div>
      </footer>
    </div>
  );
};
