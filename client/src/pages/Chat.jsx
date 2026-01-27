import React, { useState, useEffect, useContext, useRef, memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Plus, Settings as SettingsIcon, LogOut, Brain,
  Send, Trash2, GitBranch, Bot, User as UserIcon,
  Sparkles, Zap, Menu, X, ChevronDown, ChevronRight, Square,
  Check, Trash, Copy, Pencil, Info, DollarSign, Hash, Lightbulb, Search, Share2, Code, FileText

} from 'lucide-react';
import SearchModal from '../components/SearchModal';
import ExportMenu from '../components/ExportMenu';
import ShareDialog from '../components/ShareDialog';
import ImageUpload from '../components/ImageUpload';
import ImageGeneration from '../components/ImageGeneration';
import VoiceInput from '../components/VoiceInput';
import TextToSpeech from '../components/TextToSpeech';
import Canvas from '../components/Canvas';
import { AuthContext } from '../contexts/AuthContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ModelSelector, { DEFAULT_MODEL, RECENT_MODELS_KEY, MODELS_CACHE_KEY, modelSupportsReasoning } from '../components/ModelSelector';

marked.setOptions({
  breaks: true,
  gfm: true
});


const LAST_MODEL_KEY = 'budi_chat_last_model';


// Format time as seconds or minutes:seconds (integer display)
const formatThinkingTime = (seconds) => {
  const s = Math.floor(seconds);
  if (s < 60) {
    return `${s}s`;
  }
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

// Get model data from OpenRouter cache
const getModelFromCache = (modelId) => {
  try {
    const cached = localStorage.getItem(MODELS_CACHE_KEY);
    if (cached) {
      const { models } = JSON.parse(cached);
      return models.find(m => m.id === modelId);
    }
  } catch (e) {
    console.error('Failed to get model from cache:', e);
  }
  return null;
};

// Get context window size for a model (from cache or fallback)
const getModelContext = (modelId) => {
  const model = getModelFromCache(modelId);
  return model?.contextLength || 128000; // fallback to 128k
};

// Calculate cost using cached pricing data
const calculateCost = (promptTokens, completionTokens, modelId) => {
  const model = getModelFromCache(modelId);
  if (model?.pricing) {
    const inputCost = promptTokens * parseFloat(model.pricing.prompt);
    const outputCost = completionTokens * parseFloat(model.pricing.completion);
    return inputCost + outputCost;
  }
  // Fallback: rough estimate
  return (promptTokens + completionTokens) * 0.000001;
};

// Format model ID into a readable name
const formatModelName = (modelId) => {
  if (!modelId) return 'Assistant';

  // Try to find in cache first for proper official name
  const model = getModelFromCache(modelId);
  if (model?.name) {
    // Strip provider prefix if present (e.g. "Google: Gemini 2.5 Flash" -> "Gemini 2.5 Flash")
    if (model.name.includes(': ')) {
      return model.name.split(': ')[1];
    }
    return model.name;
  }

  // Fallback: clean up the ID (e.g. "google/gemini-2.5-pro" -> "Gemini 2.5 Pro")
  const parts = modelId.split('/');
  const name = parts[parts.length - 1];
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

// Memoized ThinkingSection component to prevent re-renders during streaming
const ThinkingSection = memo(({ reasoning, isExpanded, onToggle, isStreaming, elapsedTime, stats }) => {
  const contentRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    if (isExpanded && isStreaming && shouldAutoScrollRef.current) {
      const scroll = () => {
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
      };
      requestAnimationFrame(scroll);
    }
  }, [reasoning, isExpanded, isStreaming]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // If user is within 50px of bottom, enable auto-scroll, otherwise disable
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    shouldAutoScrollRef.current = isAtBottom;
  };

  if (!reasoning && !isStreaming) return null;

  const hasStats = stats && (stats.totalTokens > 0 || stats.duration > 0);
  const cost = hasStats ? (stats.cost || (stats.promptTokens || 0) > 0 ? calculateCost(stats.promptTokens || 0, stats.completionTokens || 0, stats.model) : 0) : 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onToggle();
          }}
          className="flex items-center gap-2 text-sm font-medium text-dark-500 hover:text-dark-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800/40 select-none"
        >
          <Brain className="w-4 h-4" />
          <span>
            {isStreaming ? (
              <>Thinking... <span className="text-dark-500 font-mono text-xs ml-1">{formatThinkingTime(elapsedTime || 0)}</span></>
            ) : (
              'Reasoning'
            )}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Details on hover - bottom right */}
        {!isStreaming && hasStats && (
          <div className="group relative">
            <span className="text-[10px] text-dark-600 cursor-default">details</span>
            <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block z-10">
              <div className="bg-dark-800/95 border border-dark-700/40 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                <div className="space-y-1">
                  {stats.duration > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-dark-500">Time:</span>
                      <span className="text-dark-300 font-mono">{formatThinkingTime(stats.duration)}</span>
                    </div>
                  )}
                  {stats.totalTokens > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-dark-500">Tokens:</span>
                      <span className="text-dark-300 font-mono">{stats.totalTokens.toLocaleString()}</span>
                    </div>
                  )}
                  {cost > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-dark-500">Cost:</span>
                      <span className="text-dark-400 font-mono">${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(3)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {isExpanded && (
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="mt-2 px-4 py-3 text-sm rounded-lg border border-dark-700/30 bg-dark-800/40 text-left max-h-[300px] overflow-y-auto markdown-content"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(marked.parse(reasoning || 'Thinking...'))
          }}
        />
      )}
    </div>
  );
});

