import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, MessageSquare, FileText, Clock, ChevronRight } from 'lucide-react';

function SearchModal({ isOpen, onClose, onSelectChat, onSelectMessage }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ chats: [], messages: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults({ chats: [], messages: [] });
      setActiveTab('all');
    }
  }, [isOpen]);

  // Handle keyboard shortcut to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Debounced search
  const search = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults({ chats: [], messages: [] });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=${activeTab}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      const data = await res.json();
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Debounce input changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  const handleChatClick = (chat) => {
    onSelectChat(chat.id);
    onClose();
  };

  const handleMessageClick = (message) => {
    onSelectMessage(message.chat_id, message.message_id);
    onClose();
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const renderHighlightedText = (html) => {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (!isOpen) return null;

  const hasResults = results.chats?.length > 0 || results.messages?.length > 0;

  return (
    <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-start justify-center z-50 pt-[10vh] scale-in">
      <div className="glass-card rounded-2xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden">
        {/* Search Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-dark-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats and messages..."
              className="flex-1 bg-transparent text-dark-100 placeholder-dark-500 outline-none text-lg"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-dark-500 px-2 py-1 rounded bg-dark-800/50">ESC</span>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/[0.05] rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5 text-dark-400" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'all', label: 'All' },
              { id: 'chats', label: 'Chat Titles' },
              { id: 'messages', label: 'Messages' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-white/[0.03]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-dark-400 text-sm mt-2">Searching...</p>
            </div>
          ) : !query.trim() ? (
            <div className="p-8 text-center">
              <Search className="w-12 h-12 text-dark-700 mx-auto mb-3" />
              <p className="text-dark-400 text-sm">Type to search your conversations</p>
              <p className="text-dark-500 text-xs mt-1">Press <kbd className="px-1.5 py-0.5 rounded bg-dark-800 text-dark-300">Cmd/Ctrl + K</kbd> anytime to search</p>
            </div>
          ) : !hasResults ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-dark-700 mx-auto mb-3" />
              <p className="text-dark-400 text-sm">No results found for "{query}"</p>
              <p className="text-dark-500 text-xs mt-1">Try different keywords</p>
            </div>
          ) : (
            <div className="p-2">
              {/* Chat Results */}
              {results.chats?.length > 0 && (activeTab === 'all' || activeTab === 'chats') && (
                <div className="mb-4">
                  <div className="px-3 py-2 text-xs font-semibold text-dark-500 uppercase tracking-wider">
                    Chats ({results.totalChats || results.chats.length})
                  </div>
                  {results.chats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => handleChatClick(chat)}
                      className="w-full p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200 text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-4 h-4 text-primary-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-dark-200 truncate search-highlight">
                              {renderHighlightedText(chat.title_snippet || chat.title)}
                            </span>
                            <ChevronRight className="w-4 h-4 text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-dark-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(chat.created_at)}
                            </span>
                            <span>{chat.message_count} messages</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Message Results */}
              {results.messages?.length > 0 && (activeTab === 'all' || activeTab === 'messages') && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-dark-500 uppercase tracking-wider">
                    Messages ({results.totalMessages || results.messages.length})
                  </div>
                  {results.messages.map((message) => (
                    <button
                      key={message.message_id}
                      onClick={() => handleMessageClick(message)}
                      className="w-full p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200 text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          message.role === 'user'
                            ? 'bg-dark-700'
                            : 'bg-accent-500/10'
                        }`}>
                          <FileText className={`w-4 h-4 ${
                            message.role === 'user' ? 'text-dark-300' : 'text-accent-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-dark-400">{message.chat_title}</span>
                            <span className="text-xs text-dark-600">•</span>
                            <span className={`text-xs ${message.role === 'user' ? 'text-dark-500' : 'text-accent-400'}`}>
                              {message.role === 'user' ? 'You' : 'AI'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                          </div>
                          <p className="text-sm text-dark-300 line-clamp-2 search-highlight">
                            {renderHighlightedText(message.content_snippet || message.content)}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-dark-500">
                            <Clock className="w-3 h-3" />
                            {formatDate(message.created_at)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasResults && (
          <div className="p-3 border-t border-white/[0.06] text-center">
            <p className="text-xs text-dark-500">
              Found {results.total} result{results.total !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchModal;
