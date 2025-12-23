import { create } from 'zustand';
import { 
  MatchState, 
  Player, 
  ClipWithAnswer, 
  PlayerAnswer, 
  RoundResult,
  Decision,
  GAME_CONFIG,
  ScreenType,
} from '@/types/game';
import { calculateRoundScore } from '@/lib/scoring';
import { generateBotAnswer } from '@/lib/bot';
import { getPlayerId, getPlayerName, getRandomBotName, generateShareCode } from '@/lib/utils';
import { FirestoreMatch } from '@/lib/firestore';
import { getRandomClipsFromArray, getClipsByIdsFromArray } from '@/hooks/useClips';

interface GameStore {
  // Navigation
  currentScreen: ScreenType;
  setScreen: (screen: ScreenType) => void;

  // Match state
  match: MatchState | null;
  firestoreMatchId: string | null; // For async matches
  isPlayer1: boolean; // For async matches
  
  // Current round state
  selectedDecision: Decision | null;
  answerWindowStartTime: number | null; // When user CAN start answering (after 1st play)
  speedBonusWindowMs: number; // Dynamic based on clip duration
  
  // Actions
  startPracticeMatch: (clips: ClipWithAnswer[]) => void;
  startAsyncMatch: (matchId: string, firestoreMatch: FirestoreMatch, isPlayer1: boolean, clips: ClipWithAnswer[]) => void;
  startAnswerWindow: (clipDurationSec: number) => void; // Called when 1st play ends
  selectDecision: (decision: Decision) => void;
  submitAnswer: () => void;
  handleTimeout: () => void;
  nextRound: () => void;
  resetGame: () => void;
  
  // Computed
  getCurrentClip: () => ClipWithAnswer | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  currentScreen: 'home',
  match: null,
  firestoreMatchId: null,
  isPlayer1: true,
  selectedDecision: null,
  answerWindowStartTime: null,
  speedBonusWindowMs: GAME_CONFIG.SPEED_BONUS_WINDOW_MS,

  setScreen: (screen) => set({ currentScreen: screen }),

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

    // Get clips by IDs from the match
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
      currentScreen: 'game',
      selectedDecision: null,
      answerWindowStartTime: null,
    });
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
      shareCode: generateShareCode(),
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
    const { match, selectedDecision, answerWindowStartTime, speedBonusWindowMs } = get();
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

    // Generate bot answer
    const opponentAnswer = generateBotAnswer(currentClip);

    // Calculate scores with dynamic speed bonus window
    const correctAnswer = {
      clipId: currentClip.id,
      correctDecision: currentClip.correctDecision,
    };

    const playerScore = calculateRoundScore(playerAnswer, correctAnswer, speedBonusWindowMs);
    const opponentScore = calculateRoundScore(opponentAnswer, correctAnswer, speedBonusWindowMs);

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
        opponentTotalScore: match.opponentTotalScore + opponentScore.points,
      },
      selectedDecision: null,
      answerWindowStartTime: null,
    });
  },

  handleTimeout: () => {
    const { match, selectedDecision, answerWindowStartTime, speedBonusWindowMs } = get();
    if (!match) return;
    
    // Don't process timeout if answer was already submitted
    if (match.status !== 'playing') return;

    const currentClip = match.clipSet[match.currentRoundIndex];

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

      const opponentAnswer = generateBotAnswer(currentClip);

      const correctAnswer = {
        clipId: currentClip.id,
        correctDecision: currentClip.correctDecision,
      };

      const playerScore = calculateRoundScore(playerAnswer, correctAnswer, speedBonusWindowMs);
      const opponentScore = calculateRoundScore(opponentAnswer, correctAnswer, speedBonusWindowMs);

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
          opponentTotalScore: match.opponentTotalScore + opponentScore.points,
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

      const opponentAnswer = generateBotAnswer(currentClip);

      const correctAnswer = {
        clipId: currentClip.id,
        correctDecision: currentClip.correctDecision,
      };

      const playerScore = calculateRoundScore(playerAnswer, correctAnswer, speedBonusWindowMs);
      const opponentScore = calculateRoundScore(opponentAnswer, correctAnswer, speedBonusWindowMs);

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
          opponentTotalScore: match.opponentTotalScore + opponentScore.points,
        },
        selectedDecision: null,
        answerWindowStartTime: null,
      });
    }
  },

  nextRound: () => {
    const { match } = get();
    if (!match) return;

    const nextIndex = match.currentRoundIndex + 1;
    
    if (nextIndex >= match.clipSet.length) {
      // Match complete
      set({
        match: { ...match, status: 'completed' },
        currentScreen: 'results',
      });
    } else {
      // Next round
      set({
        match: {
          ...match,
          status: 'playing',
          currentRoundIndex: nextIndex,
        },
        selectedDecision: null,
        answerWindowStartTime: null,
      });
    }
  },

  resetGame: () => {
    set({
      currentScreen: 'home',
      match: null,
      firestoreMatchId: null,
      isPlayer1: true,
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
