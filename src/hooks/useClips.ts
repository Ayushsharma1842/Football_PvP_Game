import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ClipWithAnswer, Decision } from '@/types/game';

interface ClipDoc {
  videoUrl: string;
  title: string;
  difficulty: number;
  durationSec: number;
  explanationBullets: string[];
  correctDecision: Decision;
}

interface UseClipsReturn {
  clips: ClipWithAnswer[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useClips(): UseClipsReturn {
  const [clips, setClips] = useState<ClipWithAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClips = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const clipsRef = collection(db, 'clips');
      const snapshot = await getDocs(clipsRef);
      
      const fetchedClips: ClipWithAnswer[] = snapshot.docs.map(doc => {
        const data = doc.data() as ClipDoc;
        return {
          id: doc.id,
          videoUrl: data.videoUrl,
          title: data.title,
          difficulty: data.difficulty as 1 | 2 | 3 | 4 | 5,
          durationSec: data.durationSec,
          explanationBullets: data.explanationBullets,
          correctDecision: data.correctDecision,
        };
      });
      
      setClips(fetchedClips);
    } catch (err) {
      console.error('Failed to fetch clips:', err);
      setError('Failed to load clips');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  return {
    clips,
    isLoading,
    error,
    refetch: fetchClips,
  };
}

// Helper to get random clips from an array
export function getRandomClipsFromArray(clips: ClipWithAnswer[], count: number): ClipWithAnswer[] {
  const shuffled = [...clips].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Helper to get clips by IDs
export function getClipsByIdsFromArray(clips: ClipWithAnswer[], ids: string[]): ClipWithAnswer[] {
  return ids
    .map(id => clips.find(clip => clip.id === id))
    .filter((clip): clip is ClipWithAnswer => clip !== undefined);
}

