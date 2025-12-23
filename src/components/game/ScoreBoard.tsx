import { motion } from 'framer-motion';
import { User, Bot } from 'lucide-react';
import { Player } from '@/types/game';
import { cn } from '@/lib/utils';

interface ScoreBoardProps {
  player: Player;
  opponent: Player;
  playerScore: number;
  opponentScore: number;
  currentRound: number;
  totalRounds: number;
}

export function ScoreBoard({
  player,
  opponent,
  playerScore,
  opponentScore,
  currentRound,
  totalRounds,
}: ScoreBoardProps) {
  return (
    <div className="bg-var-card border border-var-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        {/* Player */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-var-glow/20 flex items-center justify-center">
            <User className="w-5 h-5 text-var-glow" />
          </div>
          <div>
            <div className="text-sm text-gray-400">You</div>
            <div className="font-medium truncate max-w-[100px]">{player.name}</div>
          </div>
        </div>

        {/* Scores */}
        <div className="flex items-center gap-4">
          <motion.div 
            className="scoreboard text-3xl font-bold text-var-glow"
            key={`player-${playerScore}`}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {playerScore}
          </motion.div>
          
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-500 uppercase">Round</div>
            <div className="text-lg font-mono font-bold">
              {currentRound}/{totalRounds}
            </div>
          </div>
          
          <motion.div 
            className="scoreboard text-3xl font-bold text-gray-400"
            key={`opponent-${opponentScore}`}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {opponentScore}
          </motion.div>
        </div>

        {/* Opponent */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-gray-400">
              {opponent.isBot ? 'Bot' : 'Opponent'}
            </div>
            <div className="font-medium truncate max-w-[100px]">{opponent.name}</div>
          </div>
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            opponent.isBot ? "bg-purple-500/20" : "bg-blue-500/20"
          )}>
            {opponent.isBot ? (
              <Bot className="w-5 h-5 text-purple-400" />
            ) : (
              <User className="w-5 h-5 text-blue-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact version for mobile/smaller screens
export function ScoreBoardCompact({
  player,
  opponent,
  playerScore,
  opponentScore,
  currentRound,
  totalRounds,
}: ScoreBoardProps) {
  return (
    <div className="bg-var-card border border-var-border rounded-lg px-4 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{player.name}</span>
          <motion.span 
            className="font-mono font-bold text-var-glow"
            key={`player-compact-${playerScore}`}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {playerScore}
          </motion.span>
        </div>
        
        <div className="font-mono text-gray-500">
          R{currentRound}/{totalRounds}
        </div>
        
        <div className="flex items-center gap-2">
          <motion.span 
            className="font-mono font-bold text-gray-400"
            key={`opponent-compact-${opponentScore}`}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {opponentScore}
          </motion.span>
          <span className="text-gray-400">{opponent.name}</span>
        </div>
      </div>
    </div>
  );
}

