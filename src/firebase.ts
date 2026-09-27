import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Campaign, PipelineJob } from './types/campaign';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  if (credential.user) {
    await syncUserProfileToFirestore(credential.user);
  }
  return credential;
}

export async function logOut() {
  return signOut(auth);
}

export async function syncUserProfileToFirestore(user: User): Promise<void> {
  const nowIso = new Date().toISOString().slice(0, 64);
  const uid = user.uid.slice(0, 128);
  const userPath = `users/${uid}`;
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        uid,
        displayName: (user.displayName || user.email?.split('@')[0] || 'Creative Director').slice(0, 120),
        photoURL: (user.photoURL || '').slice(0, 1024),
        createdAt: (user.metadata?.creationTime
          ? new Date(user.metadata.creationTime).toISOString()
          : nowIso
        ).slice(0, 64),
        lastLoginAt: nowIso,
      },
      { merge: true }
    );

    if (user.email) {
      await setDoc(
        doc(db, 'users', uid, 'private', 'info'),
        {
          uid,
          email: user.email.slice(0, 256),
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function saveCampaignToFirestore(
  camp: Campaign,
  currentUser: User | null
): Promise<void> {
  if (!currentUser) return;
  const baseId = camp.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 100);
  const campaignId =
    camp.ownerId === 'public-demo' || baseId === 'camp_starter_kona'
      ? `${baseId}_${currentUser.uid.slice(0, 10)}`
      : baseId;
  const path = `campaigns/${campaignId}`;
  const nowIso = new Date().toISOString().slice(0, 64);

  // Sanitize & bound fields to match firebase-blueprint.json & firestore.rules
  const sanitizedScenes = (camp.scenes || []).slice(0, 10).map((s) => ({
    ...s,
    title: (s.title || '').slice(0, 200),
    imagePrompt: (s.imagePrompt || '').slice(0, 2000),
    videoPrompt: (s.videoPrompt || '').slice(0, 2000),
    overlayText: (s.overlayText || '').slice(0, 200),
  }));

  const rawPayload = {
    id: campaignId,
    ownerId: currentUser.uid.slice(0, 128),
    brandName: (camp.brandName || 'Untitled Brand').slice(0, 200),
    productDescription: (camp.productDescription || 'Product description').slice(0, 5000),
    targetAudience: (camp.targetAudience || '').slice(0, 1000),
    campaignObjective: (camp.campaignObjective || '').slice(0, 1000),
    creativeStyle: (camp.creativeStyle || '').slice(0, 500),
    durationSeconds: Number(camp.durationSeconds) || 15,
    aspectRatio: ['16:9', '9:16', '1:1'].includes(camp.aspectRatio) ? camp.aspectRatio : '16:9',
    language: (camp.language || 'English').slice(0, 100),
    referenceImageUrl: (camp.referenceImageUrl || '').slice(0, 1024),
    status: (camp.status || 'planned').slice(0, 64),
    plan: camp.plan || {},
    scenes: sanitizedScenes,
    soundtrack: camp.soundtrack || {},
    voiceover: camp.voiceover || {},
    finalRender: {
      ...(camp.finalRender || { status: 'idle' }),
      ffmpegCommandLog: (camp.finalRender?.ffmpegCommandLog || '').slice(0, 4000),
    },
    localizedVariants: (camp.localizedVariants || []).slice(0, 10),
    orchestrationState: camp.orchestrationState
      ? {
          ...camp.orchestrationState,
          logs: (camp.orchestrationState.logs || []).slice(0, 25),
          checkpoints: (camp.orchestrationState.checkpoints || []).slice(0, 8),
        }
      : null,
    createdAt: (camp.createdAt || nowIso).slice(0, 64),
    updatedAt: nowIso,
  };

  const payload = JSON.parse(JSON.stringify(rawPayload));

  try {
    await setDoc(doc(db, 'campaigns', campaignId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveJobToFirestore(
  job: PipelineJob,
  currentUser: User | null
): Promise<void> {
  if (!currentUser) return;
  const jobId = job.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  const campaignId = job.campaignId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  const path = `jobs/${jobId}`;
  const nowIso = new Date().toISOString().slice(0, 64);

  const payload = {
    id: jobId,
    campaignId,
    ownerId: currentUser.uid.slice(0, 128),
    type: job.type,
    status: job.status,
    progress: Number(job.progress) || 0,
    modelId: (job.modelId || 'gemini').slice(0, 128),
    message: (job.message || '').slice(0, 1000),
    createdAt: (job.createdAt || nowIso).slice(0, 64),
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'jobs', jobId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCampaignFromFirestore(
  campaignId: string,
  currentUser: User | null
): Promise<void> {
  if (!currentUser) return;
  const cleanId = campaignId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  const path = `campaigns/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'campaigns', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToUserCampaigns(
  user: User,
  onData: (campaigns: Campaign[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, 'campaigns'), where('ownerId', '==', user.uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Campaign[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Campaign);
      });
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'campaigns');
      } catch (formattedErr: any) {
        if (onError) onError(formattedErr);
      }
    }
  );
}

export function subscribeToUserJobs(
  user: User,
  onData: (jobs: PipelineJob[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, 'jobs'), where('ownerId', '==', user.uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: PipelineJob[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as PipelineJob);
      });
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onData(list.slice(0, 30));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'jobs');
      } catch (formattedErr: any) {
        if (onError) onError(formattedErr);
      }
    }
  );
}
