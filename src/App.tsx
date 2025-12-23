import { createContext, useContext } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useAuth } from '@/hooks/useAuth';
import { useClips } from '@/hooks/useClips';
import { HomeScreen } from '@/screens/HomeScreen';
import { GameScreen } from '@/screens/GameScreen';
import { ResultsScreen } from '@/screens/ResultsScreen';
import { ClipWithAnswer } from '@/types/game';

// Context for clips data
interface ClipsContextType {
  clips: ClipWithAnswer[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const ClipsContext = createContext<ClipsContextType | null>(null);

export function useClipsContext() {
  const context = useContext(ClipsContext);
  if (!context) {
    throw new Error('useClipsContext must be used within ClipsProvider');
  }
  return context;
}

function App() {
  const { currentScreen } = useGameStore();
  const { isLoading: authLoading } = useAuth();
  const { clips, isLoading: clipsLoading, refetch } = useClips();

  // Show loading while Firebase auth and clips initialize
  if (authLoading || clipsLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-var-glow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">
            {authLoading ? 'Connecting...' : 'Loading clips...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error if no clips loaded
  if (clips.length === 0) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <p className="text-red-400 mb-4">No clips found in database.</p>
          <p className="text-gray-400 text-sm">
            Please add clips to Firebase Firestore to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClipsContext.Provider value={{ clips, isLoading: clipsLoading, refetch }}>
      {currentScreen === 'home' && <HomeScreen />}
      {currentScreen === 'game' && <GameScreen />}
      {currentScreen === 'results' && <ResultsScreen />}
    </ClipsContext.Provider>
  );
}

export default App;
