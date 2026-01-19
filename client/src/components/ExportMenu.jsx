import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileJson, ChevronDown, Check, Loader2 } from 'lucide-react';

function ExportMenu({ chatId, chatTitle, messages }) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [success, setSuccess] = useState(null);
  const menuRef = useRef(null);

  // Close menu when clicking outside
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

  const sanitizeFilename = (name) => {
    return name
      .replace(/[^a-z0-9\s\-_]/gi, '')
      .replace(/\s+/g, '_')
      .substring(0, 50) || 'chat_export';
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = async () => {
    setExporting('markdown');
    try {
      const res = await fetch(`/api/export/${chatId}?format=markdown`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!res.ok) throw new Error('Export failed');

      const markdown = await res.text();
      downloadFile(markdown, `${sanitizeFilename(chatTitle)}.md`, 'text/markdown');

      setSuccess('markdown');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      console.error('Markdown export failed:', error);
      alert('Failed to export as Markdown');
    } finally {
      setExporting(null);
    }
  };

  const exportJSON = async () => {
    setExporting('json');
    try {
      const res = await fetch(`/api/export/${chatId}?format=json`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!res.ok) throw new Error('Export failed');

      const data = await res.json();
      const jsonString = JSON.stringify(data, null, 2);
      downloadFile(jsonString, `${sanitizeFilename(chatTitle)}.json`, 'application/json');

      setSuccess('json');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      console.error('JSON export failed:', error);
      alert('Failed to export as JSON');
    } finally {
      setExporting(null);
    }
  };

  const exportPlainText = () => {
    setExporting('txt');
    try {
      let text = `${chatTitle}\n`;
      text += `${'='.repeat(chatTitle.length)}\n\n`;
      text += `Exported: ${new Date().toLocaleString()}\n\n`;
      text += `---\n\n`;

      for (const msg of messages) {
        const role = msg.role === 'user' ? 'You' : 'Assistant';
        const timestamp = new Date(msg.created_at).toLocaleString();
        text += `[${role}] ${timestamp}\n\n`;
        text += `${msg.content}\n\n`;
        text += `---\n\n`;
      }

      downloadFile(text, `${sanitizeFilename(chatTitle)}.txt`, 'text/plain');

      setSuccess('txt');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      console.error('Text export failed:', error);
      alert('Failed to export as text');
    } finally {
      setExporting(null);
    }
  };

  const exportOptions = [
    {
      id: 'markdown',
      label: 'Markdown',
      description: 'Rich formatted document',
      icon: FileText,
      action: exportMarkdown
    },
    {
      id: 'json',
      label: 'JSON',
      description: 'Full data with metadata',
      icon: FileJson,
      action: exportJSON
    },
    {
      id: 'txt',
      label: 'Plain Text',
      description: 'Simple text format',
      icon: FileText,
      action: exportPlainText
    }
  ];

  if (!chatId) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 flex items-center gap-2 rounded-xl transition-all duration-200 text-sm font-medium ${
          isOpen
            ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
            : 'glass-button text-dark-300 hover:text-dark-100'
        }`}
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-dark-900 border border-dark-700 rounded-xl shadow-2xl z-50 overflow-hidden scale-in">
          <div className="p-2">
            <p className="px-3 py-2 text-xs font-semibold text-dark-500 uppercase tracking-wider">
              Export Format
            </p>
            {exportOptions.map((option) => {
              const Icon = option.icon;
              const isExporting = exporting === option.id;
              const isSuccess = success === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => {
                    option.action();
                    setIsOpen(false);
                  }}
                  disabled={exporting !== null}
                  className="w-full p-3 rounded-lg hover:bg-white/[0.03] transition-all duration-200 text-left group flex items-start gap-3 disabled:opacity-50"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSuccess ? 'bg-green-500/10' : 'bg-dark-800'
                  }`}>
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                    ) : isSuccess ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Icon className="w-4 h-4 text-dark-400 group-hover:text-primary-400 transition-colors" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-200 group-hover:text-dark-100">
                      {option.label}
                    </p>
                    <p className="text-xs text-dark-500">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
