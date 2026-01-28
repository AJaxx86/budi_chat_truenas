import React, { useState, useRef, useEffect } from 'react';
import { Plus, Paperclip, Wand2, X, Upload, Loader2, AlertCircle } from 'lucide-react';

function PlusMenu({ onFilesSelected, onOpenImageGeneration, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const validateFiles = (files) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/json'
    ];
    const maxSize = 10 * 1024 * 1024;
    const validFiles = [];
    const errors = [];

    for (const file of files) {
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

      const uploadedWithPreviews = data.files.map((file, index) => ({
        ...file,
        preview: URL.createObjectURL(files[index])
      }));

      onFilesSelected(prev => [...prev, ...uploadedWithPreviews]);
      setIsOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0) {
      setError(errors.join(', '));
    }

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }

    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
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
  };

  return (
    <div className="relative" ref={menuRef}>
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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || uploading}
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
          isOpen
            ? 'bg-accent/10 text-accent'
            : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Attach files or generate images"
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Plus className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-52 glass-dropdown rounded-xl shadow-xl border border-dark-700/50 overflow-hidden scale-in z-50"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging ? (
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <Upload className="w-8 h-8 text-accent mb-2" />
              <p className="text-sm text-dark-200">Drop files here</p>
            </div>
          ) : (
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-700/50 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-dark-700/50 flex items-center justify-center group-hover:bg-accent/10">
                  <Paperclip className="w-4 h-4 text-dark-400 group-hover:text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-200 group-hover:text-dark-100">Attach files</p>
                  <p className="text-[10px] text-dark-500">Images, PDF, text files</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenImageGeneration();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-700/50 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-dark-700/50 flex items-center justify-center group-hover:bg-accent/10">
                  <Wand2 className="w-4 h-4 text-dark-400 group-hover:text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-200 group-hover:text-dark-100">Generate image</p>
                  <p className="text-[10px] text-dark-500">AI-powered creation</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="absolute bottom-full left-0 mb-12 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs whitespace-nowrap z-50">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="max-w-[200px] truncate">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default PlusMenu;
