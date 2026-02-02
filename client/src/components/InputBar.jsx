import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Lightbulb } from 'lucide-react';
import PlusMenu from './PlusMenu';
import VoiceInput from './VoiceInput';
import PersonaQuickSelect from './PersonaQuickSelect';

// Thinking modes with effort levels for OpenRouter reasoning API
export const THINKING_MODES = [
  { id: 'off', label: 'Off', description: 'No extended thinking', effort: null },
  { id: 'low', label: 'Low', description: 'Quick reasoning', effort: 'low' },
  { id: 'medium', label: 'Medium', description: 'Balanced thinking', effort: 'medium' },
  { id: 'high', label: 'High', description: 'Deep reasoning', effort: 'high' },
  { id: 'max', label: 'Max', description: 'Maximum reasoning', effort: 'high', max_tokens: 32768 },
];



function InputBar({
  inputMessage,
  setInputMessage,
  onSendMessage,
  onStopGeneration,
  streaming,
  pendingAttachments,
  setPendingAttachments,
  thinkingMode,
  setThinkingMode,
  isReasoningSupported,
  chatId,
  onOpenImageGeneration,
  selectedPersona,
  onPersonaSelect,
  showRecentPersonas,
}) {
  const [showThinkingDropdown, setShowThinkingDropdown] = useState(false);
  const textareaRef = useRef(null);
  const thinkingDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (thinkingDropdownRef.current && !thinkingDropdownRef.current.contains(event.target)) {
        setShowThinkingDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset textarea height when input is cleared
  useEffect(() => {
    if (!inputMessage && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputMessage]);

  // Auto-resize textarea
  const handleTextareaInput = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputMessage.trim() && !streaming) {
        onSendMessage(e);
      }
    }
  };

  const handleThinkingModeChange = async (modeId) => {
    setThinkingMode(modeId);
    setShowThinkingDropdown(false);
    if (chatId) {
      try {
        await fetch(`/api/chats/${chatId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ thinking_mode: modeId })
        });
      } catch (error) {
        console.error('Failed to update thinking mode:', error);
      }
    }
  };



  const removeAttachment = (fileId) => {
    const file = pendingAttachments.find(f => f.id === fileId);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }
    fetch(`/api/uploads/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).catch(console.error);
    setPendingAttachments(prev => prev.filter(f => f.id !== fileId));
  };

  const getThinkingModeColor = () => {
    switch (thinkingMode) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'max': return 'text-red-400';
      default: return 'text-dark-500';
    }
  };

  const getFileIcon = (mimetype, filename) => {
    if (mimetype?.startsWith('image/')) return null;
    if (mimetype === 'application/pdf') return '📄';
    if (mimetype === 'text/csv') return '📊';
    if (mimetype === 'application/json') return '{ }';
    if (mimetype?.includes('markdown') || filename?.endsWith('.md')) return '📝';
    if (mimetype === 'text/plain') return '📃';
    return '📎';
  };

  return (
    <div className="p-4">
      <div className="max-w-2xl mx-auto">
        {/* Pending Attachments Preview */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 p-2 rounded-xl bg-dark-800/50 border border-white/[0.06]">
            {pendingAttachments.map((file) => {
              const isImage = file.mimetype?.startsWith('image/');
              const fileIcon = getFileIcon(file.mimetype, file.original_name);

              return (
                <div
                  key={file.id}
                  className="relative group w-16 h-16 rounded-lg overflow-hidden border border-white/[0.1] bg-dark-800"
                >
                  {isImage && file.preview ? (
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
                    type="button"
                    onClick={() => removeAttachment(file.id)}
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
          </div>
        )}

        {/* Main Input Pill */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-3xl bg-dark-800/60 border border-dark-700/50 focus-within:border-dark-600/60 transition-colors">
          {/* Persona Quick Select */}
          <PersonaQuickSelect
            selectedPersona={selectedPersona}
            onSelect={onPersonaSelect}
            showRecent={showRecentPersonas}
          />

          {/* Plus Menu */}
          <PlusMenu
            onFilesSelected={setPendingAttachments}
            onOpenImageGeneration={onOpenImageGeneration}
            disabled={streaming}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            placeholder={streaming ? "AI is responding..." : "Ask anything..."}
            className="flex-1 bg-transparent outline-none ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-dark-200 placeholder-dark-500 text-sm resize-none py-2"
            style={{ minHeight: '24px', maxHeight: '140px' }}
            rows={1}
            disabled={streaming}
          />

          {/* Voice Input */}
          <div className="flex-shrink-0">
            <VoiceInput
              onTranscript={(text) => setInputMessage(prev => prev + (prev ? ' ' : '') + text)}
              disabled={streaming}
              compact={true}
            />
          </div>

          {/* Send/Stop Button (inside pill) */}
          {streaming ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-dark-200 transition-all duration-200"
              title="Stop generating"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSendMessage}
              disabled={!inputMessage.trim()}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-accent text-dark-900 hover:bg-accent-light disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Bottom Controls Row - plain controls, left-aligned */}
        <div className="flex items-center gap-2 mt-2 px-1">
          {/* Thinking Mode Button */}
          <div className="relative" ref={thinkingDropdownRef}>
            <button
              type="button"
              onClick={() => isReasoningSupported && setShowThinkingDropdown(!showThinkingDropdown)}
              disabled={!isReasoningSupported}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${!isReasoningSupported
                ? 'text-dark-600 cursor-not-allowed opacity-50'
                : thinkingMode !== 'off'
                  ? `${getThinkingModeColor()} hover:bg-dark-800/50`
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50'
                }`}
              title={!isReasoningSupported ? "Model doesn't support thinking" : `Thinking: ${THINKING_MODES.find(m => m.id === thinkingMode)?.label}`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>{THINKING_MODES.find(m => m.id === thinkingMode)?.label}</span>
            </button>

            {showThinkingDropdown && (
              <div className="absolute bottom-full left-0 mb-2 w-56 glass-dropdown rounded-xl shadow-xl border border-dark-700/50 overflow-hidden scale-in z-50">
                <div className="p-2 border-b border-dark-700/30">
                  <p className="text-xs font-medium text-dark-400 px-2">Thinking Mode</p>
                  <p className="text-[10px] text-dark-500 px-2 mt-0.5">Controls reasoning depth</p>
                </div>
                <div className="p-1">
                  {THINKING_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleThinkingModeChange(mode.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-150 ${thinkingMode === mode.id
                        ? 'bg-accent/10 text-accent'
                        : 'hover:bg-dark-700/50 text-dark-300 hover:text-dark-100'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${mode.id === 'off' ? 'bg-dark-500' :
                          mode.id === 'low' ? 'bg-green-400' :
                            mode.id === 'medium' ? 'bg-yellow-400' :
                              mode.id === 'high' ? 'bg-orange-400' :
                                'bg-red-400'
                          }`} />
                        <div>
                          <p className="text-xs font-medium">{mode.label}</p>
                          <p className="text-[10px] text-dark-500">{mode.description}</p>
                        </div>
                      </div>
                      {thinkingMode === mode.id && (
                        <Check className="w-3.5 h-3.5 text-accent" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default InputBar;
