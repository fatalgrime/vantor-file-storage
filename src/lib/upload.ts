export function uploadFile(blob: Blob, name: string, repositoryId: string, folderId: string | null, signal: AbortSignal, onProgress: (percent: number) => void): Promise<{ fileId: string; url: string; size: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener('abort', abort);
    xhr.open('POST', `/api/r2/upload?${new URLSearchParams({ repositoryId, ...(folderId ? { folderId } : {}) })}`);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(name));
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
      cleanup();
      let payload; try { payload = JSON.parse(xhr.responseText); } catch { reject(new Error('Invalid upload response.')); return; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload); else reject(new Error(payload.error || 'Upload failed.'));
    };
    xhr.onerror = () => { cleanup(); reject(new Error('Upload failed. Check your connection and retry.')); };
    xhr.onabort = () => { cleanup(); reject(new DOMException('Upload cancelled.', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { cleanup(); reject(new DOMException('Upload cancelled.', 'AbortError')); return; }
    xhr.send(blob);
  });
}
