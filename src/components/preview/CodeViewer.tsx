'use client';

import React, { useState } from 'react';
import { Code, Copy, Check } from 'lucide-react';

interface CodeViewerProps {
  fileName: string;
  content: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ fileName, content }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightLines = (codeText: string) => {
    const lines = codeText.split('\n');
    return lines.map((line, idx) => (
      <div key={idx} className="table-row">
        <span className="table-cell pr-4 text-right text-slate-600 select-none font-mono text-[11px] w-8">
          {idx + 1}
        </span>
        <span className="table-cell whitespace-pre text-slate-200 font-mono text-xs">
          {line || ' '}
        </span>
      </div>
    ));
  };

  return (
    <div className="flex flex-col space-y-2 w-full">
      <div className="flex items-center justify-between bg-[#080d1a] border border-slate-800 rounded-t-xl px-4 py-2.5 text-xs">
        <span className="font-mono text-slate-300 flex items-center space-x-2">
          <Code className="h-4 w-4 text-blue-400" />
          <span className="font-semibold">{fileName}</span>
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-md px-3 py-1 transition-colors text-slate-200 text-xs font-medium"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy Code'}</span>
        </button>
      </div>

      <div className="bg-[#040813] rounded-b-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed shadow-inner max-h-[55vh]">
        <div className="table w-full border-spacing-0">
          {highlightLines(content)}
        </div>
      </div>
    </div>
  );
};
