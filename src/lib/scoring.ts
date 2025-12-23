import { PlayerAnswer, ClipAnswer, RoundScore, GAME_CONFIG } from '@/types/game';

/**
 * Calculate the score for a single round
 * @param playerAnswer - The player's answer
 * @param correctAnswer - The correct answer
 * @param speedBonusWindowMs - Optional custom speed bonus window (default from config)
 */
export function calculateRoundScore(
  playerAnswer: PlayerAnswer,
  correctAnswer: ClipAnswer,
  speedBonusWindowMs: number = GAME_CONFIG.SPEED_BONUS_WINDOW_MS
): RoundScore {
  // If no answer selected, score is 0
  if (!playerAnswer.decision) {
    return {
      points: 0,
      isCorrect: false,
      speedBonus: 0,
    };
  }

  const isCorrect = playerAnswer.decision === correctAnswer.correctDecision;

  let points = 0;
  let speedBonus = 0;

  if (isCorrect) {
    // Full points + speed bonus
    points = GAME_CONFIG.BASE_POINTS;
    
    // Speed bonus: max 50 points, scaled by response time
    // Faster response = higher bonus
    const timeRatio = Math.min(1, playerAnswer.responseTimeMs / speedBonusWindowMs);
    speedBonus = Math.max(0, Math.round(GAME_CONFIG.MAX_SPEED_BONUS * (1 - timeRatio)));
    points += speedBonus;
  }

  return {
    points,
    isCorrect,
    speedBonus,
  };
}

/**
 * Calculate total score from all rounds
 */
export function calculateTotalScore(roundScores: RoundScore[]): number {
  return roundScores.reduce((total, round) => total + round.points, 0);
}

/**
 * Determine match winner
 */
export function determineWinner(
  playerScore: number,
  opponentScore: number
): 'player' | 'opponent' | 'tie' {
  if (playerScore > opponentScore) return 'player';
  if (opponentScore > playerScore) return 'opponent';
  return 'tie';
}

/**
 * Get score breakdown text for UI
 */
export function getScoreBreakdown(score: RoundScore): string {
  if (score.points === 0) {
    return 'Incorrect - 0 pts';
  }
  
  if (score.speedBonus > 0) {
    return `Correct! ${GAME_CONFIG.BASE_POINTS} + ${score.speedBonus} speed bonus = ${score.points} pts`;
  }
  return `Correct! ${score.points} pts`;
}
