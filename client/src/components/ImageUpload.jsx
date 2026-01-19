import React, { useState, useRef, useCallback } from 'react';
import { Paperclip, X, Upload, Loader2, AlertCircle, FileText, File } from 'lucide-react';

function ImageUpload({ onFilesSelected, disabled = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const validateFiles = (files) => {
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      // Documents
      'application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/json'
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = [];
    const errors = [];

    for (const file of files) {
      // Allow .md files even if browser reports wrong mimetype
      const isMd = file.name.endsWith('.md');
      if (!allowedTypes.includes(file.type) && !isMd) {
        errors.push(`${file.name}: Unsupported file type`);
        continue;
      }
      if (file.size > maxSize) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }
      validFiles.push(file);
    }

    return { validFiles, errors };
  };

  const getFileIcon = (mimetype, filename) => {
    if (mimetype?.startsWith('image/')) return null; // Will show preview
    if (mimetype === 'application/pdf') return '📄';
    if (mimetype === 'text/csv') return '📊';
    if (mimetype === 'application/json') return '{ }';
    if (mimetype?.includes('markdown') || filename?.endsWith('.md')) return '📝';
    if (mimetype === 'text/plain') return '📃';
    return '📎';
  };

  const isImage = (mimetype) => mimetype?.startsWith('image/');

  const uploadFiles = async (files) => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();

      // Create preview URLs for uploaded files
      const uploadedWithPreviews = data.files.map((file, index) => ({
        ...file,
        preview: URL.createObjectURL(files[index])
      }));

      setPendingFiles(prev => [...prev, ...uploadedWithPreviews]);
      onFilesSelected([...pendingFiles, ...uploadedWithPreviews]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0) {
      setError(errors.join(', '));
    }

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  }, [disabled, pendingFiles]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0) {
      setError(errors.join(', '));
    }

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }

    // Reset input
    e.target.value = '';
  };

  const removeFile = (fileId) => {
    const file = pendingFiles.find(f => f.id === fileId);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }

    const newFiles = pendingFiles.filter(f => f.id !== fileId);
    setPendingFiles(newFiles);
    onFilesSelected(newFiles);

    // Delete from server
    fetch(`/api/uploads/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).catch(console.error);
  };

  const clearAll = () => {
    pendingFiles.forEach(file => {
      if (file.preview) URL.revokeObjectURL(file.preview);
      fetch(`/api/uploads/${file.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).catch(console.error);
    });
    setPendingFiles([]);
    onFilesSelected([]);
  };

  return (
    <div className="space-y-2">
      {/* Pending Files Preview */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-dark-800/50 border border-white/[0.06]">
          {pendingFiles.map((file) => {
            const fileIcon = getFileIcon(file.mimetype, file.original_name);
            const showPreview = isImage(file.mimetype) && file.preview;

            return (
              <div
                key={file.id}
                className="relative group w-16 h-16 rounded-lg overflow-hidden border border-white/[0.1] bg-dark-800"
              >
                {showPreview ? (
                  <img
                    src={file.preview}
                    alt={file.original_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <span className="text-2xl">{fileIcon}</span>
                    {file.has_text && (
                      <span className="text-[8px] text-green-400 mt-0.5">✓ parsed</span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => removeFile(file.id)}
                  className="absolute top-0.5 right-0.5 p-1 bg-dark-900/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-dark-300" />
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-dark-900/80 px-1 py-0.5">
                  <p className="text-[8px] text-dark-300 truncate">{file.original_name}</p>
                </div>
              </div>
            );
          })}
          {pendingFiles.length > 1 && (
            <button
              onClick={clearAll}
              className="flex items-center justify-center w-16 h-16 rounded-lg border border-dashed border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex items-center gap-2 ${
          isDragging
            ? 'ring-2 ring-primary-500/50 bg-primary-500/5'
            : ''
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/csv,.csv,.md,.json"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className={`p-2 rounded-xl transition-all duration-200 ${
            uploading
              ? 'bg-primary-500/10 text-primary-400'
              : 'glass-button text-dark-400 hover:text-primary-400'
          } disabled:opacity-50`}
          title="Attach files (images, PDF, TXT, CSV, JSON, Markdown)"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        {/* Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary-500/10 border-2 border-dashed border-primary-500/50 rounded-xl z-10">
            <div className="flex items-center gap-2 text-primary-400">
              <Upload className="w-5 h-5" />
              <span className="text-sm font-medium">Drop files here</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default ImageUpload;
