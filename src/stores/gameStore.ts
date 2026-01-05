import { create } from 'zustand';
import { 
  MatchState, 
  Player, 
  ClipWithAnswer, 
  PlayerAnswer, 
  RoundResult,
  RoundScore,
  Decision,
  GAME_CONFIG,
  ScreenType,
} from '@/types/game';
import { calculateRoundScore } from '@/lib/scoring';
import { generateBotAnswer } from '@/lib/bot';
import { getPlayerId, getPlayerName, getRandomBotName } from '@/lib/utils';
import { 
  FirestoreMatch, 
  submitRoundAnswer, 
  subscribeToMatch, 
  PlayerAnswerDoc,
  signalVideoReady,
  signalReadyForNextRound,
} from '@/lib/firestore';
import { getRandomClipsFromArray, getClipsByIdsFromArray } from '@/hooks/useClips';

// Sync state from Firebase
interface SyncState {
  currentRound: number;
  roundState: 'loading' | 'playing' | 'answering' | 'results' | 'completed';
  player1VideoReady: boolean;
  player2VideoReady: boolean;
  player1ReadyForNext: boolean;
  player2ReadyForNext: boolean;
  roundStartTime: number | null;
}

interface GameStore {
  // Navigation
  currentScreen: ScreenType;
  setScreen: (screen: ScreenType) => void;

  // Match state
  match: MatchState | null;
  firestoreMatchId: string | null; // For async matches
  isPlayer1: boolean; // For async matches
  
  // Real-time sync state (for multiplayer)
  syncState: SyncState | null;
  opponentAnswers: PlayerAnswerDoc[]; // Live opponent answers from Firebase
  opponentTotalScoreLive: number; // Live opponent score
  matchUnsubscribe: (() => void) | null; // Cleanup function for Firebase subscription
  videoReady: boolean; // Has local video loaded?
  
  // Current round state
  selectedDecision: Decision | null;
  answerWindowStartTime: number | null; // When user CAN start answering (after 1st play)
  speedBonusWindowMs: number; // Dynamic based on clip duration
  
  // Actions
  startPracticeMatch: (clips: ClipWithAnswer[]) => void;
  startAsyncMatch: (matchId: string, firestoreMatch: FirestoreMatch, isPlayer1: boolean, clips: ClipWithAnswer[]) => void;
  subscribeToMatchUpdates: () => void; // Subscribe to match sync state
  signalVideoLoaded: () => void; // Signal that video is ready
  startAnswerWindow: (clipDurationSec: number) => void; // Called when 1st play ends
  selectDecision: (decision: Decision) => void;
  submitAnswer: () => void;
  handleTimeout: () => void;
  nextRound: () => void;
  resetGame: () => void;
  
  // Computed
  getCurrentClip: () => ClipWithAnswer | null;
  getOpponentAnswerForRound: (roundIndex: number) => PlayerAnswerDoc | null;
  canPlayVideo: () => boolean; // Both players ready?
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  currentScreen: 'home',
  match: null,
  firestoreMatchId: null,
  isPlayer1: true,
  syncState: null,
  opponentAnswers: [],
  opponentTotalScoreLive: 0,
  matchUnsubscribe: null,
  videoReady: false,
  selectedDecision: null,
  answerWindowStartTime: null,
  speedBonusWindowMs: GAME_CONFIG.SPEED_BONUS_WINDOW_MS,

  setScreen: (screen) => set({ currentScreen: screen }),
  
  // Get opponent's answer for a specific round (if they've submitted it)
  getOpponentAnswerForRound: (roundIndex: number) => {
    const { opponentAnswers } = get();
    return opponentAnswers[roundIndex] || null;
  },
  
  // Check if both players are ready to play video
  canPlayVideo: () => {
    const { match, syncState } = get();
    if (!match || match.mode !== 'async') return true; // Practice mode always can play
    if (!syncState) return false;
    return syncState.roundState === 'playing' && syncState.roundStartTime !== null;
  },
  
  // Signal that local video has loaded
  signalVideoLoaded: () => {
    const { firestoreMatchId, isPlayer1, match } = get();
    if (!firestoreMatchId || !match || match.mode !== 'async') {
      // Practice mode - just mark ready locally
      set({ videoReady: true });
      return;
    }
    
    set({ videoReady: true });
    signalVideoReady(firestoreMatchId, isPlayer1).catch(err => {
      console.error('Failed to signal video ready:', err);
    });
  },
  
