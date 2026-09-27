/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  FolderKanban,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Plus,
  Sparkles,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import {
  auth,
  deleteCampaignFromFirestore,
  logOut,
  saveCampaignToFirestore,
  saveJobToFirestore,
  signInWithGoogle,
  subscribeToUserCampaigns,
  subscribeToUserJobs,
  syncUserProfileToFirestore,
} from './firebase';
import {
  AgentOrchestrationState,
  Campaign,
  CreativeBrief,
  ModelVerificationReport,
  PipelineJob,
  RenderProgressEvent,
  SceneItem,
  SceneVersion,
  SubtitleCue,
  SubtitleStyle,
} from './types/campaign';
import { BriefAndPlannerStage } from './components/BriefAndPlannerStage';
import { StoryboardStage } from './components/StoryboardStage';
import { VideoDirectorStage } from './components/VideoDirectorStage';
import { SoundtrackAndRenderStage } from './components/SoundtrackAndRenderStage';
import { ModelVerificationModal } from './components/ModelVerificationModal';
import { DocumentationStage } from './components/DocumentationStage';
import { AuthPortalPage } from './components/AuthPortalPage';
import { ProfileAndDatabaseStage } from './components/ProfileAndDatabaseStage';
import { AgenticCommandCenter } from './components/AgenticCommandCenter';

export type StudioTab = 'agent' | 'brief' | 'storyboard' | 'video' | 'master' | 'docs' | 'profile';

