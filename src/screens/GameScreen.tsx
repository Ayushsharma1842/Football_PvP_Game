import { useEffect, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import { useTimer } from '@/hooks/useTimer';
import { GAME_CONFIG } from '@/types/game';
import { VideoPlayer } from '@/components/game/VideoPlayer';
import { DecisionPanel } from '@/components/game/DecisionPanel';
import { CountdownTimer } from '@/components/game/CountdownTimer';
import { ScoreBoard } from '@/components/game/ScoreBoard';
import { RoundResult } from '@/components/game/RoundResult';

export function GameScreen() {
  const {
    match,
    selectedDecision,
    selectDecision,
    submitAnswer,
    handleTimeout,
    nextRound,
    getCurrentClip,
    startAnswerWindow,
  } = useGameStore();

  const currentClip = getCurrentClip();
  
  // Track video playback state
  const [canAnswer, setCanAnswer] = useState(false); // After 1st play
  const [videoLocked, setVideoLocked] = useState(false); // After 2nd play

  // Timer for answering - starts after 1st play ends
  // Window = 2nd play duration + 10 seconds answer time
  const totalAnswerWindow = (currentClip?.durationSec || 15) + GAME_CONFIG.ANSWER_TIME_SECONDS;
  
  const {
    timeRemaining,
    isRunning,
    start: startTimer,
    reset: resetTimer,
  } = useTimer({
    duration: totalAnswerWindow,
    onComplete: handleTimeout,
    autoStart: false,
  });

  // Called when 1st play ends - user can now answer!
  const handleFirstPlayComplete = useCallback(() => {
    if (currentClip) {
      setCanAnswer(true);
      startTimer();
      startAnswerWindow(currentClip.durationSec); // Track in store for scoring
    }
  }, [startTimer, startAnswerWindow, currentClip]);

  // Called when 2nd play ends - video locks
  const handleAllPlaysComplete = useCallback(() => {
    setVideoLocked(true);
  }, []);

  // Reset when round changes
  useEffect(() => {
    if (match?.status === 'playing') {
      setCanAnswer(false);
      setVideoLocked(false);
      resetTimer();
    }
  }, [match?.currentRoundIndex, match?.status, resetTimer]);

  // Handle submit button click
  const handleSubmit = () => {
    if (selectedDecision && canAnswer) {
      submitAnswer();
    }
  };

  if (!match || !currentClip) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  const lastRoundResult = match.roundResults[match.roundResults.length - 1];

  // Determine phase for timer display
  const getTimerPhase = () => {
    if (!canAnswer) return 'watching';
    if (videoLocked) return 'answering';
    return 'answering'; // During 2nd play, still answering phase
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Show round result overlay */}
      {match.status === 'round_result' && lastRoundResult && (
        <RoundResult result={lastRoundResult} onContinue={nextRound} />
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Scoreboard */}
        <ScoreBoard
          player={match.player}
          opponent={match.opponent}
          playerScore={match.playerTotalScore}
          opponentScore={match.opponentTotalScore}
          currentRound={match.currentRoundIndex + 1}
          totalRounds={match.clipSet.length}
        />

        {/* Video + Timer Row */}
        <div className="flex gap-6 items-start">
          {/* Video Player */}
          <div className="flex-1">
            <VideoPlayer
              key={currentClip.id}
              src={currentClip.videoUrl}
              onFirstPlayComplete={handleFirstPlayComplete}
              onAllPlaysComplete={handleAllPlaysComplete}
            />
            
            {/* Clip Info */}
            <div className="mt-3 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white">{currentClip.title}</h3>
                <p className="text-sm text-gray-400">
                  Difficulty: {'⭐'.repeat(currentClip.difficulty)}
                </p>
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="flex-shrink-0">
            <CountdownTimer
              timeRemaining={timeRemaining}
              totalTime={totalAnswerWindow}
              phase={getTimerPhase()}
            />
          </div>
        </div>

        {/* Status Message */}
        {!canAnswer && (
          <motion.div
            className="text-center py-4 bg-var-card border border-var-border rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-blue-400">
              👀 Watch the clip carefully...
            </p>
            <p className="text-sm text-gray-500 mt-1">
              You can answer after the first viewing
            </p>
          </motion.div>
        )}

        {canAnswer && !selectedDecision && (
          <motion.div
            className="text-center py-4 bg-green-900/30 border border-green-500/30 rounded-lg"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-green-400">
              ⚡ You can answer now! Submit fast for speed bonus!
            </p>
          </motion.div>
        )}

        {/* Decision Panel - enabled after 1st play */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DecisionPanel
            selected={selectedDecision}
            onSelect={selectDecision}
            disabled={!canAnswer || match.status !== 'playing'}
          />
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={handleSubmit}
            disabled={!selectedDecision || !canAnswer || match.status !== 'playing'}
            className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
              selectedDecision && canAnswer && match.status === 'playing'
                ? 'bg-var-glow text-var-dark hover:bg-var-glow/90 btn-glow'
                : 'bg-var-card text-gray-500 cursor-not-allowed border border-var-border'
            }`}
          >
            {!canAnswer
              ? 'Watch the clip first...' 
              : !selectedDecision 
              ? 'Select your call'
              : '⚡ Submit Answer'}
          </button>
          
          {selectedDecision && canAnswer && isRunning && (
            <p className="text-center text-sm text-yellow-400 mt-2">
              ⚡ Submit now for max speed bonus! ({timeRemaining.toFixed(0)}s remaining)
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