  // Subscribe to match updates for sync
  subscribeToMatchUpdates: () => {
    const { firestoreMatchId, isPlayer1 } = get();
    if (!firestoreMatchId) return;
    
    const unsubscribe = subscribeToMatch(firestoreMatchId, (firebaseMatch) => {
      if (!firebaseMatch) return;
      
      const { match: localMatch, syncState: currentSync } = get();
      
      // Update sync state
      if (firebaseMatch.sync) {
        const newSync = firebaseMatch.sync;
        
        // Detect round advancement from Firebase
        if (localMatch && currentSync && newSync.currentRound > currentSync.currentRound) {
          set({
            match: {
              ...localMatch,
              status: 'playing',
              currentRoundIndex: newSync.currentRound,
            },
            selectedDecision: null,
            answerWindowStartTime: null,
            videoReady: false,
          });
        }
        
        // Detect match completion
        if (newSync.roundState === 'completed' && localMatch?.status !== 'completed') {
          set({
            match: localMatch ? { ...localMatch, status: 'completed' } : null,
            currentScreen: 'results',
          });
        }
        
        set({ syncState: newSync });
      }
      
      // Update opponent answers
      const opponentKey = isPlayer1 ? 'player2' : 'player1';
      const opponentData = firebaseMatch[opponentKey];
      
      console.log('=== OPPONENT DATA UPDATE ===');
      console.log('Looking for:', opponentKey);
      console.log('Opponent data from Firebase:', opponentData);
      console.log('Opponent answers raw:', opponentData?.answers);
      console.log('Opponent totalScore:', opponentData?.totalScore);
      
      if (opponentData) {
        // Handle both array and object formats from Firestore
        let newAnswers = opponentData.answers || [];
        
        // Firestore can return arrays as objects with numeric keys
        if (newAnswers && !Array.isArray(newAnswers)) {
          console.log('Converting object to array...');
          newAnswers = Object.values(newAnswers);
        }
        
        const newScore = opponentData.totalScore || 0;
        
        console.log('Processed answers:', newAnswers);
        console.log('Processed score:', newScore);
        
        const { opponentAnswers: currentAnswers, opponentTotalScoreLive: currentScore } = get();
        
        // Update if answers changed or score changed
        if (newAnswers.length !== currentAnswers.length || newScore !== currentScore) {
          console.log('*** UPDATING OPPONENT DATA ***');
          set({ 
            opponentAnswers: newAnswers,
            opponentTotalScoreLive: newScore,
          });
        }
      }
    });
    
    set({ matchUnsubscribe: unsubscribe });
  },

  startAsyncMatch: (matchId: string, firestoreMatch: FirestoreMatch, isPlayer1: boolean, clips: ClipWithAnswer[]) => {
    const player: Player = {
      id: isPlayer1 ? firestoreMatch.player1.uid : firestoreMatch.player2!.uid,
      name: isPlayer1 ? firestoreMatch.player1.name : firestoreMatch.player2!.name,
      isBot: false,
    };

    const opponent: Player = {
      id: isPlayer1 ? (firestoreMatch.player2?.uid || 'waiting') : firestoreMatch.player1.uid,
      name: isPlayer1 ? (firestoreMatch.player2?.name || 'Waiting...') : firestoreMatch.player1.name,
      isBot: false,
    };

    // Get clips by IDs from the match - SAME clips for both players!
    // The clipIds are stored in Firebase when match is created
    // Both players fetch the SAME clipIds, ensuring identical clip order
    const clipSet = getClipsByIdsFromArray(clips, firestoreMatch.clipIds);

    const match: MatchState = {
      id: matchId,
      mode: 'async',
      status: 'playing',
      player,
      opponent,
      clipSet,
      currentRoundIndex: 0,
      roundResults: [],
      playerTotalScore: 0,
      opponentTotalScore: 0,
      shareCode: firestoreMatch.shareCode,
      createdAt: firestoreMatch.createdAt?.toMillis?.() || Date.now(),
    };

    set({ 
      match, 
      firestoreMatchId: matchId,
      isPlayer1,
      opponentAnswers: [],
      opponentTotalScoreLive: 0,
      currentScreen: 'game',
      selectedDecision: null,
      answerWindowStartTime: null,
    });
    
    // Subscribe to match updates (sync + opponent answers)
    get().subscribeToMatchUpdates();
  },

  startPracticeMatch: (clips: ClipWithAnswer[]) => {
    const player: Player = {
      id: getPlayerId(),
      name: getPlayerName(),
      isBot: false,
    };

    const opponent: Player = {
      id: 'bot-' + crypto.randomUUID(),
      name: getRandomBotName(),
      isBot: true,
    };

    const clipSet = getRandomClipsFromArray(clips, GAME_CONFIG.ROUNDS_PER_MATCH);

    const match: MatchState = {
      id: crypto.randomUUID(),
      mode: 'practice',
      status: 'playing',
      player,
      opponent,
      clipSet,
      currentRoundIndex: 0,
      roundResults: [],
      playerTotalScore: 0,
      opponentTotalScore: 0,
      shareCode: '', // Practice matches don't need share codes
      createdAt: Date.now(),
    };

    set({ 
      match, 
      currentScreen: 'game',
      selectedDecision: null,
      answerWindowStartTime: null,
    });
  },

