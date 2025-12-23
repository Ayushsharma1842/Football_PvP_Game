import { motion } from 'framer-motion';
import { Check, Flag, CreditCard, CheckCircle } from 'lucide-react';
import { GiWhistle, GiSoccerKick } from 'react-icons/gi';
import { Decision, DECISIONS } from '@/types/game';
import { cn } from '@/lib/utils';

interface DecisionPanelProps {
  selected: Decision | null;
  onSelect: (decision: Decision) => void;
  disabled?: boolean;
}

const DECISION_ICONS: Record<Decision, React.ReactNode> = {
  no_foul: <CheckCircle className="w-6 h-6" />,
  foul_no_card: <GiWhistle className="w-6 h-6" />,
  penalty: <GiSoccerKick className="w-6 h-6" />,
  offside: <Flag className="w-6 h-6" />,
  yellow_card: <CreditCard className="w-6 h-6" />,
  red_card: <CreditCard className="w-6 h-6" />,
};

const DECISION_COLORS: Record<Decision, { hover: string; selected: string }> = {
  no_foul: {
    hover: 'hover:border-green-500 hover:bg-green-500/10',
    selected: 'border-green-500 bg-green-500/20 text-green-400',
  },
  foul_no_card: {
    hover: 'hover:border-blue-500 hover:bg-blue-500/10',
    selected: 'border-blue-500 bg-blue-500/20 text-blue-400',
  },
  penalty: {
    hover: 'hover:border-red-500 hover:bg-red-500/10',
    selected: 'border-red-500 bg-red-500/20 text-red-400',
  },
  offside: {
    hover: 'hover:border-orange-500 hover:bg-orange-500/10',
    selected: 'border-orange-500 bg-orange-500/20 text-orange-400',
  },
  yellow_card: {
    hover: 'hover:border-yellow-500 hover:bg-yellow-500/10',
    selected: 'border-yellow-500 bg-yellow-500/20 text-yellow-400',
  },
  red_card: {
    hover: 'hover:border-red-600 hover:bg-red-600/10',
    selected: 'border-red-600 bg-red-600/20 text-red-400',
  },
};

export function DecisionPanel({ selected, onSelect, disabled }: DecisionPanelProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Make Your Call
      </h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {DECISIONS.map((decision, index) => {
          const isSelected = selected === decision.value;
          const colors = DECISION_COLORS[decision.value];
          
          return (
            <motion.button
              key={decision.value}
              onClick={() => !disabled && onSelect(decision.value)}
              disabled={disabled}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 p-4 rounded-lg",
                "border-2 transition-all duration-200",
                "bg-var-card border-var-border",
                disabled && "opacity-50 cursor-not-allowed",
                !disabled && !isSelected && colors.hover,
                isSelected && colors.selected,
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={!disabled ? { scale: 1.02 } : undefined}
              whileTap={!disabled ? { scale: 0.98 } : undefined}
            >
              {/* Card icon for yellow/red */}
              {(decision.value === 'yellow_card' || decision.value === 'red_card') ? (
                <div 
                  className={cn(
                    "w-8 h-10 rounded-sm",
                    decision.value === 'yellow_card' && "bg-gradient-to-br from-yellow-400 to-yellow-600",
                    decision.value === 'red_card' && "bg-gradient-to-br from-red-500 to-red-700",
                  )}
                  style={{
                    boxShadow: decision.value === 'yellow_card' 
                      ? '0 2px 8px rgba(250, 204, 21, 0.4)' 
                      : '0 2px 8px rgba(239, 68, 68, 0.4)'
                  }}
                />
              ) : (
                DECISION_ICONS[decision.value]
              )}
              
              <span className="text-sm font-medium text-center">{decision.label}</span>
              
              {/* Selection indicator */}
              {isSelected && (
                <motion.div
                  className="absolute -top-1 -right-1 w-5 h-5 bg-var-glow rounded-full flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <Check className="w-3 h-3 text-var-dark" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
