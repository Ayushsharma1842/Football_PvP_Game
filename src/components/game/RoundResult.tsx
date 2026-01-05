import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, Zap, Loader2 } from 'lucide-react';
import { RoundResult as RoundResultType, DECISIONS } from '@/types/game';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/stores/gameStore';
import { calculateRoundScore } from '@/lib/scoring';

const AUTO_ADVANCE_SECONDS = 7;
const REVEAL_DELAY_MS = 2000; // 2 seconds to build suspense

interface RoundResultProps {
  result: RoundResultType;
  onContinue: () => void;
  isAsyncMatch?: boolean;
}

export function RoundResult({ result, onContinue, isAsyncMatch = false }: RoundResultProps) {
  const { opponentAnswers, speedBonusWindowMs } = useGameStore();
  
  const { 
    clip, 
    playerAnswer, 
    correctAnswer, 
    playerScore, 
  } = result;
  
  // For async matches, check if opponent has answered this round
  const opponentLiveAnswer = isAsyncMatch ? opponentAnswers[result.roundIndex] : null;
  const hasOpponentAnswered = isAsyncMatch ? !!opponentLiveAnswer : true;
  
  // Calculate opponent score from live answer
  const opponentScore = isAsyncMatch && opponentLiveAnswer 
    ? calculateRoundScore(
        {
          decision: opponentLiveAnswer.decision,
          responseTimeMs: opponentLiveAnswer.responseTimeMs,
          submittedAt: 0,
          timedOut: opponentLiveAnswer.timedOut,
        },
        correctAnswer,
        speedBonusWindowMs
      )
    : result.opponentScore;
  
  const opponentAnswer = isAsyncMatch && opponentLiveAnswer
    ? {
        decision: opponentLiveAnswer.decision,
        responseTimeMs: opponentLiveAnswer.responseTimeMs,
        submittedAt: 0,
        timedOut: opponentLiveAnswer.timedOut,
      }
    : result.opponentAnswer;
  
  // Phase logic:
  // - Practice: wait 2s then reveal
  // - Async with opponent answer: reveal immediately
  // - Async without opponent answer: stay in waiting
  const [phase, setPhase] = useState<'waiting' | 'revealed'>(() => {
    if (!isAsyncMatch) return 'waiting'; // Practice starts in waiting, reveals after delay
    if (hasOpponentAnswered) return 'revealed'; // Async with answer goes straight to revealed
    return 'waiting'; // Async without answer waits
  });
  
  const [timeRemaining, setTimeRemaining] = useState(AUTO_ADVANCE_SECONDS);
  const [hasSignaledReady, setHasSignaledReady] = useState(false); // Track if we've already signaled
  
  // Watch for opponent answer in async mode
  useEffect(() => {
    if (isAsyncMatch && hasOpponentAnswered && phase === 'waiting') {
      setPhase('revealed');
    }
  }, [isAsyncMatch, hasOpponentAnswered, phase]);

  // Reveal after delay (only for practice matches)
  useEffect(() => {
    if (isAsyncMatch) return; // Skip delay for async matches
    
    const timeout = setTimeout(() => {
      setPhase('revealed');
    }, REVEAL_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [isAsyncMatch]);

  // Auto-advance timer (only starts after reveal)
  useEffect(() => {
    if (phase !== 'revealed') return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0.1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [phase]);

  // Call onContinue when timer reaches 0 (only once)
  useEffect(() => {
    if (phase === 'revealed' && timeRemaining <= 0 && !hasSignaledReady) {
      setHasSignaledReady(true);
      onContinue();
    }
  }, [timeRemaining, phase, onContinue, hasSignaledReady]);

  const playerDecisionLabel = playerAnswer.decision 
    ? DECISIONS.find(d => d.value === playerAnswer.decision)?.label 
    : 'No Answer';
    
  const opponentDecisionLabel = DECISIONS.find(d => d.value === opponentAnswer.decision)?.label;
  const correctDecisionLabel = DECISIONS.find(d => d.value === correctAnswer.correctDecision)?.label;

  const progress = timeRemaining / AUTO_ADVANCE_SECONDS;

  return (
    <motion.div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="bg-var-card border border-var-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Auto-advance progress bar (only show after reveal) */}
        {phase === 'revealed' && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-var-border rounded-t-xl overflow-hidden">
            <motion.div 
              className="h-full bg-var-glow"
              initial={{ width: '100%' }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-var-border">
          <h2 className="text-xl font-bold text-center">
            {phase === 'waiting' ? 'Waiting for Opponent...' : 'Round Result'}
          </h2>
          <p className="text-gray-400 text-center text-sm mt-1">{clip.title}</p>
        </div>

        {/* Correct Answer - only show after reveal */}
        <AnimatePresence>
          {phase === 'revealed' && (
            <motion.div 
              className="p-6 bg-var-elevated border-b border-var-border"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center">
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Correct Call</div>
                <motion.div 
                  className="text-2xl font-bold text-var-glow"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                >
                  {correctDecisionLabel}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player Results */}
        <div className="p-6 grid grid-cols-2 gap-6">
          {/* Your Answer - always visible, locked state */}
          <motion.div
            className={cn(
              "p-4 rounded-lg border-2",
              phase === 'waiting' 
                ? "border-var-glow bg-var-glow/10"
                : playerScore.isCorrect
                  ? "border-green-500 bg-green-500/10"
                  : "border-red-500 bg-red-500/10"
            )}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
              Your Answer
              {phase === 'waiting' && (
                <span className="text-xs text-var-glow bg-var-glow/20 px-2 py-0.5 rounded">LOCKED</span>
              )}
            </div>
            
            {!playerAnswer.decision ? (
              <div className="flex items-center gap-2 text-red-400">
                <Clock className="w-5 h-5" />
                <span>No Answer</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {phase === 'revealed' && (
                  playerScore.isCorrect ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )
                )}
                <span className={cn(
                  "font-medium",
                  phase === 'waiting' && "text-var-glow",
                  phase === 'revealed' && playerScore.isCorrect && "text-green-400",
                  phase === 'revealed' && !playerScore.isCorrect && "text-red-400"
                )}>
                  {playerDecisionLabel}
                </span>
              </div>
            )}

            {/* Score - only show after reveal */}
            {phase === 'revealed' && (
              <motion.div 
                className="mt-4 pt-4 border-t border-white/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Points</span>
                  <motion.span 
                    className="text-2xl font-mono font-bold text-var-glow"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                  >
                    +{playerScore.points}
                  </motion.span>
                </div>
                {playerScore.speedBonus > 0 && (
                  <div className="flex items-center gap-1 text-sm text-yellow-400 mt-1">
                    <Zap className="w-4 h-4" />
                    <span>Speed bonus: +{playerScore.speedBonus}</span>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Opponent Answer */}
          <motion.div
            className={cn(
              "p-4 rounded-lg border-2",
              phase === 'waiting' || (isAsyncMatch && !hasOpponentAnswered)
                ? "border-var-border bg-var-card"
                : opponentScore.isCorrect
                  ? "border-green-500 bg-green-500/10"
                  : "border-red-500 bg-red-500/10"
            )}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-sm text-gray-400 mb-3">Opponent</div>
            
            {isAsyncMatch && !hasOpponentAnswered ? (
              // Async match: waiting for opponent
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Waiting for answer...</span>
              </div>
            ) : phase === 'waiting' ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Thinking...</span>
              </div>
            ) : (
              <motion.div 
                className="flex items-center gap-2"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring" }}
              >
                {opponentScore.isCorrect ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <X className="w-5 h-5 text-red-400" />
                )}
                <span className={cn(
                  "font-medium",
                  opponentScore.isCorrect ? "text-green-400" : "text-red-400"
                )}>
                  {opponentDecisionLabel}
                </span>
              </motion.div>
            )}

            {/* Score - show after reveal when opponent has answered */}
            {phase === 'revealed' && hasOpponentAnswered && (
              <motion.div 
                className="mt-4 pt-4 border-t border-white/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Points</span>
                  <motion.span 
                    className="text-2xl font-mono font-bold text-gray-400"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                  >
                    +{opponentScore.points}
                  </motion.span>
                </div>
                {opponentScore.speedBonus > 0 && (
                  <div className="flex items-center gap-1 text-sm text-yellow-400 mt-1">
                    <Zap className="w-4 h-4" />
                    <span>Speed bonus: +{opponentScore.speedBonus}</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Async match waiting: show info text */}
            {isAsyncMatch && !hasOpponentAnswered && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500">
                  Will reveal when opponent answers
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Explanation - only show after reveal */}
        <AnimatePresence>
          {phase === 'revealed' && (
            <motion.div 
              className="px-6 pb-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-var-elevated rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Explanation</h4>
                <ul className="space-y-1">
                  {clip.explanationBullets.map((bullet, i) => (
                    <motion.li 
                      key={i}
                      className="text-sm text-gray-300 flex items-start gap-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                    >
                      <span className="text-var-glow mt-1">•</span>
                      {bullet}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Footer */}
        <div className="p-6 border-t border-var-border">
          {phase === 'waiting' ? (
            // Waiting for opponent to answer
            <div className="w-full py-3 px-6 bg-var-card border border-var-border text-gray-500 font-bold rounded-lg text-center flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Waiting for opponent...
            </div>
          ) : hasSignaledReady ? (
            // Timer expired, waiting for opponent to also be ready
            <div className="w-full py-3 px-6 bg-var-card border border-var-border text-gray-500 font-bold rounded-lg text-center flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Waiting for opponent to continue...
            </div>
          ) : (
            // Both answered - show countdown to next round
            <div className="w-full py-3 px-6 bg-var-card border border-var-border text-gray-400 font-medium rounded-lg text-center">
              Next round in {Math.ceil(Math.max(0, timeRemaining))}s...
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