  // Called when 1st play ends - answer window opens
  startAnswerWindow: (clipDurationSec: number) => {
    // Speed bonus window = 2nd play duration + answer time
    const speedBonusWindowMs = (clipDurationSec + GAME_CONFIG.ANSWER_TIME_SECONDS) * 1000;
    set({ 
      answerWindowStartTime: Date.now(),
      speedBonusWindowMs,
    });
  },

  selectDecision: (decision) => {
    set({ selectedDecision: decision });
  },

  submitAnswer: () => {
    const { match, selectedDecision, answerWindowStartTime, speedBonusWindowMs, firestoreMatchId, isPlayer1 } = get();
    if (!match || !selectedDecision) return;

    const currentClip = match.clipSet[match.currentRoundIndex];
    
    // Response time from when answer window opened (after 1st play)
    const responseTimeMs = answerWindowStartTime 
      ? Date.now() - answerWindowStartTime 
      : speedBonusWindowMs;

    // Create player answer
    const playerAnswer: PlayerAnswer = {
      decision: selectedDecision,
      responseTimeMs,
      submittedAt: Date.now(),
      timedOut: false,
    };

    // Calculate scores with dynamic speed bonus window
    const correctAnswer = {
      clipId: currentClip.id,
      correctDecision: currentClip.correctDecision,
    };

    const playerScore = calculateRoundScore(playerAnswer, correctAnswer, speedBonusWindowMs);

    // For async matches: save answer to Firebase immediately!
    if (match.mode === 'async' && firestoreMatchId) {
      submitRoundAnswer(firestoreMatchId, isPlayer1, match.currentRoundIndex, {
        clipId: currentClip.id,
        decision: selectedDecision,
        responseTimeMs,
        timedOut: false,
        score: playerScore.points,
      }).catch(err => console.error('Failed to save round answer:', err));
    }

    // For async matches: opponent plays separately, no bot answer
    // For practice matches: generate bot answer
    let opponentAnswer: PlayerAnswer;
    let opponentScore: RoundScore;
    
    if (match.mode === 'async') {
      // Async: opponent hasn't answered yet (they play separately)
      opponentAnswer = {
        decision: null,
        responseTimeMs: 0,
        submittedAt: 0,
        timedOut: false,
      };
      opponentScore = { points: 0, speedBonus: 0, isCorrect: false };
    } else {
      // Practice: generate bot answer
      opponentAnswer = generateBotAnswer(currentClip);
      opponentScore = calculateRoundScore(opponentAnswer, correctAnswer, speedBonusWindowMs);
    }

    // Create round result
    const roundResult: RoundResult = {
      roundIndex: match.currentRoundIndex,
      clip: currentClip,
      playerAnswer,
      opponentAnswer,
      correctAnswer,
      playerScore,
      opponentScore,
    };

    // Update match state
    set({
      match: {
        ...match,
        status: 'round_result',
        roundResults: [...match.roundResults, roundResult],
        playerTotalScore: match.playerTotalScore + playerScore.points,
        opponentTotalScore: match.mode === 'async' ? 0 : match.opponentTotalScore + opponentScore.points,
      },
      selectedDecision: null,
      answerWindowStartTime: null,
    });
  },

