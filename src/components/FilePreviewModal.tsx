'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  Lock, 
  Globe, 
  Users, 
  ShieldAlert, 
  Calendar, 
  User, 
  HardDrive, 
  Tag, 
  Eye, 
  Code,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Search,
  ChevronLeft,
  ChevronRight,
  Music,
  Video,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { VantorFile, UserRole, VantorFolder, VantorRepository } from '../lib/types';
import { canReadItem, ALL_USER_ROLES } from '../lib/authorization';
import { PdfViewer } from './PdfViewer';

interface FilePreviewModalProps {
  file: VantorFile | null;
  onClose: () => void;
  onDownload: (file: VantorFile) => void;
  role: UserRole;
  userId: string;
  allFolders: VantorFolder[];
  repository: VantorRepository | undefined;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDownload,
  role,
  userId,
  allFolders,
  repository,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'details' | 'security'>('preview');
  
  // Image Viewer States
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Audio Player States
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string>('');

  // CSV States
  const [csvSearch, setCsvSearch] = useState('');
  const [csvPage, setCsvPage] = useState(0);
  const [csvRowsPerPage] = useState(10);

  // Code Copy State
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!file) return;
    
    // Reset states on file change
    setZoom(1);
    setRotation(0);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setCsvSearch('');
    setCsvPage(0);
    setCodeCopied(false);

    const isAudio = file.mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(file.extension);
    const isVideo = file.mimeType.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(file.extension);
    
    if ((isAudio || isVideo) && file.content) {
      let url = '';
      if (file.content.startsWith('data:')) {
        url = file.content;
      } else {
        try {
          const base64Data = file.content.split(',')[1] || file.content;
          const binaryString = window.atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: file.mimeType });
          url = URL.createObjectURL(blob);
        } catch {
          const blob = new Blob([file.content], { type: file.mimeType });
          url = URL.createObjectURL(blob);
        }
      }
      setMediaUrl(url);
      return () => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      };
    }
  }, [file]);

  if (!file) return null;

  const canDownload = canReadItem(role, userId, file, allFolders, repository);

  const handleCopyLink = () => {
    const fakeUrl = `${window.location.origin}/share/${file.id}`;
    navigator.clipboard.writeText(fakeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Audio Handlers
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error("Playback failed", e));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = parseFloat(e.target.value);
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const vol = parseFloat(e.target.value);
      audioRef.current.volume = vol;
      setVolume(vol);
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const mute = !isMuted;
      audioRef.current.muted = mute;
      setIsMuted(mute);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // CSV Parser
  const parseCSV = (content: string) => {
    if (!content) return { headers: [], rows: [] };
    const lines = content.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      const delimiter = file.extension === 'tsv' ? '\t' : ',';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };
    
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  };

  // Code Syntax Highlighter
  const highlightCode = (code: string) => {
    if (!code) return <span className="text-slate-500">// Empty file</span>;
    const keywords = ['const', 'let', 'var', 'function', 'return', 'import', 'export', 'from', 'class', 'default', 'extends', 'if', 'else', 'for', 'while', 'try', 'catch', 'def', 'import', 'as', 'with', 'public', 'private', 'interface', 'type', 'string', 'number', 'boolean', 'any'];
    const lines = code.split('\n');
    
    return lines.map((line, idx) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        return (
          <div key={idx} className="table-row">
            <span className="table-cell select-none text-right pr-4 text-slate-600 font-mono text-[10px] w-8">{idx + 1}</span>
            <span className="table-cell text-slate-500 font-mono text-xs whitespace-pre">{line}</span>
          </div>
        );
      }
      
      const words = line.split(/(\s+|=|\+|-|\*|\/|\(|\)|\{|\}|\[|\]|;|,|\.|\"|\')/);
      let inDoubleQuote = false;
      let inSingleQuote = false;
      
      const lineSpan = words.map((token, wIdx) => {
        if (token === '"') {
          inDoubleQuote = !inDoubleQuote;
          return <span key={wIdx} className="text-emerald-400">"</span>;
        }
        if (token === "'") {
          inSingleQuote = !inSingleQuote;
          return <span key={wIdx} className="text-emerald-400">'</span>;
        }
        if (inDoubleQuote || inSingleQuote) {
          return <span key={wIdx} className="text-emerald-400">{token}</span>;
        }
        if (keywords.includes(token)) {
          return <span key={wIdx} className="text-pink-500 font-semibold">{token}</span>;
        }
        if (/^\d+$/.test(token)) {
          return <span key={wIdx} className="text-amber-400">{token}</span>;
        }
        if (['=', '+', '-', '*', '/', '=>', '==', '===', '!=', '!==', '<', '>', '&&', '||'].includes(token)) {
          return <span key={wIdx} className="text-cyan-400">{token}</span>;
        }
        return <span key={wIdx}>{token}</span>;
      });

      return (
        <div key={idx} className="table-row hover:bg-slate-900/40">
          <span className="table-cell select-none text-right pr-4 text-slate-600 font-mono text-[10px] w-8">{idx + 1}</span>
          <span className="table-cell text-slate-300 font-mono text-xs whitespace-pre">{lineSpan}</span>
        </div>
      );
    });
  };

  // Markdown Parser
  const parseInlineMarkdown = (text: string) => {
    let parts: (string | React.ReactNode)[] = [text];
    
    // Bold **text**
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      const regex = /\*\*(.*?)\*\*/g;
      const subparts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          subparts.push(part.substring(lastIndex, match.index));
        }
        subparts.push(<strong className="font-bold text-white" key={match.index}>{match[1]}</strong>);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < part.length) {
        subparts.push(part.substring(lastIndex));
      }
      return subparts;
    });

    // Italic *text*
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      const regex = /\*(.*?)\*/g;
      const subparts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          subparts.push(part.substring(lastIndex, match.index));
        }
        subparts.push(<em className="italic text-slate-200" key={match.index}>{match[1]}</em>);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < part.length) {
        subparts.push(part.substring(lastIndex));
      }
      return subparts;
    });

    // Inline Code `code`
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      const regex = /`(.*?)`/g;
      const subparts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          subparts.push(part.substring(lastIndex, match.index));
        }
        subparts.push(<code className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-amber-300 font-mono" key={match.index}>{match[1]}</code>);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < part.length) {
        subparts.push(part.substring(lastIndex));
      }
      return subparts;
    });

    return parts;
  };

  const parseMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeLines: string[] = [];
    
    return lines.map((line, index) => {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const content = codeLines.join('\n');
          codeLines = [];
          return (
            <pre key={index} className="bg-[#040813] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-amber-300 my-3 overflow-x-auto">
              <code>{content}</code>
            </pre>
          );
        } else {
          inCodeBlock = true;
          return null;
        }
      }
      
      if (inCodeBlock) {
        codeLines.push(line);
        return null;
      }
      
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-xl font-bold text-white border-b border-slate-800 pb-1 mt-5 mb-2.5">{parseInlineMarkdown(line.slice(2))}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-lg font-bold text-slate-100 mt-4 mb-2">{parseInlineMarkdown(line.slice(3))}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-base font-bold text-slate-200 mt-3 mb-1">{parseInlineMarkdown(line.slice(4))}</h3>;
      }
      
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={index} className="list-disc ml-5 text-slate-300 my-1 font-sans">
            {parseInlineMarkdown(line.trim().slice(2))}
          </li>
        );
      }
      
      if (/^\d+\.\s/.test(line.trim())) {
        const match = line.trim().match(/^(\d+)\.\s(.*)/);
        return (
          <li key={index} className="list-decimal ml-5 text-slate-300 my-1 font-sans">
            {parseInlineMarkdown(match ? match[2] : line)}
          </li>
        );
      }
      
      if (!line.trim()) {
        return <div key={index} className="h-3" />;
      }
      
      return (
        <p key={index} className="text-slate-300 leading-relaxed text-sm my-2 font-sans">
          {parseInlineMarkdown(line)}
        </p>
      );
    }).filter(Boolean);
  };

  const handleCopyCode = () => {
    if (file.content) {
      navigator.clipboard.writeText(file.content);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const renderContentPreview = () => {
    // 1. Image Viewer with Zoom / Rotate
    if (file.mimeType.startsWith('image/') && file.content?.startsWith('data:')) {
      return (
        <div className="flex flex-col space-y-4 items-center w-full">
          {/* Controls Bar */}
          <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 rounded-lg px-4 py-1.5 text-xs text-slate-300">
            <button 
              onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
              disabled={zoom <= 0.25}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="font-mono min-w-[48px] text-center">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(z => Math.min(3, z + 0.25))}
              disabled={zoom >= 3.0}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-slate-800"></div>
            <button 
              onClick={() => setRotation(r => (r + 90) % 360)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors flex items-center space-x-1"
              title="Rotate Right"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button 
              onClick={() => { setZoom(1); setRotation(0); }}
              className="p-1 hover:bg-slate-800 rounded text-[10px] text-slate-400 hover:text-white font-semibold transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Canvas Wrapper with checkered transparent pattern */}
          <div className="w-full flex items-center justify-center p-6 bg-slate-950/60 rounded-xl border border-slate-800 overflow-auto max-h-[60vh] relative min-h-[250px]">
            <div 
              className="absolute inset-0 opacity-[0.04] pointer-events-none" 
              style={{
                backgroundImage: 'conic-gradient(#ffffff 0.25turn, #000000 0.25turn 0.5turn, #ffffff 0.5turn 0.75turn, #000000 0.75turn)',
                backgroundSize: '24px 24px'
              }}
            />
            <img 
              src={file.content} 
              alt={file.name} 
              className="max-w-full max-h-[50vh] object-contain rounded shadow-lg transition-transform duration-250 ease-out" 
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          </div>
        </div>
      );
    }

    // 2. Audio Player (Custom Styled Component)
    const isAudio = file.mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(file.extension);
    if (isAudio) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-900/60 rounded-xl border border-slate-800/80 text-center space-y-6">
          <audio 
            ref={audioRef} 
            src={mediaUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          {/* Visual Pulsing Disc */}
          <div className="relative">
            <div className={`h-28 w-28 rounded-full bg-gradient-to-tr from-blue-900 to-indigo-950 border-4 border-slate-800 flex items-center justify-center shadow-xl relative overflow-hidden ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent"></div>
              <Music className="h-10 w-10 text-blue-400" />
            </div>
            {isPlaying && (
              <div className="absolute -inset-2 rounded-full border border-blue-500/40 animate-ping pointer-events-none" style={{ animationDuration: '2s' }}></div>
            )}
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">{file.name}</h4>
            <p className="text-xs text-slate-400 font-mono">{file.formattedSize} · Audio Media File</p>
          </div>

          {/* Player controls */}
          <div className="w-full max-w-md space-y-3 bg-slate-950/50 border border-slate-800/60 rounded-lg p-4">
            {/* Timeline Slider */}
            <div className="flex items-center space-x-3 text-xs">
              <span className="font-mono text-slate-400 w-10 text-right">{formatTime(currentTime)}</span>
              <input 
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="flex-grow h-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 outline-none"
              />
              <span className="font-mono text-slate-400 w-10 text-left">{formatTime(duration)}</span>
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input 
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 outline-none"
                />
              </div>

              <button
                onClick={handlePlayPause}
                className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
              </button>

              <div className="w-20"></div> {/* Spacer to balance volume controls */}
            </div>
          </div>
        </div>
      );
    }

    // 3. Video Player (Custom Styled HTML5 Component)
    const isVideo = file.mimeType.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(file.extension);
    if (isVideo) {
      return (
        <div className="flex flex-col space-y-3 w-full">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl relative max-h-[60vh] flex items-center justify-center">
            <video 
              src={mediaUrl} 
              controls 
              className="w-full max-h-[58vh] outline-none"
              poster=""
            />
          </div>
          <div className="flex items-center justify-between px-2 text-xs text-slate-400">
            <span className="font-mono">{file.formattedSize} · Video Media</span>
            <span>{file.mimeType}</span>
          </div>
        </div>
      );
    }

    // 4. CSV Spreadsheet Viewer with Filter Search & Pagination
    const isCSV = file.extension === 'csv' || file.extension === 'tsv' || file.mimeType === 'text/csv' || file.mimeType === 'text/tab-separated-values';
    if (isCSV && file.content) {
      const { headers, rows } = parseCSV(file.content);
      const filteredRows = rows.filter(row => 
        row.some(cell => cell.toLowerCase().includes(csvSearch.toLowerCase()))
      );
      const totalPages = Math.ceil(filteredRows.length / csvRowsPerPage);
      const paginatedRows = filteredRows.slice(csvPage * csvRowsPerPage, (csvPage + 1) * csvRowsPerPage);

      return (
        <div className="flex flex-col space-y-3 w-full bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800/50">
            <div className="flex items-center space-x-2 text-xs font-semibold text-white">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Spreadsheet Grid Viewer</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">({filteredRows.length} rows found)</span>
            </div>
            
            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
              <input 
                type="text"
                placeholder="Search rows..."
                value={csvSearch}
                onChange={(e) => { setCsvSearch(e.target.value); setCsvPage(0); }}
                className="bg-slate-900 border border-slate-850 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 w-44 transition-all"
              />
            </div>
          </div>

          {/* Scrollable grid Table */}
          <div className="overflow-x-auto border border-slate-850 rounded-lg max-h-[40vh] min-h-[150px] relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#080d1a] border-b border-slate-800 text-slate-300 font-semibold z-10">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 border-r border-slate-800 font-mono text-[11px] truncate max-w-[150px]" title={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-900/10 text-slate-300">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length || 1} className="px-4 py-8 text-center text-slate-500">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/40">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2 border-r border-slate-850 truncate max-w-[180px] font-mono text-[11px]" title={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-xs">
              <span className="text-slate-400">
                Page <span className="font-semibold text-white">{csvPage + 1}</span> of <span className="font-semibold">{totalPages}</span>
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCsvPage(p => Math.max(0, p - 1))}
                  disabled={csvPage === 0}
                  className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-400" />
                </button>
                <button
                  onClick={() => setCsvPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={csvPage === totalPages - 1}
                  className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // 5. Markdown with elegant parser
    if (file.extension === 'md') {
      return (
        <div className="max-w-none text-slate-200 text-sm bg-slate-950/60 rounded-xl p-5 border border-slate-800/80 overflow-y-auto max-h-[55vh] shadow-inner font-sans">
          {parseMarkdown(file.content || file.description)}
        </div>
      );
    }

    // 6. PDF document
    if (file.extension === 'pdf' || file.mimeType === 'application/pdf') {
      return (
        <div className="w-full flex items-center justify-center bg-slate-950/40 rounded-lg">
          <PdfViewer file={file} canDownload={canDownload} onDownload={onDownload} />
        </div>
      );
    }

    // 7. Structured Code Viewer with Syntax Coloring
    const isCode = ['json', 'ts', 'js', 'py', 'svg', 'xml', 'css', 'html', 'sh', 'yaml', 'yml', 'tsx', 'jsx'].includes(file.extension);
    if (isCode && file.content) {
      return (
        <div className="flex flex-col space-y-2 w-full">
          {/* Header copy buttons */}
          <div className="flex items-center justify-between bg-[#080d1a] border border-slate-800 border-b-0 rounded-t-lg px-4 py-2 text-xs">
            <span className="font-mono text-slate-400 flex items-center space-x-1.5">
              <Code className="h-3.5 w-3.5 text-blue-400" />
              <span>{file.name}</span>
            </span>
            <button
              onClick={handleCopyCode}
              className="flex items-center space-x-1 hover:bg-slate-800 border border-slate-850 rounded px-2.5 py-1 transition-all text-slate-300 font-semibold"
            >
              {codeCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{codeCopied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          <div className="bg-[#040813] rounded-b-lg p-3 font-mono text-xs overflow-x-auto border border-slate-800/80 leading-relaxed shadow-inner max-h-[50vh]">
            <div className="table w-full border-spacing-0">
              {highlightCode(file.content)}
            </div>
          </div>
        </div>
      );
    }

    // Default File Preview Info Card
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-950/50 rounded-lg border border-slate-800/80 text-center">
        <FileText className="h-12 w-12 text-blue-400 mb-3" />
        <h4 className="text-base font-bold text-white mb-1">{file.name}</h4>
        <p className="text-xs text-slate-400 max-w-md">{file.description}</p>
        <div className="mt-4 flex items-center space-x-3">
          <span className="text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1 rounded">
            {file.formattedSize} · {file.mimeType}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-xl border border-[#1e3059] bg-[#070d1d] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e3059] px-6 py-4 bg-[#090f22]">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{file.name}</h3>
              <p className="text-xs text-slate-400">{file.category} · {file.fileType}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {canDownload && (
              <button
                onClick={() => onDownload(file)}
                className="flex items-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-glow-blue transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 px-6 bg-[#060a17] text-xs font-medium">
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'preview' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            File Preview
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'details' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Metadata Details
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2.5 px-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'security' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Access Security & Permissions
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#060a17]">
          {activeTab === 'preview' && renderContentPreview()}

          {activeTab === 'details' && (
            <div className="space-y-4 text-xs font-sans text-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 flex items-center mb-1"><HardDrive className="h-3.5 w-3.5 mr-1 text-blue-400" /> Size:</span>
                  <p className="font-mono text-sm text-white font-semibold">{file.formattedSize} ({file.size.toLocaleString()} bytes)</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 flex items-center mb-1"><User className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Uploaded By:</span>
                  <p className="font-medium text-sm text-white">{file.uploadedBy} ({file.uploadedByRole})</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 flex items-center mb-1"><Calendar className="h-3.5 w-3.5 mr-1 text-purple-400" /> Created Date:</span>
                  <p className="font-mono text-xs text-white">{new Date(file.createdAt).toLocaleString()}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 flex items-center mb-1"><Download className="h-3.5 w-3.5 mr-1 text-cyan-400" /> Downloads:</span>
                  <p className="font-mono text-sm text-white font-semibold">{file.downloadCount} downloads</p>
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold">Description:</span>
                <p className="text-slate-300 leading-relaxed">{file.description}</p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex items-center space-x-2">
                <Tag className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                <span className="text-slate-400 font-semibold mr-2">Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {file.tags.map((tag, idx) => (
                    <span key={idx} className="bg-slate-800 border border-slate-700 text-blue-300 px-2 py-0.5 rounded text-[11px] font-mono">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              <div className="rounded-lg border border-blue-800/60 bg-blue-950/30 p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Lock className="h-4 w-4 text-blue-400" />
                  <h4 className="font-bold text-sm text-white">Current Access Policy: {file.permissionLevel.toUpperCase()}</h4>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {file.permissionLevel === 'public' && 'This file is accessible to all authenticated Vantor Cloud workspace users.'}
                  {file.permissionLevel === 'authenticated' && 'Requires valid Vantor user authentication via Clerk.'}
                  {file.permissionLevel === 'admin_only' && 'Strictly restricted to users with System Administrator privileges.'}
                  {file.permissionLevel === 'role_restricted' && `Restricted to assigned roles: ${file.allowedRoles.join(', ')}.`}
                </p>
              </div>
              <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4 font-sans text-xs">
                <div className="flex items-start space-x-2.5">
                  <Info className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="font-semibold text-amber-200">Shareable Links & Access Control</h5>
                    <p className="text-slate-300 leading-relaxed">
                      To create and manage shareable links for this file, click the horizontal three-dots menu icon (<span className="font-semibold text-white">•••</span>) on the file, navigate to <span className="font-semibold text-white">Permissions</span>, and select the <span className="font-semibold text-amber-300">Shareable Links</span> tab.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-2">
                <h5 className="font-semibold text-slate-200">Authorized Roles Matrix</h5>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ALL_USER_ROLES.map((role: UserRole) => {
                    const isAllowed = file.allowedRoles.includes(role) || file.permissionLevel === 'public';
                    return (
                      <span
                        key={role}
                        className={`px-3 py-1 rounded border text-xs font-mono font-medium ${
                          isAllowed
                            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                        }`}
                      >
                        {role}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
