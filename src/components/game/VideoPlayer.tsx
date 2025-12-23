import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  onFirstPlayComplete?: () => void; // Called after 1st play - user can now answer
  onAllPlaysComplete?: () => void; // Called after video plays twice
  onVideoLoaded?: () => void; // Called when video metadata is loaded (for sync)
  canPlay?: boolean; // External control: should video start playing?
  className?: string;
}

export function VideoPlayer({ 
  src, 
  onFirstPlayComplete,
  onAllPlaysComplete,
  onVideoLoaded,
  canPlay = true, // Default to true for backward compatibility (practice mode)
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [currentPlay, setCurrentPlay] = useState(1);
  const [hasSignaledLoaded, setHasSignaledLoaded] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);

  const handleVideoEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newPlayCount = playCount + 1;
    setPlayCount(newPlayCount);

    if (newPlayCount === 1) {
      // First play complete - user can now answer!
      onFirstPlayComplete?.();
      // Start second play
      setCurrentPlay(2);
      video.currentTime = 0;
      video.play();
    } else if (newPlayCount >= 2) {
      // Done playing twice - lock the video
      setIsLocked(true);
      onAllPlaysComplete?.();
    }
  }, [playCount, onFirstPlayComplete, onAllPlaysComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      setIsReady(true);
      
      // Signal that video is loaded (for sync)
      if (!hasSignaledLoaded) {
        setHasSignaledLoaded(true);
        onVideoLoaded?.();
      }
      
      // Only auto-play if canPlay is true (sync allows it)
      if (canPlay && !hasStartedPlaying) {
        setHasStartedPlaying(true);
        video.play().catch(() => {
          // Autoplay failed, user needs to interact
        });
      }
    };

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleVideoEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleVideoEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [handleVideoEnded, canPlay, hasSignaledLoaded, hasStartedPlaying, onVideoLoaded]);
  
  // Start playing when canPlay becomes true (for sync mode)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady || !canPlay || hasStartedPlaying) return;
    
    console.log('Sync: Starting video playback');
    setHasStartedPlaying(true);
    video.play().catch(() => {
      // Autoplay failed
    });
  }, [canPlay, isReady, hasStartedPlaying]);

  // Reset when src changes
  useEffect(() => {
    setPlayCount(0);
    setIsLocked(false);
    setCurrentPlay(1);
    setProgress(0);
    setIsReady(false);
    setHasSignaledLoaded(false);
    setHasStartedPlaying(false);
  }, [src]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <motion.div 
      className={cn(
        "video-container relative rounded-lg overflow-hidden glow-border",
        className
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        className={cn(
          "w-full aspect-video bg-black",
          isLocked && "opacity-50"
        )}
        playsInline
        muted={isMuted}
      />

      {/* Loading overlay */}
      {(!isReady || (isReady && !canPlay)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-var-dark/80">
          <div className="animate-pulse text-var-glow">
            {!isReady ? 'Loading...' : 'Ready...'}
          </div>
        </div>
      )}

      {/* Locked overlay */}
      {isLocked && (
        <motion.div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Lock className="w-12 h-12 text-gray-400 mb-2" />
          <span className="text-gray-400 text-sm">Video locked - Make your call!</span>
        </motion.div>
      )}

      {/* Controls overlay - only show when not locked */}
      {isReady && !isLocked && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress bar */}
          <div className="w-full h-1 bg-white/20 rounded-full mb-3 overflow-hidden">
            <motion.div 
              className="h-full bg-var-glow"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <button 
              onClick={toggleMute}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Play count indicator */}
            <div className="text-sm text-white/80">
              Play {currentPlay}/2
            </div>
          </div>
        </div>
      )}

      {/* VAR label */}
      <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded text-xs font-mono text-var-glow border border-var-glow/30">
        VAR REVIEW
      </div>

      {/* Play count badge */}
      {!isLocked && isReady && (
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 rounded text-xs font-mono text-white border border-white/30">
          {currentPlay === 1 ? '1st View' : '2nd View'}
        </div>
      )}
    </motion.div>
  );
}
