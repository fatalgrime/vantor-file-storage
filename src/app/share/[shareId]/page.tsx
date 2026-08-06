'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Lock,
  X,
  Key,
  Download,
  Calendar,
  HardDrive,
  Eye,
  Folder,
  FileText,
  ArrowLeft,
  Music,
  Video,
  FileSpreadsheet,
  Code,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileText as FileIcon,
  Check,
  Copy,
  ChevronRight as ChevronRightIcon,
  AlertCircle
} from 'lucide-react';
import { VantorFile, VantorFolder, ShareLink } from '../../../lib/types';
import { PdfViewer } from '../../../components/PdfViewer';
import { useToast } from '../../../components/ToastProvider';

export default function PublicSharePage() {
  const params = useParams();
  const shareId = params?.shareId as string;
  const router = useRouter();
  const { addToast } = useToast();

  // Loading / Error states
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Password screen
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const viewLoggedRef = useRef(false);

  // Share link meta
  const [linkLabel, setLinkLabel] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [itemType, setItemType] = useState<'file' | 'folder'>('file');

  // Payload data
  const [fileData, setFileData] = useState<VantorFile | null>(null);

  // Folder browser states
  const [rootFolder, setRootFolder] = useState<VantorFolder | null>(null);
  const [currentFolder, setCurrentFolder] = useState<VantorFolder | null>(null);
  const [folderFiles, setFolderFiles] = useState<VantorFile[]>([]);
  const [folderFolders, setFolderFolders] = useState<VantorFolder[]>([]);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);

  // Preview Modal for Folder Browser
  const [previewFile, setPreviewFile] = useState<VantorFile | null>(null);

  // General Viewer States
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

  // Fetch initial details
  const fetchShareData = async (enteredPassword?: string, subfolderId?: string) => {
    try {
      setLoading(true);

      let url = `/api/public/share/${shareId}`;
      const queryParams: string[] = [];
      if (enteredPassword) queryParams.push(`password=${encodeURIComponent(enteredPassword)}`);
      if (subfolderId) queryParams.push(`subfolderId=${encodeURIComponent(subfolderId)}`);
      if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

      const res = await fetch(url);
      const data = await res.json().catch(() => null);

      if (data?.passwordRequired) {
        setPasswordRequired(true);
        setLinkLabel(data.label || 'Secure Link');
        setItemType(data.itemType);
        if (enteredPassword || !res.ok || data?.error) {
          const msg = data?.error || 'Incorrect password. Please try again.';
          setAuthError(msg);
          addToast({
            type: 'error',
            title: 'Invalid Password',
            message: msg,
          });
        } else {
          setAuthError('');
        }
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to retrieve share contents.');
      }

      setErrorMsg('');
      setPasswordRequired(false);
      setAllowDownload(data.allowDownload);
      setItemType(data.itemType);

      if (data.itemType === 'file') {
        setFileData(data.file);

        // Setup Media URL if audio/video
        const f = data.file as VantorFile;
        const isMedia = f.mimeType.startsWith('audio/') || f.mimeType.startsWith('video/') ||
          ['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov'].includes(f.extension);
        if (isMedia && f.content) {
          let mUrl = '';
          if (f.content.startsWith('data:')) {
            mUrl = f.content;
          } else {
            try {
              const base64Data = f.content.split(',')[1] || f.content;
              const binaryString = window.atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: f.mimeType });
              mUrl = URL.createObjectURL(blob);
            } catch {
              const blob = new Blob([f.content], { type: f.mimeType });
              mUrl = URL.createObjectURL(blob);
            }
          }
          setMediaUrl(mUrl);
        }
      } else {
        setRootFolder(data.rootFolder);
        setCurrentFolder(data.folder);
        setFolderFiles(data.files || []);
        setFolderFolders(data.folders || []);

        // Update breadcrumb trail path
        if (data.folder && data.rootFolder) {
          const trail = [{ id: data.rootFolder.id, name: data.rootFolder.name }];
          if (data.folder.id !== data.rootFolder.id) {
            trail.push({ id: data.folder.id, name: data.folder.name });
          }
          setFolderPath(trail);
        }
      }

      // Log view count increment (silently)
      if (!viewLoggedRef.current) {
        viewLoggedRef.current = true;
        await fetch(`/api/public/share/${shareId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: enteredPassword, action: 'view' }),
        }).catch(e => console.error("Metrics view error", e));
      }

      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error connecting to storage gateway.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shareId) {
      fetchShareData();
    }
  }, [shareId]);

  // Clean up Media URLs on unmount
  useEffect(() => {
    return () => {
      if (mediaUrl && mediaUrl.startsWith('blob:')) {
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [mediaUrl]);

  // Handle password submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!password.trim()) {
      addToast({
        type: 'warning',
        title: 'Password Required',
        message: 'Please enter a password to decrypt this file.',
      });
      return;
    }

    // Test login
    fetchShareData(password.trim());
  };

  // Download Trigger
  const triggerDownload = async (fileToDownload: VantorFile) => {
    if (!allowDownload) return;

    try {
      // Record download count metric
      await fetch(`/api/public/share/${shareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'download' }),
      }).catch(e => console.error("Metrics download error", e));

      // Initiate download
      const isDataUrl = fileToDownload.content?.startsWith('data:');
      let dlUrl = '';

      if (isDataUrl) {
        dlUrl = fileToDownload.content!;
      } else {
        const blob = new Blob([fileToDownload.content || fileToDownload.description], { type: fileToDownload.mimeType });
        dlUrl = URL.createObjectURL(blob);
      }

      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = fileToDownload.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (!isDataUrl) {
        URL.revokeObjectURL(dlUrl);
      }
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  // Navigating inside Shared Folders
  const handleOpenSubfolder = (folderId: string) => {
    setCsvSearch('');
    setCsvPage(0);
    fetchShareData(password, folderId);
  };

  // Navigating back
  const handleNavigateBack = () => {
    if (folderPath.length > 1) {
      const parentFolderId = rootFolder?.id || '';
      handleOpenSubfolder(parentFolderId);
    }
  };

  // Audio Event Handlers
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error("Audio playback error", e));
      setIsPlaying(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

  // CSV Parser
  const parseCSV = (content: string) => {
    if (!content) return { headers: [], rows: [] };
    const lines = content.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      const delimiter = fileData?.extension === 'tsv' ? '\t' : ',';

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

  // Code syntax highlighting
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
        if (['=', '+', '-', '*', '/', '==', '===', '!=', '!==', '<', '>', '&&', '||'].includes(token)) {
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

  // Render individual file previews inside the Portal page
  const renderSharedFilePreview = (file: VantorFile) => {
    // 1. Image
    if (file.mimeType.startsWith('image/') && file.content?.startsWith('data:')) {
      return (
        <div className="flex flex-col space-y-4 items-center w-full">
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
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
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

          <div className="w-full flex items-center justify-center p-6 bg-slate-950/60 rounded-xl border border-slate-800 overflow-auto max-h-[50vh] min-h-[250px] relative">
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: 'conic-gradient(#ffffff 0.25turn, #000000 0.25turn 0.5turn, #ffffff 0.5turn 0.75turn, #000000 0.75turn)',
                backgroundSize: '24px 24px'
              }}
            />
            <img
              src={file.content}
              alt={file.name}
              className="max-w-full max-h-[45vh] object-contain rounded shadow-lg transition-transform duration-250 ease-out"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          </div>
        </div>
      );
    }

    // 2. Audio
    const isAudio = file.mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(file.extension);
    if (isAudio) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 rounded-xl border border-slate-800 text-center space-y-5">
          <audio
            ref={audioRef}
            src={mediaUrl}
            onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
            onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="relative">
            <div className={`h-24 w-24 rounded-full bg-gradient-to-tr from-blue-900 to-indigo-950 border-4 border-slate-800 flex items-center justify-center shadow-xl overflow-hidden ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>
              <Music className="h-9 w-9 text-blue-400" />
            </div>
            {isPlaying && (
              <div className="absolute -inset-2 rounded-full border border-blue-500/30 animate-ping pointer-events-none" style={{ animationDuration: '2s' }}></div>
            )}
          </div>

          {/* Audio Controls */}
          <div className="w-full max-w-sm space-y-3 bg-slate-950/50 border border-slate-850 rounded-lg p-3.5">
            <div className="flex items-center space-x-3 text-xs">
              <span className="font-mono text-slate-400 w-10 text-right">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  if (audioRef.current) {
                    const time = parseFloat(e.target.value);
                    audioRef.current.currentTime = time;
                    setCurrentTime(time);
                  }
                }}
                className="flex-grow h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-500 outline-none"
              />
              <span className="font-mono text-slate-400 w-10 text-left">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    const mute = !isMuted;
                    audioRef.current.muted = mute;
                    setIsMuted(mute);
                  }
                }}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
              </button>

              <button
                onClick={handlePlayPause}
                className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 shadow-md shadow-blue-500/20"
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
              </button>

              <div className="w-8"></div>
            </div>
          </div>
        </div>
      );
    }

    // 3. Video
    const isVideo = file.mimeType.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(file.extension);
    if (isVideo) {
      return (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 max-h-[50vh] flex items-center justify-center">
          <video src={mediaUrl} controls className="w-full max-h-[48vh] outline-none" />
        </div>
      );
    }

    // 4. CSV Spreadsheet
    const isCSV = file.extension === 'csv' || file.extension === 'tsv' || file.mimeType === 'text/csv' || file.mimeType === 'text/tab-separated-values';
    if (isCSV && file.content) {
      const { headers, rows } = parseCSV(file.content);
      const filteredRows = rows.filter(row =>
        row.some(cell => cell.toLowerCase().includes(csvSearch.toLowerCase()))
      );
      const totalPages = Math.ceil(filteredRows.length / csvRowsPerPage);
      const paginatedRows = filteredRows.slice(csvPage * csvRowsPerPage, (csvPage + 1) * csvRowsPerPage);

      return (
        <div className="flex flex-col space-y-3 w-full bg-slate-950/20 p-4 border border-slate-850 rounded-xl text-left">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-1.5 border-b border-slate-850">
            <div className="flex items-center space-x-2 text-xs font-semibold text-white">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Spreadsheet Grid Viewer</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">({filteredRows.length} rows)</span>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search..."
                value={csvSearch}
                onChange={(e) => { setCsvSearch(e.target.value); setCsvPage(0); }}
                className="bg-slate-900 border border-slate-850 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 outline-none w-36 focus:border-blue-500 focus:w-44 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-850 rounded-lg max-h-[35vh] min-h-[120px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#080d1a] border-b border-slate-850 text-slate-300 font-semibold z-10">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-3.5 py-2 border-r border-slate-850 font-mono text-[10px] truncate max-w-[120px]" title={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-300">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length || 1} className="px-4 py-8 text-center text-slate-500">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/20">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-1.5 border-r border-slate-850 truncate max-w-[150px] font-mono text-[10px]" title={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-xs">
              <span className="text-slate-400">
                Page <span className="font-semibold text-white">{csvPage + 1}</span> of <span className="font-semibold">{totalPages}</span>
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCsvPage(p => Math.max(0, p - 1))}
                  disabled={csvPage === 0}
                  className="p-1 rounded bg-slate-900 border border-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCsvPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={csvPage === totalPages - 1}
                  className="p-1 rounded bg-slate-900 border border-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // 5. Markdown
    if (file.extension === 'md') {
      return (
        <div className="max-w-none text-slate-200 text-sm bg-slate-950/60 rounded-xl p-5 border border-slate-800/80 overflow-y-auto max-h-[50vh] text-left">
          {parseMarkdown(file.content || file.description)}
        </div>
      );
    }

    // 6. PDF
    if (file.extension === 'pdf' || file.mimeType === 'application/pdf') {
      return (
        <div className="w-full flex items-center justify-center bg-slate-950/40 rounded-lg text-left">
          <PdfViewer file={file} canDownload={allowDownload} onDownload={triggerDownload} />
        </div>
      );
    }

    // 7. Code
    const isCode = ['json', 'ts', 'js', 'py', 'svg', 'xml', 'css', 'html', 'sh', 'yaml', 'yml', 'tsx', 'jsx'].includes(file.extension);
    if (isCode && file.content) {
      return (
        <div className="flex flex-col space-y-2 w-full text-left">
          <div className="flex items-center justify-between bg-[#080d1a] border border-slate-800 border-b-0 rounded-t-lg px-4 py-2 text-xs">
            <span className="font-mono text-slate-400 flex items-center space-x-1.5">
              <Code className="h-3.5 w-3.5 text-blue-400" />
              <span>{file.name}</span>
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(file.content || '');
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              }}
              className="flex items-center space-x-1 hover:bg-slate-800 border border-slate-850 rounded px-2.5 py-1 transition-all text-slate-300 font-semibold"
            >
              {codeCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{codeCopied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          <div className="bg-[#040813] rounded-b-lg p-3 font-mono text-xs overflow-x-auto border border-slate-800/80 leading-relaxed shadow-inner max-h-[45vh]">
            <div className="table w-full border-spacing-0">
              {highlightCode(file.content)}
            </div>
          </div>
        </div>
      );
    }

    // Default Fallback Info Box
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900/40 rounded-xl border border-slate-800 text-center">
        <FileIcon className="h-12 w-12 text-blue-400 mb-3" />
        <h4 className="text-base font-bold text-white mb-1">{file.name}</h4>
        <p className="text-xs text-slate-400 max-w-sm">{file.description}</p>
        <span className="mt-4 text-xs font-mono bg-slate-950 border border-slate-850 px-3 py-1 rounded text-slate-300">
          {file.formattedSize} · {file.mimeType}
        </span>
      </div>
    );
  };

  // LOADING SCREEN
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060a17] text-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-xs text-slate-400 font-mono font-medium">Securing connection to Vantor Storage...</span>
        </div>
      </div>
    );
  }

  // ERROR SCREEN
  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#060a17] text-slate-100 flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-md rounded-xl border border-red-900/50 bg-red-950/15 p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-950 border border-red-900/80 text-red-400 mb-4">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-base font-bold text-white">Access Link Unusable</h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => router.push('/sign-in')}
            className="mt-5 w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-750 transition-all"
          >
            Go to Portal Login
          </button>
        </div>
      </div>
    );
  }

  // PASSWORD GATE SCREEN
  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-[#060a17] text-slate-100 flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-md rounded-xl border border-[#1e3059] bg-[#070c18] p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-950 border border-blue-800 text-blue-400 mb-4">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-base font-bold text-white">{linkLabel}</h1>
          <p className="mt-1.5 text-xs text-slate-400">This share link is password-protected. Enter the password below to decrypt and view the shared {itemType}.</p>

          <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-3">
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                placeholder="Enter password to decrypt..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError('');
                }}
                className={`w-full rounded-lg border bg-slate-900 pl-10 pr-3 py-2 text-xs text-white outline-none transition-colors ${authError
                    ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white transition-all shadow-glow-blue"
            >
              Unlock Shared Asset
            </button>
          </form>
        </div>
      </div>
    );
  }

  // MAIN PUBLIC CONTENT VIEWER
  return (
    <div className="min-h-screen bg-[#060a17] text-slate-100 flex flex-col font-sans select-none pointer-events-auto">
      {/* Top Header branding */}
      <header className="border-b border-[#1e3059] bg-[#070c18]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src="/logo.png" alt="Vantor logo" className="h-7 w-auto object-contain" />
          <div className="h-4 w-px bg-slate-800"></div>
          <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Share Portal</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-5xl w-full mx-auto px-4 py-8 flex flex-col items-center">
        {itemType === 'file' && fileData && (
          <div className="w-full max-w-3xl space-y-5 text-center">
            {/* Header info */}
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white truncate px-2">{fileData.name}</h2>
              <p className="text-xs text-slate-400 font-mono">
                {fileData.fileType} · {fileData.formattedSize}
              </p>
            </div>

            {/* Standalone File Viewer */}
            <div className="bg-[#070d1d] border border-[#1e3059] rounded-xl p-5 shadow-2xl relative">
              {renderSharedFilePreview(fileData)}
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {allowDownload ? (
                <button
                  onClick={() => triggerDownload(fileData)}
                  className="flex items-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs font-semibold text-white shadow-glow-blue transition-all"
                >
                  <Download className="h-4 w-4" />
                  <span>Download file ({fileData.formattedSize})</span>
                </button>
              ) : (
                <div className="flex items-center space-x-1.5 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs text-slate-400 font-medium">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  <span>Download Disabled (View Only Link)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {itemType === 'folder' && currentFolder && (
          <div className="w-full space-y-4">
            {/* Folder Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#070c18] border border-[#1e3059] p-4 rounded-xl">
              <div>
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Shared Folder Browser</p>
                <h1 className="text-lg font-bold text-white flex items-center space-x-2 mt-0.5">
                  <Folder className="h-5 w-5 text-emerald-500" />
                  <span>{currentFolder.name}</span>
                </h1>
                {currentFolder.description && (
                  <p className="text-xs text-slate-400 mt-1">{currentFolder.description}</p>
                )}
              </div>

              {!allowDownload && (
                <span className="flex items-center space-x-1 text-[10px] bg-amber-950/80 border border-amber-900 text-amber-400 px-2 py-1 rounded">
                  <Lock className="h-3 w-3" />
                  <span>View Only Browser</span>
                </span>
              )}
            </div>

            {/* Folder Navigation Trail */}
            {folderPath.length > 1 && (
              <button
                onClick={handleNavigateBack}
                className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Parent Directory</span>
              </button>
            )}

            {/* Folder Grid Contents */}
            <div className="bg-[#070d1d] border border-[#1e3059] rounded-xl overflow-hidden shadow-2xl">
              <div className="grid grid-cols-1 divide-y divide-slate-850">
                {/* Header labels */}
                <div className="grid grid-cols-12 px-6 py-2.5 bg-[#090f22] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="col-span-8 md:col-span-6">Name</span>
                  <span className="col-span-4 md:col-span-3">Size</span>
                  <span className="hidden md:block col-span-3 text-right">Action</span>
                </div>

                {/* Subfolders list */}
                {folderFolders.map((sub: VantorFolder) => (
                  <div
                    key={sub.id}
                    onClick={() => handleOpenSubfolder(sub.id)}
                    className="grid grid-cols-12 px-6 py-3 items-center hover:bg-slate-800/30 cursor-pointer text-xs"
                  >
                    <div className="col-span-8 md:col-span-6 flex items-center space-x-2.5 min-w-0">
                      <Folder className="h-4.5 w-4.5 text-emerald-500 flex-shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{sub.name}</span>
                    </div>
                    <span className="col-span-4 md:col-span-3 font-mono text-[10px] text-slate-400">--</span>
                    <div className="hidden md:flex col-span-3 justify-end">
                      <ChevronRightIcon className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                ))}

                {/* Files list */}
                {folderFiles.map((f: VantorFile) => (
                  <div
                    key={f.id}
                    onClick={() => setPreviewFile(f)}
                    className="grid grid-cols-12 px-6 py-3 items-center hover:bg-slate-800/30 cursor-pointer text-xs"
                  >
                    <div className="col-span-8 md:col-span-6 flex items-center space-x-2.5 min-w-0">
                      <FileIcon className="h-4.5 w-4.5 text-blue-400 flex-shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{f.name}</span>
                    </div>
                    <span className="col-span-4 md:col-span-3 font-mono text-[10px] text-slate-400">{f.formattedSize}</span>
                    <div className="hidden md:flex col-span-3 justify-end items-center space-x-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setPreviewFile(f)}
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        Preview
                      </button>
                      {allowDownload && (
                        <button
                          onClick={() => triggerDownload(f)}
                          className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-500 transition-colors"
                        >
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Empty State */}
                {folderFolders.length === 0 && folderFiles.length === 0 && (
                  <div className="p-10 text-center text-slate-500 text-xs">
                    This directory is empty.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER SUMMARY */}
      <footer className="border-t border-[#1e3059] bg-[#070c18] py-4 text-center text-[10px] text-slate-500 font-mono flex-shrink-0">
        Powered by Vantor Storage (storage.vantor.group) • All Rights Reserved.
      </footer>

      {/* EMBEDDED FILE PREVIEW MODAL FOR FOLDER BROWSER */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl rounded-xl border border-[#1e3059] bg-[#070d1d] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-[#1e3059] px-6 py-4 bg-[#090f22] flex-shrink-0">
              <div>
                <h3 className="font-bold text-base text-white">{previewFile.name}</h3>
                <p className="text-xs text-slate-400">{previewFile.fileType} · {previewFile.formattedSize}</p>
              </div>
              <div className="flex items-center space-x-2">
                {allowDownload && (
                  <button
                    onClick={() => triggerDownload(previewFile)}
                    className="flex items-center space-x-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-glow-blue transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                )}
                <button
                  onClick={() => setPreviewFile(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-[#060a17] text-center">
              {renderSharedFilePreview(previewFile)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
