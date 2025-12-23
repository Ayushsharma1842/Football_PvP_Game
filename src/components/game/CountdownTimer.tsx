import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  timeRemaining: number;
  totalTime: number;
  phase: 'watching' | 'answering' | 'locked';
  watchLockRemaining?: number;
}

export function CountdownTimer({ 
  timeRemaining, 
  totalTime, 
  phase,
}: CountdownTimerProps) {
  const progress = timeRemaining / totalTime;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference * (1 - progress);
  
  const isUrgent = timeRemaining <= 3 && phase === 'answering';
  const isWatching = phase === 'watching';
  
  return (
    <div className="relative w-28 h-28">
      {/* Background circle */}
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-var-border"
        />
        
        {/* Progress circle - only show during answering phase */}
        {!isWatching && (
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              "transition-colors duration-300",
              !isUrgent && "text-var-glow",
              isUrgent && "text-red-500",
              phase === 'locked' && "text-gray-500",
            )}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.1 }}
          />
        )}
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isWatching ? (
          <>
            <Eye className="w-6 h-6 text-blue-400 mb-1" />
            <span className="text-xs text-blue-400 uppercase tracking-wider">Watching</span>
          </>
        ) : phase === 'locked' ? (
          <span className="text-sm text-gray-400 uppercase">Locked</span>
        ) : (
          <>
            <span className={cn(
              "text-xs uppercase tracking-wider",
              isUrgent ? "text-red-400" : "text-var-glow"
            )}>
              Time
            </span>
            <motion.span 
              className={cn(
                "text-2xl font-mono font-bold",
                isUrgent ? "text-red-400" : "text-var-glow"
              )}
              key={Math.ceil(timeRemaining)}
              initial={{ scale: 1.2, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {timeRemaining.toFixed(1)}
            </motion.span>
          </>
        )}
      </div>
      
      {/* Urgent pulse animation */}
      {isUrgent && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-red-500"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
          }}
        />
      )}
    </div>
  );
}
