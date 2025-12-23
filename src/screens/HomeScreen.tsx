import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Users, Trophy, Settings, Copy, Check, X, Loader2 } from 'lucide-react';
import { useGameStore } from '@/stores/gameStore';
import { useAuth } from '@/hooks/useAuth';
import { useClipsContext } from '@/App';
import { getPlayerName, setPlayerName } from '@/lib/utils';
import { createAsyncMatch, joinMatchByCode } from '@/lib/firestore';

type ModalType = 'none' | 'create' | 'join';

export function HomeScreen() {
  const { startPracticeMatch, startAsyncMatch } = useGameStore();
  const { userId } = useAuth();
  const { clips } = useClipsContext();
  const [name, setName] = useState(getPlayerName());
  const [showNameInput, setShowNameInput] = useState(false);
  
  // Async PvP state
  const [modalType, setModalType] = useState<ModalType>('none');
  const [shareCode, setShareCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleStartPractice = () => {
    if (name.trim()) {
      setPlayerName(name.trim());
    }
    startPracticeMatch(clips);
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (newName.trim()) {
      setPlayerName(newName.trim());
    }
  };

  const handleCreateMatch = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Get random clip IDs for the match
      const shuffled = [...clips].sort(() => Math.random() - 0.5);
      const clipIds = shuffled.slice(0, 5).map(c => c.id);
      
      const result = await createAsyncMatch(
        userId,
        name || 'Player',
        clipIds
      );
      
      setShareCode(result.shareCode);
      setModalType('create');
    } catch (err) {
      setError('Failed to create match. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinMatch = async () => {
    if (!userId || !joinCode.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const result = await joinMatchByCode(
        joinCode.trim().toUpperCase(),
        userId,
        name || 'Player'
      );
      
      if (!result) {
        setError('Match not found. Check the code and try again.');
        return;
      }
      
      // Start the async match
      startAsyncMatch(result.matchId, result.match, false, clips);
      setModalType('none');
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Cannot join your own match') {
        setError('You cannot join your own match!');
      } else {
        setError('Failed to join match. Please try again.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartAsPlayer1 = () => {
    // For now, just close the modal - in a full implementation,
    // player 1 would wait for player 2 to join, then both play
    // For MVP, we'll just let them start practice mode
    setModalType('none');
    handleStartPractice();
  };

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Logo / Title */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-5xl md:text-7xl text-white tracking-wider mb-2">
            THE VAR
          </h1>
          <h1 className="font-display text-6xl md:text-8xl text-var-glow tracking-wider">
            ROOM
          </h1>
          <p className="text-gray-400 mt-4 text-lg">Make the call. Beat your opponents.</p>
        </motion.div>

        {/* Player Name */}
        <motion.div
          className="mb-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {showNameInput ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter your name"
                className="px-4 py-2 bg-var-card border border-var-border rounded-lg focus:border-var-glow focus:outline-none text-white"
                autoFocus
                onBlur={() => setShowNameInput(false)}
                onKeyDown={(e) => e.key === 'Enter' && setShowNameInput(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowNameInput(true)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Playing as: <span className="text-var-glow font-medium">{name || 'Player'}</span>
              <Settings className="inline w-4 h-4 ml-2" />
            </button>
          )}
        </motion.div>

        {/* Game Mode Buttons */}
        <div className="flex flex-col gap-4 w-full max-w-md">
          {/* Practice vs Bot */}
          <motion.button
            onClick={handleStartPractice}
            className="group relative flex items-center gap-4 p-6 bg-var-card border-2 border-var-border rounded-xl hover:border-var-glow transition-all btn-glow"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-14 h-14 rounded-xl bg-var-glow/20 flex items-center justify-center group-hover:bg-var-glow/30 transition-colors">
              <Play className="w-7 h-7 text-var-glow" />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-xl font-bold text-white">Practice vs Bot</h3>
              <p className="text-sm text-gray-400">Play a best-of-5 match against AI</p>
            </div>
            <div className="text-var-glow opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </div>
          </motion.button>

          {/* Challenge Friend */}
          <motion.button
            onClick={() => setModalType('join')}
            className="group relative flex items-center gap-4 p-6 bg-var-card border-2 border-var-border rounded-xl hover:border-blue-500 transition-all"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <Users className="w-7 h-7 text-blue-400" />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-xl font-bold text-white">Challenge Friend</h3>
              <p className="text-sm text-gray-400">Create or join an async duel</p>
            </div>
            <div className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </div>
          </motion.button>

          {/* Leaderboard - Coming Soon */}
          <motion.button
            disabled
            className="relative flex items-center gap-4 p-6 bg-var-card border-2 border-var-border rounded-xl opacity-50 cursor-not-allowed"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 0.5, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="w-14 h-14 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-7 h-7 text-yellow-400" />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-xl font-bold text-white">Leaderboard</h3>
              <p className="text-sm text-gray-400">Coming soon - Global rankings</p>
            </div>
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">SOON</span>
          </motion.button>
        </div>
      </div>

      {/* Footer */}
      <motion.footer
        className="p-6 text-center text-gray-500 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p>Watch clips. Make calls. Beat your opponents.</p>
        <p className="mt-1 text-xs text-gray-600">v0.2.0 - Firebase Edition</p>
      </motion.footer>

      {/* Async PvP Modal */}
      <AnimatePresence>
        {modalType !== 'none' && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-var-card border border-var-border rounded-xl max-w-md w-full p-6"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Close button */}
              <button
                onClick={() => {
                  setModalType('none');
                  setError('');
                  setShareCode('');
                  setJoinCode('');
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Create Match - showing share code */}
              {modalType === 'create' && shareCode && (
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Match Created!</h2>
                  <p className="text-gray-400 mb-6">Share this code with your friend:</p>
                  
                  <div className="bg-var-elevated rounded-lg p-4 mb-6">
                    <div className="text-4xl font-mono font-bold text-var-glow tracking-widest mb-2">
                      {shareCode}
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mx-auto"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy code
                        </>
                      )}
                    </button>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-6">
                    Your friend enters this code to join. Once they join, you'll both play the same clips and compare results!
                  </p>

                  <button
                    onClick={handleStartAsPlayer1}
                    className="w-full py-3 bg-var-glow text-var-dark font-bold rounded-lg hover:bg-var-glow/90"
                  >
                    Start Playing
                  </button>
                </div>
              )}

              {/* Join Match */}
              {modalType === 'join' && !shareCode && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-center">Challenge Friend</h2>
                  
                  {/* Create new match */}
                  <button
                    onClick={handleCreateMatch}
                    disabled={isLoading}
                    className="w-full py-4 mb-4 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Create New Match'
                    )}
                  </button>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-var-border" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-var-card px-4 text-gray-500 text-sm">or join existing</span>
                    </div>
                  </div>
                  
                  {/* Join with code */}
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter 6-letter code"
                      maxLength={6}
                      className="w-full px-4 py-3 bg-var-elevated border border-var-border rounded-lg focus:border-var-glow focus:outline-none text-white text-center text-2xl font-mono tracking-widest uppercase"
                    />
                    
                    {error && (
                      <p className="text-red-400 text-sm text-center">{error}</p>
                    )}
                    
                    <button
                      onClick={handleJoinMatch}
                      disabled={isLoading || joinCode.length !== 6}
                      className="w-full py-3 bg-var-glow text-var-dark font-bold rounded-lg hover:bg-var-glow/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Join Match'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