async function safeJsonFetch(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, options);
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text ? text.slice(0, 180) : `HTTP ${res.status}` };
  }
  return { ok: res.ok, status: res.status, data };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [showAuthPortal, setShowAuthPortal] = useState<boolean>(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>('');
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [activeTab, setActiveTab] = useState<StudioTab>('agent');
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');

  // Loading & operation states
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPlanning, setIsPlanning] = useState(false);
  const [generatingAllImages, setGeneratingAllImages] = useState(false);
  const [generatingSceneImageId, setGeneratingSceneImageId] = useState<string | null>(null);
  const [generatingAllVideos, setGeneratingAllVideos] = useState(false);
  const [generatingSceneVideoId, setGeneratingSceneVideoId] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [isRunningAutopilot, setIsRunningAutopilot] = useState(false);
  const [autopilotProgress, setAutopilotProgress] = useState<RenderProgressEvent | null>(null);
  const [isLocalizing, setIsLocalizing] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [liveOrchestrationState, setLiveOrchestrationState] = useState<AgentOrchestrationState | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Model Verification Modal & Campaign Switcher Drawer
  const [verificationReport, setVerificationReport] = useState<ModelVerificationReport | null>(null);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [showCampaignDrawer, setShowCampaignDrawer] = useState(false);

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        setIsGuest(false);
        setShowAuthPortal(false);
        setErrorBanner(null);
        syncUserProfileToFirestore(u).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  const fetchWorkspaceData = async (currentUser: User | null) => {
    try {
      const ownerParam = currentUser ? encodeURIComponent(currentUser.uid) : 'public-demo';
      const [campRes, verifyRes] = await Promise.all([
        fetch(`/api/campaigns?ownerId=${ownerParam}`),
        fetch('/api/models/verify'),
      ]);
      if (campRes.ok) {
        const data = await campRes.json();
        const loaded: Campaign[] = data.campaigns || [];
        setCampaigns((prev) => {
          const byId = new Map<string, Campaign>();
          for (const c of prev) {
            byId.set(c.id, c);
          }
          for (const srvCamp of loaded) {
            const existing = byId.get(srvCamp.id);
            if (
              !existing ||
              new Date(srvCamp.updatedAt || 0).getTime() >=
                new Date(existing.updatedAt || 0).getTime()
            ) {
              byId.set(srvCamp.id, srvCamp);
              if (currentUser && srvCamp.ownerId === currentUser.uid) {
                saveCampaignToFirestore(srvCamp, currentUser).catch(() => {});
              }
            }
          }
          return Array.from(byId.values()).sort(
            (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
          );
        });
        setJobs(data.jobs || []);
        if (loaded.length > 0) {
          const preferred =
            loaded.find((c) => c.status === 'completed' && c.finalRender?.videoUrl) || loaded[0];
          setActiveCampaignId((prev) =>
            loaded.some((c) => c.id === prev) ? prev : preferred.id
          );
          if (preferred.scenes?.[0]) {
            setSelectedSceneId(preferred.scenes[0].id);
          }
        } else {
          setActiveCampaignId('');
        }
      }
      if (verifyRes.ok) {
        const rep = await verifyRes.json();
        setVerificationReport(rep);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to load studio workspace');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;
    fetchWorkspaceData(user);
  }, [isAuthReady, user]);

  // Real-time Firestore listeners for authenticated user's personal campaigns and jobs
  useEffect(() => {
    if (!isAuthReady || !user) {
      return;
    }

    const unsubCampaigns = subscribeToUserCampaigns(
      user,
      (cloudCampaigns) => {
        if (cloudCampaigns.length > 0) {
          fetch('/api/campaigns/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaigns: cloudCampaigns }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((syncData) => {
              const sanitizedList: Campaign[] = syncData?.campaigns || cloudCampaigns;
              setCampaigns((prev) => {
                const byId = new Map<string, Campaign>();
                for (const c of prev) {
                  if (c.ownerId === user.uid || c.ownerId === 'public-demo') {
                    byId.set(c.id, c);
                  }
                }
                for (const srvCamp of sanitizedList) {
                  if (srvCamp.ownerId === user.uid || srvCamp.ownerId === 'public-demo') {
                    byId.set(srvCamp.id, srvCamp);
                  }
                }
                return Array.from(byId.values()).sort(
                  (a, b) =>
                    new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
                );
              });
            })
            .catch(() => {});
        }
      },
      (err) => {
        console.warn('Firestore campaign listener warning:', err.message);
      }
    );

    const unsubJobs = subscribeToUserJobs(
      user,
      (cloudJobs) => {
        if (cloudJobs.length > 0) {
          setJobs((prev) => {
            const byId = new Map<string, PipelineJob>();
            for (const j of prev) {
              if (j.ownerId === user.uid) byId.set(j.id, j);
            }
            for (const cj of cloudJobs) byId.set(cj.id, cj);
            return Array.from(byId.values())
              .sort(
                (a, b) =>
                  new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
              )
              .slice(0, 30);
          });
        }
      },
      () => {}
    );

    return () => {
      unsubCampaigns();
      unsubJobs();
    };
  }, [isAuthReady, user]);

  const syncCampaignToFirestore = async (camp: Campaign) => {
    if (!user) return;
    try {
      await saveCampaignToFirestore(camp, user);
    } catch {
      // Handled inside saveCampaignToFirestore
    }
  };

  const syncJobToFirestore = async (job?: PipelineJob) => {
    if (!user || !job) return;
    try {
      await saveJobToFirestore(job, user);
    } catch {
      // Handled inside saveJobToFirestore
    }
  };

  const handleGoogleSignIn = async () => {
    const signedInUser = await signInWithGoogle();
    if (signedInUser) {
      setIsGuest(false);
      setShowAuthPortal(false);
      setErrorBanner(null);
    }
  };

  const handleSignOut = async () => {
    await logOut();
    setIsGuest(false);
    setShowAuthPortal(true);
  };

  const handleSyncAllToFirestore = async () => {
    if (!user) {
      setShowAuthPortal(true);
      return;
    }
    setIsSyncingCloud(true);
    try {
      for (const camp of campaigns) {
        await saveCampaignToFirestore(camp, user);
      }
    } catch (e: any) {
      setErrorBanner(e?.message || 'Firestore sync error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleCloneStarterToUserDb = async () => {
    if (!user) {
      setShowAuthPortal(true);
      return;
    }
    try {
      const res = await fetch('/api/campaigns/clone-starter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: user.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clone starter showcase');
      updateCampaignInState(data.campaign, data.job);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to clone starter showcase');
    }
  };

  const updateCampaignInState = (updated: Campaign, latestJob?: PipelineJob, syncCloud = true) => {
    setCampaigns((prev) => {
      const exists = prev.some((c) => c.id === updated.id);
      if (exists) {
        return prev.map((c) => (c.id === updated.id ? updated : c));
      }
      return [updated, ...prev];
    });
    setActiveCampaignId(updated.id);
    if (syncCloud) {
      syncCampaignToFirestore(updated);
      if (latestJob) {
        syncJobToFirestore(latestJob);
      }
    }
  };

  // Stage 1 & 2: Plan Campaign
  const handlePlanCampaign = async (brief: CreativeBrief) => {
    setIsPlanning(true);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch('/api/campaigns/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          ownerId: user?.uid || 'public-demo',
        }),
      });
      if (!ok) throw new Error(data.error || 'Campaign planning failed');
      updateCampaignInState(data.campaign, data.job);
      if (data.campaign.scenes?.[0]) {
        setSelectedSceneId(data.campaign.scenes[0].id);
      }
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to generate campaign plan');
    } finally {
      setIsPlanning(false);
    }
  };

  // Stage 3: Generate All Storyboard Images
  const handleGenerateAllImages = async () => {
    if (!activeCampaign) return;
    setGeneratingAllImages(true);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch(
        `/api/campaigns/${activeCampaign.id}/storyboard/generate-all`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign: activeCampaign }),
        }
      );
      if (!ok) throw new Error(data.error || 'Storyboard generation failed');
      updateCampaignInState(data.campaign, data.job);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Storyboard generation failed');
    } finally {
      setGeneratingAllImages(false);
    }
  };

  // Stage 3: Generate Single Scene Image
  const handleGenerateSingleImage = async (sceneId: string, updatedPrompt?: string) => {
    if (!activeCampaign) return;
    setGeneratingSceneImageId(sceneId);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch(
        `/api/campaigns/${activeCampaign.id}/scenes/${sceneId}/image`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagePrompt: updatedPrompt, campaign: activeCampaign }),
        }
      );
      if (!ok) throw new Error(data.error || 'Scene image generation failed');
      updateCampaignInState(data.campaign, data.job);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Scene image generation failed');
    } finally {
      setGeneratingSceneImageId(null);
    }
  };

  // Stage 3: Update Scenes
  const handleUpdateScenes = async (updatedScenes: SceneItem[]) => {
    if (!activeCampaign) return;
    try {
      const { ok, data } = await safeJsonFetch(`/api/campaigns/${activeCampaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...activeCampaign, scenes: updatedScenes }),
      });
      if (ok && data?.id) {
        updateCampaignInState(data);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to update storyboard scenes');
    }
  };

  // Stage 4: Generate All Scene Videos
  const handleGenerateAllVideos = async () => {
    if (!activeCampaign) return;
    setGeneratingAllVideos(true);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch(
        `/api/campaigns/${activeCampaign.id}/videos/generate-all`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign: activeCampaign }),
        }
      );
      if (!ok) throw new Error(data.error || 'Batch video synthesis failed');
      updateCampaignInState(data.campaign, data.job);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Batch video synthesis failed');
    } finally {
      setGeneratingAllVideos(false);
    }
  };

  // Stage 4: Generate or Edit Scene Video
  const handleGenerateOrEditVideo = async (
    sceneId: string,
    options?: {
      instruction?: string;
      videoPrompt?: string;
      cameraMovement?: string;
      overlayText?: string;
      subtitleCues?: SubtitleCue[];
      subtitleStyle?: SubtitleStyle;
    }
  ) => {
    if (!activeCampaign) return;
    setGeneratingSceneVideoId(sceneId);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch(
        `/api/campaigns/${activeCampaign.id}/scenes/${sceneId}/video`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...(options || {}), campaign: activeCampaign }),
        }
      );
      if (!ok) throw new Error(data.error || 'Scene video generation failed');
      updateCampaignInState(data.campaign, data.job);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Scene video generation failed');
    } finally {
      setGeneratingSceneVideoId(null);
    }
  };

  // Stage 4: Restore Previous Scene Version
  const handleRestoreSceneVersion = async (sceneId: string, version: SceneVersion) => {
    if (!activeCampaign) return;
    const updatedScenes = activeCampaign.scenes.map((s) => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        videoUrl: version.videoUrl,
        rawVideoUrl: version.rawVideoUrl || s.rawVideoUrl,
        subtitlesBurnedIn: version.subtitlesBurnedIn ?? s.subtitlesBurnedIn,
        overlayText: version.overlayText !== undefined ? version.overlayText : s.overlayText,
        subtitleCues: version.subtitleCues || s.subtitleCues,
        subtitleStyle: version.subtitleStyle || s.subtitleStyle,
        cameraMovement: version.cameraMovement,
        videoPrompt: version.videoPrompt,
        directorNotes: `Restored v${version.version}: ${version.instruction}`,
        interactionId: version.interactionId,
      };
    });
    await handleUpdateScenes(updatedScenes);
  };

  // Stage 5: Generate Soundtrack
  const handleGenerateSoundtrack = async (mood: string, prompt: string) => {
    if (!activeCampaign) return;
    setIsGeneratingAudio(true);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch(`/api/campaigns/${activeCampaign.id}/soundtrack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, prompt, campaign: activeCampaign }),
      });
      if (!ok) throw new Error(data.error || 'Soundtrack generation failed');
      updateCampaignInState(data.campaign, data.job);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Soundtrack generation failed');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Stage 6 & 7: Assemble Final Video
  const handleAssembleFinalVideo = async (includeInFinalMix: boolean, volumeLevel: number) => {
    if (!activeCampaign) return;
    setIsRenderingFinal(true);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch(`/api/campaigns/${activeCampaign.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeInFinalMix, volumeLevel, campaign: activeCampaign }),
      });
      if (!ok) throw new Error(data.error || 'FFmpeg rendering failed');
      updateCampaignInState(data.campaign, data.job);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'FFmpeg rendering failed');
    } finally {
      setIsRenderingFinal(false);
    }
  };

  // Chained Single-Loop Autopilot
  const handleRunSingleLoopAutopilot = async () => {
    if (!activeCampaign) return;
    setIsRunningAutopilot(true);
    setIsRenderingFinal(true);
    setActiveTab('master');
    setErrorBanner(null);
    setAutopilotProgress({
      campaignId: activeCampaign.id,
      jobId: 'starting',
      stageKey: 'init',
      stageLabel: 'Stage 01 · Storyboard Synthesis',
      progress: 6,
      sceneIndex: 1,
      totalScenes: activeCampaign.scenes.length || 3,
      message: `Launching full multimodal commercial production for ${activeCampaign.brandName}...`,
      timestamp: new Date().toISOString(),
    });

    try {
      const { ok, data } = await safeJsonFetch(
        `/api/campaigns/${activeCampaign.id}/single-loop-autopilot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign: activeCampaign, asyncMode: true }),
        }
      );

      if (!ok) {
        throw new Error(data.error || 'Autopilot failed to start');
      }

      if (data.campaign && !data.running) {
        updateCampaignInState(data.campaign, data.job);
        if (data.job) setJobs((prev) => [data.job, ...prev]);
        return;
      }

      const targetId = activeCampaign.id;
      const maxPolls = 180;
      for (let tick = 0; tick < maxPolls; tick++) {
        await new Promise((r) => setTimeout(r, 900));
        const poll = await safeJsonFetch(`/api/campaigns/${targetId}/render-progress`);
        if (poll.ok && poll.data) {
          if (poll.data.progress) {
            setAutopilotProgress(poll.data.progress);
          }
          if (poll.data.campaign) {
            const isFinished =
              !poll.data.autopilotRunning &&
              (poll.data.progress?.stageKey === 'completed' ||
                poll.data.campaign.status === 'completed' ||
                poll.data.campaign.finalRender?.status === 'completed');

            updateCampaignInState(poll.data.campaign, poll.data.job, isFinished);
            if (isFinished) {
              if (poll.data.job) {
                setJobs((prev) => [
                  poll.data.job,
                  ...prev.filter((j) => j.id !== poll.data.job.id),
                ]);
              }
              break;
            }
          }
          if (!poll.data.autopilotRunning && poll.data.progress?.stageKey === 'failed') {
            throw new Error(poll.data.progress.message || 'Autopilot failed');
          }
        }
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Autopilot failed');
    } finally {
      setIsRunningAutopilot(false);
      setIsRenderingFinal(false);
    }
  };

  // Multi-Market Localized Ad Engine
  const handleLocalizeCampaign = async (locale: string, language: string) => {
    if (!activeCampaign) return;
    setIsLocalizing(true);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch(`/api/campaigns/${activeCampaign.id}/localize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, language, campaign: activeCampaign }),
      });
      if (!ok) throw new Error(data.error || 'Campaign localization failed');
      updateCampaignInState(data.campaign, data.job);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Campaign localization failed');
    } finally {
      setIsLocalizing(false);
    }
  };

  // Poll & stream live Agentic Orchestration state until completion
  const monitorAgentOrchestration = async (targetCampaignId: string) => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/agent/stream/${targetCampaignId}`);
      eventSource.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          if (parsed?.orchestrationState) {
            setLiveOrchestrationState(parsed.orchestrationState);
          }
          if (parsed?.campaign) {
            updateCampaignInState(parsed.campaign, parsed.job, false);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // fallback polling handles updates
    }

    try {
      const maxPolls = 240;
      for (let tick = 0; tick < maxPolls; tick++) {
        await new Promise((r) => setTimeout(r, 950));
        const poll = await safeJsonFetch(`/api/agent/status/${targetCampaignId}`);
        if (poll.ok && poll.data) {
          if (poll.data.orchestrationState) {
            setLiveOrchestrationState(poll.data.orchestrationState);
          }
          if (poll.data.campaign) {
            const isDone =
              !poll.data.running &&
              (poll.data.orchestrationState?.status === 'completed' ||
                poll.data.orchestrationState?.status === 'failed' ||
                poll.data.orchestrationState?.status === 'paused_checkpoint');
            updateCampaignInState(poll.data.campaign, poll.data.job, isDone);
            if (isDone) {
              if (poll.data.job) {
                setJobs((prev) => [
                  poll.data.job,
                  ...prev.filter((j) => j.id !== poll.data.job.id),
                ]);
              }
              break;
            }
          }
        }
      }
    } finally {
      if (eventSource) {
        eventSource.close();
      }
    }
  };

  // Central Orchestrator Agent Execution (New Campaign or Selective Delta Modification)
  const handleExecuteAgentPrompt = async (options: {
    prompt: string;
    forceNewCampaign?: boolean;
    referenceImageBase64?: string;
    referenceImageMimeType?: string;
  }) => {
    setIsOrchestrating(true);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch('/api/agent/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: options.prompt,
          campaignId: options.forceNewCampaign ? undefined : activeCampaign?.id,
          campaign: options.forceNewCampaign ? undefined : activeCampaign,
          ownerId: user?.uid || 'public-demo',
          forceNewCampaign: Boolean(options.forceNewCampaign),
          referenceImageBase64: options.referenceImageBase64,
          referenceImageMimeType: options.referenceImageMimeType,
          asyncMode: true,
        }),
      });
      if (!ok) {
        throw new Error(data.error || 'Agent orchestration failed to start');
      }
      if (data.orchestrationState) {
        setLiveOrchestrationState(data.orchestrationState);
      }
      if (data.campaign) {
        updateCampaignInState(data.campaign, data.job, !data.running);
        if (data.campaign.scenes?.[0] && !selectedSceneId) {
          setSelectedSceneId(data.campaign.scenes[0].id);
        }
      }
      const targetId = data.campaign?.id || activeCampaign?.id;
      if (data.running && targetId) {
        await monitorAgentOrchestration(targetId);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Agent orchestration encountered an error');
    } finally {
      setIsOrchestrating(false);
    }
  };

  // Resume Interrupted or Checkpointed Agent Workflow
  const handleResumeAgentCheckpoint = async () => {
    if (!activeCampaign) return;
    setIsOrchestrating(true);
    setErrorBanner(null);
    try {
      const { ok, data } = await safeJsonFetch(`/api/agent/resume/${activeCampaign.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: activeCampaign, asyncMode: true }),
      });
      if (!ok) {
        throw new Error(data.error || 'Failed to resume agent workflow');
      }
      if (data.orchestrationState) {
        setLiveOrchestrationState(data.orchestrationState);
      }
      if (data.campaign) {
        updateCampaignInState(data.campaign, data.job, !data.running);
      }
      if (data.running) {
        await monitorAgentOrchestration(activeCampaign.id);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to resume checkpointed workflow');
    } finally {
      setIsOrchestrating(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!user) return;
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      await deleteCampaignFromFirestore(id, user).catch(() => {});
      const remaining = campaigns.filter((c) => c.id !== id);
      setCampaigns(remaining);
      if (activeCampaignId === id) {
        setActiveCampaignId(remaining[0]?.id || '');
      }
    } catch {
      // ignore
    }
  };

  if (initialLoading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-[#070709] text-[#F5F3EF] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#E2B86B] animate-spin" />
        <div className="text-xs text-[#9A9893] tracking-wide">
          Preparing GenMedia Studio...
        </div>
      </div>
    );
  }

  if (showAuthPortal || (!user && !isGuest)) {
    return (
      <>
        <AuthPortalPage
          onGoogleSignIn={handleGoogleSignIn}
          onContinueAsGuest={() => {
            setIsGuest(true);
            setShowAuthPortal(false);
          }}
          onOpenVerificationReport={() => setIsVerificationOpen(true)}
        />
        <ModelVerificationModal
          isOpen={isVerificationOpen}
          onClose={() => setIsVerificationOpen(false)}
          report={verificationReport}
        />
      </>
    );
  }

  const readyImages = activeCampaign?.scenes.filter((s) => Boolean(s.imageUrl)).length || 0;
  const readyVideos = activeCampaign?.scenes.filter((s) => Boolean(s.videoUrl)).length || 0;
  const totalScenes = activeCampaign?.scenes.length || 0;

  return (
    <div className="min-h-screen bg-[#070709] text-[#F5F3EF] flex flex-col">
      {/* Top Studio Header Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 bg-[#070709]/85 backdrop-blur-2xl border-b border-white/[0.08] px-4 lg:px-8 py-3.5">
        <div className="max-w-[1520px] mx-auto flex items-center justify-between gap-6">
          {/* Zone 1: Single Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('agent')}
            className="text-2xl font-semibold tracking-tight text-[#F5F3EF] font-display whitespace-nowrap cursor-pointer flex items-center gap-2.5"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-[#E2B86B] via-purple-400 to-cyan-400 shadow-[0_0_12px_rgba(226,184,107,0.8)]" />
            <span>GenMedia Studio</span>
          </button>

          {/* Zone 2: Clean Editorial Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-[#9A9893]">
            <button
              type="button"
              onClick={() => setActiveTab('agent')}
              className={`hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer py-1 flex items-center gap-1.5 ${
                activeTab === 'agent'
                  ? 'text-[#E2B86B] underline underline-offset-8 decoration-[#E2B86B] decoration-2 font-semibold'
                  : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E2B86B]" />
              <span>AI Director</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('brief')}
              className={`hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer py-1 ${
                activeTab === 'brief'
                  ? 'text-[#F5F3EF] underline underline-offset-8 decoration-[#E2B86B] decoration-2'
                  : ''
              }`}
            >
              01. Brief &amp; Blueprint
            </button>
            <button
              type="button"
              disabled={!activeCampaign}
              onClick={() => setActiveTab('storyboard')}
              className={`hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 py-1 tabular-nums ${
                activeTab === 'storyboard'
                  ? 'text-[#F5F3EF] underline underline-offset-8 decoration-[#E2B86B] decoration-2'
                  : ''
              }`}
            >
              02. Storyboard ({readyImages}/{totalScenes})
            </button>
            <button
              type="button"
              disabled={!activeCampaign}
              onClick={() => setActiveTab('video')}
              className={`hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 py-1 tabular-nums ${
                activeTab === 'video'
                  ? 'text-[#F5F3EF] underline underline-offset-8 decoration-[#E2B86B] decoration-2'
                  : ''
              }`}
            >
              03. Motion &amp; Direction ({readyVideos}/{totalScenes})
            </button>
            <button
              type="button"
              disabled={!activeCampaign}
              onClick={() => setActiveTab('master')}
              className={`hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 py-1 ${
                activeTab === 'master'
                  ? 'text-[#F5F3EF] underline underline-offset-8 decoration-[#E2B86B] decoration-2'
                  : ''
              }`}
            >
              04. Score &amp; Master
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer py-1 tabular-nums ${
                activeTab === 'profile'
                  ? 'text-[#F5F3EF] underline underline-offset-8 decoration-[#E2B86B] decoration-2'
                  : ''
              }`}
            >
              Library ({campaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('docs')}
              className={`hover:text-[#F5F3EF] transition-colors whitespace-nowrap cursor-pointer py-1 ${
                activeTab === 'docs'
                  ? 'text-[#F5F3EF] underline underline-offset-8 decoration-[#E2B86B] decoration-2'
                  : ''
              }`}
            >
              Guide
            </button>
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCampaignDrawer(!showCampaignDrawer)}
              className="px-3.5 py-2 btn-glass rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <FolderKanban className="w-3.5 h-3.5 text-[#E2B86B] shrink-0" />
              <span className="truncate max-w-[150px]">
                {activeCampaign ? activeCampaign.brandName : 'Projects'}
              </span>
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="px-3 py-1.5 btn-glass rounded-xl flex items-center gap-2 text-left cursor-pointer whitespace-nowrap"
                  title="Open Personal Library"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-full border border-[#E2B86B]/50"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-[#E2B86B]" />
                  )}
                  <span className="hidden sm:inline text-xs text-[#F5F3EF] truncate max-w-[110px]">
                    {user.displayName || user.email}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-2 btn-glass rounded-xl text-[#9A9893] hover:text-[#F5F3EF] cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthPortal(true)}
                className="px-4 py-2 btn-champagne rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Stage Navigation Bar (Only visible on < lg screens) */}
      <div className="lg:hidden border-b border-white/[0.08] bg-[#070709]/80 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {(
          [
            { id: 'agent', label: 'AI Director' },
            { id: 'brief', label: '01. Brief' },
            { id: 'storyboard', label: `02. Storyboard (${readyImages}/${totalScenes})` },
            { id: 'video', label: `03. Motion (${readyVideos}/${totalScenes})` },
            { id: 'master', label: '04. Master' },
            { id: 'profile', label: 'Library' },
            { id: 'docs', label: 'Guide' },
          ] as Array<{ id: StudioTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#E2B86B] text-black font-medium'
                : 'text-[#9A9893] hover:text-[#F5F3EF]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Collapsible Project Switcher Drawer */}
      <AnimatePresence>
        {showCampaignDrawer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-white/[0.08] bg-[#0D0D12]/95 backdrop-blur-2xl overflow-hidden"
          >
            <div className="max-w-[1520px] mx-auto px-4 lg:px-8 py-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[#E2B86B] font-medium">
                  {user
                    ? `${user.displayName || user.email}'s Cloud Projects (${campaigns.length})`
                    : `Curated Showcase Projects (${campaigns.length} · Guest Read-Only)`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('profile');
                      setShowCampaignDrawer(false);
                    }}
                    className="px-3 py-1.5 btn-glass rounded-xl text-xs cursor-pointer whitespace-nowrap"
                  >
                    Open Full Library
                  </button>
                  {user && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCampaignId('');
                        setActiveTab('brief');
                        setShowCampaignDrawer(false);
                      }}
                      className="px-3.5 py-1.5 btn-champagne rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Campaign
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {campaigns.map((camp) => {
                  const isSelected = camp.id === activeCampaign?.id;
                  return (
                    <div
                      key={camp.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                        isSelected
                          ? 'glass-panel border-[#E2B86B]'
                          : 'glass-subpanel border-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCampaignId(camp.id);
                            if (camp.scenes?.[0]) setSelectedSceneId(camp.scenes[0].id);
                            setShowCampaignDrawer(false);
                          }}
                          className="text-left cursor-pointer"
                        >
                          <div className="text-base font-semibold text-[#F5F3EF] font-display hover:text-[#E2B86B] transition-colors">
                            {camp.brandName}
                          </div>
                          <div className="text-xs text-[#9A9893] font-mono tabular-nums mt-0.5">
                            {camp.aspectRatio} · {camp.durationSeconds}s · {camp.scenes.length} Scenes
                          </div>
                        </button>
                        {user && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCampaign(camp.id)}
                            className="p-1 text-[#9A9893] hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#9A9893] pt-2 border-t border-white/[0.06] tabular-nums">
                        <span className="capitalize text-emerald-400">{camp.status}</span>
                        <span>{new Date(camp.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-[1520px] w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Quiet Guest Notice Bar */}
        {!user && (
          <div className="glass-subpanel rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-[#D6D3CD]">
              <Lock className="w-3.5 h-3.5 text-[#E2B86B] shrink-0" />
              <span>
                Browsing the read-only studio showcase. Sign in with Google to unlock live AI generation and personal cloud storage.
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                handleGoogleSignIn().catch((e) =>
                  setErrorBanner(e?.message || 'Google Sign-In failed')
                )
              }
              className="px-3.5 py-1.5 btn-champagne rounded-xl text-xs cursor-pointer whitespace-nowrap"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {errorBanner && (
          <div className="p-4 glass-panel border-red-400/30 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-red-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <div className="flex items-center gap-2">
              {!user && (
                <button
                  type="button"
                  onClick={() =>
                    handleGoogleSignIn().catch((e) =>
                      setErrorBanner(e?.message || 'Google Sign-In failed')
                    )
                  }
                  className="px-3 py-1.5 btn-champagne rounded-xl text-xs cursor-pointer whitespace-nowrap"
                >
                  Sign In to Unlock
                </button>
              )}
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="px-3 py-1.5 btn-glass rounded-xl text-xs cursor-pointer whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Streamlined Studio Flow & 1-Click Autopilot Bar */}
        {activeCampaign && ['brief', 'storyboard', 'video', 'master'].includes(activeTab) && (
          <div className="glass-subpanel rounded-2xl px-5 py-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#9A9893]">
                <span className="text-[#E2B86B] font-medium">{activeCampaign.brandName}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('storyboard')}
                  className="hover:text-[#F5F3EF] transition cursor-pointer"
                >
                  1K Storyboard
                </button>
                <ArrowRight className="w-3 h-3 text-white/25" />
                <button
                  type="button"
                  onClick={() => setActiveTab('video')}
                  className="hover:text-[#F5F3EF] transition cursor-pointer"
                >
                  Motion &amp; Captions
                </button>
                <ArrowRight className="w-3 h-3 text-white/25" />
                <button
                  type="button"
                  onClick={() => setActiveTab('master')}
                  className="hover:text-[#F5F3EF] transition cursor-pointer"
                >
                  Lyria Score &amp; 24fps Master
                </button>
              </div>

              <button
                type="button"
                disabled={isRunningAutopilot || isRenderingFinal}
                onClick={handleRunSingleLoopAutopilot}
                className="px-4 py-2 btn-champagne rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isRunningAutopilot ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="font-mono tabular-nums">
                      Producing Film ({autopilotProgress?.progress ?? 8}%)...
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Produce Full Commercial (1-Click Autopilot)</span>
                  </>
                )}
              </button>
            </div>

            {isRunningAutopilot && autopilotProgress && (
              <div className="pt-2.5 border-t border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#E2B86B] font-medium">
                    {autopilotProgress.stageLabel}
                  </span>
                  <span className="text-emerald-400 font-mono tabular-nums">
                    {autopilotProgress.progress}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-[#E2B86B] to-emerald-400 transition-all duration-300"
                    style={{ width: `${Math.max(4, autopilotProgress.progress)}%` }}
                  />
                </div>
                <div className="text-xs text-[#9A9893] truncate">
                  {autopilotProgress.message}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Stage Viewport */}
        {activeTab === 'agent' && (
          <AgenticCommandCenter
            activeCampaign={activeCampaign}
            orchestrationState={
              (liveOrchestrationState &&
              activeCampaign &&
              liveOrchestrationState.campaignId === activeCampaign.id
                ? liveOrchestrationState
                : activeCampaign?.orchestrationState) || null
            }
            isOrchestrating={isOrchestrating}
            onExecuteAgentPrompt={handleExecuteAgentPrompt}
            onResumeCheckpoint={handleResumeAgentCheckpoint}
            onNavigateToStage={(stage, sceneId) => {
              if (sceneId) setSelectedSceneId(sceneId);
              setActiveTab(stage);
            }}
          />
        )}

        {activeTab === 'brief' && (
          <BriefAndPlannerStage
            activeCampaign={activeCampaign}
            isPlanning={isPlanning}
            isRunningSingleLoop={isRunningAutopilot}
            isLocalizing={isLocalizing}
            onPlanCampaign={handlePlanCampaign}
            onRunSingleLoopAutopilot={handleRunSingleLoopAutopilot}
            onLocalizeCampaign={handleLocalizeCampaign}
            onProceedToStoryboard={() => setActiveTab('storyboard')}
            onProceedToMaster={() => setActiveTab('master')}
          />
        )}

        {activeTab === 'storyboard' && activeCampaign && (
          <StoryboardStage
            campaign={activeCampaign}
            generatingAllImages={generatingAllImages}
            generatingSceneImageId={generatingSceneImageId}
            generatingAllVideos={generatingAllVideos}
            onGenerateAllImages={handleGenerateAllImages}
            onGenerateSingleImage={handleGenerateSingleImage}
            onGenerateAllVideos={handleGenerateAllVideos}
            onUpdateScenes={handleUpdateScenes}
            onProceedToVideo={(sceneId) => {
              if (sceneId) setSelectedSceneId(sceneId);
              setActiveTab('video');
            }}
          />
        )}

        {activeTab === 'video' && activeCampaign && (
          <VideoDirectorStage
            campaign={activeCampaign}
            selectedSceneId={selectedSceneId || activeCampaign.scenes[0]?.id || ''}
            onSelectScene={setSelectedSceneId}
            generatingSceneVideoId={generatingSceneVideoId}
            generatingAllVideos={generatingAllVideos}
            onGenerateOrEditVideo={handleGenerateOrEditVideo}
            onGenerateAllVideos={handleGenerateAllVideos}
            onRestoreSceneVersion={handleRestoreSceneVersion}
            onProceedToScoreAndRender={() => setActiveTab('master')}
          />
        )}

        {activeTab === 'master' && activeCampaign && (
          <SoundtrackAndRenderStage
            campaign={activeCampaign}
            isGeneratingAudio={isGeneratingAudio}
            isRenderingFinal={isRenderingFinal || isRunningAutopilot}
            isLocalizing={isLocalizing}
            onGenerateSoundtrack={handleGenerateSoundtrack}
            onAssembleFinalVideo={handleAssembleFinalVideo}
            onLocalizeCampaign={handleLocalizeCampaign}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileAndDatabaseStage
            user={user}
            isGuest={isGuest}
            campaigns={campaigns}
            jobs={jobs}
            activeCampaignId={activeCampaign?.id || ''}
            isSyncingCloud={isSyncingCloud}
            onGoogleSignIn={handleGoogleSignIn}
            onSignOut={handleSignOut}
            onOpenAuthPortal={() => setShowAuthPortal(true)}
            onSelectCampaignAndNavigate={(campaignId, tab) => {
              setActiveCampaignId(campaignId);
              const found = campaigns.find((c) => c.id === campaignId);
              if (found?.scenes?.[0]) setSelectedSceneId(found.scenes[0].id);
              setActiveTab(tab);
            }}
            onCreateNewCampaign={() => {
              setActiveCampaignId('');
              setActiveTab('brief');
            }}
            onCloneStarterToUserDb={handleCloneStarterToUserDb}
            onSyncAllToCloud={handleSyncAllToFirestore}
            onDeleteCampaign={handleDeleteCampaign}
          />
        )}

        {activeTab === 'docs' && (
          <DocumentationStage
            onNavigateTab={setActiveTab}
            onOpenModelVerification={() => setIsVerificationOpen(true)}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-white/[0.07] bg-[#070709]/80 px-4 lg:px-8 py-4 text-xs text-[#9A9893]">
        <div className="max-w-[1520px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <span>
            GenMedia Studio · Multimodal Commercial Direction &amp; Cinema Mastering
          </span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setIsVerificationOpen(true)}
              className="hover:text-[#F5F3EF] transition cursor-pointer"
            >
              Engine Verification
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('docs')}
              className="hover:text-[#F5F3EF] transition cursor-pointer"
            >
              Studio Guide
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Siri-inspired AI Creative Director Dock when on Manual Tabs */}
      {activeTab !== 'agent' && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={() => setActiveTab('agent')}
            className="group glass-panel border border-[#E2B86B]/40 hover:border-[#E2B86B] rounded-full pl-2.5 pr-4 py-2 flex items-center gap-3 shadow-[0_16px_40px_rgba(0,0,0,0.75)] cursor-pointer transition-all"
            title="Open Autonomous AI Creative Director"
          >
            <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0">
              <div
                className="absolute inset-0 rounded-full siri-orb-layer-1"
                style={{
                  background:
                    'conic-gradient(from 0deg, #E2B86B, #A78BFA, #38BDF8, #34D399, #F472B6, #E2B86B)',
                }}
              />
              <div className="relative z-10 w-3 h-3 rounded-full bg-white/90 shadow-[0_0_10px_#fff]" />
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-[#F5F3EF] group-hover:text-[#E2B86B] transition-colors flex items-center gap-1.5">
                <span>Ask AI Director</span>
                {activeCampaign?.orchestrationState?.status === 'running' && (
                  <span className="w-2 h-2 rounded-full bg-[#E2B86B] animate-ping" />
                )}
              </div>
              <div className="text-[10px] text-[#9A9893]">
                {activeCampaign?.orchestrationState?.status === 'running'
                  ? `Working · ${activeCampaign.orchestrationState.overallProgress}%`
                  : 'Voice & Prompt Control'}
              </div>
            </div>
          </button>
        </div>
      )}

      <ModelVerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
        report={verificationReport}
      />
    </div>
  );
}