function Chat() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(() => ({
    title: 'New Chat',
    model: localStorage.getItem(LAST_MODEL_KEY) || DEFAULT_MODEL,
    temperature: 0.7,
    system_prompt: '',
    agent_mode: false,
    thinking_mode: 'auto'
  }));
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
  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isCreatingChatRef = useRef(false);
  const userHasScrolledUp = useRef(false);
  const statsPopupRef = useRef(null);
  const textareaRef = useRef(null);
  const [expandedThinkingSections, setExpandedThinkingSections] = useState(new Set());
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [usageStats, setUsageStats] = useState(null);
  const [thinkingStartTime, setThinkingStartTime] = useState(null);
  const [thinkingElapsedTime, setThinkingElapsedTime] = useState(0);
  const [lastThinkingStats, setLastThinkingStats] = useState(null);
  const [thinkingComplete, setThinkingComplete] = useState(false);
  const currentChatIdRef = useRef(null);

  // Update ref whenever currentChat changes to prevent ghosting
  useEffect(() => {
    currentChatIdRef.current = currentChat?.id;
  }, [currentChat?.id]);

  // Thinking mode state for reasoning models
  const [thinkingMode, setThinkingMode] = useState('auto');
  const [showThinkingDropdown, setShowThinkingDropdown] = useState(false);
  const thinkingDropdownRef = useRef(null);

  // Thinking mode options
  const THINKING_MODES = [
    { id: 'off', label: 'Off', description: 'No extended thinking', budgetTokens: 0 },
    { id: 'auto', label: 'Auto', description: 'Model default', budgetTokens: 16384 },
    { id: 'low', label: 'Low', description: 'Quick reasoning', budgetTokens: 1024 },
    { id: 'medium', label: 'Medium', description: 'Balanced thinking', budgetTokens: 4096 },
    { id: 'high', label: 'High', description: 'Deep reasoning', budgetTokens: 16384 },
    { id: 'max', label: 'Max', description: 'Maximum reasoning', budgetTokens: 32768 },
  ];

  const [showSearch, setShowSearch] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [canvasState, setCanvasState] = useState({ isOpen: false, content: '', language: 'javascript', title: 'Canvas' });
  const targetMessageRef = useRef(null);

  const [chatSettings, setChatSettings] = useState(() => ({
    model: localStorage.getItem(LAST_MODEL_KEY) || DEFAULT_MODEL,
    temperature: 0.7,
    system_prompt: '',
    agent_mode: false
  }));

  // Check if current model supports reasoning
  const isReasoningSupported = useMemo(() => {
    return modelSupportsReasoning(chatSettings.model);
  }, [chatSettings.model]);

  // Reset thinking mode if model changes to one that doesn't support it
  useEffect(() => {
    if (!isReasoningSupported && thinkingMode !== 'off') {
      setThinkingMode('off');
    }
  }, [isReasoningSupported, thinkingMode]);

  // Calculate chat totals from persisted message data
  const chatTotals = useMemo(() => {
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    return {
      totalPromptTokens: assistantMsgs.reduce((sum, m) => sum + (m.prompt_tokens || 0), 0),
      totalCompletionTokens: assistantMsgs.reduce((sum, m) => sum + (m.completion_tokens || 0), 0),
      totalTokens: assistantMsgs.reduce((sum, m) => sum + (m.prompt_tokens || 0) + (m.completion_tokens || 0), 0),
      totalTimeMs: assistantMsgs.reduce((sum, m) => sum + (m.response_time_ms || 0), 0),
      totalCost: assistantMsgs.reduce((sum, m) => sum + (m.cost || 0), 0),
    };
  }, [messages]);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    // Skip clearing/aborting if we're in the middle of creating a new chat
    if (isCreatingChatRef.current) {
      return;
    }

    // Clear state immediately when switching chats or if no chat is selected
    setStreamingMessage('');
    setStreamingReasoning('');
    setStreaming(false);
    setUsageStats(null);

    // We do NOT abort the controller here anymore. 
    // This allows the previous message to continue generating in the background.

    if (currentChat?.id) {
      loadMessages(currentChat.id);
    }
  }, [currentChat?.id]);

  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled up
    if (!userHasScrolledUp.current) {
      scrollToBottom();
    }
  }, [messages, streamingMessage]);

  // Reset scroll flag when streaming ends
  useEffect(() => {
    if (!streaming) {
      userHasScrolledUp.current = false;
    }
  }, [streaming]);

  // Timer for thinking section - stops when thinking is complete
  useEffect(() => {
    let interval;
    if (streaming && thinkingStartTime && !thinkingComplete) {
      interval = setInterval(() => {
        setThinkingElapsedTime((Date.now() - thinkingStartTime) / 1000);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [streaming, thinkingStartTime, thinkingComplete]);

  // Reset thinking timer when streaming starts
  useEffect(() => {
    if (streaming) {
      setThinkingStartTime(Date.now());
      setThinkingElapsedTime(0);
      setLastThinkingStats(null);
    }
  }, [streaming]);

  // Close stats popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statsPopupRef.current && !statsPopupRef.current.contains(event.target)) {
        setShowInfoModal(false);
      }
    };
    if (showInfoModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showInfoModal]);

  // Close thinking dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (thinkingDropdownRef.current && !thinkingDropdownRef.current.contains(event.target)) {
        setShowThinkingDropdown(false);
      }
    };
    if (showThinkingDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showThinkingDropdown]);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to target message when navigating from search
  useEffect(() => {
    if (targetMessageRef.current && messages.length > 0) {
      const messageElement = document.getElementById(`message-${targetMessageRef.current}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageElement.classList.add('highlight-message');
        setTimeout(() => {
          messageElement.classList.remove('highlight-message');
        }, 2000);
        targetMessageRef.current = null;
      }
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleMessagesScroll = (e) => {
    const container = e.target;
    const threshold = 100; // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    userHasScrolledUp.current = !isNearBottom;
  };

  const toggleThinkingSection = useCallback((messageId) => {
    setExpandedThinkingSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

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
      setThinkingMode(data.thinking_mode || 'auto');
      // Update currentChat with latest data (including updated title)
      const { messages: _, ...chatData } = data;
      setCurrentChat(prev => ({ ...prev, ...chatData }));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const createNewChat = () => {
    const modelToUse = localStorage.getItem(LAST_MODEL_KEY) || DEFAULT_MODEL;
    // Clear all existing state
    setMessages([]);
    setStreamingMessage('');
    setStreamingMessage('');
    setStreamingReasoning('');
    setThinkingComplete(false);
    setExpandedThinkingSections(new Set());
    setLastThinkingStats(null);
    setThinkingElapsedTime(0);
    setShowSettings(false);
    // Create a temporary chat object without an ID
    // The actual chat will be created when the first message is sent
    setCurrentChat({
      title: 'New Chat',
      model: modelToUse,
      temperature: 0.7,
      system_prompt: '',
      agent_mode: false,
      thinking_mode: 'auto'
    });
    setMessages([]);
    setStreamingMessage('');
    setStreamingReasoning('');
    setUsageStats(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setChatSettings({
      model: modelToUse,
      temperature: 0.7,
      system_prompt: '',
      agent_mode: false
    });
    setThinkingMode('auto');
  };

  const updateChatSettings = async () => {
    if (!currentChat) return;

    // If it's a new chat without an ID, just update local state
    if (!currentChat.id) {
      setCurrentChat({ ...currentChat, ...chatSettings });
      setShowSettings(false);
      return;
    }

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

    // If we have a current chat with an ID, update it immediately
    if (currentChat && currentChat.id) {
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
    } else if (currentChat && !currentChat.id) {
      // If it's a new chat without an ID, just update local state
      setCurrentChat({ ...currentChat, model: modelId });
    }
  };

  const deleteChat = async (chatId) => {
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!res.ok) {
        throw new Error('Failed to delete chat');
      }

      setChats(chats.filter(c => c.id !== chatId));
      if (currentChat?.id === chatId) {
        // Automatically open a new chat instead of leaving blank
        setMessages([]);
        createNewChat();
      }
      setDeletingChatId(null);
    } catch (error) {
      console.error('Failed to delete chat:', error);
      alert('Failed to delete chat. Please try again.');
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
    const attachmentIds = pendingAttachments.map(a => a.id);
    const attachmentPreviews = [...pendingAttachments];

    setInputMessage('');
    setPendingAttachments([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
    }
    setStreaming(true);
    setStreamingMessage('');
    setStreamingReasoning('');

    abortControllerRef.current = new AbortController();

    // Add user message to UI immediately (with attachment previews)
    const tempUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
      attachments: attachmentPreviews
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      // If this is a new chat without an ID, create it first
      let chatId = currentChat.id;
      if (!chatId) {
        isCreatingChatRef.current = true;
        const createRes = await fetch('/api/chats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            title: 'New Chat',
            model: chatSettings.model,
            temperature: chatSettings.temperature,
            system_prompt: chatSettings.system_prompt,
            agent_mode: chatSettings.agent_mode,
            thinking_mode: thinkingMode || 'auto'
          })
        });
        const newChat = await createRes.json();
        chatId = newChat.id;
        // Don't update currentChat here yet as it might race, but we need the ID
        setCurrentChat(newChat);
        setChats(prev => [newChat, ...prev]);
        currentChatIdRef.current = chatId; // Manually update ref for immediate use
      }

      // Final check before starting stream
      if (currentChatIdRef.current && currentChatIdRef.current !== chatId) {
        throw new Error('Chat changed before sending message');
      }

      const res = await fetch(`/api/messages/${chatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: userMessage,
          thinking: thinkingMode !== 'off' ? {
            type: 'enabled',
            budget_tokens: THINKING_MODES.find(m => m.id === thinkingMode)?.budgetTokens || 16384
          } : undefined,
          attachment_ids: attachmentIds
        }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Capture critical references for the loop
      const currentStreamController = abortControllerRef.current;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Check for abort on THIS specific controller (user interactions)
        if (currentStreamController?.signal.aborted) {
          try { reader.cancel(); } catch (e) { }
          break;
        }

        // Check if this is the active chat for UI updates
        // We do NOT break here if it's not active - we keep the stream alive for the server
        const isActiveChat = currentChatIdRef.current === chatId;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'reasoning') {
                if (isActiveChat) {
                  setStreamingReasoning(prev => prev + data.content);
                }
              } else if (data.type === 'content') {
                if (isActiveChat) {
                  setThinkingComplete(true); // Stop thinking timer
                  setStreamingMessage(prev => prev + data.content);
                }
              } else if (data.type === 'title') {
                // Handle concurrent title update
                const newTitle = data.content;
                // Always update the chat list item
                setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
                // Update currentChat only if it matches
                if (isActiveChat) {
                  setCurrentChat(prev => (prev.id === chatId ? { ...prev, title: newTitle } : prev));
                }
              } else if (data.type === 'done') {
                // If we are not on the active chat, just ignore UI updates
                if (!isActiveChat) return;

                // Calculate thinking duration
                const thinkingDuration = thinkingStartTime ? (Date.now() - thinkingStartTime) / 1000 : 0;

                // Capture usage data if provided
                if (data.usage) {
                  const stats = {
                    promptTokens: data.usage.prompt_tokens || 0,
                    completionTokens: data.usage.completion_tokens || 0,
                    totalTokens: data.usage.total_tokens || 0,
                    model: data.model,
                    duration: thinkingDuration,
                    cost: data.cost || 0
                  };
                  setLastThinkingStats(stats);
                  setUsageStats(prev => ({
                    ...prev,
                    lastMessage: stats,
                    totalPromptTokens: (prev?.totalPromptTokens || 0) + (data.usage.prompt_tokens || 0),
                    totalCompletionTokens: (prev?.totalCompletionTokens || 0) + (data.usage.completion_tokens || 0),
                    totalTokens: (prev?.totalTokens || 0) + (data.usage.total_tokens || 0),
                    messageCount: (prev?.messageCount || 0) + 1
                  }));
                } else {
                  // No usage data, but we still have duration
                  setLastThinkingStats({ duration: thinkingDuration, totalTokens: 0 });
                }
                // Don't clear streaming states immediately - let loadMessages handle it
                // This prevents the thinking section from disappearing before the message is added
                loadMessages(chatId);
                loadChats();
                // Clear streaming states after a short delay to ensure smooth transition
                setTimeout(() => {
                  setStreamingMessage('');
                  setStreamingReasoning('');
                }, 100);
              } else if (data.type === 'error') {
                if (isActiveChat) {
                  alert('Error: ' + data.error);
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Chat changed before sending message') {
        console.log('Generation aborted');
      } else {
        console.error('Failed to send message:', error);
        alert(error.message || 'Failed to send message. Please check your API key configuration.');
      }
    } finally {
      // Only clear streaming state if we are still on the same chat
      // If we switched, the checking in useEffect would have already cleared it
      if (currentChatIdRef.current === chatId) {
        setStreaming(false);
        abortControllerRef.current = null;
        isCreatingChatRef.current = false;
      }
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

  const handleSearchSelectChat = (chatId) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      setCurrentChat(chat);
    } else {
      // Chat not in current list, fetch it
      fetch(`/api/chats/${chatId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          const { messages: _, ...chatData } = data;
          setCurrentChat(chatData);
          loadChats();
        })
        .catch(console.error);
    }
  };

  const handleSearchSelectMessage = (chatId, messageId) => {
    targetMessageRef.current = messageId;
    handleSearchSelectChat(chatId);
  };

  const openInCanvas = (content, title = 'Canvas') => {
    // Try to detect language from code blocks
    const codeBlockMatch = content.match(/```(\w+)?/);
    let language = 'markdown';
    let cleanContent = content;

    if (codeBlockMatch) {
      // Extract code from code block
      const fullMatch = content.match(/```(\w+)?\n?([\s\S]*?)```/);
      if (fullMatch) {
        language = fullMatch[1] || 'javascript';
        cleanContent = fullMatch[2].trim();
      }
    } else if (content.includes('function ') || content.includes('const ') || content.includes('let ')) {
      language = 'javascript';
    } else if (content.includes('def ') || content.includes('import ')) {
      language = 'python';
    }

    setCanvasState({
      isOpen: true,
      content: cleanContent,
      language,
      title
    });
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
                // Calculate thinking duration
                const thinkingDuration = thinkingStartTime ? (Date.now() - thinkingStartTime) / 1000 : 0;

                if (data.usage) {
                  const stats = {
                    promptTokens: data.usage.prompt_tokens || 0,
                    completionTokens: data.usage.completion_tokens || 0,
                    totalTokens: data.usage.total_tokens || 0,
                    model: data.model,
                    duration: thinkingDuration,
                    cost: data.cost || 0
                  };
                  setLastThinkingStats(stats);
                  setUsageStats(prev => ({
                    ...prev,
                    lastMessage: stats,
                    totalPromptTokens: (prev?.totalPromptTokens || 0) + (data.usage.prompt_tokens || 0),
                    totalCompletionTokens: (prev?.totalCompletionTokens || 0) + (data.usage.completion_tokens || 0),
                    totalTokens: (prev?.totalTokens || 0) + (data.usage.total_tokens || 0),
                    messageCount: (prev?.messageCount || 0) + 1
                  }));
                } else {
                  setLastThinkingStats({ duration: thinkingDuration, totalTokens: 0 });
                }
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

  return (
    <div className="flex h-screen bg-dark-950 bg-mesh">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-72' : 'w-16'} transition-all duration-300 ease-out glass-sidebar flex flex-col overflow-hidden`}>
        <div className={`${showSidebar ? 'p-5' : 'p-2'} border-b border-dark-700/30`}>
          <div className={`flex items-center ${showSidebar ? 'justify-between mb-5' : 'justify-center mb-2'}`}>
            {showSidebar ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-lg bg-dark-700/60 flex items-center justify-center border border-dark-600/40">
                      <MessageSquare className="w-4 h-4 text-dark-300" />
                    </div>
                  </div>
                  <div>
                    <h1 className="font-semibold text-base text-dark-100 tracking-tight font-mono">Budi Chat</h1>
                    <p className="text-xs text-dark-500">{user?.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-2 hover:bg-dark-700/30 rounded-lg transition-all duration-200"
                  title="Collapse sidebar"
                >
                  <ChevronRight className="w-4 h-4 text-dark-500" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 hover:bg-dark-700/30 rounded-lg transition-all duration-200"
                title="Expand sidebar"
              >
                <Menu className="w-4 h-4 text-dark-500" />
              </button>
            )}
          </div>

          <div className={`flex ${showSidebar ? 'gap-2' : 'flex-col gap-2'}`}>
            <button
              onClick={createNewChat}
              className={`${showSidebar ? 'flex-1 py-3 gap-2' : 'w-10 h-10 mx-auto'} gradient-primary text-white rounded-xl font-semibold hover:shadow-glow transition-all duration-200 flex items-center justify-center shine active:scale-[0.98]`}
              title={showSidebar ? undefined : "New Chat"}
            >
              <Plus className="w-4 h-4" />
              {showSidebar && "New Chat"}
            </button>
            <button
              onClick={() => setShowSearch(true)}
              className={`${showSidebar ? 'px-3 py-3' : 'w-10 h-10 mx-auto'} glass-button text-dark-400 hover:text-dark-200 rounded-xl transition-all duration-200 flex items-center justify-center`}
              title={showSidebar ? "Search (Cmd+K)" : "Search"}
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto ${showSidebar ? 'p-3 space-y-1' : 'p-2 space-y-1'}`}>
          {chats.length === 0 && showSidebar && (
            <div className="text-center py-8 px-4">
              <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-dark-500" />
              </div>
              <p className="text-sm text-dark-400">No chats yet</p>
              <p className="text-xs text-dark-500 mt-1">Create a new chat to get started</p>
            </div>
          )}
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`group ${showSidebar ? 'p-3' : 'p-2'} rounded-lg cursor-pointer transition-all duration-200 ${currentChat?.id === chat.id
                ? 'bg-dark-800/80 border-l-2 border-accent/60'
                : 'hover:bg-dark-800/40 border-l-2 border-transparent'
                }`}
              onClick={() => setCurrentChat(chat)}
              title={showSidebar ? undefined : chat.title}
            >
              {showSidebar ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${currentChat?.id === chat.id ? 'text-dark-50' : 'text-dark-200'}`}>{chat.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-dark-500">
                        {chat.message_count === 1 ? '1 message' : `${chat.message_count || 0} messages`}
                      </span>
                      {chat.agent_mode === 1 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-medium">
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
              ) : (
                <div className="flex justify-center">
                  <MessageSquare className={`w-5 h-5 ${currentChat?.id === chat.id ? 'text-accent' : 'text-dark-400'}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={`${showSidebar ? 'p-3' : 'p-2'} border-t border-dark-700/30 space-y-1`}>
          <button
            onClick={() => navigate('/memories')}
            className={`${showSidebar ? 'w-full px-4 gap-3' : 'w-9 h-9 mx-auto'} flex items-center justify-center py-2 rounded-lg hover:bg-dark-800/40 transition-all text-sm font-medium text-dark-400 hover:text-dark-300`}
            title={showSidebar ? undefined : "Memories"}
          >
            <Brain className="w-4 h-4" />
            {showSidebar && "Memories"}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`${showSidebar ? 'w-full px-4 gap-3' : 'w-9 h-9 mx-auto'} flex items-center justify-center py-2 rounded-lg hover:bg-dark-800/40 transition-all text-sm font-medium text-dark-400 hover:text-dark-300`}
            title={showSidebar ? undefined : "Settings"}
          >
            <SettingsIcon className="w-4 h-4" />
            {showSidebar && "Settings"}
          </button>
          {user?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              className={`${showSidebar ? 'w-full px-4 gap-3' : 'w-9 h-9 mx-auto'} flex items-center justify-center py-2 rounded-lg hover:bg-dark-800/40 transition-all text-sm font-medium text-dark-400 hover:text-dark-300`}
              title={showSidebar ? undefined : "Admin"}
            >
              <Sparkles className="w-4 h-4" />
              {showSidebar && "Admin"}
            </button>
          )}
          {showSidebar && <div className="divider-gradient my-2"></div>}
          <button
            onClick={logout}
            className={`${showSidebar ? 'w-full px-4 gap-3' : 'w-9 h-9 mx-auto'} flex items-center justify-center py-2 rounded-lg hover:bg-dark-800/40 transition-all text-sm font-medium text-dark-500 hover:text-dark-400`}
            title={showSidebar ? undefined : "Logout"}
          >
            <LogOut className="w-4 h-4" />
            {showSidebar && "Logout"}
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-dark-900/50 border-b border-dark-700/30 px-4 py-3 flex items-center justify-between relative z-50 overflow-visible">
          <div className="flex items-center gap-3">
            {/* Chat Title and Model Selector */}
            {currentChat ? (
              <>
                <h2 className="text-sm font-medium text-dark-200">{currentChat.title}</h2>
                <div className="h-3 w-px bg-dark-700/50"></div>
                <div className="flex items-center">
                  <ModelSelector
                    selectedModel={chatSettings.model}
                    onModelChange={handleModelChange}
                    isDropdown={true}
                  />
                </div>
                {chatSettings.agent_mode && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-800/60 text-dark-400 rounded text-xs font-medium border border-dark-700/40">
                    <Zap className="w-3 h-3" />
                    Agent
                  </span>
                )}
              </>
            ) : (
              <p className="text-dark-500 text-sm">Select a chat or create a new one</p>
            )}
          </div>

          {currentChat && (
            <div className="flex items-center gap-2 overflow-visible">
              <div className="relative overflow-visible" ref={statsPopupRef}>
                <button
                  onClick={() => setShowInfoModal(!showInfoModal)}
                  className={`p-2 rounded-lg transition-all duration-200 ${showInfoModal
                    ? 'bg-dark-800 text-dark-300 border border-dark-700/50'
                    : 'hover:bg-dark-800/40 text-dark-500 hover:text-dark-400'
                    }`}
                  title="Usage Stats"
                >
                  <Info className="w-4 h-4" />
                </button>

                {/* Usage Stats Panel */}
                {showInfoModal && (
                  <div className="fixed top-14 right-4 w-80 glass-dropdown rounded-lg z-[100] scale-in">
                    <div className="p-3 border-b border-dark-700/30">
                      <h4 className="text-sm font-medium text-dark-300 flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-dark-500" />
                        Chat Stats
                      </h4>
                    </div>

                    <div className="p-3 space-y-3">
                      {/* Current Model */}
                      <div className="p-2 rounded-lg bg-dark-800">
                        <p className="text-dark-500 text-xs mb-1">Current Model</p>
                        <p className="text-sm font-medium text-dark-200 truncate">{chatSettings.model}</p>
                      </div>

                      {/* Conversation Stats */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-dark-800">
                          <p className="text-dark-500">Messages</p>
                          <p className="text-sm font-semibold text-dark-200">{messages.length}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-dark-800">
                          <p className="text-dark-500">AI Responses</p>
                          <p className="text-sm font-semibold text-accent">{messages.filter(m => m.role === 'assistant').length}</p>
                        </div>
                      </div>

                      {/* Token Usage - from persisted data */}
                      {chatTotals.totalTokens > 0 && (
                        <div className="border-t border-dark-700 pt-3">
                          <p className="text-dark-500 text-xs mb-2">Chat Token Usage</p>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-dark-400">Total Cost</span>
                              <span className="font-semibold text-accent">
                                ${chatTotals.totalCost.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Token Bar with USED/CONTEXT label */}
                          {(() => {
                            const contextLimit = getModelContext(chatSettings.model);
                            const inputPercent = (chatTotals.totalPromptTokens / contextLimit) * 100;
                            const outputPercent = (chatTotals.totalCompletionTokens / contextLimit) * 100;
                            const freePercent = Math.max(0, 100 - inputPercent - outputPercent);
                            return (
                              <>
                                <div className="flex justify-between mt-3 mb-1 text-xs">
                                  <span className="text-dark-400">Tokens Used</span>
                                  <span className="font-medium text-dark-200">
                                    {chatTotals.totalTokens.toLocaleString()}
                                    <span className="text-dark-500"> / {contextLimit.toLocaleString()}</span>
                                  </span>
                                </div>
                                <div className="h-2 bg-dark-700 rounded-full overflow-hidden flex">
                                  <div
                                    className="h-full bg-accent"
                                    style={{ width: `${inputPercent}%` }}
                                    title={`Input: ${chatTotals.totalPromptTokens.toLocaleString()}`}
                                  />
                                  <div
                                    className="h-full bg-accent-500"
                                    style={{ width: `${outputPercent}%` }}
                                    title={`Output: ${chatTotals.totalCompletionTokens.toLocaleString()}`}
                                  />
                                  <div
                                    className="h-full bg-dark-600"
                                    style={{ width: `${freePercent}%` }}
                                    title={`Free: ${(contextLimit - chatTotals.totalTokens).toLocaleString()}`}
                                  />
                                </div>
                                <div className="flex justify-between mt-1 text-[10px] text-dark-500">
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-accent"></span>
                                      Input ({chatTotals.totalPromptTokens.toLocaleString()})
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-accent-500"></span>
                                      Output ({chatTotals.totalCompletionTokens.toLocaleString()})
                                    </span>
                                  </div>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-dark-600"></span>
                                    Free
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* No token data message - only show if no persisted data */}
                      {chatTotals.totalTokens === 0 && messages.length > 0 && (
                        <p className="text-[10px] text-dark-500 text-center pt-2 border-t border-dark-700">
                          Token usage will appear after sending messages
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <ExportMenu
                chatId={currentChat?.id}
                chatTitle={currentChat?.title}
                messages={messages}
              />
              {currentChat?.id && (
                <button
                  onClick={() => setShowShareDialog(true)}
                  className="px-3 py-2 flex items-center gap-2 rounded-xl transition-all duration-200 text-sm font-medium glass-button text-dark-300 hover:text-dark-100"
                  title="Share chat"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`px-3 py-1.5 flex items-center gap-2 rounded-lg transition-all duration-200 text-sm font-medium ${showSettings
                  ? 'bg-dark-800 text-dark-300 border border-dark-700/50'
                  : 'hover:bg-dark-800/40 text-dark-500 hover:text-dark-400'
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
          <div className="bg-dark-900/50 border-b border-dark-700/30 p-5 scale-in">
            <div className="max-w-2xl mx-auto space-y-5">
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
                    <span className="ml-2 px-2 py-0.5 bg-dark-800 rounded-md text-xs text-accent font-mono">
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
                  className="w-full px-4 py-3 rounded-xl glass-input outline-none resize-none text-dark-100 placeholder-dark-500 text-sm font-mono"
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
                  className="btn-primary px-5 py-2.5 rounded-xl font-semibold transition-all duration-200"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto p-6 relative z-0"
        >
          {currentChat && (
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.length === 0 && !streaming && (
                <div className="text-center py-20 fade-in">
                  <div className="relative inline-block mb-5">
                    <div className="w-12 h-12 rounded-lg bg-dark-800/80 border border-dark-700/40 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-dark-500" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-dark-200 mb-2">Start a conversation</h3>
                  <p className="text-dark-500 text-sm max-w-xs mx-auto">Type a message below to begin chatting with AI.</p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={message.id}
                  id={`message-${message.id}`}
                  className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''} group`}
                >
                  {/* Avatar Column */}
                  <div className="flex-shrink-0 flex flex-col items-center pt-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${message.role === 'user' ? 'bg-dark-700' : 'bg-dark-800'}`}>
                      {message.role === 'user' ? (
                        <UserIcon className="w-5 h-5 text-dark-400" />
                      ) : (
                        <Bot className="w-5 h-5 text-accent" />
                      )}
                    </div>
                  </div>

                  {/* Content Column */}
                  <div className={`flex-1 min-w-0 flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {/* Header: Name and Model */}
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs font-medium text-dark-400">
                        {message.role === 'user' ? 'You' : formatModelName(message.model)}
                      </span>
                    </div>

                    {/* Thinking Section (Assistant only) */}
                    {message.role === 'assistant' && message.reasoning_content && (
                      <div className="mb-2 w-full max-w-[85%]">
                        <ThinkingSection
                          reasoning={message.reasoning_content}
                          isExpanded={expandedThinkingSections.has(message.id)}
                          onToggle={() => toggleThinkingSection(message.id)}
                          isStreaming={false}
                          elapsedTime={0}
                          stats={null}
                        />
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div className={`inline-block max-w-[85%] ${message.role === 'user'
                      ? 'bg-dark-700/80 border border-dark-600 text-dark-100 rounded-2xl rounded-tr-sm px-4 py-3'
                      : 'bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-600/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg'
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
                          <>
                            {renderMessage(message.content)}
                            {/* Display attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {message.attachments.map((att) => {
                                  const isImage = att.mimetype?.startsWith('image/');
                                  const getIcon = () => {
                                    if (att.mimetype === 'application/pdf') return '📄';
                                    if (att.mimetype === 'text/csv') return '📊';
                                    if (att.mimetype === 'application/json') return '{ }';
                                    if (att.mimetype?.includes('markdown') || att.original_name?.endsWith('.md')) return '📝';
                                    if (att.mimetype === 'text/plain') return '📃';
                                    return '📎';
                                  };

                                  if (isImage) {
                                    return (
                                      <img
                                        key={att.id}
                                        src={att.preview || `/api/uploads/${att.id}`}
                                        alt={att.original_name}
                                        className="max-w-[200px] max-h-[150px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(att.preview || `/api/uploads/${att.id}`, '_blank')}
                                      />
                                    );
                                  }

                                  return (
                                    <div
                                      key={att.id}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/50 border border-white/[0.08]"
                                    >
                                      <span className="text-lg">{getIcon()}</span>
                                      <span className="text-xs text-dark-300 max-w-[150px] truncate">{att.original_name}</span>
                                      {att.has_text && (
                                        <span className="text-[10px] text-green-400">✓</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )
                      ) : (
                        renderMessage(message.content)
                      )}
                    </div>

                    {/* Actions Row (Assistant Only) */}
                    {message.role === 'assistant' && (
                      <div className="mt-1 flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity px-1">
                        <button
                          onClick={() => handleCopy(message.id, message.content, 'raw')}
                          className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                          title={copiedMessageId === `${message.id}-raw` ? 'Copied!' : 'Copy Raw'}
                        >
                          {copiedMessageId === `${message.id}-raw` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopy(message.id, message.content, 'markdown')}
                          className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                          title={copiedMessageId === `${message.id}-markdown` ? 'Copied!' : 'Copy Markdown'}
                        >
                          {copiedMessageId === `${message.id}-markdown` ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => openForkModal(message.id)}
                          className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                          title="Fork from here"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                        </button>
                        <TextToSpeech text={message.content} messageId={message.id} />
                        {message.content.includes('```') && (
                          <button
                            onClick={() => openInCanvas(message.content, 'Edit Code')}
                            className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                            title="Open in Canvas"
                          >
                            <Code className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {(message.prompt_tokens || message.response_time_ms || message.cost > 0) && (
                          <div className="group/info relative">
                            <button
                              className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                              title="Message details"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-full left-0 mb-1 hidden group-hover/info:block z-10">
                              <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                                <div className="space-y-1">
                                  {message.response_time_ms > 0 && (
                                    <div className="flex justify-between gap-4">
                                      <span className="text-dark-400">Time:</span>
                                      <span className="text-dark-200 font-mono">{formatThinkingTime(message.response_time_ms / 1000)}</span>
                                    </div>
                                  )}
                                  {(message.prompt_tokens || message.completion_tokens) && (
                                    <div className="flex justify-between gap-4">
                                      <span className="text-dark-400">Tokens:</span>
                                      <span className="text-dark-200 font-mono">{((message.prompt_tokens || 0) + (message.completion_tokens || 0)).toLocaleString()} tks</span>
                                    </div>
                                  )}
                                  {message.cost > 0 && (
                                    <div className="flex justify-between gap-4">
                                      <span className="text-dark-400">Cost:</span>
                                      <span className="text-accent-400 font-mono">
                                        ${message.cost.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(streaming || streamingMessage || streamingReasoning) && (
                <div className="pr-8">
                  {(streamingReasoning || (streaming && !streamingMessage)) && (
                    <ThinkingSection
                      reasoning={streamingReasoning}
                      isExpanded={expandedThinkingSections.has('streaming')}
                      onToggle={() => toggleThinkingSection('streaming')}
                      isStreaming={!streamingMessage || (streamingReasoning && streaming)}
                      elapsedTime={thinkingElapsedTime}
                      stats={lastThinkingStats}
                    />
                  )}

                  {streamingMessage && (
                    <div className="flex gap-4 group fade-in">
                      <div className="flex-shrink-0 flex flex-col items-center pt-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-800">
                          <Bot className="w-5 h-5 text-accent" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col items-start">
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-xs font-medium text-dark-400">{formatModelName(chatSettings.model)}</span>
                        </div>
                        <div className="inline-block max-w-[85%] bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-600/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg">
                          {renderMessage(streamingMessage)}
                        </div>
                      </div>
                    </div>
                  )}

                  {streaming && !streamingMessage && !streamingReasoning && (
                    <div className="flex gap-4 group fade-in">
                      <div className="flex-shrink-0 flex flex-col items-center pt-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-800">
                          <Bot className="w-5 h-5 text-accent" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col items-start">
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-xs font-medium text-dark-400">{formatModelName(chatSettings.model)}</span>
                        </div>
                        <div className="inline-block bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-600/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-dark-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-dark-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-dark-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {currentChat && (
          <div className="border-t border-dark-700/30 bg-dark-900/50 p-4">
            <div className="max-w-2xl mx-auto">
              {/* Tools Toolbar */}
              <div className="flex items-center gap-3 mb-3">
                {/* Thinking Mode Dropdown */}
                <div className="relative" ref={thinkingDropdownRef}>
                  <button
                    type="button"
                    onClick={() => isReasoningSupported && setShowThinkingDropdown(!showThinkingDropdown)}
                    disabled={!isReasoningSupported}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${!isReasoningSupported
                      ? 'bg-dark-800/40 text-dark-600 border border-dark-700/30 cursor-not-allowed opacity-70'
                      : thinkingMode === 'auto'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20'
                        : thinkingMode === 'low'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                          : thinkingMode === 'medium'
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20'
                            : thinkingMode === 'high'
                              ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20'
                              : thinkingMode === 'max'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                                : 'bg-dark-800/60 text-dark-400 border border-dark-700/40 hover:bg-dark-800 hover:text-dark-300'
                      }`}
                    title={!isReasoningSupported ? "Model doesn't support extended thinking" : "Thinking Mode"}
                  >
                    <Lightbulb className={`w-3.5 h-3.5 ${!isReasoningSupported ? 'text-dark-600' :
                      thinkingMode === 'low' ? 'text-green-400' :
                        thinkingMode === 'medium' ? 'text-yellow-400' :
                          thinkingMode === 'high' ? 'text-orange-400' :
                            thinkingMode === 'max' ? 'text-red-400' :
                              ''
                      }`} />
                    <span>Thinking: {THINKING_MODES.find(m => m.id === thinkingMode)?.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showThinkingDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu - Opens Upward */}
                  {showThinkingDropdown && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 glass-dropdown rounded-lg shadow-xl border border-dark-700/50 overflow-hidden scale-in z-50">
                      <div className="p-2 border-b border-dark-700/30">
                        <p className="text-xs font-medium text-dark-400 px-2">Thinking Mode</p>
                        <p className="text-[10px] text-dark-500 px-2 mt-0.5">Controls reasoning depth for supported models</p>
                      </div>
                      <div className="p-1">
                        {THINKING_MODES.map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={async () => {
                              setThinkingMode(mode.id);
                              setShowThinkingDropdown(false);
                              if (currentChat && currentChat.id) {
                                try {
                                  await fetch(`/api/chats/${currentChat.id}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                                    },
                                    body: JSON.stringify({ thinking_mode: mode.id })
                                  });
                                } catch (error) {
                                  console.error('Failed to update thinking mode:', error);
                                }
                              }
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-all duration-150 ${thinkingMode === mode.id
                              ? 'bg-accent/10 text-accent'
                              : 'hover:bg-dark-700/50 text-dark-300 hover:text-dark-100'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${mode.id === 'off' ? 'bg-dark-500' :
                                mode.id === 'auto' ? 'bg-blue-400' :
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

                {/* Placeholder for future tools */}
                {/* Add more tool toggles here */}
              </div>

              {/* Pending Attachments Preview */}
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 p-2 rounded-xl bg-dark-800/50 border border-white/[0.06]">
                  {pendingAttachments.map((file) => {
                    const isImage = file.mimetype?.startsWith('image/');
                    const getIcon = () => {
                      if (file.mimetype === 'application/pdf') return '📄';
                      if (file.mimetype === 'text/csv') return '📊';
                      if (file.mimetype === 'application/json') return '{ }';
                      if (file.mimetype?.includes('markdown') || file.original_name?.endsWith('.md')) return '📝';
                      if (file.mimetype === 'text/plain') return '📃';
                      return '📎';
                    };

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
                            <span className="text-2xl">{getIcon()}</span>
                            {file.has_text && (
                              <span className="text-[8px] text-green-400 mt-0.5">✓ parsed</span>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (file.preview) URL.revokeObjectURL(file.preview);
                            fetch(`/api/uploads/${file.id}`, {
                              method: 'DELETE',
                              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                            }).catch(console.error);
                            setPendingAttachments(prev => prev.filter(f => f.id !== file.id));
                          }}
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

              <form onSubmit={sendMessage} className="flex gap-3 items-center">
                <ImageUpload
                  onFilesSelected={setPendingAttachments}
                  disabled={streaming}
                />
                <ImageGeneration
                  chatId={currentChat?.id}
                  onImageGenerated={(result) => {
                    // Add the generated image info to the chat
                    console.log('Image generated:', result);
                  }}
                />
                <div className="flex-1 flex items-center">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (inputMessage.trim() && !streaming) {
                          sendMessage(e);
                        }
                      }
                    }}
                    placeholder={streaming ? "AI is responding..." : "Type a message..."}
                    className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-200 placeholder-dark-600 text-sm resize-none overflow-y-auto"
                    style={{ minHeight: '48px', maxHeight: '140px' }}
                    rows={1}
                    disabled={streaming}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                    }}
                  />
                </div>
                <VoiceInput
                  onTranscript={(text) => setInputMessage(prev => prev + (prev ? ' ' : '') + text)}
                  disabled={streaming}
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="h-12 px-5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-dark-800/60 text-dark-400 border border-dark-700/40 hover:bg-dark-800 hover:text-dark-300"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputMessage.trim()}
                    className="h-12 px-5 btn-primary text-dark-900 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Fork Modal */}
      {
        showForkModal && (
          <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center z-50 scale-in">
            <div className="glass-modal rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-dark-100 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                    <GitBranch className="w-4 h-4 text-white" />
                  </div>
                  Fork Chat
                </h3>
                <button
                  onClick={() => setShowForkModal(false)}
                  className="p-2 hover:bg-dark-700/50 rounded-xl transition-all duration-200"
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
                  className="btn-primary flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <GitBranch className="w-4 h-4" />
                  Fork Chat
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectChat={handleSearchSelectChat}
        onSelectMessage={handleSearchSelectMessage}
      />

      {/* Share Dialog */}
      <ShareDialog
        chatId={currentChat?.id}
        chatTitle={currentChat?.title}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
      />

      {/* Canvas Editor */}
      <Canvas
        isOpen={canvasState.isOpen}
        onClose={() => setCanvasState({ ...canvasState, isOpen: false })}
        initialContent={canvasState.content}
        initialLanguage={canvasState.language}
        title={canvasState.title}
      />

    </div >
  );
}

export default Chat;
