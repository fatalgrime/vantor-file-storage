'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { VantorFile } from '../../lib/types';

interface MediaViewerProps {
  file: VantorFile;
  isAudio: boolean;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ file, isAudio }) => {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  useEffect(() => {
    let objectUrl = '';

    if (file.content) {
      if (file.content.startsWith('data:')) {
        setMediaUrl(file.content);
      } else {
        const base64Parts = file.content.split(',');
        const base64Data = base64Parts[1] || base64Parts[0];
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const mime = file.mimeType || (isAudio ? 'audio/mpeg' : 'video/mp4');
        const blob = new Blob([bytes], { type: mime });
        objectUrl = URL.createObjectURL(blob);
        setMediaUrl(objectUrl);
      }
    } else if (file.url) {
      setMediaUrl(file.url);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file.content, file.url, file.mimeType, isAudio]);

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
    } else {
      mediaRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
      setDuration(mediaRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (mediaRef.current) {
      mediaRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!mediaRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    mediaRef.current.muted = nextMute;
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!mediaUrl) {
    return (
      <div className="flex items-center justify-center p-8 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-500 text-xs font-mono">
        Loading media source...
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="flex flex-col space-y-4 w-full bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={mediaUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />

        <div className="flex items-center space-x-4">
          <button
            onClick={togglePlay}
            className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-all shadow-lg shadow-blue-950/40 flex-shrink-0"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          <div className="flex-grow flex flex-col space-y-1.5">
            <span className="font-mono text-xs font-semibold text-slate-200 truncate">{file.name}</span>
            <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="flex-grow h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800/80">
          <button onClick={toggleMute} className="text-slate-400 hover:text-slate-200">
            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center bg-slate-950/60 rounded-xl border border-slate-800 p-2 shadow-xl">
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        src={mediaUrl}
        controls
        className="max-h-[55vh] max-w-full rounded-lg shadow-2xl"
      />
    </div>
  );
};
