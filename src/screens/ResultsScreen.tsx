import { motion } from 'framer-motion';
import { Trophy, Medal, RotateCcw, Home, Check, X, Zap, Clock, Copy } from 'lucide-react';
import { useGameStore } from '@/stores/gameStore';
import { useClipsContext } from '@/App';
import { determineWinner } from '@/lib/scoring';
import { DECISIONS } from '@/types/game';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function ResultsScreen() {
  const { match, resetGame, startPracticeMatch, opponentAnswers, opponentTotalScoreLive } = useGameStore();
  const { clips } = useClipsContext();
  const [copied, setCopied] = useState(false);
  
  // Debug logging
  console.log('=== RESULTS SCREEN DEBUG ===');
  console.log('opponentAnswers:', opponentAnswers);
  console.log('opponentAnswers.length:', opponentAnswers?.length);
  console.log('opponentTotalScoreLive:', opponentTotalScoreLive);
  console.log('match.opponentTotalScore:', match?.opponentTotalScore);

  const handleCopyLink = () => {
    if (match?.shareCode) {
      const link = `${window.location.origin}?code=${match.shareCode}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!match) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <p className="text-gray-400">No match data</p>
      </div>
    );
  }

  const isAsyncMatch = match.mode === 'async';
  const totalRounds = match.clipSet.length;
  
  // For async matches, check if opponent has actually finished all rounds
  const opponentFinished = isAsyncMatch 
    ? opponentAnswers.length >= totalRounds 
    : true; // Practice mode: bot always "finished"
  
  const isWaitingForOpponent = isAsyncMatch && !opponentFinished;

  // Use live opponent score for async matches
  const actualOpponentScore = isAsyncMatch ? opponentTotalScoreLive : match.opponentTotalScore;

  const winner = determineWinner(match.playerTotalScore, actualOpponentScore);
  const playerWon = winner === 'player';
  const isTie = winner === 'tie';

  // Count correct answers
  const playerCorrect = match.roundResults.filter(r => r.playerScore.isCorrect).length;
  
  // For async matches, count opponent correct from opponentAnswers
  const opponentCorrect = isAsyncMatch
    ? opponentAnswers.filter((a, i) => {
        const clip = match.clipSet[i];
        return clip && a.decision === clip.correctDecision;
      }).length
    : match.roundResults.filter(r => r.opponentScore.isCorrect).length;

  return (
    <div className="min-h-screen gradient-bg p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Victory/Defeat Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            {isWaitingForOpponent ? (
              <Clock className="w-20 h-20 mx-auto text-blue-400 mb-4" />
            ) : playerWon ? (
              <Trophy className="w-20 h-20 mx-auto text-yellow-400 mb-4" />
            ) : isTie ? (
              <Medal className="w-20 h-20 mx-auto text-gray-400 mb-4" />
            ) : (
              <Medal className="w-20 h-20 mx-auto text-gray-500 mb-4" />
            )}
          </motion.div>
          
          <h1 className={cn(
            "font-display text-5xl md:text-7xl tracking-wider",
            isWaitingForOpponent && "text-blue-400",
            !isWaitingForOpponent && playerWon && "text-yellow-400",
            !isWaitingForOpponent && isTie && "text-gray-400",
            !isWaitingForOpponent && !playerWon && !isTie && "text-gray-500"
          )}>
            {isWaitingForOpponent ? 'CHALLENGE SENT!' : playerWon ? 'VICTORY!' : isTie ? 'DRAW' : 'DEFEAT'}
          </h1>
          
          <p className="text-gray-400 mt-2">
            {isWaitingForOpponent 
              ? "Waiting for your friend to play..." 
              : playerWon 
              ? (isAsyncMatch ? "You beat your friend!" : "You outperformed the bot!")
              : isTie 
              ? "Evenly matched!" 
              : (isAsyncMatch ? "Your friend beat you!" : "The bot got the better of you this time")}
          </p>
        </motion.div>
        
        {/* Share code for async match (Player 1 waiting) */}
        {isWaitingForOpponent && match.shareCode && (
          <motion.div
            className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-6 mb-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <p className="text-gray-300 mb-3">Share this code with your friend:</p>
            <div className="text-4xl font-mono font-bold text-blue-400 tracking-widest mb-4">
              {match.shareCode}
            </div>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Invite Link
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Final Score Card */}
        <motion.div
          className="bg-var-card border border-var-border rounded-xl p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between">
            {/* Player */}
            <div className="text-center flex-1">
              <div className="text-sm text-gray-400 mb-1">You</div>
              <div className="font-medium text-lg mb-2">{match.player.name}</div>
              <motion.div 
                className="text-4xl md:text-5xl font-mono font-bold text-var-glow"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                {match.playerTotalScore}
              </motion.div>
              <div className="text-sm text-gray-500 mt-1">
                {playerCorrect}/{match.roundResults.length} correct
              </div>
            </div>

            {/* VS */}
            <div className="px-6">
              <div className="text-2xl text-gray-600 font-bold">VS</div>
            </div>

            {/* Opponent */}
            <div className="text-center flex-1">
              <div className="text-sm text-gray-400 mb-1">
                {isAsyncMatch ? 'Friend' : 'Bot'}
              </div>
              <div className="font-medium text-lg mb-2">{match.opponent.name}</div>
              {isWaitingForOpponent ? (
                <div className="text-2xl text-gray-500 py-4">
                  Waiting...
                </div>
              ) : (
                <>
                  <motion.div 
                    className="text-4xl md:text-5xl font-mono font-bold text-gray-400"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6, type: "spring" }}
                  >
                    {actualOpponentScore}
                  </motion.div>
                  <div className="text-sm text-gray-500 mt-1">
                    {opponentCorrect}/{totalRounds} correct
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Round-by-Round Breakdown */}
        <motion.div
          className="bg-var-card border border-var-border rounded-xl overflow-hidden mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="p-4 border-b border-var-border">
            <h3 className="font-bold">Round Breakdown</h3>
          </div>
          
          <div className="divide-y divide-var-border">
            {match.roundResults.map((result, index) => {
              const playerDecision = result.playerAnswer.decision 
                ? DECISIONS.find(d => d.value === result.playerAnswer.decision)?.shortLabel 
                : 'None';
              const correctDecision = DECISIONS.find(d => d.value === result.correctAnswer.correctDecision)?.shortLabel;
              
              // For async matches, get opponent answer from opponentAnswers array
              const opponentAnswer = isAsyncMatch ? opponentAnswers[index] : null;
              const opponentDecision = isAsyncMatch
                ? (opponentAnswer?.decision 
                    ? DECISIONS.find(d => d.value === opponentAnswer.decision)?.shortLabel 
                    : (isWaitingForOpponent ? '...' : 'None'))
                : DECISIONS.find(d => d.value === result.opponentAnswer.decision)?.shortLabel || 'None';
              
              const clip = match.clipSet[index];
              const opponentIsCorrect = isAsyncMatch
                ? (opponentAnswer?.decision === clip?.correctDecision)
                : result.opponentScore.isCorrect;

              return (
                <motion.div
                  key={index}
                  className="p-4 grid grid-cols-12 gap-4 items-center text-sm"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                >
                  {/* Round number */}
                  <div className="col-span-1 text-gray-500 font-mono">
                    R{index + 1}
                  </div>

                  {/* Clip title */}
                  <div className="col-span-3 text-gray-400 truncate">
                    {result.clip.title}
                  </div>

                  {/* Correct answer */}
                  <div className="col-span-2 text-center">
                    <div className="text-xs text-gray-500">Correct</div>
                    <div className="text-var-glow font-medium">{correctDecision}</div>
                  </div>

                  {/* Player answer */}
                  <div className="col-span-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {result.playerScore.isCorrect ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-400" />
                      )}
                      <span className={cn(
                        result.playerScore.isCorrect ? "text-green-400" : "text-red-400"
                      )}>
                        {playerDecision}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                      <span>+{result.playerScore.points}</span>
                      {result.playerScore.speedBonus > 0 && (
                        <span className="text-yellow-400 flex items-center">
                          <Zap className="w-3 h-3" />
                          {result.playerScore.speedBonus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Opponent answer */}
                  <div className="col-span-3 text-center">
                    {isWaitingForOpponent && !opponentAnswer ? (
                      <span className="text-gray-500">...</span>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-1">
                          {opponentIsCorrect ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <X className="w-4 h-4 text-red-400" />
                          )}
                          <span className={cn(
                            opponentIsCorrect ? "text-green-400" : "text-red-400"
                          )}>
                            {opponentDecision}
                          </span>
                        </div>
                        {isAsyncMatch && opponentAnswer && (
                          <div className="text-xs text-gray-500">
                            +{opponentIsCorrect ? 100 : 0}
                          </div>
                        )}
                        {!isAsyncMatch && (
                          <div className="text-xs text-gray-500">
                            +{result.opponentScore.points}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="flex gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <button
            onClick={() => startPracticeMatch(clips)}
            className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-var-glow text-var-dark font-bold rounded-xl hover:bg-var-glow/90 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Play Again
          </button>
          
          <button
            onClick={resetGame}
            className="flex items-center justify-center gap-2 py-4 px-6 bg-var-card border border-var-border text-white font-bold rounded-xl hover:bg-var-elevated transition-colors"
          >
            <Home className="w-5 h-5" />
            Home
          </button>
        </motion.div>
      </div>
    </div>
  );
}
