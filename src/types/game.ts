// Core game types for The VAR Room

// Simplified single-click decisions
export type Decision = 
  | 'no_foul'
  | 'foul_no_card'
  | 'penalty' 
  | 'offside' 
  | 'yellow_card'
  | 'red_card';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Clip {
  id: string;
  videoUrl: string;
  title: string;
  difficulty: Difficulty;
  durationSec: number;
  explanationBullets: string[];
}

export interface ClipAnswer {
  clipId: string;
  correctDecision: Decision;
}

export interface ClipWithAnswer extends Clip {
  correctDecision: Decision;
}

export interface PlayerAnswer {
  decision: Decision | null;
  responseTimeMs: number;
  submittedAt: number;
  timedOut: boolean;
}

export interface RoundScore {
  points: number;
  isCorrect: boolean;
  speedBonus: number;
}

export interface RoundResult {
  roundIndex: number;
  clip: Clip;
  playerAnswer: PlayerAnswer;
  opponentAnswer: PlayerAnswer;
  correctAnswer: ClipAnswer;
  playerScore: RoundScore;
  opponentScore: RoundScore;
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
}

export interface MatchState {
  id: string;
  mode: 'practice' | 'async';
  status: 'setup' | 'playing' | 'round_result' | 'completed';
  player: Player;
  opponent: Player;
  clipSet: ClipWithAnswer[];
  currentRoundIndex: number;
  roundResults: RoundResult[];
  playerTotalScore: number;
  opponentTotalScore: number;
  shareCode?: string;
  createdAt: number;
}

export interface GamePhase {
  phase: 'watching' | 'answering' | 'locked';
  watchLockRemaining: number;
  answerTimeRemaining: number;
}

// UI State types
export type ScreenType = 'home' | 'game' | 'results';

export interface DecisionOption {
  value: Decision;
  label: string;
  shortLabel: string;
  color: string;
}

// Simplified decision options - single click
export const DECISIONS: DecisionOption[] = [
  { value: 'no_foul', label: 'No Foul', shortLabel: 'No Foul', color: 'green' },
  { value: 'foul_no_card', label: 'Foul (No Card)', shortLabel: 'Foul', color: 'blue' },
  { value: 'penalty', label: 'Penalty', shortLabel: 'Penalty', color: 'red' },
  { value: 'offside', label: 'Offside', shortLabel: 'Offside', color: 'orange' },
  { value: 'yellow_card', label: 'Yellow Card', shortLabel: 'Yellow', color: 'yellow' },
  { value: 'red_card', label: 'Red Card', shortLabel: 'Red', color: 'red' },
];

// Game configuration
export const GAME_CONFIG = {
  ROUNDS_PER_MATCH: 5,
  ANSWER_TIME_SECONDS: 10, // Extra time after 2nd play ends
  BASE_POINTS: 100,
  MAX_SPEED_BONUS: 50,
  // Speed bonus window = clip duration (2nd play) + answer time
  // Set dynamically, this is the fallback/max
  SPEED_BONUS_WINDOW_MS: 25000, // ~15s clip + 10s answer time
} as const;
