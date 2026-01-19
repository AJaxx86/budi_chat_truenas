import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Code, FileText, Copy, Download, Check,
    ChevronLeft, ChevronRight, Maximize2, Minimize2,
    Play, RotateCcw, Eye, EyeOff
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Simple syntax highlighting for common languages
const highlightCode = (code, language) => {
    // Basic keyword highlighting - could be enhanced with a real library like Prism
    const keywords = {
        javascript: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|null|undefined|true|false)\b/g,
        python: /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|raise|with|lambda|True|False|None|self|async|await)\b/g,
        typescript: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|null|undefined|true|false|interface|type|enum|implements|extends)\b/g,
    };

    const stringPattern = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
    const commentPattern = /\/\/.*$|\/\*[\s\S]*?\*\/|#.*$/gm;
    const numberPattern = /\b\d+\.?\d*\b/g;

    let highlighted = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Highlight comments
    highlighted = highlighted.replace(commentPattern, '<span class="text-dark-500">$&</span>');

    // Highlight strings
    highlighted = highlighted.replace(stringPattern, '<span class="text-green-400">$&</span>');

    // Highlight numbers
    highlighted = highlighted.replace(numberPattern, '<span class="text-amber-400">$&</span>');

    // Highlight keywords
    const keywordList = keywords[language] || keywords.javascript;
    if (keywordList) {
        highlighted = highlighted.replace(keywordList, '<span class="text-purple-400">$1</span>');
    }

    return highlighted;
};

const LANGUAGES = [
    { id: 'javascript', name: 'JavaScript', ext: 'js' },
    { id: 'typescript', name: 'TypeScript', ext: 'ts' },
    { id: 'python', name: 'Python', ext: 'py' },
    { id: 'html', name: 'HTML', ext: 'html' },
    { id: 'css', name: 'CSS', ext: 'css' },
    { id: 'json', name: 'JSON', ext: 'json' },
    { id: 'markdown', name: 'Markdown', ext: 'md' },
    { id: 'plaintext', name: 'Plain Text', ext: 'txt' },
];

