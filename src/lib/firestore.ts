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
  status: 'waiting_for_p2' | 'playing' | 'completed';
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
  
  // Sync state for real-time multiplayer
  sync?: {
    currentRound: number;
    roundState: 'loading' | 'playing' | 'answering' | 'results' | 'completed';
    player1VideoReady: boolean;
    player2VideoReady: boolean;
    player1ReadyForNext: boolean;
    player2ReadyForNext: boolean;
    roundStartTime: number | null; // Timestamp when video should start
  };
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
  
  // Update match with player 2 and initialize sync state
  await updateDoc(matchDoc.ref, {
    'player2.uid': userId,
    'player2.name': playerName,
    'status': 'playing',
    'sync': {
      currentRound: 0,
      roundState: 'loading',
      player1VideoReady: false,
      player2VideoReady: false,
      player1ReadyForNext: false,
      player2ReadyForNext: false,
      roundStartTime: null,
    },
  });
  
  // Return updated match data with player2 included
  const updatedMatch: FirestoreMatch = {
    ...matchData,
    id: matchDoc.id,
    player2: {
      uid: userId,
      name: playerName,
    },
    status: 'playing',
    sync: {
      currentRound: 0,
      roundState: 'loading',
      player1VideoReady: false,
      player2VideoReady: false,
      player1ReadyForNext: false,
      player2ReadyForNext: false,
      roundStartTime: null,
    },
  };
  
  return { 
    matchId: matchDoc.id, 
    match: updatedMatch,
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
  
  let newStatus: 'playing' | 'completed' = matchData.status === 'completed' ? 'completed' : 'playing';
  
  // Only mark as completed when player 2 finishes
  if (!isPlayer1) {
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

// Submit a single round answer immediately (for real-time comparison)
export async function submitRoundAnswer(
  matchId: string,
  isPlayer1: boolean,
  roundIndex: number,
  answer: {
    clipId: string;
    decision: Decision | null;
    responseTimeMs: number;
    timedOut: boolean;
    score: number;
  }
): Promise<void> {
  const matchRef = doc(db, 'matches', matchId);
  const playerKey = isPlayer1 ? 'player1' : 'player2';
  
  // Get current match data
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) {
    throw new Error('Match not found');
  }
  
  const matchData = matchSnap.data() as FirestoreMatch;
  const currentAnswers = matchData[playerKey]?.answers || [];
  
  // Create the new answer object
  // NOTE: Can't use serverTimestamp() inside arrays, so we use Date.now()
  const newAnswer: PlayerAnswerDoc = {
    clipId: answer.clipId,
    decision: answer.decision,
    responseTimeMs: answer.responseTimeMs,
    submittedAt: Timestamp.fromMillis(Date.now()),
    timedOut: answer.timedOut,
  };
  
  // Update answers array and running score
  const updatedAnswers = [...currentAnswers];
  updatedAnswers[roundIndex] = newAnswer;
  
  const currentScore = matchData[playerKey]?.totalScore || 0;
  const newTotalScore = currentScore + answer.score;
  
  await updateDoc(matchRef, {
    [`${playerKey}.answers`]: updatedAnswers,
    [`${playerKey}.totalScore`]: newTotalScore,
  });
}

// ==========================================
// SYNC FUNCTIONS FOR REAL-TIME MULTIPLAYER
// ==========================================

// Signal that player's video is loaded and ready
export async function signalVideoReady(
  matchId: string,
  isPlayer1: boolean
): Promise<void> {
  const matchRef = doc(db, 'matches', matchId);
  const playerKey = isPlayer1 ? 'player1VideoReady' : 'player2VideoReady';
  
  // First, update this player's ready state
  await updateDoc(matchRef, {
    [`sync.${playerKey}`]: true,
  });
  
  // Now read the updated state to check if both are ready
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) return;
  
  const matchData = matchSnap.data() as FirestoreMatch;
  const sync = matchData.sync;
  
  if (!sync) return;
  
  // Check if BOTH players are now ready
  if (sync.player1VideoReady && sync.player2VideoReady && sync.roundState === 'loading') {
    // Both ready! Set the start time and change state to playing
    await updateDoc(matchRef, {
      'sync.roundState': 'playing',
      'sync.roundStartTime': Date.now(),
    });
  }
}

// Update round state (for transitioning between phases)
export async function updateRoundState(
  matchId: string,
  newState: 'loading' | 'playing' | 'answering' | 'results'
): Promise<void> {
  const matchRef = doc(db, 'matches', matchId);
  await updateDoc(matchRef, {
    'sync.roundState': newState,
  });
}

// Signal that player is ready for next round (done viewing results)
export async function signalReadyForNextRound(
  matchId: string,
  isPlayer1: boolean
): Promise<void> {
  const matchRef = doc(db, 'matches', matchId);
  const playerKey = isPlayer1 ? 'player1ReadyForNext' : 'player2ReadyForNext';
  
  // First, update this player's ready state
  await updateDoc(matchRef, {
    [`sync.${playerKey}`]: true,
  });
  
  // Now read the updated state to check if both are ready
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) return;
  
  const matchData = matchSnap.data() as FirestoreMatch;
  const sync = matchData.sync;
  
  if (!sync) return;
  
  // Check if BOTH players are now ready for next round
  const bothReady = sync.player1ReadyForNext && sync.player2ReadyForNext;
  
  if (bothReady) {
    const nextRoundIndex = sync.currentRound + 1;
    const totalRounds = matchData.clipIds.length;
    
    if (nextRoundIndex >= totalRounds) {
      // Match complete
      await updateDoc(matchRef, {
        'status': 'completed',
        'sync.roundState': 'completed',
      });
    } else {
      // Move to next round - reset all ready states
      await updateDoc(matchRef, {
        'sync.currentRound': nextRoundIndex,
        'sync.roundState': 'loading',
        'sync.player1VideoReady': false,
        'sync.player2VideoReady': false,
        'sync.player1ReadyForNext': false,
        'sync.player2ReadyForNext': false,
        'sync.roundStartTime': null,
      });
    }
  }
}

// Advance to next round (reset ready states) - kept for backward compatibility
export async function advanceToNextRound(
  matchId: string,
  nextRoundIndex: number,
  totalRounds: number
): Promise<void> {
  const matchRef = doc(db, 'matches', matchId);
  
  if (nextRoundIndex >= totalRounds) {
    // Match complete
    await updateDoc(matchRef, {
      'status': 'completed',
      'sync.roundState': 'completed',
    });
  } else {
    // Move to next round
    await updateDoc(matchRef, {
      'sync.currentRound': nextRoundIndex,
      'sync.roundState': 'loading',
      'sync.player1VideoReady': false,
      'sync.player2VideoReady': false,
      'sync.player1ReadyForNext': false,
      'sync.player2ReadyForNext': false,
      'sync.roundStartTime': null,
    });
  }
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


