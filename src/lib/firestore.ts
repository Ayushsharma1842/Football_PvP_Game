import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc, 
  query, 
  where,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Decision } from '@/types/game';

// Types for Firestore documents
export interface FirestoreMatch {
  id: string;
  mode: 'practice' | 'async';
  status: 'waiting_for_p2' | 'p1_playing' | 'p2_playing' | 'completed';
  shareCode: string;
  clipIds: string[];
  rulesVersion: string;
  createdAt: Timestamp;
  player1: {
    uid: string;
    name: string;
    answers?: PlayerAnswerDoc[];
    totalScore?: number;
    submittedAt?: Timestamp;
  };
  player2?: {
    uid: string;
    name: string;
    answers?: PlayerAnswerDoc[];
    totalScore?: number;
    submittedAt?: Timestamp;
  };
  winner?: 'player1' | 'player2' | 'tie';
}

export interface PlayerAnswerDoc {
  clipId: string;
  decision: Decision | null;
  responseTimeMs: number;
  submittedAt: Timestamp;
  timedOut: boolean;
}

export interface ClipDoc {
  id: string;
  videoUrl: string;
  title: string;
  difficulty: number;
  durationSec: number;
  explanationBullets: string[];
}

export interface ClipAnswerDoc {
  clipId: string;
  correctDecision: Decision;
}

// Generate a short share code (6 characters)
export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new async match
export async function createAsyncMatch(
  userId: string,
  playerName: string,
  clipIds: string[]
): Promise<{ matchId: string; shareCode: string }> {
  const shareCode = generateShareCode();
  
  const matchRef = doc(collection(db, 'matches'));
  const matchData: Omit<FirestoreMatch, 'id'> = {
    mode: 'async',
    status: 'waiting_for_p2',
    shareCode,
    clipIds,
    rulesVersion: 'v1',
    createdAt: serverTimestamp() as Timestamp,
    player1: {
      uid: userId,
      name: playerName,
    },
  };

  await setDoc(matchRef, matchData);
  
  return { matchId: matchRef.id, shareCode };
}

// Join an existing match by share code
export async function joinMatchByCode(
  shareCode: string,
  userId: string,
  playerName: string
): Promise<{ matchId: string; match: FirestoreMatch } | null> {
  const matchesRef = collection(db, 'matches');
  const q = query(
    matchesRef, 
    where('shareCode', '==', shareCode.toUpperCase()),
    where('status', '==', 'waiting_for_p2')
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const matchDoc = snapshot.docs[0];
  const matchData = matchDoc.data() as FirestoreMatch;
  
  // Don't let same user join their own match
  if (matchData.player1.uid === userId) {
    throw new Error('Cannot join your own match');
  }
  
  // Update match with player 2
  await updateDoc(matchDoc.ref, {
    'player2.uid': userId,
    'player2.name': playerName,
    'status': 'p1_playing',
  });
  
  return { 
    matchId: matchDoc.id, 
    match: { ...matchData, id: matchDoc.id } 
  };
}

// Get match by ID
export async function getMatch(matchId: string): Promise<FirestoreMatch | null> {
  const matchRef = doc(db, 'matches', matchId);
  const matchSnap = await getDoc(matchRef);
  
  if (!matchSnap.exists()) {
    return null;
  }
  
  return { id: matchSnap.id, ...matchSnap.data() } as FirestoreMatch;
}

// Subscribe to match updates
export function subscribeToMatch(
  matchId: string, 
  callback: (match: FirestoreMatch | null) => void
): () => void {
  const matchRef = doc(db, 'matches', matchId);
  
  return onSnapshot(matchRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ id: snapshot.id, ...snapshot.data() } as FirestoreMatch);
  });
}

// Submit player answers for a match
export async function submitMatchAnswers(
  matchId: string,
  isPlayer1: boolean,
  answers: PlayerAnswerDoc[],
  totalScore: number
): Promise<void> {
  const matchRef = doc(db, 'matches', matchId);
  const playerKey = isPlayer1 ? 'player1' : 'player2';
  
  // Get current match to determine next status
  const matchSnap = await getDoc(matchRef);
  const matchData = matchSnap.data() as FirestoreMatch;
  
  let newStatus = matchData.status;
  
  if (isPlayer1) {
    newStatus = 'p2_playing';
  } else {
    newStatus = 'completed';
  }
  
  const updateData: Record<string, unknown> = {
    [`${playerKey}.answers`]: answers,
    [`${playerKey}.totalScore`]: totalScore,
    [`${playerKey}.submittedAt`]: serverTimestamp(),
    status: newStatus,
  };
  
  // If completing, determine winner
  if (newStatus === 'completed') {
    const p1Score = matchData.player1.totalScore || 0;
    const p2Score = totalScore;
    
    if (p1Score > p2Score) {
      updateData.winner = 'player1';
    } else if (p2Score > p1Score) {
      updateData.winner = 'player2';
    } else {
      updateData.winner = 'tie';
    }
  }
  
  await updateDoc(matchRef, updateData);
}

// Get clips from Firestore
export async function getClips(): Promise<ClipDoc[]> {
  const clipsRef = collection(db, 'clips');
  const snapshot = await getDocs(clipsRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClipDoc));
}

// Get clip answers (for scoring) - this should eventually be server-side only
export async function getClipAnswers(): Promise<ClipAnswerDoc[]> {
  const answersRef = collection(db, 'clipAnswers');
  const snapshot = await getDocs(answersRef);
  return snapshot.docs.map(doc => doc.data() as ClipAnswerDoc);
}