function Canvas({ isOpen, onClose, initialContent = '', initialLanguage = 'javascript', title = 'Canvas' }) {
    const [content, setContent] = useState(initialContent);
    const [language, setLanguage] = useState(initialLanguage);
    const [showPreview, setShowPreview] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [history, setHistory] = useState([initialContent]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const textareaRef = useRef(null);
    const previewRef = useRef(null);

    // Update content when initialContent changes
    useEffect(() => {
        if (initialContent !== content) {
            setContent(initialContent);
            setHistory([initialContent]);
            setHistoryIndex(0);
        }
    }, [initialContent]);

    // Auto-detect language from content
    useEffect(() => {
        if (initialLanguage === 'auto') {
            // Simple detection based on content patterns
            if (content.includes('```python') || content.includes('def ') || content.includes('import numpy')) {
                setLanguage('python');
            } else if (content.includes('```typescript') || content.includes(': string') || content.includes('interface ')) {
                setLanguage('typescript');
            } else if (content.includes('```javascript') || content.includes('const ') || content.includes('function ')) {
                setLanguage('javascript');
            } else if (content.includes('<html') || content.includes('<div')) {
                setLanguage('html');
            } else if (content.includes('{') && content.includes('"')) {
                try {
                    JSON.parse(content);
                    setLanguage('json');
                } catch { }
            } else if (content.includes('# ') || content.includes('## ')) {
                setLanguage('markdown');
            }
        }
    }, [initialContent, initialLanguage]);

    // Save to history on content change (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (content !== history[historyIndex]) {
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(content);
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [content]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setContent(history[historyIndex - 1]);
        }
    }, [historyIndex, history]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setContent(history[historyIndex + 1]);
        }
    }, [historyIndex, history]);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [content]);

    const handleDownload = useCallback(() => {
        const lang = LANGUAGES.find(l => l.id === language) || LANGUAGES[0];
        const filename = `canvas_export.${lang.ext}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [content, language]);

    const handleKeyDown = useCallback((e) => {
        // Ctrl/Cmd + Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
        }
        // Ctrl/Cmd + Shift + Z for redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
            e.preventDefault();
            handleRedo();
        }
        // Tab for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            const newContent = content.substring(0, start) + '  ' + content.substring(end);
            setContent(newContent);
            // Restore cursor position
            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = start + 2;
            }, 0);
        }
    }, [content, handleUndo, handleRedo]);

    const renderPreview = useCallback(() => {
        if (language === 'markdown') {
            const html = DOMPurify.sanitize(marked(content || ''));
            return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
        } else if (language === 'html') {
            return (
                <iframe
                    srcDoc={content}
                    className="w-full h-full bg-white rounded-lg"
                    sandbox="allow-scripts"
                    title="HTML Preview"
                />
            );
        } else {
            // Code preview with syntax highlighting
            return (
                <pre className="text-sm font-mono overflow-auto h-full p-4">
                    <code dangerouslySetInnerHTML={{ __html: highlightCode(content, language) }} />
                </pre>
            );
        }
    }, [content, language]);

    if (!isOpen) return null;

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return (
        <div
            className={`fixed inset-0 z-50 flex ${isFullscreen ? '' : 'p-4'}`}
            onClick={(e) => e.target === e.currentTarget && !isFullscreen && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Canvas Panel */}
            <div className={`relative flex flex-col bg-dark-900 border border-dark-700 shadow-2xl ${isFullscreen
                    ? 'w-full h-full'
                    : 'w-full max-w-5xl h-[85vh] mx-auto rounded-2xl overflow-hidden scale-in'
                }`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                            <Code className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-dark-100">{title}</h2>
                            <p className="text-xs text-dark-500">Edit and iterate on content</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Language selector */}
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="px-2 py-1.5 text-xs rounded-lg bg-dark-800 border border-dark-600 text-dark-200 focus:border-primary-500/50 focus:outline-none"
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.id} value={lang.id}>{lang.name}</option>
                            ))}
                        </select>

                        {/* Preview toggle */}
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className={`p-2 rounded-lg transition-colors ${showPreview
                                    ? 'bg-primary-500/10 text-primary-400'
                                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                                }`}
                            title={showPreview ? 'Hide preview' : 'Show preview'}
                        >
                            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>

                        {/* Fullscreen toggle */}
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>

                        {/* Close */}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-1 px-4 py-2 border-b border-dark-700 bg-dark-800/30">
                    <button
                        onClick={handleUndo}
                        disabled={!canUndo}
                        className="p-1.5 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Undo (Ctrl+Z)"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>

                    <div className="w-px h-4 bg-dark-700 mx-1" />

                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors flex items-center gap-1"
                        title="Copy to clipboard"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
                    </button>

                    <button
                        onClick={handleDownload}
                        className="p-1.5 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors flex items-center gap-1"
                        title="Download file"
                    >
                        <Download className="w-4 h-4" />
                        <span className="text-xs">Download</span>
                    </button>

                    <div className="flex-1" />

                    <span className="text-xs text-dark-500">
                        {content.length.toLocaleString()} chars • {content.split('\n').length} lines
                    </span>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Editor */}
                    <div className={`flex-1 flex flex-col ${showPreview ? 'border-r border-dark-700' : ''}`}>
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 w-full p-4 bg-transparent text-dark-100 font-mono text-sm resize-none outline-none"
                            placeholder="Start typing or paste content here..."
                            spellCheck={false}
                        />
                    </div>

                    {/* Preview */}
                    {showPreview && (
                        <div
                            ref={previewRef}
                            className="flex-1 overflow-auto p-4 bg-dark-950/50"
                        >
                            {renderPreview()}
                        </div>
                    )}
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-dark-700 bg-dark-800/30 text-xs text-dark-500">
                    <span>{LANGUAGES.find(l => l.id === language)?.name || 'Unknown'}</span>
                    <span>Press Esc to close • Tab for indent • Ctrl+Z undo</span>
                </div>
            </div>
        </div>
    );
}

export default Canvas;
