import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Plus, Settings as SettingsIcon, LogOut, Brain,
  Send, Trash2, GitBranch, Bot, User as UserIcon,
  Sparkles, Zap, Menu, X, ChevronDown, ChevronRight, Square,
  Check, Trash, Copy, Pencil, Info, DollarSign, Hash
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ModelSelector, { DEFAULT_MODEL, RECENT_MODELS_KEY } from '../components/ModelSelector';

marked.setOptions({
  breaks: true,
  gfm: true
});

const LAST_MODEL_KEY = 'budi_chat_last_model';

function Chat() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showForkModal, setShowForkModal] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState(null);
  const [forkMessageId, setForkMessageId] = useState(null);
  const [forkModel, setForkModel] = useState(DEFAULT_MODEL);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [usageStats, setUsageStats] = useState(null);

  const [chatSettings, setChatSettings] = useState({
    model: localStorage.getItem(LAST_MODEL_KEY) || DEFAULT_MODEL,
    temperature: 0.7,
    system_prompt: '',
    agent_mode: false
  });

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    // Clear state immediately when switching chats or if no chat is selected
    setMessages([]);
    setStreamingMessage('');
    setStreamingReasoning('');
    setStreaming(false);
    setUsageStats(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (currentChat?.id) {
      loadMessages(currentChat.id);
    }
  }, [currentChat?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    try {
      const res = await fetch('/api/chats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setChats(data);
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const loadMessages = async (chatId) => {
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setMessages(data.messages || []);
      setChatSettings({
        model: data.model,
        temperature: data.temperature,
        system_prompt: data.system_prompt || '',
        agent_mode: !!data.agent_mode
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const createNewChat = async () => {
    const modelToUse = localStorage.getItem(LAST_MODEL_KEY) || DEFAULT_MODEL;
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: 'New Chat',
          model: modelToUse,
          temperature: 0.7,
          system_prompt: '',
          agent_mode: false
        })
      });
      const data = await res.json();
      setChats([data, ...chats]);
      setCurrentChat(data);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const updateChatSettings = async () => {
    if (!currentChat) return;

    try {
      await fetch(`/api/chats/${currentChat.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(chatSettings)
      });
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to update chat:', error);
    }
  };

  const handleModelChange = async (modelId) => {
    // Save as last used model
    localStorage.setItem(LAST_MODEL_KEY, modelId);
    
    setChatSettings(prev => ({ ...prev, model: modelId }));

    // If we have a current chat, update it immediately
    if (currentChat) {
      try {
        await fetch(`/api/chats/${currentChat.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ ...chatSettings, model: modelId })
        });
      } catch (error) {
        console.error('Failed to update chat model:', error);
      }
    }
  };

  const deleteChat = async (chatId) => {
    try {
      await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setChats(chats.filter(c => c.id !== chatId));
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
        setMessages([]);
      }
      setDeletingChatId(null);
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const openForkModal = (messageId) => {
    setForkMessageId(messageId);
    setForkModel(chatSettings.model);
    setShowForkModal(true);
  };

  const forkChat = async () => {
    if (!currentChat || !forkMessageId) return;

    try {
      const res = await fetch(`/api/chats/${currentChat.id}/fork`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          message_id: forkMessageId,
          model: forkModel 
        })
      });
      const data = await res.json();
      setChats([data, ...chats]);
      setCurrentChat(data);
      setShowForkModal(false);
      setForkMessageId(null);
      
      // Save the fork model as last used
      localStorage.setItem(LAST_MODEL_KEY, forkModel);
    } catch (error) {
      console.error('Failed to fork chat:', error);
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStreaming(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentChat || streaming) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setStreaming(true);
    setStreamingMessage('');
    setStreamingReasoning('');

    abortControllerRef.current = new AbortController();

    // Add user message to UI immediately
    const tempUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const res = await fetch(`/api/messages/${currentChat.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: userMessage }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'reasoning') {
                setStreamingReasoning(prev => prev + data.content);
              } else if (data.type === 'content') {
                setStreamingMessage(prev => prev + data.content);
              } else if (data.type === 'done') {
                // Capture usage data if provided
                if (data.usage) {
                  setUsageStats(prev => ({
                    ...prev,
                    lastMessage: {
                      promptTokens: data.usage.prompt_tokens || 0,
                      completionTokens: data.usage.completion_tokens || 0,
                      totalTokens: data.usage.total_tokens || 0,
                      model: data.model
                    },
                    totalPromptTokens: (prev?.totalPromptTokens || 0) + (data.usage.prompt_tokens || 0),
                    totalCompletionTokens: (prev?.totalCompletionTokens || 0) + (data.usage.completion_tokens || 0),
                    totalTokens: (prev?.totalTokens || 0) + (data.usage.total_tokens || 0),
                    messageCount: (prev?.messageCount || 0) + 1
                  }));
                }
                // Don't clear streaming states immediately - let loadMessages handle it
                // This prevents the thinking section from disappearing before the message is added
                loadMessages(currentChat.id);
                loadChats();
                // Clear streaming states after a short delay to ensure smooth transition
                setTimeout(() => {
                  setStreamingMessage('');
                  setStreamingReasoning('');
                }, 100);
              } else if (data.type === 'error') {
                alert('Error: ' + data.error);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Generation aborted');
      } else {
        console.error('Failed to send message:', error);
        alert(error.message || 'Failed to send message. Please check your API key configuration.');
      }
    } finally {
      setStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const renderMessage = (content) => {
    const html = DOMPurify.sanitize(marked(content || ''));
    return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const stripMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/#{1,6}\s?/g, '')           // headers
      .replace(/\*\*(.+?)\*\*/g, '$1')     // bold
      .replace(/\*(.+?)\*/g, '$1')         // italic
      .replace(/__(.+?)__/g, '$1')         // bold alt
      .replace(/_(.+?)_/g, '$1')           // italic alt
      .replace(/`{3}[\s\S]*?`{3}/g, '')    // code blocks
      .replace(/`(.+?)`/g, '$1')           // inline code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')  // links
      .replace(/!\[.*?\]\(.+?\)/g, '')     // images
      .replace(/^\s*[-*+]\s/gm, '')        // unordered lists
      .replace(/^\s*\d+\.\s/gm, '')        // ordered lists
      .replace(/>\s?/g, '')                // blockquotes
      .replace(/---/g, '')                 // horizontal rules
      .trim();
  };

  const handleCopy = async (messageId, content, type) => {
    const textToCopy = type === 'raw' ? stripMarkdown(content) : content;
    await navigator.clipboard.writeText(textToCopy);
    setCopiedMessageId(`${messageId}-${type}`);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleEditStart = (message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleEditSave = async (messageId) => {
    if (!editContent.trim() || !currentChat) return;
    
    try {
      // 1. Delete branch from this message onward
      const res = await fetch(`/api/messages/${messageId}/branch`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!res.ok) throw new Error('Failed to delete message branch');

      // 2. Trigger new message with edited content
      // We manually call sendMessage implementation
      const userMessage = editContent.trim();
      setEditingMessageId(null);
      setEditContent('');
      setStreaming(true);
      setStreamingMessage('');
      setStreamingReasoning('');
      abortControllerRef.current = new AbortController();

      // Update UI: load messages again to show the deletion
      await loadMessages(currentChat.id);

      // Add temporary user message to UI for responsiveness
      const tempUserMessage = {
        id: Date.now(),
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempUserMessage]);

      // Trigger the API call to start regeneration
      const sendRes = await fetch(`/api/messages/${currentChat.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: userMessage }),
        signal: abortControllerRef.current.signal
      });

      if (!sendRes.ok) {
        const errorData = await sendRes.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const reader = sendRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'reasoning') {
                setStreamingReasoning(prev => prev + data.content);
              } else if (data.type === 'content') {
                setStreamingMessage(prev => prev + data.content);
              } else if (data.type === 'done') {
                loadMessages(currentChat.id);
                loadChats();
                setTimeout(() => {
                  setStreamingMessage('');
                  setStreamingReasoning('');
                }, 100);
              } else if (data.type === 'error') {
                alert('Error: ' + data.error);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Generation aborted');
      } else {
        console.error('Failed to edit message:', error);
        alert('Failed to edit message: ' + error.message);
      }
      setStreaming(false);
    }
  };

  const ThinkingSection = ({ reasoning, isExpanded, onToggle, isStreaming }) => {
    if (!reasoning && !isStreaming) return null;

    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-medium text-dark-400 hover:text-dark-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.03]"
        >
          <Brain className="w-4 h-4 text-accent-400" />
          <span>{isStreaming ? 'Thinking...' : 'Thought Process'}</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        {isExpanded && (
          <div className="mt-2 px-4 py-3 text-sm text-dark-300 rounded-xl border border-white/[0.06] italic bg-dark-900/40 whitespace-pre-wrap text-left max-h-[300px] overflow-y-auto">
            {reasoning || 'Thinking...'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-dark-950 bg-mesh">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 ease-out glass-sidebar flex flex-col overflow-hidden`}>
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg glow">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-dark-900"></div>
            </div>
            <div>
              <h1 className="font-bold text-lg gradient-text tracking-tight">Budi Chat</h1>
              <p className="text-xs text-dark-400 font-medium">{user?.name}</p>
            </div>
          </div>

          <button
            onClick={createNewChat}
            className="w-full gradient-primary text-white py-3 rounded-xl font-semibold hover:shadow-glow transition-all duration-200 flex items-center justify-center gap-2 shine active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {chats.length === 0 && (
            <div className="text-center py-8 px-4">
              <div className="w-12 h-12 rounded-xl bg-dark-800/50 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-dark-500" />
              </div>
              <p className="text-sm text-dark-400">No chats yet</p>
              <p className="text-xs text-dark-500 mt-1">Create a new chat to get started</p>
            </div>
          )}
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`group p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                currentChat?.id === chat.id
                  ? 'glass-card border-primary-500/20 shadow-lg'
                  : 'hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]'
              }`}
              onClick={() => setCurrentChat(chat)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm truncate ${currentChat?.id === chat.id ? 'text-dark-50' : 'text-dark-200'}`}>{chat.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-dark-500">{chat.message_count} messages</span>
                    {chat.agent_mode === 1 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-500/10 text-accent-400 text-[10px] font-medium">
                        <Zap className="w-2.5 h-2.5" />
                        Agent
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {deletingChatId === chat.id ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                        className="p-1.5 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-all"
                        title="Confirm Delete"
                      >
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingChatId(null);
                        }}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingChatId(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Delete Chat"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-dark-400 hover:text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1">
          <button
            onClick={() => navigate('/memories')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl glass-button transition-all text-sm font-medium text-dark-300 hover:text-dark-100"
          >
            <Brain className="w-4 h-4 text-accent-400" />
            Memories
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl glass-button transition-all text-sm font-medium text-dark-300 hover:text-dark-100"
          >
            <SettingsIcon className="w-4 h-4 text-dark-400" />
            Settings
          </button>
          {user?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl glass-button transition-all text-sm font-medium text-accent-400 hover:text-accent-300"
            >
              <Sparkles className="w-4 h-4" />
              Admin Panel
            </button>
          )}
          <div className="divider-gradient my-2"></div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-500/10 transition-all text-sm font-medium text-dark-400 hover:text-red-400"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="glass border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-white/[0.05] rounded-xl transition-all duration-200"
            >
              {showSidebar ? <X className="w-5 h-5 text-dark-400" /> : <Menu className="w-5 h-5 text-dark-400" />}
            </button>

            {/* Model Selector */}
            {currentChat && (
              <ModelSelector
                selectedModel={chatSettings.model}
                onModelChange={handleModelChange}
                isDropdown={true}
              />
            )}

            {currentChat && chatSettings.agent_mode && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500/10 text-accent-400 rounded-lg text-xs font-semibold border border-accent-500/20">
                <Zap className="w-3 h-3" />
                Agent Mode
              </span>
            )}

            {!currentChat && (
              <p className="text-dark-500 text-sm">Select a chat or create a new one</p>
            )}
          </div>

          {currentChat && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInfoModal(true)}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  showInfoModal
                    ? 'bg-accent-500/10 text-accent-400 border border-accent-500/20'
                    : 'glass-button text-dark-400 hover:text-dark-200'
                }`}
                title="Usage Stats"
              >
                <Info className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`px-4 py-2 flex items-center gap-2 rounded-xl transition-all duration-200 text-sm font-medium ${
                  showSettings
                    ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                    : 'glass-button text-dark-300 hover:text-dark-100'
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </button>
            </div>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && currentChat && (
          <div className="glass border-b border-white/[0.06] p-6 scale-in">
            <div className="max-w-4xl mx-auto space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Model
                  </label>
                  <ModelSelector
                    selectedModel={chatSettings.model}
                    onModelChange={handleModelChange}
                    isDropdown={true}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Temperature
                    <span className="ml-2 px-2 py-0.5 bg-dark-800/50 rounded-md text-xs text-primary-400 font-mono">
                      {chatSettings.temperature}
                    </span>
                  </label>
                  <div className="pt-2">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={chatSettings.temperature}
                      onChange={(e) => setChatSettings({ ...chatSettings, temperature: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-dark-500 mt-1">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={chatSettings.system_prompt}
                  onChange={(e) => setChatSettings({ ...chatSettings, system_prompt: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl glass-input outline-none resize-none text-dark-100 placeholder-dark-500 text-sm"
                  rows="3"
                  placeholder="Set a custom system prompt for this chat..."
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={chatSettings.agent_mode}
                    onChange={(e) => setChatSettings({ ...chatSettings, agent_mode: e.target.checked })}
                    className="w-5 h-5 rounded-md"
                  />
                  <span className="text-sm font-medium text-dark-300 flex items-center gap-2 group-hover:text-dark-200 transition-colors">
                    <Zap className="w-4 h-4 text-accent-400" />
                    Enable Agent Mode
                    <span className="text-xs text-dark-500">(with tools)</span>
                  </span>
                </label>

                <button
                  onClick={updateChatSettings}
                  className="px-5 py-2.5 gradient-primary text-white rounded-xl font-semibold hover:shadow-glow transition-all duration-200 active:scale-[0.98]"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentChat ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.length === 0 && !streaming && (
                <div className="text-center py-16 fade-in">
                  <div className="relative inline-block mb-6">
                    <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-lg glow-lg">
                      <Bot className="w-10 h-10 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full gradient-primary flex items-center justify-center shadow-lg">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-dark-100 mb-3 tracking-tight">Start a conversation</h3>
                  <p className="text-dark-400 max-w-sm mx-auto">Type a message below to begin chatting with AI. I'm here to help with anything you need.</p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'gradient-primary shadow-glow'
                      : 'glass-card'
                  }`}>
                    {message.role === 'user' ? (
                      <UserIcon className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-primary-400" />
                    )}
                  </div>

                  <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                    {message.role === 'assistant' && message.reasoning_content && (
                      <div className="text-left">
                        <ThinkingSection 
                          reasoning={message.reasoning_content} 
                          isExpanded={isThinkingExpanded} 
                          onToggle={() => setIsThinkingExpanded(!isThinkingExpanded)} 
                          isStreaming={false}
                        />
                      </div>
                    )}
                    <div className={`inline-block max-w-[80%] ${
                      message.role === 'user'
                        ? 'gradient-primary text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-glow'
                        : 'glass-card rounded-2xl rounded-tl-sm px-4 py-3 text-left'
                    }`}>
                      {message.role === 'user' ? (
                        editingMessageId === message.id ? (
                          <div className="space-y-2 text-left">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full min-w-[300px] bg-dark-800/50 border border-dark-600 rounded-lg p-2 text-white resize-none focus:outline-none focus:border-primary-400"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={handleEditCancel}
                                className="px-3 py-1 text-xs rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleEditSave(message.id)}
                                className="px-3 py-1 text-xs rounded-lg bg-primary-500 hover:bg-primary-400 transition-colors"
                              >
                                Save & Regenerate
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )
                      ) : (
                        renderMessage(message.content)
                      )}
                    </div>

                    {message.role === 'user' && editingMessageId !== message.id && (
                      <div className="mt-2 flex gap-2 justify-end">
                        <button
                          onClick={() => handleCopy(message.id, message.content, 'raw')}
                          className="text-xs text-dark-400 hover:text-primary-400 flex items-center gap-1 transition-colors"
                        >
                          {copiedMessageId === `${message.id}-raw` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedMessageId === `${message.id}-raw` ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => handleEditStart(message)}
                          className="text-xs text-dark-400 hover:text-primary-400 flex items-center gap-1 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      </div>
                    )}

                    {message.role === 'assistant' && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleCopy(message.id, message.content, 'raw')}
                          className="text-xs text-dark-400 hover:text-primary-400 flex items-center gap-1 transition-colors"
                        >
                          {copiedMessageId === `${message.id}-raw` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedMessageId === `${message.id}-raw` ? 'Copied!' : 'Copy Raw'}
                        </button>
                        <button
                          onClick={() => handleCopy(message.id, message.content, 'markdown')}
                          className="text-xs text-dark-400 hover:text-primary-400 flex items-center gap-1 transition-colors"
                        >
                          {copiedMessageId === `${message.id}-markdown` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedMessageId === `${message.id}-markdown` ? 'Copied!' : 'Copy Markdown'}
                        </button>
                        <button
                          onClick={() => openForkModal(message.id)}
                          className="text-xs text-dark-400 hover:text-primary-400 flex items-center gap-1 transition-colors"
                        >
                          <GitBranch className="w-3 h-3" />
                          Fork from here
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              ))}

              {(streaming || streamingMessage || streamingReasoning) && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full glass-card flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary-400" />
                  </div>
                  <div className="flex-1">
                    {(streamingReasoning || (streaming && !streamingMessage)) && (
                      <ThinkingSection 
                        reasoning={streamingReasoning} 
                        isExpanded={isThinkingExpanded} 
                        onToggle={() => setIsThinkingExpanded(!isThinkingExpanded)} 
                        isStreaming={!streamingMessage || (streamingReasoning && streaming)}
                      />
                    )}
                    
                    {streamingMessage && (
                      <div className="inline-block max-w-[80%] glass-card rounded-2xl rounded-tl-sm px-4 py-3">
                        {renderMessage(streamingMessage)}
                      </div>
                    )}

                    {streaming && !streamingMessage && !streamingReasoning && (
                      <div className="inline-block glass-card rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center fade-in">
              <div className="text-center max-w-md mx-auto px-4">
                <div className="relative inline-block mb-8">
                  <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center shadow-2xl glow-lg">
                    <MessageSquare className="w-12 h-12 text-white" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-accent-500 flex items-center justify-center shadow-lg glow-accent">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold gradient-text mb-3 tracking-tight">Welcome to Budi Chat</h2>
                <p className="text-dark-400 mb-8 text-base">Your AI-powered conversation assistant. Create a new chat to get started.</p>
                <button
                  onClick={createNewChat}
                  className="px-8 py-4 gradient-primary text-white rounded-2xl font-semibold hover:shadow-glow transition-all duration-200 inline-flex items-center gap-3 shine active:scale-[0.98]"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Chat
                </button>
                <div className="mt-8 flex items-center justify-center gap-6 text-xs text-dark-500">
                  <span className="flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    Multiple AI models
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Agent mode
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />
                    Memories
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        {currentChat && (
          <div className="border-t border-white/[0.06] glass p-4">
            <div className="max-w-4xl mx-auto">
              {streaming && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={stopGeneration}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition-all duration-200 active:scale-[0.98]"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop Generating
                  </button>
                </div>
              )}
              <form onSubmit={sendMessage} className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={streaming ? "AI is responding..." : "Type your message..."}
                    className="w-full px-5 py-3.5 rounded-2xl glass-input outline-none text-dark-100 placeholder-dark-500 text-sm pr-4"
                    disabled={streaming}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || streaming}
                  className="px-6 py-3.5 gradient-primary text-white rounded-2xl font-semibold hover:shadow-glow transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center gap-2 active:scale-[0.98] shine"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Fork Modal */}
      {showForkModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center z-50 scale-in">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-dark-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-lg">
                  <GitBranch className="w-4 h-4 text-white" />
                </div>
                Fork Chat
              </h3>
              <button
                onClick={() => setShowForkModal(false)}
                className="p-2 hover:bg-white/[0.05] rounded-xl transition-all duration-200"
              >
                <X className="w-5 h-5 text-dark-400" />
              </button>
            </div>

            <p className="text-dark-400 text-sm mb-5 leading-relaxed">
              Create a new chat branch from this point. You can choose a different model for the forked chat.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Model for forked chat
              </label>
              <ModelSelector
                selectedModel={forkModel}
                onModelChange={setForkModel}
                isDropdown={true}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForkModal(false)}
                className="flex-1 px-4 py-3 rounded-xl glass-button text-dark-300 font-semibold transition-all duration-200 hover:text-dark-100"
              >
                Cancel
              </button>
              <button
                onClick={forkChat}
                className="flex-1 px-4 py-3 rounded-xl gradient-primary text-white font-semibold hover:shadow-glow transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] shine"
              >
                <GitBranch className="w-4 h-4" />
                Fork Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Stats Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center z-50 scale-in">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-dark-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center">
                  <Info className="w-4 h-4 text-accent-400" />
                </div>
                Session Usage
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-2 hover:bg-white/[0.05] rounded-xl transition-all duration-200"
              >
                <X className="w-5 h-5 text-dark-400" />
              </button>
            </div>

            {usageStats ? (
              <div className="space-y-4">
                {/* Last Message Stats */}
                {usageStats.lastMessage && (
                  <div className="p-4 rounded-xl bg-dark-800/30 border border-white/[0.06]">
                    <h4 className="text-sm font-medium text-dark-400 mb-3">Last Response</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-primary-400" />
                        <div>
                          <p className="text-xs text-dark-500">Input</p>
                          <p className="text-sm font-semibold text-dark-200">{usageStats.lastMessage.promptTokens.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-accent-400" />
                        <div>
                          <p className="text-xs text-dark-500">Output</p>
                          <p className="text-sm font-semibold text-dark-200">{usageStats.lastMessage.completionTokens.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Session Totals */}
                <div className="p-4 rounded-xl bg-dark-800/30 border border-white/[0.06]">
                  <h4 className="text-sm font-medium text-dark-400 mb-3">Session Totals</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-dark-400">Total Tokens</span>
                      <span className="text-sm font-semibold text-dark-200">{usageStats.totalTokens?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-dark-400">Input Tokens</span>
                      <span className="text-sm font-medium text-primary-400">{usageStats.totalPromptTokens?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-dark-400">Output Tokens</span>
                      <span className="text-sm font-medium text-accent-400">{usageStats.totalCompletionTokens?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-dark-400">AI Responses</span>
                      <span className="text-sm font-medium text-dark-200">{usageStats.messageCount || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Token Usage Bar */}
                <div className="p-4 rounded-xl bg-dark-800/30 border border-white/[0.06]">
                  <h4 className="text-sm font-medium text-dark-400 mb-3">Token Distribution</h4>
                  <div className="h-3 bg-dark-700/50 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
                      style={{ width: `${usageStats.totalTokens ? (usageStats.totalPromptTokens / usageStats.totalTokens * 100) : 50}%` }}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all duration-500"
                      style={{ width: `${usageStats.totalTokens ? (usageStats.totalCompletionTokens / usageStats.totalTokens * 100) : 50}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-primary-400">Input {usageStats.totalTokens ? Math.round(usageStats.totalPromptTokens / usageStats.totalTokens * 100) : 0}%</span>
                    <span className="text-accent-400">Output {usageStats.totalTokens ? Math.round(usageStats.totalCompletionTokens / usageStats.totalTokens * 100) : 0}%</span>
                  </div>
                </div>

                <p className="text-xs text-dark-500 text-center">
                  Stats are tracked per session and reset when switching chats
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-xl bg-dark-800/50 flex items-center justify-center mx-auto mb-4">
                  <Hash className="w-8 h-8 text-dark-500" />
                </div>
                <p className="text-dark-400 font-medium">No usage data yet</p>
                <p className="text-sm text-dark-500 mt-1">Send a message to see token usage stats</p>
              </div>
            )}

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full mt-5 px-4 py-3 rounded-xl glass-button text-dark-300 font-semibold transition-all duration-200 hover:text-dark-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
