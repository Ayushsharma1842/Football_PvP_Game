import { 
  PlayerAnswer, 
  ClipWithAnswer, 
  Decision, 
  DECISIONS 
} from '@/types/game';

/**
 * Generate a bot answer for a clip
 * Bot accuracy scales inversely with clip difficulty
 */
export function generateBotAnswer(clip: ClipWithAnswer): PlayerAnswer {
  // Bot accuracy: 80% on difficulty 1, down to 40% on difficulty 5
  const baseAccuracy = 0.9;
  const difficultyPenalty = 0.1;
  const accuracy = baseAccuracy - (clip.difficulty * difficultyPenalty);
  
  const isCorrect = Math.random() < accuracy;
  
  let decision: Decision;
  
  if (isCorrect) {
    decision = clip.correctDecision;
  } else {
    // Pick a random wrong answer
    decision = getRandomWrongDecision(clip.correctDecision);
  }
  
  // Bot response time: 2-7 seconds (faster on easier clips)
  const baseTime = 2000;
  const variableTime = 3000 + (clip.difficulty * 400);
  const responseTimeMs = baseTime + Math.random() * variableTime;
  
  return {
    decision,
    responseTimeMs: Math.round(responseTimeMs),
    submittedAt: Date.now(),
    timedOut: false,
  };
}

/**
 * Get a random wrong decision
 */
function getRandomWrongDecision(correct: Decision): Decision {
  const wrongOptions = DECISIONS
    .map(d => d.value)
    .filter(d => d !== correct);
  
  return wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
}

/**
 * Simulate bot "thinking" delay
 */
export function simulateBotThinking(responseTimeMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, responseTimeMs));
}
