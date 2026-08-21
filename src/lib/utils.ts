export function detectFileType(fileName: string, mimeType?: string): {
  extension: string;
  fileType: string;
  mimeType: string;
  category: string;
} {
  const name = fileName.trim();
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : '';
  const mime = mimeType?.toLowerCase() || '';

  // 1. PDF Documents
  if (ext === 'pdf' || mime.includes('pdf')) {
    return {
      extension: 'pdf',
      fileType: 'PDF Document',
      mimeType: 'application/pdf',
      category: 'Documentation',
    };
  }

  // 2. Images
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'].includes(ext) || mime.startsWith('image/')) {
    return {
      extension: ext || 'png',
      fileType: 'Image Asset',
      mimeType: mime || `image/${ext || 'png'}`,
      category: 'Brand Assets',
    };
  }

  // 3. Word Documents
  if (['doc', 'docx'].includes(ext) || mime.includes('word') || mime.includes('wordprocessingml')) {
    return {
      extension: ext || 'docx',
      fileType: 'Word Document',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      category: 'Documents & Assets',
    };
  }

  // 4. Excel / Spreadsheets
  if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) {
    return {
      extension: ext || 'xlsx',
      fileType: ext === 'csv' ? 'CSV Spreadsheet' : 'Excel Spreadsheet',
      mimeType: ext === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      category: 'Documents & Assets',
    };
  }

  // 5. PowerPoint / Presentations
  if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
    return {
      extension: ext || 'pptx',
      fileType: 'PowerPoint Presentation',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      category: 'Documents & Assets',
    };
  }

  // 6. Video Files
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv'].includes(ext) || mime.startsWith('video/')) {
    return {
      extension: ext || 'mp4',
      fileType: 'Video File',
      mimeType: mime || 'video/mp4',
      category: 'Brand Assets',
    };
  }

  // 7. Audio Files
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext) || mime.startsWith('audio/')) {
    return {
      extension: ext || 'mp3',
      fileType: 'Audio Recording',
      mimeType: mime || 'audio/mpeg',
      category: 'Brand Assets',
    };
  }

  // 8. Code & Developer Files
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json', 'sql', 'sh', 'xml', 'yaml', 'yml'].includes(ext)) {
    return {
      extension: ext,
      fileType: `${ext.toUpperCase()} Source Code`,
      mimeType: mime || 'text/plain',
      category: 'Source Code',
    };
  }

  // 9. Markdown Documents
  if (ext === 'md' || ext === 'markdown') {
    return {
      extension: 'md',
      fileType: 'Markdown document',
      mimeType: 'text/markdown',
      category: 'Documentation',
    };
  }

  // 10. Archives & Compressed Files
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return {
      extension: ext || 'zip',
      fileType: 'Compressed Archive',
      mimeType: mime || 'application/zip',
      category: 'Documents & Assets',
    };
  }

  // Fallback Text / Unknown
  return {
    extension: ext || 'txt',
    fileType: ext ? `${ext.toUpperCase()} File` : 'Text Document',
    mimeType: mime || 'text/plain',
    category: 'Documents & Assets',
  };
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