  handleTimeout: () => {
    const { match, selectedDecision, answerWindowStartTime, speedBonusWindowMs, firestoreMatchId, isPlayer1 } = get();
    if (!match) return;
    
    // Don't process timeout if answer was already submitted
    if (match.status !== 'playing') return;

    const currentClip = match.clipSet[match.currentRoundIndex];

    const correctAnswer = {
      clipId: currentClip.id,
      correctDecision: currentClip.correctDecision,
    };

    // If something is selected, auto-submit it
    if (selectedDecision) {
      const responseTimeMs = answerWindowStartTime 
        ? Date.now() - answerWindowStartTime 
        : speedBonusWindowMs;

      const playerAnswer: PlayerAnswer = {
        decision: selectedDecision,
        responseTimeMs,
        submittedAt: Date.now(),
        timedOut: true, // Mark as timed out but still has answer
      };

      const playerScore = calculateRoundScore(playerAnswer, correctAnswer, speedBonusWindowMs);

      // For async matches: save to Firebase immediately
      if (match.mode === 'async' && firestoreMatchId) {
        submitRoundAnswer(firestoreMatchId, isPlayer1, match.currentRoundIndex, {
          clipId: currentClip.id,
          decision: selectedDecision,
          responseTimeMs,
          timedOut: true,
          score: playerScore.points,
        }).catch(err => console.error('Failed to save round answer:', err));
      }

      // For async matches: opponent plays separately, no bot answer
      let opponentAnswer: PlayerAnswer;
      let opponentScore: RoundScore;
      
      if (match.mode === 'async') {
        opponentAnswer = {
          decision: null,
          responseTimeMs: 0,
          submittedAt: 0,
          timedOut: false,
        };
        opponentScore = { points: 0, speedBonus: 0, isCorrect: false };
      } else {
        opponentAnswer = generateBotAnswer(currentClip);
        opponentScore = calculateRoundScore(opponentAnswer, correctAnswer, speedBonusWindowMs);
      }

      const roundResult: RoundResult = {
        roundIndex: match.currentRoundIndex,
        clip: currentClip,
        playerAnswer,
        opponentAnswer,
        correctAnswer,
        playerScore,
        opponentScore,
      };

      set({
        match: {
          ...match,
          status: 'round_result',
          roundResults: [...match.roundResults, roundResult],
          playerTotalScore: match.playerTotalScore + playerScore.points,
          opponentTotalScore: match.mode === 'async' ? 0 : match.opponentTotalScore + opponentScore.points,
        },
        selectedDecision: null,
        answerWindowStartTime: null,
      });
    } else {
      // No selection - create timed-out answer with no decision
      const playerAnswer: PlayerAnswer = {
        decision: null,
        responseTimeMs: speedBonusWindowMs,
        submittedAt: Date.now(),
        timedOut: true,
      };

      const playerScore = calculateRoundScore(playerAnswer, correctAnswer, speedBonusWindowMs);

      // For async matches: save to Firebase immediately
      if (match.mode === 'async' && firestoreMatchId) {
        submitRoundAnswer(firestoreMatchId, isPlayer1, match.currentRoundIndex, {
          clipId: currentClip.id,
          decision: null,
          responseTimeMs: speedBonusWindowMs,
          timedOut: true,
          score: 0,
        }).catch(err => console.error('Failed to save round answer:', err));
      }

      // For async matches: opponent plays separately, no bot answer
      let opponentAnswer: PlayerAnswer;
      let opponentScore: RoundScore;
      
      if (match.mode === 'async') {
        opponentAnswer = {
          decision: null,
          responseTimeMs: 0,
          submittedAt: 0,
          timedOut: false,
        };
        opponentScore = { points: 0, speedBonus: 0, isCorrect: false };
      } else {
        opponentAnswer = generateBotAnswer(currentClip);
        opponentScore = calculateRoundScore(opponentAnswer, correctAnswer, speedBonusWindowMs);
      }

      const roundResult: RoundResult = {
        roundIndex: match.currentRoundIndex,
        clip: currentClip,
        playerAnswer,
        opponentAnswer,
        correctAnswer,
        playerScore,
        opponentScore,
      };

      set({
        match: {
          ...match,
          status: 'round_result',
          roundResults: [...match.roundResults, roundResult],
          playerTotalScore: match.playerTotalScore + playerScore.points,
          opponentTotalScore: match.mode === 'async' ? 0 : match.opponentTotalScore + opponentScore.points,
        },
        selectedDecision: null,
        answerWindowStartTime: null,
      });
    }
  },

  nextRound: async () => {
    const { match, firestoreMatchId, isPlayer1 } = get();
    if (!match) return;

    // For async matches, signal ready for next round - don't advance locally!
    // The local state will be updated when Firebase sync changes
    if (match.mode === 'async' && firestoreMatchId) {
      try {
        await signalReadyForNextRound(firestoreMatchId, isPlayer1);
      } catch (error) {
        console.error('Failed to signal ready for next round:', error);
      }
      return; // Don't advance locally - wait for Firebase
    }

    // For practice matches, advance locally
    const nextIndex = match.currentRoundIndex + 1;
    
    if (nextIndex >= match.clipSet.length) {
      // Match complete
      set({
        match: { ...match, status: 'completed' },
        currentScreen: 'results',
        videoReady: false,
      });
    } else {
      // Next round - reset video ready state
      set({
        match: {
          ...match,
          status: 'playing',
          currentRoundIndex: nextIndex,
        },
        selectedDecision: null,
        answerWindowStartTime: null,
        videoReady: false, // Reset for next round
      });
    }
  },

  resetGame: () => {
    // Clean up Firebase subscription
    const { matchUnsubscribe } = get();
    if (matchUnsubscribe) {
      matchUnsubscribe();
    }
    
    set({
      currentScreen: 'home',
      match: null,
      firestoreMatchId: null,
      isPlayer1: true,
      syncState: null,
      opponentAnswers: [],
      opponentTotalScoreLive: 0,
      matchUnsubscribe: null,
      videoReady: false,
      selectedDecision: null,
      answerWindowStartTime: null,
    });
  },

  getCurrentClip: () => {
    const { match } = get();
    if (!match) return null;
    return match.clipSet[match.currentRoundIndex] || null;
  },
}));
