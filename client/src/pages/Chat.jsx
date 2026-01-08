import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Plus, Settings as SettingsIcon, LogOut, Brain, 
  Send, Trash2, GitBranch, Bot, User as UserIcon,
  Sparkles, Zap, Menu, X, ChevronDown, ChevronRight, Square,
  Check, Trash
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
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

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
                // Auto-expand thinking section when reasoning starts
                if (!isThinkingExpanded) {
                  setIsThinkingExpanded(true);
                }
              } else if (data.type === 'content') {
                setStreamingMessage(prev => prev + data.content);
              } else if (data.type === 'done') {
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

  const ThinkingSection = ({ reasoning, isExpanded, onToggle, isStreaming }) => {
    if (!reasoning && !isStreaming) return null;
    
    return (
      <div className="mb-4 overflow-hidden rounded-xl border border-dark-700/50 bg-dark-800/30">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-dark-400 hover:bg-dark-700/30 transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Brain className="w-4 h-4 text-accent-400" />
          <span>{isStreaming ? 'Thinking...' : 'Thought Process'}</span>
          {isStreaming && <div className="ml-auto w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>}
        </button>
        {isExpanded && (
          <div className="px-4 py-3 text-sm text-dark-300 border-t border-dark-700/50 italic bg-dark-900/30 whitespace-pre-wrap text-left">
            {reasoning || 'Thinking...'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-dark-950 bg-mesh">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 glass-sidebar flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-dark-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg gradient-text">Budi Chat</h1>
                <p className="text-xs text-dark-400">{user?.name}</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={createNewChat}
            className="w-full gradient-primary text-white py-2.5 rounded-lg font-medium hover:shadow-glow transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`group p-3 rounded-lg cursor-pointer transition-all ${
                currentChat?.id === chat.id
                  ? 'glass-card border-primary-500/30'
                  : 'hover:bg-dark-800/50 border border-transparent'
              }`}
              onClick={() => setCurrentChat(chat)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-dark-100">{chat.title}</p>
                  <p className="text-xs text-dark-400 mt-1">
                    {chat.message_count} messages
                    {chat.agent_mode === 1 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-accent-400">
                        <Zap className="w-3 h-3" />
                        Agent
                      </span>
                    )}
                  </p>
                </div>
                
                <div className="flex items-center gap-1">
                  {deletingChatId === chat.id ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                        className="p-1 hover:bg-green-500/20 rounded transition-all"
                        title="Confirm Delete"
                      >
                        <Check className="w-4 h-4 text-green-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingChatId(null);
                        }}
                        className="p-1 hover:bg-red-500/20 rounded transition-all"
                        title="Cancel"
                      >
                        <X className="w-4 h-4 text-red-400" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingChatId(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                      title="Delete Chat"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-dark-700/50 space-y-2">
          <button
            onClick={() => navigate('/memories')}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg glass-button transition-all text-sm font-medium text-dark-200"
          >
            <Brain className="w-4 h-4 text-accent-400" />
            Memories
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg glass-button transition-all text-sm font-medium text-dark-200"
          >
            <SettingsIcon className="w-4 h-4 text-dark-400" />
            Settings
          </button>
          {user?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg glass-button transition-all text-sm font-medium text-accent-400"
            >
              <Sparkles className="w-4 h-4" />
              Admin Panel
            </button>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-red-500/20 transition-all text-sm font-medium text-red-400"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="glass border-b border-dark-700/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-dark-700/50 rounded-lg transition-all"
            >
              {showSidebar ? <X className="w-5 h-5 text-dark-300" /> : <Menu className="w-5 h-5 text-dark-300" />}
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
              <span className="flex items-center gap-1 px-2.5 py-1 bg-accent-500/20 text-accent-300 rounded-full text-xs font-medium border border-accent-500/30">
                <Zap className="w-3 h-3" />
                Agent Mode
              </span>
            )}

            {!currentChat && (
              <p className="text-dark-400">Select a chat or create a new one</p>
            )}
          </div>

          {currentChat && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 flex items-center gap-2 glass-button rounded-lg transition-all text-sm font-medium text-dark-200"
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
            </button>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && currentChat && (
          <div className="glass border-b border-dark-700/50 p-6">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Model
                  </label>
                  <ModelSelector
                    selectedModel={chatSettings.model}
                    onModelChange={handleModelChange}
                    isDropdown={false}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Temperature: {chatSettings.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={chatSettings.temperature}
                    onChange={(e) => setChatSettings({ ...chatSettings, temperature: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={chatSettings.system_prompt}
                  onChange={(e) => setChatSettings({ ...chatSettings, system_prompt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg glass-input outline-none resize-none text-dark-100 bg-dark-800"
                  rows="3"
                  placeholder="Set a custom system prompt for this chat..."
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chatSettings.agent_mode}
                    onChange={(e) => setChatSettings({ ...chatSettings, agent_mode: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-dark-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent-400" />
                    Enable Agent Mode (with tools)
                  </span>
                </label>

                <button
                  onClick={updateChatSettings}
                  className="px-4 py-2 gradient-primary text-white rounded-lg font-medium hover:shadow-glow transition-all"
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
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full glass-card mb-4">
                    <Bot className="w-8 h-8 text-primary-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-dark-100 mb-2">Start a conversation</h3>
                  <p className="text-dark-400">Type a message below to begin chatting with AI</p>
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
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        renderMessage(message.content)
                      )}
                    </div>

                    {message.role === 'assistant' && (
                      <div className="mt-2 flex gap-2">
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
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-primary mb-6 shadow-glow-lg">
                  <MessageSquare className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold gradient-text mb-2">Welcome to Budi Chat</h2>
                <p className="text-dark-400 mb-6">Create a new chat to get started</p>
                <button
                  onClick={createNewChat}
                  className="px-6 py-3 gradient-primary text-white rounded-lg font-medium hover:shadow-glow transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Chat
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        {currentChat && (
          <div className="border-t border-dark-700/50 glass p-4">
            <div className="max-w-4xl mx-auto">
              {streaming && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={stopGeneration}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-all"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop Generating
                  </button>
                </div>
              )}
              <form onSubmit={sendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={streaming ? "AI is responding..." : "Type your message..."}
                  className="flex-1 px-4 py-3 rounded-xl glass-input outline-none text-dark-100 bg-dark-800/50"
                  disabled={streaming}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || streaming}
                  className="px-6 py-3 gradient-primary text-white rounded-xl font-medium hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Fork Modal */}
      {showForkModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary-400" />
                Fork Chat
              </h3>
              <button
                onClick={() => setShowForkModal(false)}
                className="p-1 hover:bg-dark-700/50 rounded transition-colors"
              >
                <X className="w-5 h-5 text-dark-400" />
              </button>
            </div>

            <p className="text-dark-400 text-sm mb-4">
              Create a new chat branch from this point. You can choose a different model for the forked chat.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Model for forked chat
              </label>
              <ModelSelector
                selectedModel={forkModel}
                onModelChange={setForkModel}
                isDropdown={false}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForkModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg glass-button text-dark-200 font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={forkChat}
                className="flex-1 px-4 py-2.5 rounded-lg gradient-primary text-white font-medium hover:shadow-glow transition-all flex items-center justify-center gap-2"
              >
                <GitBranch className="w-4 h-4" />
                Fork Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
