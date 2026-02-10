import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  memo,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Plus,
  Settings as SettingsIcon,
  LogOut,
  Brain,
  Trash2,
  GitBranch,
  Bot,
  User as UserIcon,
  Sparkles,
  Zap,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Trash,
  Copy,
  Pencil,
  Info,
  DollarSign,
  Hash,
  Search,
  Share2,
  Code,
  FileText,
  Shield,
  RotateCcw,
} from "lucide-react";
import SearchModal from "../components/SearchModal";
import ExportMenu from "../components/ExportMenu";
import ShareDialog from "../components/ShareDialog";
import ImageGeneration from "../components/ImageGeneration";
import TextToSpeech from "../components/TextToSpeech";
import Canvas from "../components/Canvas";
import InputBar, { THINKING_MODES } from "../components/InputBar";
import ToolCallDisplay from "../components/ToolCallDisplay";
import MessageSteps from "../components/MessageSteps";
import { AuthContext } from "../contexts/AuthContext";
import { marked } from "marked";
import DOMPurify from "dompurify";
import ModelSelector, {
  DEFAULT_MODEL,
  RECENT_MODELS_KEY,
  MODELS_CACHE_KEY,
  modelSupportsReasoning,
} from "../components/ModelSelector";
import WorkspaceSidebar from "../components/WorkspaceSidebar";
import { getIconComponent } from "../components/WorkspaceModal";
import PersonaSelector from "../components/PersonaSelector";
import { FolderOpen } from "lucide-react";
import ContextMenu, { ContextMenuItem } from "../components/ContextMenu";
import WorkspaceQuickSelect from "../components/WorkspaceQuickSelect";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const LAST_MODEL_KEY = "budi_chat_last_model";
const LAST_THINKING_MODE_KEY = "budi_chat_last_thinking_mode";

// Format time as seconds or minutes:seconds (integer display)
const formatThinkingTime = (seconds) => {
  const s = Math.floor(seconds);
  if (s < 60) {
    return `${s}s`;
  }
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
};

// Get model data from OpenRouter cache
const getModelFromCache = (modelId) => {
  try {
    const cached = localStorage.getItem(MODELS_CACHE_KEY);
    if (cached) {
      const { models } = JSON.parse(cached);
      return models.find((m) => m.id === modelId);
    }
  } catch (e) {
    console.error("Failed to get model from cache:", e);
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
  if (!modelId) return "Assistant";

  // Try to find in cache first for proper official name
  const model = getModelFromCache(modelId);
  if (model?.name) {
    // Strip provider prefix if present (e.g. "Google: Gemini 2.5 Flash" -> "Gemini 2.5 Flash")
    if (model.name.includes(": ")) {
      return model.name.split(": ")[1];
    }
    return model.name;
  }

  // Fallback: clean up the ID (e.g. "google/gemini-2.5-pro" -> "Gemini 2.5 Pro")
  const parts = modelId.split("/");
  const name = parts[parts.length - 1];
  return name.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

// Helper: Derive tool results from message history
const getHistoricalToolResults = (messages) => {
  const results = {};
  messages.forEach((msg) => {
    if (msg.role === "tool" && msg.tool_call_id) {
      results[msg.tool_call_id] = msg.content;
    }
  });
  return results;
};

// Helper: Parse reasoning content - handles both plain text and structured JSON
const parseReasoningContent = (reasoningContent) => {
  if (!reasoningContent)
    return {
      preToolReasoning: null,
      postToolReasoning: null,
      isStructured: false,
    };

  try {
    const parsed = JSON.parse(reasoningContent);
    if (
      parsed &&
      (parsed.pre_tool !== undefined || parsed.post_tool !== undefined)
    ) {
      return {
        preToolReasoning: parsed.pre_tool || null,
        postToolReasoning: parsed.post_tool || null,
        isStructured: true,
      };
    }
  } catch (e) {
    // Not JSON, treat as plain text
  }

  // Plain text reasoning (no tool calls involved)
  return {
    preToolReasoning: reasoningContent,
    postToolReasoning: null,
    isStructured: false,
  };
};

// Group messages for display: consecutive non-user messages form response groups
const groupMessagesForDisplay = (messages) => {
  const groups = [];
  let currentGroup = null;
  for (const msg of messages) {
    if (msg.role === "user") {
      if (currentGroup) groups.push(currentGroup);
      groups.push({ type: "user", messages: [msg] });
      currentGroup = null;
    } else {
      // assistant or tool messages go into response groups
      if (!currentGroup) currentGroup = { type: "response", messages: [] };
      currentGroup.messages.push(msg);
    }
  }
  if (currentGroup) groups.push(currentGroup);
  return groups;
};

// Memoized ThinkingSection component to prevent re-renders during streaming
const ACCENT_COLORS = {
  amber: "hsl(38, 92%, 50%)",
  blue: "hsl(217, 91%, 60%)",
  green: "hsl(142, 71%, 45%)",
  purple: "hsl(262, 83%, 58%)",
  rose: "hsl(350, 89%, 60%)",
  cyan: "hsl(186, 94%, 42%)",
};

const ThinkingSection = memo(
  ({ reasoning, isExpanded, onToggle, isStreaming, elapsedTime }) => {
    const contentRef = useRef(null);
    const shouldAutoScrollRef = useRef(true);
    const [accentColor, setAccentColor] = useState(() => {
      const accent =
        document.documentElement.getAttribute("data-accent") || "amber";
      return ACCENT_COLORS[accent] || ACCENT_COLORS.amber;
    });

    useEffect(() => {
      const updateAccent = () => {
        const accent =
          document.documentElement.getAttribute("data-accent") || "amber";
        setAccentColor(ACCENT_COLORS[accent] || ACCENT_COLORS.amber);
      };

      // Update on mount and when data-accent changes
      updateAccent();

      // Listen for attribute changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "data-accent") {
            updateAccent();
          }
        });
      });

      observer.observe(document.documentElement, { attributes: true });

      return () => observer.disconnect();
    }, []);

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

    return (
      <div
        className="mb-2 border-l-2 bg-dark-800/30 rounded-r-lg"
        style={{ borderLeftColor: accentColor }}
      >
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
                <>
                  Thinking...{" "}
                  <span className="text-dark-500 font-mono text-xs ml-1">
                    {formatThinkingTime(elapsedTime || 0)}
                  </span>
                </>
              ) : (
                "Thinking"
              )}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {isExpanded && (
          <div
            ref={contentRef}
            onScroll={handleScroll}
            className="mt-2 px-4 py-3 text-sm rounded-lg border border-dark-700/30 bg-dark-800/40 text-left max-h-[300px] overflow-y-auto markdown-content"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                marked.parse(reasoning || "Thinking..."),
              ),
            }}
          />
        )}
        {/* Context Menu */}
      </div>
    );
  },
);

function Chat() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [isWorkspacesExpanded, setIsWorkspacesExpanded] = useState(true);
  const [currentChat, setCurrentChat] = useState(() => ({
    title: "New Chat",
    model: localStorage.getItem(LAST_MODEL_KEY) || DEFAULT_MODEL,
    temperature: 0.7,
    system_prompt: "",
    agent_mode: false,
    thinking_mode: "medium",
  }));
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  // Per-chat streaming state: Map<chatId, { streaming, message, reasoning, ... }>
  const [streamingStates, setStreamingStates] = useState(new Map());
  const [showSettings, setShowSettings] = useState(false);

  // Mobile detection and responsive sidebar
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(
    () => window.innerWidth >= 768,
  );
  const [showForkModal, setShowForkModal] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState(null);
  const [forkMessageId, setForkMessageId] = useState(null);
  const [forkModel, setForkModel] = useState(DEFAULT_MODEL);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  // Per-chat abort controllers
  const abortControllersRef = useRef(new Map());
  const isCreatingChatRef = useRef(false);
  const userHasScrolledUp = useRef(false);
  const statsPopupRef = useRef(null);
  const [expandedThinkingSections, setExpandedThinkingSections] = useState(
    new Set(),
  );
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [usageStats, setUsageStats] = useState(null);
  const [thinkingElapsedTime, setThinkingElapsedTime] = useState(0);
  const currentChatIdRef = useRef(null);

  // Update ref whenever currentChat changes to prevent ghosting
  useEffect(() => {
    currentChatIdRef.current = currentChat?.id;
  }, [currentChat?.id]);

  // Thinking mode state for reasoning models (default to 'medium')
  const [thinkingMode, setThinkingMode] = useState(
    () => localStorage.getItem(LAST_THINKING_MODE_KEY) || "medium",
  );

  // Persist thinking mode changes
  useEffect(() => {
    if (thinkingMode) {
      localStorage.setItem(LAST_THINKING_MODE_KEY, thinkingMode);
    }
  }, [thinkingMode]);

  const [showSearch, setShowSearch] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [showImageGeneration, setShowImageGeneration] = useState(false);
  const [enabledTools, setEnabledTools] = useState({
    web_search: true,
    calculator: true,
    code_interpreter: true,
  });
  const [canvasState, setCanvasState] = useState({
    isOpen: false,
    content: "",
    language: "javascript",
    title: "Canvas",
  });
  const [selectedPersona, setSelectedPersona] = useState(null);
  const targetMessageRef = useRef(null);

  const [chatSettings, setChatSettings] = useState(() => ({
    model: localStorage.getItem(LAST_MODEL_KEY) || DEFAULT_MODEL,
    temperature: 0.7,
    depth: "standard",
    tone: "friendly",
    system_prompt: "",
    agent_mode: false,
  }));

  // Context Menu State
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    chatId: null,
    type: "chat", // 'chat' | 'workspace'
  });

  // Rename state
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState(null);
  const [renamingChatId, setRenamingChatId] = useState(null);
  const [editChatValue, setEditChatValue] = useState("");
  const [wsSettingsId, setWsSettingsId] = useState(null);

  // Hover tooltip state for collapsed sidebar
  const [hoverTooltip, setHoverTooltip] = useState({
    visible: false,
    text: "",
    x: 0,
    y: 0,
  });

  const handleContextMenu = (e, chatId, type = "chat") => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      chatId,
      type,
    });
  };

  const closeContextMenu = () => {
    if (contextMenu.isOpen) {
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Factory for initial stream state
  const createInitialStreamState = useCallback(
    () => ({
      streaming: false,
      streamingMessage: "",
      streamingReasoning: "",
      preToolReasoning: "", // Reasoning before tool calls
      postToolReasoning: "", // Reasoning after tool calls (synthesis)
      isPostToolPhase: false, // Track if we're in post-tool synthesis phase
      thinkingStartTime: null,
      thinkingComplete: false,
      lastThinkingStats: null,
      toolCalls: [],
      toolResults: {},
      // Step-based tracking for timeline display
      steps: [], // Array of step objects
      currentStepId: null, // ID of currently active step
      // Multi-turn tracking for tool-use chains
      completedTurns: [], // Array of completed turn objects { message, reasoning, steps, toolCalls, toolResults }
    }),
    [],
  );

  // Update streaming state for a specific chat
  const updateStreamState = useCallback(
    (chatId, updates) => {
      setStreamingStates((prev) => {
        const newMap = new Map(prev);
        const current = prev.get(chatId) || createInitialStreamState();
        newMap.set(chatId, { ...current, ...updates });
        return newMap;
      });
    },
    [createInitialStreamState],
  );

  // Clear streaming state for a chat
  const clearStreamState = useCallback((chatId) => {
    setStreamingStates((prev) => {
      const newMap = new Map(prev);
      newMap.delete(chatId);
      return newMap;
    });
    // Also clean up abort controller
    const controller = abortControllersRef.current.get(chatId);
    if (controller) {
      abortControllersRef.current.delete(chatId);
    }
  }, []);

  // Get set of currently streaming chat IDs (for sidebar indicators)
  const streamingChatIds = useMemo(() => {
    const ids = new Set();
    for (const [chatId, state] of streamingStates) {
      if (state.streaming) ids.add(chatId);
    }
    return ids;
  }, [streamingStates]);

  // Derived streaming state for the active chat
  const currentStreamState = useMemo(() => {
    if (!currentChat?.id) return createInitialStreamState();
    return streamingStates.get(currentChat.id) || createInitialStreamState();
  }, [streamingStates, currentChat?.id, createInitialStreamState]);

  // Destructure for easy access (maintains API compatibility)
  const {
    streaming,
    streamingMessage,
    streamingReasoning,
    preToolReasoning,
    postToolReasoning,
    isPostToolPhase,
    thinkingStartTime,
    thinkingComplete,
    lastThinkingStats,
    toolCalls,
    toolResults,
    steps: streamingSteps,
    currentStepId,
    completedTurns,
  } = currentStreamState;

  // Check if current model supports reasoning
  const isReasoningSupported = useMemo(() => {
    return modelSupportsReasoning(chatSettings.model);
  }, [chatSettings.model]);

  // Reset thinking mode if model changes to one that doesn't support it
  useEffect(() => {
    if (!isReasoningSupported && thinkingMode !== "off") {
      setThinkingMode("off");
    }
  }, [isReasoningSupported, thinkingMode]);

  // Calculate chat totals from persisted message data
  const chatTotals = useMemo(() => {
    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    return {
      totalPromptTokens: assistantMsgs.reduce(
        (sum, m) => sum + (m.prompt_tokens || 0),
        0,
      ),
      totalCompletionTokens: assistantMsgs.reduce(
        (sum, m) => sum + (m.completion_tokens || 0),
        0,
      ),
      totalTokens: assistantMsgs.reduce(
        (sum, m) => sum + (m.prompt_tokens || 0) + (m.completion_tokens || 0),
        0,
      ),
      totalTimeMs: assistantMsgs.reduce(
        (sum, m) => sum + (m.response_time_ms || 0),
        0,
      ),
      totalCost: assistantMsgs.reduce((sum, m) => sum + (m.cost || 0), 0),
    };
  }, [messages]);

  // Get chats that are NOT in any workspace (shown in main chat list)
  const uncategorizedChats = useMemo(() => {
    return chats.filter((chat) => !chat.workspace_id);
  }, [chats]);

  // Cleanup on unmount - abort all active streams
  useEffect(() => {
    return () => {
      for (const controller of abortControllersRef.current.values()) {
        controller.abort();
      }
      abortControllersRef.current.clear();
    };
  }, []);

  // Mobile detection and resize handling
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-close sidebar when switching to mobile, auto-open on desktop
      if (mobile !== isMobile) {
        setShowSidebar(!mobile);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  // Manage body scroll lock when mobile sidebar is open
  useEffect(() => {
    if (isMobile && showSidebar) {
      document.body.classList.add("sidebar-open");
    } else {
      document.body.classList.remove("sidebar-open");
    }
    return () => document.body.classList.remove("sidebar-open");
  }, [isMobile, showSidebar]);

  // Handle virtual keyboard on mobile
  useEffect(() => {
    if ("visualViewport" in window && isMobile) {
      const handleViewportResize = () => {
        const viewport = window.visualViewport;
        const keyboardOffset = window.innerHeight - viewport.height;
        document.documentElement.style.setProperty(
          "--keyboard-offset",
          `${Math.max(0, keyboardOffset)}px`,
        );
      };

      window.visualViewport.addEventListener("resize", handleViewportResize);
      window.visualViewport.addEventListener("scroll", handleViewportResize);

      return () => {
        window.visualViewport.removeEventListener(
          "resize",
          handleViewportResize,
        );
        window.visualViewport.removeEventListener(
          "scroll",
          handleViewportResize,
        );
        document.documentElement.style.setProperty("--keyboard-offset", "0px");
      };
    }
  }, [isMobile]);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    // Skip if we're in the middle of creating a new chat
    if (isCreatingChatRef.current) {
      return;
    }

    // Don't clear streaming states - they're per-chat now
    setUsageStats(null);

    if (currentChat?.id) {
      loadMessages(currentChat.id);
    } else {
      setMessages([]);
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

  // Close stats popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        statsPopupRef.current &&
        !statsPopupRef.current.contains(event.target)
      ) {
        setShowInfoModal(false);
      }
    };
    if (showInfoModal) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showInfoModal]);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close context menu on any click
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [contextMenu.isOpen]);

  // Scroll to target message when navigating from search
  useEffect(() => {
    if (targetMessageRef.current && messages.length > 0) {
      const messageElement = document.getElementById(
        `message-${targetMessageRef.current}`,
      );
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
        messageElement.classList.add("highlight-message");
        setTimeout(() => {
          messageElement.classList.remove("highlight-message");
        }, 2000);
        targetMessageRef.current = null;
      }
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleMessagesScroll = (e) => {
    const container = e.target;
    const threshold = 100; // pixels from bottom
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    userHasScrolledUp.current = !isNearBottom;
  };

  const toggleThinkingSection = useCallback((messageId) => {
    setExpandedThinkingSections((prev) => {
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
      const res = await fetch("/api/chats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      setChats(data);
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  };

  const loadWorkspaces = async () => {
    try {
      const res = await fetch("/api/workspaces", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      setWorkspaces(data);
    } catch (error) {
      console.error("Failed to load workspaces:", error);
    }
  };

  const createWorkspace = async (workspaceData) => {
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(workspaceData),
      });
      const newWorkspace = await res.json();
      setWorkspaces((prev) => [...prev, newWorkspace]);
      return newWorkspace;
    } catch (error) {
      console.error("Failed to create workspace:", error);
    }
  };

  const updateWorkspace = async (workspaceData) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(workspaceData),
      });
      const updated = await res.json();
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === updated.id ? updated : w)),
      );
      return updated;
    } catch (error) {
      console.error("Failed to update workspace:", error);
    }
  };

  const handleRenameClick = () => {
    const chat = chats.find((c) => c.id === contextMenu.chatId);
    if (chat) {
      setRenamingChatId(chat.id);
      setEditChatValue(chat.title);
      closeContextMenu();
    }
  };

  const handleInlineChatRename = async (id, newName) => {
    if (!newName || !newName.trim()) {
      setRenamingChatId(null);
      return;
    }
    try {
      const res = await fetch(`/api/chats/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ title: newName.trim() }),
      });
      if (res.ok) {
        setChats((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newName.trim() } : c)),
        );
        if (currentChat?.id === id) {
          setCurrentChat((prev) => ({ ...prev, title: newName.trim() }));
        }
      }
    } catch (e) {
      console.error("Failed to rename chat:", e);
    }
    setRenamingChatId(null);
  };

  const deleteWorkspace = async (workspaceId) => {
    try {
      await fetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
      if (activeWorkspace === workspaceId) setActiveWorkspace(null);
      loadChats(); // Reload chats to update uncategorized status
    } catch (error) {
      console.error("Failed to delete workspace:", error);
    }
  };

  const moveChatsToWorkspace = async (chatIds, workspaceId) => {
    try {
      await fetch(`/api/workspaces/${workspaceId || "remove"}/chats`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ chatIds }),
      });
      loadChats(); // Reload chats to reflect new workspace
      loadWorkspaces(); // Reload workspaces to update counts
    } catch (error) {
      console.error("Failed to move chats:", error);
    }
  };

  // Initial load
  useEffect(() => {
    loadChats();
    loadWorkspaces();
  }, []);

  const loadMessages = async (chatId) => {
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (!res.ok) {
        if (res.status === 404) {
          console.warn(`Chat ${chatId} not found`);
          // If we're trying to load a chat that doesn't exist (e.g. valid ID but failed creation),
          // fallback to new chat state to prevent error loops
          if (chatId === currentChatIdRef.current) {
            createNewChat();
          }
          return;
        }
        throw new Error(`Failed to load chat: ${res.status}`);
      }

      const data = await res.json();

      // Only update state if this chat is still the active one
      // This prevents race conditions when user switches chats during a stream
      if (chatId !== currentChatIdRef.current) {
        return; // User switched chats, don't update
      }

      setMessages(data.messages || []);

      let modelToUse = data.model;

      // Check if guest user needs model auto-switch (Admins and users with can_use_default_key are exempt)
      if (
        user?.usingDefaultKey &&
        !user?.is_admin &&
        !user?.permissions?.can_use_default_key
      ) {
        if (user?.guestModelWhitelist && user.guestModelWhitelist.length > 0) {
          if (!user.guestModelWhitelist.includes(data.model)) {
            // Auto-switch to first whitelisted model
            modelToUse = user.guestModelWhitelist[0];

            // Get model name for notification
            const getModelName = (modelId) => {
              try {
                const cached = localStorage.getItem(MODELS_CACHE_KEY);
                if (cached) {
                  const { models } = JSON.parse(cached);
                  const model = models.find((m) => m.id === modelId);
                  if (model?.name) return model.name;
                }
              } catch (e) {}
              return modelId.split("/").pop();
            };

            const newModelName = getModelName(modelToUse);
            alert(
              `Model switched to ${newModelName} (previous model not available for guest users)`,
            );

            // Update the chat model on the server
            try {
              await fetch(`/api/chats/${chatId}`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ model: modelToUse }),
              });
            } catch (e) {
              console.error("Failed to update chat model:", e);
            }
          }
        }
      }

      setChatSettings({
        model: modelToUse,
        temperature: data.temperature,
        depth: data.depth || "standard",
        tone: data.tone || "friendly",
        system_prompt: data.system_prompt || "",
        agent_mode: !!data.agent_mode,
      });
      setThinkingMode(data.thinking_mode || "medium");

      // Restore persona from chat data
      if (data.persona_id) {
        try {
          const personaRes = await fetch(`/api/personas/${data.persona_id}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          if (personaRes.ok) {
            const persona = await personaRes.json();
            setSelectedPersona(persona);
          } else {
            setSelectedPersona(null);
          }
        } catch (e) {
          console.error("Failed to load persona:", e);
          setSelectedPersona(null);
        }
      } else {
        setSelectedPersona(null);
      }

      // Update currentChat with latest data (including updated title)
      const { messages: _, ...chatData } = data;
      setCurrentChat((prev) => ({ ...prev, ...chatData, model: modelToUse }));
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const createNewChat = async () => {
    // Preserve workspace context from current chat if it exists
    const contextWorkspaceId = currentChat?.workspace_id || null;
    setActiveWorkspace(contextWorkspaceId);

    let modelToUse = localStorage.getItem(LAST_MODEL_KEY) || DEFAULT_MODEL;

    // For guest users using default key, ensure the model is whitelisted (Admins and users with can_use_default_key are exempt)
    if (
      user?.usingDefaultKey &&
      !user?.is_admin &&
      !user?.permissions?.can_use_default_key
    ) {
      if (user?.guestModelWhitelist && user.guestModelWhitelist.length > 0) {
        if (!user.guestModelWhitelist.includes(modelToUse)) {
          // Use first whitelisted model - ONLY if whitelist has items
          modelToUse = user.guestModelWhitelist[0];
        }
      }
      // If whitelist is empty, we don't change modelToUse here,
      // but ModelSelector will show "Add API Key" and backend will reject any model.
    }

    // Clear all existing state
    setMessages([]);
    setExpandedThinkingSections(new Set());
    setThinkingElapsedTime(0);
    setShowSettings(false);
    setUsageStats(null);

    // Check if workspace has a default persona
    let defaultPersona = null;
    if (contextWorkspaceId) {
      const ws = workspaces.find((w) => w.id === contextWorkspaceId);
      if (ws?.default_persona_id) {
        try {
          const personaRes = await fetch(
            `/api/personas/${ws.default_persona_id}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            },
          );
          if (personaRes.ok) {
            defaultPersona = await personaRes.json();
          }
        } catch (e) {
          console.error("Failed to load workspace default persona:", e);
        }
      }
    }

    setSelectedPersona(defaultPersona);

    // Apply persona settings if available
    let temperature = 0.7;
    let depth = "standard";
    let tone = "friendly";
    let systemPrompt = "";
    if (defaultPersona) {
      if (defaultPersona.creativity === "precise") temperature = 0.2;
      else if (defaultPersona.creativity === "imaginative") temperature = 1.0;
      depth = defaultPersona.depth || "standard";
      tone = defaultPersona.tone || "friendly";
      systemPrompt = defaultPersona.system_prompt || "";
    }

    // Create a temporary chat object without an ID
    // The actual chat will be created when the first message is sent
    setCurrentChat({
      title: "New Chat",
      model: modelToUse,
      temperature,
      system_prompt: systemPrompt,
      agent_mode: false,
      thinking_mode: "medium",
    });
    setChatSettings({
      model: modelToUse,
      temperature,
      depth,
      tone,
      system_prompt: systemPrompt,
      agent_mode: false,
    });
    setThinkingMode(localStorage.getItem(LAST_THINKING_MODE_KEY) || "medium");
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
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(chatSettings),
      });
      setShowSettings(false);
    } catch (error) {
      console.error("Failed to update chat:", error);
    }
  };

  const handleModelChange = async (modelId) => {
    // Save as last used model
    localStorage.setItem(LAST_MODEL_KEY, modelId);

    setChatSettings((prev) => ({ ...prev, model: modelId }));

    // If we have a current chat with an ID, update it immediately
    if (currentChat && currentChat.id) {
      try {
        await fetch(`/api/chats/${currentChat.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ ...chatSettings, model: modelId }),
        });
      } catch (error) {
        console.error("Failed to update chat model:", error);
      }
    } else if (currentChat && !currentChat.id) {
      // If it's a new chat without an ID, just update local state
      setCurrentChat({ ...currentChat, model: modelId });
    }
  };

  const handlePersonaSelect = async (persona) => {
    setSelectedPersona(persona);

    if (!persona) {
      setChatSettings((prev) => ({
        ...prev,
        system_prompt: "",
        temperature: 0.7,
        depth: "standard",
        tone: "friendly",
      }));
      // Persist null persona to chat
      if (currentChat?.id) {
        try {
          await fetch(`/api/chats/${currentChat.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ persona_id: null }),
          });
        } catch (e) {
          console.error("Failed to update chat persona:", e);
        }
      }
      return;
    }

    // Map creativity to temperature
    let newTemp = 0.7;
    if (persona.creativity === "precise") newTemp = 0.2;
    else if (persona.creativity === "imaginative") newTemp = 1.0;
    else newTemp = 0.7;

    setChatSettings((prev) => ({
      ...prev,
      system_prompt: persona.system_prompt || "",
      temperature: newTemp,
      depth: persona.depth || "standard",
      tone: persona.tone || "friendly",
    }));

    // Persist persona_id to chat
    if (currentChat?.id) {
      try {
        await fetch(`/api/chats/${currentChat.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ persona_id: persona.id }),
        });
      } catch (e) {
        console.error("Failed to update chat persona:", e);
      }
    }
  };

  // Handle workspace selection: apply default persona (or reset to Default Assistant)
  const handleWorkspaceSelect = async (workspaceId) => {
    setActiveWorkspace(workspaceId);

    // Only apply persona defaults for new chats (no ID yet)
    if (currentChat?.id) return;

    if (workspaceId) {
      const ws = workspaces.find((w) => w.id === workspaceId);
      if (ws?.default_persona_id) {
        try {
          const personaRes = await fetch(
            `/api/personas/${ws.default_persona_id}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            },
          );
          if (personaRes.ok) {
            const persona = await personaRes.json();
            setSelectedPersona(persona);
            let newTemp = 0.7;
            if (persona.creativity === "precise") newTemp = 0.2;
            else if (persona.creativity === "imaginative") newTemp = 1.0;
            setChatSettings((prev) => ({
              ...prev,
              system_prompt: persona.system_prompt || "",
              temperature: newTemp,
              depth: persona.depth || "standard",
              tone: persona.tone || "friendly",
            }));
            return;
          }
        } catch (e) {
          console.error("Failed to load workspace default persona:", e);
        }
      }
    }

    // No workspace or no default persona → reset to Default Assistant
    setSelectedPersona(null);
    setChatSettings((prev) => ({
      ...prev,
      system_prompt: "",
      temperature: 0.7,
      depth: "standard",
      tone: "friendly",
    }));
  };

  const deleteChat = async (chatId) => {
    // Abort any active stream for this chat
    const controller = abortControllersRef.current.get(chatId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(chatId);
      clearStreamState(chatId);
    }

    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (!res.ok) {
        throw new Error("Failed to delete chat");
      }

      setChats(chats.filter((c) => c.id !== chatId));
      if (currentChat?.id === chatId) {
        // Automatically open a new chat instead of leaving blank
        setMessages([]);
        createNewChat();
      }
      setDeletingChatId(null);
      closeContextMenu(); // Ensure menu is closed
    } catch (error) {
      console.error("Failed to delete chat:", error);
      alert("Failed to delete chat. Please try again.");
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          message_id: forkMessageId,
          model: forkModel,
        }),
      });
      const data = await res.json();
      setChats([data, ...chats]);
      setCurrentChat(data);
      setShowForkModal(false);
      setForkMessageId(null);

      // Save the fork model as last used
      localStorage.setItem(LAST_MODEL_KEY, forkModel);
    } catch (error) {
      console.error("Failed to fork chat:", error);
    }
  };

  const stopGeneration = useCallback(() => {
    const chatId = currentChat?.id;
    if (!chatId) return;

    const controller = abortControllersRef.current.get(chatId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(chatId);
      clearStreamState(chatId);
    }
  }, [currentChat?.id, clearStreamState]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentChat || streaming) return;

    const userMessage = inputMessage.trim();
    const attachmentIds = pendingAttachments.map((a) => a.id);
    const attachmentPreviews = [...pendingAttachments];

    setInputMessage("");
    setPendingAttachments([]);

    // Add user message to UI immediately (with attachment previews)
    const tempUserMessage = {
      id: Date.now(),
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
      attachments: attachmentPreviews,
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    // Determine chatId - may need to create the chat first
    let chatId = currentChat.id;

    try {
      // If this is a new chat without an ID, create it first
      if (!chatId) {
        isCreatingChatRef.current = true;
        const createRes = await fetch("/api/chats", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            title: "New Chat",
            model: chatSettings.model,
            temperature: chatSettings.temperature,
            // Combine persona prompt (if any) with custom system prompt
            system_prompt: [
              selectedPersona?.system_prompt,
              chatSettings.system_prompt,
            ]
              .filter(Boolean)
              .join("\n\n"),
            agent_mode: chatSettings.agent_mode,
            thinking_mode: thinkingMode || "medium",
            workspace_id: activeWorkspace || null,
            persona_id: selectedPersona?.id || null,
          }),
        });
        const newChat = await createRes.json();
        chatId = newChat.id;
        // Don't update currentChat here yet as it might race, but we need the ID
        setCurrentChat(newChat);
        setChats((prev) => [newChat, ...prev]);
        currentChatIdRef.current = chatId; // Manually update ref for immediate use
      }

      // Initialize streaming state for this chat
      const streamStartTime = Date.now();
      updateStreamState(chatId, {
        streaming: true,
        streamingMessage: "",
        streamingReasoning: "",
        thinkingStartTime: streamStartTime,
        thinkingComplete: false,
        lastThinkingStats: null,
      });

      // Create abort controller for this chat
      const abortController = new AbortController();
      abortControllersRef.current.set(chatId, abortController);

      // Final check before starting stream
      if (currentChatIdRef.current && currentChatIdRef.current !== chatId) {
        throw new Error("Chat changed before sending message");
      }

      const res = await fetch(`/api/messages/${chatId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          content: userMessage,
          reasoning:
            thinkingMode !== "off"
              ? (() => {
                  const mode = THINKING_MODES.find(
                    (m) => m.id === thinkingMode,
                  );
                  // OpenRouter requires EITHER effort OR max_tokens, not both
                  if (mode?.max_tokens) return { max_tokens: mode.max_tokens };
                  return { effort: mode?.effort || "medium" };
                })()
              : undefined,
          attachment_ids: attachmentIds,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send message");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Local accumulators to avoid stale closures with state
      let accumulatedMessage = "";
      let accumulatedReasoning = "";
      let accumulatedPreToolReasoning = "";
      let accumulatedPostToolReasoning = "";
      let hasReceivedToolCalls = false;
      let accumulatedSteps = []; // Track steps locally
      let currentLocalStepId = null;
      let localCompletedTurns = []; // Track completed turns for multi-step tool use
      let localToolCalls = [];
      let localToolResults = {};

      // Capture the specific controller for this stream
      const currentStreamController = abortController;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Check for abort on THIS specific controller (user interactions)
        if (currentStreamController?.signal.aborted) {
          try {
            reader.cancel();
          } catch (e) {}
          break;
        }

        // Check if this is the active chat for UI updates
        const isActiveChat = currentChatIdRef.current === chatId;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "reasoning") {
                accumulatedReasoning += data.content;
                if (hasReceivedToolCalls) {
                  accumulatedPostToolReasoning += data.content;
                  updateStreamState(chatId, {
                    streamingReasoning: accumulatedReasoning,
                    postToolReasoning: accumulatedPostToolReasoning,
                    isPostToolPhase: true,
                  });
                } else {
                  accumulatedPreToolReasoning += data.content;
                  updateStreamState(chatId, {
                    streamingReasoning: accumulatedReasoning,
                    preToolReasoning: accumulatedPreToolReasoning,
                  });
                }
              } else if (data.type === "content") {
                accumulatedMessage += data.content;
                updateStreamState(chatId, {
                  thinkingComplete: true,
                  streamingMessage: accumulatedMessage,
                });
              } else if (data.type === "title") {
                const newTitle = data.content;
                setChats((prev) =>
                  prev.map((c) =>
                    c.id === chatId ? { ...c, title: newTitle } : c,
                  ),
                );
                if (isActiveChat) {
                  setCurrentChat((prev) =>
                    prev.id === chatId ? { ...prev, title: newTitle } : prev,
                  );
                }
              } else if (data.type === "done") {
                const chatState = streamingStates.get(chatId);
                const thinkingDuration = chatState?.thinkingStartTime
                  ? (Date.now() - chatState.thinkingStartTime) / 1000
                  : 0;

                if (data.usage) {
                  const stats = {
                    promptTokens: data.usage.prompt_tokens || 0,
                    completionTokens: data.usage.completion_tokens || 0,
                    totalTokens: data.usage.total_tokens || 0,
                    model: data.model,
                    duration: thinkingDuration,
                    cost: data.cost || 0,
                  };
                  if (isActiveChat) {
                    setUsageStats((prev) => ({
                      ...prev,
                      lastMessage: stats,
                      totalPromptTokens:
                        (prev?.totalPromptTokens || 0) +
                        (data.usage.prompt_tokens || 0),
                      totalCompletionTokens:
                        (prev?.totalCompletionTokens || 0) +
                        (data.usage.completion_tokens || 0),
                      totalTokens:
                        (prev?.totalTokens || 0) +
                        (data.usage.total_tokens || 0),
                      messageCount: (prev?.messageCount || 0) + 1,
                    }));
                  }
                }

                clearStreamState(chatId);
                loadMessages(chatId);
                loadChats();
              } else if (data.type === "tool_calls") {
                hasReceivedToolCalls = true;
                localToolCalls = data.tool_calls;
                updateStreamState(chatId, {
                  toolCalls: data.tool_calls,
                  isPostToolPhase: true,
                });
              } else if (data.type === "tool_result") {
                localToolResults = {
                  ...localToolResults,
                  [data.tool_call_id]: data.result,
                };
                updateStreamState(chatId, {
                  toolResults: localToolResults,
                });
              } else if (data.type === "new_assistant_turn") {
                // A new synthesis turn is starting - save current state as a completed turn
                localCompletedTurns = [
                  ...localCompletedTurns,
                  {
                    message: accumulatedMessage,
                    reasoning: accumulatedReasoning,
                    steps: [...accumulatedSteps],
                    toolCalls: [...localToolCalls],
                    toolResults: { ...localToolResults },
                  },
                ];
                // Reset accumulators for the new turn
                accumulatedMessage = "";
                accumulatedReasoning = "";
                accumulatedPreToolReasoning = "";
                accumulatedPostToolReasoning = "";
                hasReceivedToolCalls = false;
                accumulatedSteps = [];
                currentLocalStepId = null;
                localToolCalls = [];
                localToolResults = {};
                updateStreamState(chatId, {
                  completedTurns: localCompletedTurns,
                  streamingMessage: "",
                  streamingReasoning: "",
                  preToolReasoning: "",
                  postToolReasoning: "",
                  isPostToolPhase: false,
                  thinkingComplete: false,
                  toolCalls: [],
                  toolResults: {},
                  steps: [],
                  currentStepId: null,
                });
              } else if (data.type === "step_start") {
                const newStep = {
                  id: data.step_id,
                  type: data.step_type,
                  index: data.step_index,
                  content: "",
                  isComplete: false,
                  toolName: data.tool_name || null,
                  toolCallId: data.tool_call_id || null,
                  toolArguments: data.tool_arguments || null,
                };
                accumulatedSteps = [...accumulatedSteps, newStep];
                currentLocalStepId = data.step_id;

                updateStreamState(chatId, {
                  steps: accumulatedSteps,
                  currentStepId: currentLocalStepId,
                });
              } else if (data.type === "step_content") {
                accumulatedSteps = accumulatedSteps.map((step) =>
                  step.id === data.step_id
                    ? { ...step, content: step.content + data.content }
                    : step,
                );

                updateStreamState(chatId, { steps: accumulatedSteps });
              } else if (data.type === "step_complete") {
                accumulatedSteps = accumulatedSteps.map((step) =>
                  step.id === data.step_id
                    ? {
                        ...step,
                        isComplete: true,
                        duration_ms: data.duration_ms,
                      }
                    : step,
                );

                updateStreamState(chatId, {
                  steps: accumulatedSteps,
                  currentStepId: null,
                });
              } else if (data.type === "message_finalized") {
                // Optimistic update to prevent UI flicker
                // For multi-turn tool chains, skip optimistic update - loadMessages handles it
                if (!data.message_ids || data.message_ids.length <= 1) {
                  const finalMessage = {
                    id: data.message_id,
                    role: "assistant",
                    content: accumulatedMessage,
                    model: currentChat.model,
                    created_at: new Date().toISOString(),
                    steps: accumulatedSteps,
                    reasoning_content: accumulatedReasoning,
                    tool_calls: hasReceivedToolCalls
                      ? JSON.stringify(
                          streamingStates.get(chatId)?.toolCalls || [],
                        )
                      : null,
                  };

                  setMessages((prev) => {
                    if (prev.some((m) => m.id === finalMessage.id)) {
                      return prev.map((m) =>
                        m.id === finalMessage.id ? finalMessage : m,
                      );
                    }
                    return [...prev, finalMessage];
                  });
                }
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      if (
        error.name === "AbortError" ||
        error.message === "Chat changed before sending message"
      ) {
        console.log("Generation aborted");
      } else {
        console.error("Failed to send message:", error);
        alert(
          error.message ||
            "Failed to send message. Please check your API key configuration.",
        );
      }
    } finally {
      isCreatingChatRef.current = false;
      if (chatId) {
        abortControllersRef.current.delete(chatId);
      }
    }
  };

  const renderMessage = (content) => {
    const html = DOMPurify.sanitize(marked(content || ""));
    return (
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  const stripMarkdown = (text) => {
    if (!text) return "";
    return text
      .replace(/#{1,6}\s?/g, "") // headers
      .replace(/\*\*(.+?)\*\*/g, "$1") // bold
      .replace(/\*(.+?)\*/g, "$1") // italic
      .replace(/__(.+?)__/g, "$1") // bold alt
      .replace(/_(.+?)_/g, "$1") // italic alt
      .replace(/`{3}[\s\S]*?`{3}/g, "") // code blocks
      .replace(/`(.+?)`/g, "$1") // inline code
      .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
      .replace(/!\[.*?\]\(.+?\)/g, "") // images
      .replace(/^\s*[-*+]\s/gm, "") // unordered lists
      .replace(/^\s*\d+\.\s/gm, "") // ordered lists
      .replace(/>\s?/g, "") // blockquotes
      .replace(/---/g, "") // horizontal rules
      .trim();
  };

  const handleCopy = async (messageId, content, type) => {
    const textToCopy = type === "raw" ? stripMarkdown(content) : content;
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
    setEditContent("");
  };

  const handleSearchSelectChat = (chatId) => {
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      setCurrentChat(chat);
    } else {
      // Chat not in current list, fetch it
      fetch(`/api/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
        .then((res) => res.json())
        .then((data) => {
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

  const openInCanvas = (content, title = "Canvas") => {
    // Try to detect language from code blocks
    const codeBlockMatch = content.match(/```(\w+)?/);
    let language = "markdown";
    let cleanContent = content;

    if (codeBlockMatch) {
      // Extract code from code block
      const fullMatch = content.match(/```(\w+)?\n?([\s\S]*?)```/);
      if (fullMatch) {
        language = fullMatch[1] || "javascript";
        cleanContent = fullMatch[2].trim();
      }
    } else if (
      content.includes("function ") ||
      content.includes("const ") ||
      content.includes("let ")
    ) {
      language = "javascript";
    } else if (content.includes("def ") || content.includes("import ")) {
      language = "python";
    }

    setCanvasState({
      isOpen: true,
      content: cleanContent,
      language,
      title,
    });
  };

  // Ref to hold pending edit message that should be sent after state updates
  const pendingEditMessageRef = useRef(null);

  // Effect to send the pending edit message once inputMessage is set
  useEffect(() => {
    if (
      pendingEditMessageRef.current &&
      inputMessage === pendingEditMessageRef.current
    ) {
      pendingEditMessageRef.current = null;
      // Programmatically trigger send
      const syntheticEvent = { preventDefault: () => {} };
      sendMessage(syntheticEvent);
    }
  }, [inputMessage]);

  const handleEditSave = async (messageId) => {
    if (!editContent.trim() || !currentChat?.id) return;

    try {
      // 1. Delete branch from this message onward
      const res = await fetch(`/api/messages/${messageId}/branch`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) throw new Error("Failed to delete message branch");

      // 2. Save edited content and reset edit state
      const userMessage = editContent.trim();
      setEditingMessageId(null);
      setEditContent("");

      // 3. Reload messages to reflect the deletion
      await loadMessages(currentChat.id);

      // 4. Set input and trigger send via the effect
      pendingEditMessageRef.current = userMessage;
      setInputMessage(userMessage);
    } catch (error) {
      console.error("Failed to edit message:", error);
      alert("Failed to edit message: " + error.message);
    }
  };

  const handleRetry = async (message) => {
    if (!currentChat?.id || streaming) return;
    try {
      const res = await fetch(`/api/messages/${message.id}/branch`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete messages");
      await loadMessages(currentChat.id);
      pendingEditMessageRef.current = message.content;
      setInputMessage(message.content);
    } catch (error) {
      console.error("Failed to retry message:", error);
    }
  };

  // Close sidebar when selecting a chat on mobile
  const handleChatSelect = useCallback(
    (chat) => {
      setCurrentChat(chat);
      if (isMobile) {
        setShowSidebar(false);
      }
    },
    [isMobile],
  );

  return (
    <div className="flex h-screen bg-dark-950 bg-mesh">
      {/* Mobile Sidebar Overlay */}
      {isMobile && showSidebar && (
        <div
          className="sidebar-mobile-overlay"
          onClick={() => setShowSidebar(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - responsive */}
      <div
        className={`
        ${
          isMobile
            ? `sidebar-mobile glass-sidebar ${showSidebar ? "open" : ""}`
            : `${showSidebar ? "w-72" : "w-16"} transition-all duration-300 ease-out glass-sidebar`
        }
        flex flex-col overflow-hidden ${isMobile ? "z-[60]" : "z-50"} ${isMobile ? "max-h-screen" : ""}
      `}
      >
        <div
          className={`${showSidebar ? "p-4 md:p-5" : "p-2 md:p-3"} border-b border-dark-700/30 ${isMobile ? "pt-2" : "safe-area-inset-top"}`}
        >
          <div
            className={`flex items-center ${showSidebar ? "gap-3 mb-4 md:mb-5" : "justify-center mb-2"}`}
          >
            {/* Toggle button - always on left (desktop collapse, mobile close) */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-dark-700/30 rounded-lg transition-all duration-200 flex-shrink-0"
              title={
                showSidebar
                  ? isMobile
                    ? "Close menu"
                    : "Collapse sidebar"
                  : "Expand sidebar"
              }
            >
              {showSidebar ? (
                isMobile ? (
                  <X className="w-5 h-5 text-dark-300" />
                ) : (
                  <MessageSquare className="w-4 h-4 text-dark-300" />
                )
              ) : (
                <Menu className="w-4 h-4 text-dark-500" />
              )}
            </button>

            {/* User info - only when expanded */}
            {showSidebar && (
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold text-base text-dark-100 tracking-tight truncate">
                  {user?.name || "User"}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {user?.user_type === "master" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Shield className="w-3 h-3" />
                      Master
                    </span>
                  ) : user?.is_admin || user?.user_type === "admin" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${user?.group_info?.color || "#3b82f6"}20`,
                        color: user?.group_info?.color || "#3b82f6",
                        border: `1px solid ${user?.group_info?.color || "#3b82f6"}40`,
                      }}
                    >
                      {user?.group_info?.name || user?.user_group || "User"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={`flex ${showSidebar ? "gap-2" : "flex-col gap-2"}`}>
            {(!user?.permissions || user.permissions.can_create_chats) && (
              <button
                onClick={() => {
                  createNewChat();
                  if (isMobile) setShowSidebar(false);
                }}
                className={`${showSidebar ? "flex-1 py-3 gap-2 min-h-[44px]" : "w-11 h-11 mx-auto"} gradient-primary text-white rounded-xl font-semibold hover:shadow-glow transition-all duration-200 flex items-center justify-center shine active:scale-[0.98]`}
                title={showSidebar ? undefined : "New Chat"}
              >
                <Plus className="w-4 h-4" />
                {showSidebar && "New Chat"}
              </button>
            )}
            <button
              onClick={() => {
                setShowSearch(true);
                if (isMobile) setShowSidebar(false);
              }}
              className={`${showSidebar ? "px-3 py-3 min-h-[44px]" : "w-11 h-11 mx-auto"} glass-button text-dark-400 hover:text-dark-200 rounded-xl transition-all duration-200 flex items-center justify-center`}
              title={showSidebar ? "Search (Cmd+K)" : "Search"}
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className={`flex-1 overflow-y-auto ${showSidebar ? "p-3 space-y-1" : "p-2 space-y-1"}`}
        >
          {/* Workspace Sidebar - integrated at top */}
          {showSidebar ? (
            <div className="mb-2">
              <WorkspaceSidebar
                workspaces={workspaces}
                chats={chats}
                activeWorkspace={activeWorkspace}
                activeChatId={currentChat?.id}
                streamingChatIds={streamingChatIds}
                onSelectWorkspace={(id) => {
                  // Toggle: deselect if already active
                  const newId = activeWorkspace === id ? null : id;
                  handleWorkspaceSelect(newId);
                }}
                onSelectChat={(chatId) => {
                  const chat = chats.find((c) => c.id === chatId);
                  if (chat) handleChatSelect(chat);
                }}
                onCreateWorkspace={createWorkspace}
                onUpdateWorkspace={updateWorkspace}
                onDeleteWorkspace={deleteWorkspace}
                onMoveChats={moveChatsToWorkspace}
                onChatContextMenu={handleContextMenu}
                onWorkspaceContextMenu={(e, id) =>
                  handleContextMenu(e, id, "workspace")
                }
                editingSettingsId={wsSettingsId}
                onEditSettingsComplete={() => setWsSettingsId(null)}
                renamingId={renamingWorkspaceId}
                onRenameCancel={() => setRenamingWorkspaceId(null)}
                onRenameSubmit={async (id, newName) => {
                  if (!newName || !newName.trim()) {
                    setRenamingWorkspaceId(null);
                    return;
                  }
                  try {
                    const res = await fetch(`/api/workspaces/${id}`, {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                      },
                      body: JSON.stringify({ name: newName.trim() }),
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      setWorkspaces((prev) =>
                        prev.map((w) => (w.id === updated.id ? updated : w)),
                      );
                    }
                  } catch (e) {
                    console.error("Failed to rename workspace:", e);
                  }
                  setRenamingWorkspaceId(null);
                }}
                renamingChatId={renamingChatId}
                onChatRenameCancel={() => setRenamingChatId(null)}
                onChatRenameSubmit={handleInlineChatRename}
              />
              {/* Divider between workspaces and chats */}
              <div className="h-px bg-dark-700/30 my-2 mx-2" />
            </div>
          ) : (
            workspaces.length > 0 && (
              /* Collapsed workspace icons */
              <div className="space-y-1 mb-2">
                {workspaces.map((workspace) => {
                  const IconComponent = getIconComponent(workspace.icon);
                  const isActive = activeWorkspace === workspace.id;
                  const workspaceChats = chats.filter(
                    (c) => c.workspace_id === workspace.id,
                  );
                  const isGenerating = workspaceChats.some((chat) =>
                    streamingChatIds.has(chat.id),
                  );

                  return (
                    <div
                      key={workspace.id}
                      className={`p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                        isActive
                          ? "bg-dark-800/80 border-l-2 border-accent/60"
                          : "hover:bg-dark-800/40 border-l-2 border-transparent"
                      }`}
                      onClick={() =>
                        setActiveWorkspace((prev) =>
                          prev === workspace.id ? null : workspace.id,
                        )
                      }
                      onContextMenu={(e) =>
                        handleContextMenu(e, workspace.id, "workspace")
                      }
                    >
                      <div
                        className="flex justify-center relative"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoverTooltip({
                            visible: true,
                            text: workspace.name,
                            x: rect.right + 8,
                            y: rect.top + rect.height / 2,
                          });
                        }}
                        onMouseLeave={() =>
                          setHoverTooltip({
                            visible: false,
                            text: "",
                            x: 0,
                            y: 0,
                          })
                        }
                      >
                        <IconComponent
                          className="w-5 h-5"
                          style={{ color: workspace.color }}
                        />
                        {isGenerating && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                            <span
                              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                              style={{ backgroundColor: workspace.color }}
                            ></span>
                            <span
                              className="relative inline-flex rounded-full h-2 w-2"
                              style={{ backgroundColor: workspace.color }}
                            ></span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="h-px bg-dark-700/30 my-1 mx-1" />
              </div>
            )
          )}

          {uncategorizedChats.map((chat) => (
            <div
              key={chat.id}
              className={`group ${showSidebar ? "p-3" : "p-2"} rounded-lg cursor-pointer transition-all duration-200 ${
                currentChat?.id === chat.id
                  ? "bg-dark-800/80 border-l-2 border-accent/60"
                  : "hover:bg-dark-800/40 border-l-2 border-transparent"
              }`}
              onClick={() => handleChatSelect(chat)}
              onContextMenu={(e) => handleContextMenu(e, chat.id)}
            >
              {showSidebar ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {renamingChatId === chat.id ? (
                      <input
                        type="text"
                        value={editChatValue}
                        onChange={(e) => setEditChatValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            handleInlineChatRename(chat.id, editChatValue);
                          } else if (e.key === "Escape") {
                            e.stopPropagation();
                            setRenamingChatId(null);
                          }
                        }}
                        onBlur={() =>
                          handleInlineChatRename(chat.id, editChatValue)
                        }
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-dark-900 text-sm text-dark-100 px-1.5 py-0.5 rounded border border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    ) : (
                      <p
                        className={`font-medium text-sm truncate ${currentChat?.id === chat.id ? "text-dark-50" : "text-dark-200"}`}
                      >
                        {chat.title}
                      </p>
                    )}
                    {streamingChatIds.has(chat.id) && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/20 text-accent text-[10px] font-medium">
                          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                          Generating
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {(!user?.permissions ||
                      user.permissions.can_delete_chats) &&
                      (deletingChatId === chat.id ? (
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
                      ))}
                  </div>
                </div>
              ) : (
                <div
                  className="flex justify-center relative"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoverTooltip({
                      visible: true,
                      text: chat.title,
                      x: rect.right + 8,
                      y: rect.top + rect.height / 2,
                    });
                  }}
                  onMouseLeave={() =>
                    setHoverTooltip({ visible: false, text: "", x: 0, y: 0 })
                  }
                >
                  <MessageSquare
                    className={`w-5 h-5 ${currentChat?.id === chat.id ? "text-accent" : "text-dark-400"}`}
                  />
                  {streamingChatIds.has(chat.id) && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full animate-pulse" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div
          className={`${showSidebar ? "p-3" : "p-2"} border-t border-dark-700/30 space-y-1 safe-area-inset-bottom`}
        >
          {(!user?.permissions || user.permissions.can_access_memories) && (
            <button
              onClick={() => navigate("/memories")}
              className={`${showSidebar ? "w-full px-4 gap-3 min-h-[44px]" : "w-11 h-11 mx-auto"} flex items-center justify-center py-2 rounded-lg hover:bg-dark-800/40 transition-all text-sm font-medium text-dark-400 hover:text-dark-300`}
              title={showSidebar ? undefined : "Memories"}
            >
              <Brain className="w-4 h-4" />
              {showSidebar && "Memories"}
            </button>
          )}
          {(!user?.permissions || user.permissions.can_access_settings) && (
            <button
              onClick={() => navigate("/settings")}
              className={`${showSidebar ? "w-full px-4 gap-3 min-h-[44px]" : "w-11 h-11 mx-auto"} flex items-center justify-center py-2 rounded-lg hover:bg-dark-800/40 transition-all text-sm font-medium text-dark-400 hover:text-dark-300`}
              title={showSidebar ? undefined : "Settings"}
            >
              <SettingsIcon className="w-4 h-4" />
              {showSidebar && "Settings"}
            </button>
          )}
          {(user?.is_admin ||
            user?.user_type === "admin" ||
            user?.user_type === "master") && (
            <button
              onClick={() => navigate("/admin")}
              className={`${showSidebar ? "w-full px-4 gap-3 min-h-[44px]" : "w-11 h-11 mx-auto"} flex items-center justify-center py-2 rounded-lg hover:bg-dark-800/40 transition-all text-sm font-medium text-dark-400 hover:text-dark-300`}
              title={showSidebar ? undefined : "Admin"}
            >
              <Sparkles className="w-4 h-4" />
              {showSidebar && "Admin"}
            </button>
          )}
          {showSidebar && <div className="divider-gradient my-2"></div>}
          <button
            onClick={logout}
            className={`${showSidebar ? "w-full px-4 gap-3 min-h-[44px]" : "w-11 h-11 mx-auto"} flex items-center justify-center py-2 rounded-lg hover:bg-dark-800/40 transition-all text-sm font-medium text-dark-500 hover:text-dark-400`}
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
        <div className="bg-dark-900/50 border-b border-dark-700/30 px-3 md:px-4 pt-1 pb-2 md:pt-3 md:pb-3 flex items-center justify-between relative z-50 overflow-visible">
          {/* Left - Mobile Menu Button + Chat Title */}
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            {/* Mobile menu button */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="mobile-only p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-dark-700/30 rounded-lg transition-all duration-200"
              aria-label={showSidebar ? "Close menu" : "Open menu"}
            >
              {showSidebar ? (
                <X className="w-5 h-5 text-dark-400" />
              ) : (
                <Menu className="w-5 h-5 text-dark-400" />
              )}
            </button>

            {currentChat ? (
              <>
                <h2 className="text-sm font-medium text-dark-200 truncate max-w-[150px] md:max-w-none">
                  {currentChat.title}
                </h2>
              </>
            ) : (
              <p className="text-dark-500 text-sm">
                Select a chat or create a new one
              </p>
            )}
          </div>

          {/* Center - Model Selector */}
          {currentChat && (
            <div className="flex items-center justify-center flex-shrink-0 px-4">
              <ModelSelector
                selectedModel={chatSettings.model}
                onModelChange={handleModelChange}
                isDropdown={true}
                guestWhitelist={
                  (!user?.is_admin &&
                    !user?.permissions?.can_use_default_key &&
                    user?.guestModelWhitelist) ||
                  []
                }
                isGuestUsingDefaultKey={
                  user?.usingDefaultKey &&
                  !user?.is_admin &&
                  !user?.permissions?.can_use_default_key
                }
                selectedPersona={selectedPersona}
                onPersonaChange={handlePersonaSelect}
              />
            </div>
          )}
          {/* Right - Action Buttons */}
          {currentChat ? (
            <div className="flex items-center gap-1 md:gap-2 overflow-visible flex-1 justify-end">
              <div className="relative overflow-visible" ref={statsPopupRef}>
                <button
                  onClick={() => setShowInfoModal(!showInfoModal)}
                  className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all duration-200 ${
                    showInfoModal
                      ? "bg-dark-800 text-dark-300 border border-dark-700/50"
                      : "hover:bg-dark-800/40 text-dark-500 hover:text-dark-400"
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
                        <p className="text-dark-500 text-xs mb-1">
                          Current Model
                        </p>
                        <p className="text-sm font-medium text-dark-200 truncate">
                          {chatSettings.model}
                        </p>
                      </div>

                      {/* Conversation Stats */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-dark-800">
                          <p className="text-dark-500">Messages</p>
                          <p className="text-sm font-semibold text-dark-200">
                            {messages.length}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-dark-800">
                          <p className="text-dark-500">AI Responses</p>
                          <p className="text-sm font-semibold text-accent">
                            {
                              messages.filter((m) => m.role === "assistant")
                                .length
                            }
                          </p>
                        </div>
                      </div>

                      {/* Token Usage - from persisted data */}
                      {chatTotals.totalTokens > 0 && (
                        <div className="border-t border-dark-700 pt-3">
                          <p className="text-dark-500 text-xs mb-2">
                            Chat Token Usage
                          </p>
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
                            const contextLimit = getModelContext(
                              chatSettings.model,
                            );
                            const inputPercent =
                              (chatTotals.totalPromptTokens / contextLimit) *
                              100;
                            const outputPercent =
                              (chatTotals.totalCompletionTokens /
                                contextLimit) *
                              100;
                            const freePercent = Math.max(
                              0,
                              100 - inputPercent - outputPercent,
                            );
                            return (
                              <>
                                <div className="flex justify-between mt-3 mb-1 text-xs">
                                  <span className="text-dark-400">
                                    Tokens Used
                                  </span>
                                  <span className="font-medium text-dark-200">
                                    {chatTotals.totalTokens.toLocaleString()}
                                    <span className="text-dark-500">
                                      {" "}
                                      / {contextLimit.toLocaleString()}
                                    </span>
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
                                      Input (
                                      {chatTotals.totalPromptTokens.toLocaleString()}
                                      )
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-accent-500"></span>
                                      Output (
                                      {chatTotals.totalCompletionTokens.toLocaleString()}
                                      )
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
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all duration-200 ${
                  showSettings
                    ? "bg-dark-800 text-dark-300 border border-dark-700/50"
                    : "hover:bg-dark-800/40 text-dark-500 hover:text-dark-400"
                }`}
                title="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              <ExportMenu
                chatId={currentChat?.id}
                chatTitle={currentChat?.title}
                messages={messages}
              />
              {currentChat?.id && (
                <button
                  onClick={() => setShowShareDialog(true)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-dark-800/40 text-dark-500 hover:text-dark-400"
                  title="Share chat"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && currentChat && (
          <div className="bg-dark-900/50 border-b border-dark-700/30 p-5 scale-in">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Persona Selector */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Persona
                </label>
                <PersonaSelector
                  selectedPersona={selectedPersona}
                  onSelect={handlePersonaSelect}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Creativity (Temperature) */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Creativity
                  </label>
                  <div className="flex bg-dark-800 rounded-lg p-1 border border-dark-700/50">
                    {[
                      { label: "Precise", value: 0.2, id: "precise" },
                      { label: "Balanced", value: 0.7, id: "balanced" },
                      { label: "Creative", value: 1.0, id: "imaginative" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() =>
                          setChatSettings((s) => ({
                            ...s,
                            temperature: opt.value,
                          }))
                        }
                        className={`flex-1 px-1 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 truncate ${
                          // Approximate match for float comparison
                          Math.abs(chatSettings.temperature - opt.value) < 0.1
                            ? "bg-dark-600 text-white shadow-sm"
                            : "text-dark-400 hover:text-dark-200 hover:bg-dark-700/50"
                        }`}
                        title={opt.label}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Depth */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Depth
                  </label>
                  <div className="flex bg-dark-800 rounded-lg p-1 border border-dark-700/50">
                    {["concise", "standard", "detailed"].map((d) => (
                      <button
                        key={d}
                        onClick={() =>
                          setChatSettings((s) => ({ ...s, depth: d }))
                        }
                        className={`flex-1 px-1 py-1.5 rounded-md text-[11px] font-medium capitalize transition-all duration-200 truncate ${
                          chatSettings.depth === d
                            ? "bg-dark-600 text-white shadow-sm"
                            : "text-dark-400 hover:text-dark-200 hover:bg-dark-700/50"
                        }`}
                        title={d}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Tone
                  </label>
                  <div className="flex bg-dark-800 rounded-lg p-1 border border-dark-700/50">
                    {["professional", "friendly", "enthusiastic"].map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          setChatSettings((s) => ({ ...s, tone: t }))
                        }
                        className={`flex-1 px-1 py-1.5 rounded-md text-[11px] font-medium capitalize transition-all duration-200 truncate ${
                          chatSettings.tone === t
                            ? "bg-dark-600 text-white shadow-sm"
                            : "text-dark-400 hover:text-dark-200 hover:bg-dark-700/50"
                        }`}
                        title={t}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advanced System Prompt */}
              <div className="pt-2">
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs font-medium text-dark-400 cursor-pointer hover:text-dataset-300 transition-colors select-none mb-2">
                    <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                    Advanced Controls
                  </summary>
                  <div className="pl-5 pt-2 space-y-3 animate-in fade-in slide-in-from-top-1">
                    <div>
                      <label className="block text-xs font-medium text-dark-400 mb-1.5">
                        Custom System Prompt
                      </label>
                      <textarea
                        value={chatSettings.system_prompt}
                        onChange={(e) =>
                          setChatSettings({
                            ...chatSettings,
                            system_prompt: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl glass-input outline-none resize-none text-dark-100 placeholder-dark-500 text-sm font-mono"
                        rows="3"
                        placeholder="Add custom instructions related to this chat..."
                      />
                      <p className="text-[10px] text-dark-500 mt-1.5">
                        These instructions are combined with the selected
                        persona and setting modifiers.
                      </p>
                    </div>
                  </div>
                </details>
              </div>

              <div className="flex justify-end pt-2">
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
          className="flex-1 overflow-y-auto p-3 md:p-6 relative z-0"
        >
          {currentChat && (
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.length === 0 && !streaming && (
                <div className="py-10 fade-in">
                  <WorkspaceQuickSelect
                    workspaces={workspaces}
                    activeWorkspace={activeWorkspace}
                    onSelect={handleWorkspaceSelect}
                  />
                  <div className="text-center mt-12">
                    <p className="text-dark-500 text-sm max-w-xs mx-auto">
                      Select a workspace or start typing to begin
                    </p>
                  </div>
                </div>
              )}

              {messages.length > 0 &&
                (() => {
                  // Memoize tool results to avoid O(N^2) in render
                  const historicalToolResults = messages.reduce((acc, msg) => {
                    if (msg.role === "tool" && msg.tool_call_id) {
                      acc[msg.tool_call_id] = msg.content;
                    }
                    return acc;
                  }, {});

                  // Group messages into user messages and response groups
                  const displayGroups = groupMessagesForDisplay(messages);

                  return displayGroups.map((group, groupIndex) => {
                    // USER MESSAGE GROUP
                    if (group.type === "user") {
                      const message = group.messages[0];
                      return (
                        <div
                          key={message.id}
                          id={`message-${message.id}`}
                          className="flex gap-4 flex-row-reverse group"
                        >
                          <div className="flex-shrink-0 flex flex-col items-center pt-1">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-700">
                              <UserIcon className="w-5 h-5 text-dark-400" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col items-end">
                            <div className="flex items-center gap-2 mb-1 px-1">
                              <span className="text-xs font-medium text-dark-400">
                                You
                              </span>
                            </div>
                            <div className="inline-block max-w-[85%] bg-dark-700/80 border border-dark-600 text-dark-100 rounded-2xl rounded-tr-sm px-4 py-3">
                              {editingMessageId === message.id ? (
                                <div className="space-y-2 text-left">
                                  <textarea
                                    value={editContent}
                                    onChange={(e) =>
                                      setEditContent(e.target.value)
                                    }
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
                                  {message.attachments &&
                                    message.attachments.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        {message.attachments.map((att) => {
                                          const isImage =
                                            att.mimetype?.startsWith("image/");
                                          const getIcon = () => {
                                            if (
                                              att.mimetype === "application/pdf"
                                            )
                                              return "📄";
                                            if (att.mimetype === "text/csv")
                                              return "📊";
                                            if (
                                              att.mimetype ===
                                              "application/json"
                                            )
                                              return "{ }";
                                            if (
                                              att.mimetype?.includes(
                                                "markdown",
                                              ) ||
                                              att.original_name?.endsWith(".md")
                                            )
                                              return "📝";
                                            if (att.mimetype === "text/plain")
                                              return "📃";
                                            return "📎";
                                          };
                                          if (isImage) {
                                            return (
                                              <img
                                                key={att.id}
                                                src={
                                                  att.preview ||
                                                  `/api/uploads/${att.id}`
                                                }
                                                alt={att.original_name}
                                                className="max-w-[200px] max-h-[150px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() =>
                                                  window.open(
                                                    att.preview ||
                                                      `/api/uploads/${att.id}`,
                                                    "_blank",
                                                  )
                                                }
                                              />
                                            );
                                          }
                                          return (
                                            <div
                                              key={att.id}
                                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/50 border border-white/[0.08]"
                                            >
                                              <span className="text-lg">
                                                {getIcon()}
                                              </span>
                                              <span className="text-xs text-dark-300 max-w-[150px] truncate">
                                                {att.original_name}
                                              </span>
                                              {att.has_text && (
                                                <span className="text-[10px] text-green-400">
                                                  ✓
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                </>
                              )}
                            </div>
                            <div className="mt-1 flex gap-1 items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity px-1">
                              <button
                                onClick={() => {
                                  setEditContent(message.content);
                                  setEditingMessageId(message.id);
                                }}
                                className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                                title="Edit message"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRetry(message)}
                                className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                                title="Retry message"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  handleCopy(message.id, message.content, "raw")
                                }
                                className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                                title={
                                  copiedMessageId === `${message.id}-raw`
                                    ? "Copied!"
                                    : "Copy Raw"
                                }
                              >
                                {copiedMessageId === `${message.id}-raw` ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  handleCopy(
                                    message.id,
                                    message.content,
                                    "markdown",
                                  )
                                }
                                className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                                title={
                                  copiedMessageId === `${message.id}-markdown`
                                    ? "Copied!"
                                    : "Copy Markdown"
                                }
                              >
                                {copiedMessageId ===
                                `${message.id}-markdown` ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // RESPONSE GROUP (assistant + tool messages)
                    const assistantMsgs = group.messages.filter(
                      (m) => m.role === "assistant",
                    );
                    const toolMsgs = group.messages.filter(
                      (m) => m.role === "tool",
                    );
                    // Build tool results map for this group
                    const groupToolResults = {};
                    for (const tm of toolMsgs) {
                      if (tm.tool_call_id)
                        groupToolResults[tm.tool_call_id] = tm.content;
                    }
                    // Use last assistant message for actions (copy, fork, TTS)
                    const lastAssistantMsg =
                      assistantMsgs[assistantMsgs.length - 1];
                    // Find the last assistant message that has content for display
                    const lastContentMsg =
                      [...assistantMsgs]
                        .reverse()
                        .find((m) => m.content?.trim()) || lastAssistantMsg;
                    if (!lastAssistantMsg) return null; // shouldn't happen

                    return (
                      <div
                        key={`group-${groupIndex}`}
                        id={`message-${lastAssistantMsg.id}`}
                        className="flex gap-4 group"
                      >
                        {/* Single Avatar for the whole response group */}
                        <div className="flex-shrink-0 flex flex-col items-center pt-1">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-800">
                            <Bot className="w-5 h-5 text-accent" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col items-start">
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-xs font-medium text-dark-400">
                              {formatModelName(lastAssistantMsg.model)}
                            </span>
                          </div>

                          {/* Render each assistant message in the group */}
                          {assistantMsgs.map((message, msgIdx) => {
                            let parsedToolCalls = [];
                            try {
                              if (message.tool_calls) {
                                parsedToolCalls =
                                  typeof message.tool_calls === "string"
                                    ? JSON.parse(message.tool_calls)
                                    : message.tool_calls;
                              }
                            } catch (e) {
                              console.error("Failed to parse tool calls:", e);
                            }

                            const isLastInGroup =
                              msgIdx === assistantMsgs.length - 1;

                            return (
                              <React.Fragment key={message.id}>
                                {/* Steps / Reasoning / Tool Calls */}
                                {(() => {
                                  if (
                                    message.steps &&
                                    message.steps.length > 0
                                  ) {
                                    return (
                                      <div className="mb-2 w-full max-w-[85%]">
                                        <MessageSteps
                                          steps={message.steps}
                                          isStreaming={false}
                                        />
                                      </div>
                                    );
                                  }

                                  const {
                                    preToolReasoning: ptr,
                                    postToolReasoning: potr,
                                  } = parseReasoningContent(
                                    message.reasoning_content,
                                  );
                                  const hasTC = parsedToolCalls.length > 0;

                                  if (!hasTC && message.reasoning_content) {
                                    return (
                                      <div className="mb-2 w-full max-w-[85%]">
                                        <ThinkingSection
                                          reasoning={
                                            ptr || message.reasoning_content
                                          }
                                          isExpanded={expandedThinkingSections.has(
                                            `${message.id}`,
                                          )}
                                          onToggle={() =>
                                            toggleThinkingSection(
                                              `${message.id}`,
                                            )
                                          }
                                          isStreaming={false}
                                          elapsedTime={0}
                                        />
                                      </div>
                                    );
                                  }

                                  if (hasTC) {
                                    return (
                                      <>
                                        {ptr && (
                                          <div className="mb-2 w-full max-w-[85%]">
                                            <ThinkingSection
                                              reasoning={ptr}
                                              isExpanded={expandedThinkingSections.has(
                                                `${message.id}-pre`,
                                              )}
                                              onToggle={() =>
                                                toggleThinkingSection(
                                                  `${message.id}-pre`,
                                                )
                                              }
                                              isStreaming={false}
                                              elapsedTime={0}
                                            />
                                          </div>
                                        )}
                                        <div className="mb-2 max-w-[85%]">
                                          <ToolCallDisplay
                                            toolCalls={parsedToolCalls}
                                            toolResults={{
                                              ...historicalToolResults,
                                              ...groupToolResults,
                                            }}
                                          />
                                        </div>
                                        {potr && (
                                          <div className="mb-2 w-full max-w-[85%]">
                                            <ThinkingSection
                                              reasoning={potr}
                                              isExpanded={expandedThinkingSections.has(
                                                `${message.id}-post`,
                                              )}
                                              onToggle={() =>
                                                toggleThinkingSection(
                                                  `${message.id}-post`,
                                                )
                                              }
                                              isStreaming={false}
                                              elapsedTime={0}
                                            />
                                          </div>
                                        )}
                                      </>
                                    );
                                  }

                                  return null;
                                })()}

                                {/* Content bubble - only show if message has content */}
                                {message.content?.trim() && (
                                  <div className="inline-block max-w-[85%] bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-600/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg mb-2">
                                    {renderMessage(message.content)}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}

                          {/* Actions Row - applies to last assistant message with content */}
                          {lastContentMsg && (
                            <div className="mt-1 flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity px-1">
                              <button
                                onClick={() =>
                                  handleCopy(
                                    lastContentMsg.id,
                                    lastContentMsg.content,
                                    "raw",
                                  )
                                }
                                className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                                title={
                                  copiedMessageId === `${lastContentMsg.id}-raw`
                                    ? "Copied!"
                                    : "Copy Raw"
                                }
                              >
                                {copiedMessageId ===
                                `${lastContentMsg.id}-raw` ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  handleCopy(
                                    lastContentMsg.id,
                                    lastContentMsg.content,
                                    "markdown",
                                  )
                                }
                                className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                                title={
                                  copiedMessageId ===
                                  `${lastContentMsg.id}-markdown`
                                    ? "Copied!"
                                    : "Copy Markdown"
                                }
                              >
                                {copiedMessageId ===
                                `${lastContentMsg.id}-markdown` ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  openForkModal(lastAssistantMsg.id)
                                }
                                className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                                title="Fork from here"
                              >
                                <GitBranch className="w-3.5 h-3.5" />
                              </button>
                              <TextToSpeech
                                text={lastContentMsg.content}
                                messageId={lastContentMsg.id}
                              />
                              {lastContentMsg.content?.includes("```") && (
                                <button
                                  onClick={() =>
                                    openInCanvas(
                                      lastContentMsg.content,
                                      "Edit Code",
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-dark-800 transition-colors"
                                  title="Open in Canvas"
                                >
                                  <Code className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {(lastAssistantMsg.prompt_tokens ||
                                lastAssistantMsg.response_time_ms ||
                                lastAssistantMsg.cost > 0) && (
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
                                        {lastAssistantMsg.response_time_ms >
                                          0 && (
                                          <div className="flex justify-between gap-4">
                                            <span className="text-dark-400">
                                              Time:
                                            </span>
                                            <span className="text-dark-200 font-mono">
                                              {formatThinkingTime(
                                                lastAssistantMsg.response_time_ms /
                                                  1000,
                                              )}
                                            </span>
                                          </div>
                                        )}
                                        {lastAssistantMsg.completion_tokens >
                                          0 &&
                                          lastAssistantMsg.response_time_ms >
                                            0 && (
                                            <div className="flex justify-between gap-4">
                                              <span className="text-dark-400">
                                                Speed:
                                              </span>
                                              <span className="text-dark-200 font-mono">
                                                {(
                                                  lastAssistantMsg.completion_tokens /
                                                  (lastAssistantMsg.response_time_ms /
                                                    1000)
                                                ).toFixed(1)}{" "}
                                                t/s
                                              </span>
                                            </div>
                                          )}
                                        {(lastAssistantMsg.prompt_tokens ||
                                          lastAssistantMsg.completion_tokens) && (
                                          <div className="flex justify-between gap-4">
                                            <span className="text-dark-400">
                                              Tokens:
                                            </span>
                                            <span className="text-dark-200 font-mono">
                                              {(
                                                (lastAssistantMsg.prompt_tokens ||
                                                  0) +
                                                (lastAssistantMsg.completion_tokens ||
                                                  0)
                                              ).toLocaleString()}{" "}
                                              tks
                                            </span>
                                          </div>
                                        )}
                                        {lastAssistantMsg.cost > 0 && (
                                          <div className="flex justify-between gap-4">
                                            <span className="text-dark-400">
                                              Cost:
                                            </span>
                                            <span className="text-accent-400 font-mono">
                                              $
                                              {lastAssistantMsg.cost.toFixed(2)}
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
                    );
                  });
                })()}

              {(streaming ||
                streamingMessage ||
                streamingReasoning ||
                streamingSteps?.length > 0 ||
                completedTurns?.length > 0) && (
                <div className="flex gap-4 group">
                  {/* Single avatar for the entire streaming response group */}
                  <div className="flex-shrink-0 flex flex-col items-center pt-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-800">
                      <Bot className="w-5 h-5 text-accent" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs font-medium text-dark-400">
                        {formatModelName(chatSettings.model)}
                      </span>
                    </div>

                    {/* Render completed turns from multi-step tool chains */}
                    {completedTurns &&
                      completedTurns.map((turn, turnIdx) => (
                        <React.Fragment key={`turn-${turnIdx}`}>
                          {/* Steps for this completed turn */}
                          {turn.steps && turn.steps.length > 0 ? (
                            <div className="mb-2 w-full max-w-[85%]">
                              <MessageSteps
                                steps={turn.steps}
                                isStreaming={false}
                              />
                            </div>
                          ) : (
                            /* Fallback: show ToolCallDisplay only when no steps exist */
                            turn.toolCalls &&
                            turn.toolCalls.length > 0 && (
                              <div className="mb-2 max-w-[85%]">
                                <ToolCallDisplay
                                  toolCalls={turn.toolCalls}
                                  toolResults={turn.toolResults || {}}
                                />
                              </div>
                            )
                          )}
                          {/* Content for this completed turn */}
                          {turn.message && (
                            <div className="inline-block max-w-[85%] bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-600/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg mb-2">
                              {renderMessage(turn.message)}
                            </div>
                          )}
                        </React.Fragment>
                      ))}

                    {/* Current turn: steps/reasoning + streaming content */}
                    {streamingSteps && streamingSteps.length > 0 ? (
                      <div className="mb-2 w-full max-w-[85%]">
                        <MessageSteps
                          steps={streamingSteps}
                          isStreaming={streaming}
                        />
                      </div>
                    ) : (
                      <>
                        {(preToolReasoning ||
                          (streaming &&
                            !streamingMessage &&
                            !isPostToolPhase &&
                            !toolCalls?.length)) && (
                          <ThinkingSection
                            reasoning={preToolReasoning}
                            isExpanded={expandedThinkingSections.has(
                              "streaming-pre",
                            )}
                            onToggle={() =>
                              toggleThinkingSection("streaming-pre")
                            }
                            isStreaming={
                              streaming && !isPostToolPhase && !streamingMessage
                            }
                            elapsedTime={
                              !isPostToolPhase ? thinkingElapsedTime : 0
                            }
                          />
                        )}
                        {toolCalls && toolCalls.length > 0 && (
                          <ToolCallDisplay
                            toolCalls={toolCalls}
                            toolResults={toolResults}
                          />
                        )}
                        {(postToolReasoning ||
                          (streaming &&
                            isPostToolPhase &&
                            !streamingMessage)) && (
                          <ThinkingSection
                            reasoning={postToolReasoning}
                            isExpanded={expandedThinkingSections.has(
                              "streaming-post",
                            )}
                            onToggle={() =>
                              toggleThinkingSection("streaming-post")
                            }
                            isStreaming={
                              streaming && isPostToolPhase && !streamingMessage
                            }
                            elapsedTime={
                              isPostToolPhase ? thinkingElapsedTime : 0
                            }
                          />
                        )}
                      </>
                    )}

                    {streamingMessage && (
                      <div className="inline-block max-w-[85%] bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-600/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg fade-in">
                        {renderMessage(streamingMessage)}
                      </div>
                    )}

                    {streaming &&
                      !streamingMessage &&
                      !streamingReasoning &&
                      !(streamingSteps?.length > 0) &&
                      !(completedTurns?.length > 0) && (
                        <div className="inline-block bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-600/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg fade-in">
                          <div className="flex gap-1">
                            <div
                              className="w-1.5 h-1.5 bg-dark-600 rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            ></div>
                            <div
                              className="w-1.5 h-1.5 bg-dark-600 rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            ></div>
                            <div
                              className="w-1.5 h-1.5 bg-dark-600 rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            ></div>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {currentChat && (
          <div className="keyboard-aware-input safe-area-inset-bottom">
            <InputBar
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              onSendMessage={sendMessage}
              onStopGeneration={stopGeneration}
              streaming={streaming}
              pendingAttachments={pendingAttachments}
              setPendingAttachments={setPendingAttachments}
              thinkingMode={thinkingMode}
              setThinkingMode={setThinkingMode}
              isReasoningSupported={isReasoningSupported}
              chatId={currentChat?.id}
              onOpenImageGeneration={
                !user?.permissions || user.permissions.can_access_image_gen
                  ? () => setShowImageGeneration(true)
                  : undefined
              }
              enabledTools={enabledTools}
              setEnabledTools={setEnabledTools}
            />
          </div>
        )}

        {/* Image Generation Modal */}
        <ImageGeneration
          chatId={currentChat?.id}
          onImageGenerated={(result) => {
            console.log("Image generated:", result);
          }}
          isOpen={showImageGeneration}
          onClose={() => setShowImageGeneration(false)}
          hideButton={true}
        />
      </div>

      {/* Fork Modal */}
      {showForkModal && (
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
              Create a new chat branch from this point. You can choose a
              different model for the forked chat.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Model for forked chat
              </label>
              <ModelSelector
                selectedModel={forkModel}
                onModelChange={setForkModel}
                isDropdown={true}
                guestWhitelist={
                  (!user?.is_admin &&
                    !user?.permissions?.can_use_default_key &&
                    user?.guestModelWhitelist) ||
                  []
                }
                isGuestUsingDefaultKey={
                  user?.usingDefaultKey &&
                  !user?.is_admin &&
                  !user?.permissions?.can_use_default_key
                }
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
      )}

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

      {/* Context Menu */}
      {contextMenu.isOpen && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        >
          {contextMenu.type === "workspace" ? (
            <>
              <ContextMenuItem
                icon={SettingsIcon}
                onClick={() => {
                  setWsSettingsId(contextMenu.chatId);
                  closeContextMenu();
                }}
              >
                Edit Settings
              </ContextMenuItem>
              <ContextMenuItem
                icon={Pencil}
                onClick={() => {
                  setRenamingWorkspaceId(contextMenu.chatId);
                  closeContextMenu();
                }}
              >
                Rename Workspace
              </ContextMenuItem>
              <ContextMenuItem
                icon={Trash2}
                variant="danger"
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to delete this workspace and all its chats?",
                    )
                  ) {
                    deleteWorkspace(contextMenu.chatId);
                    closeContextMenu();
                  }
                }}
              >
                Delete Workspace
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem icon={Pencil} onClick={handleRenameClick}>
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                icon={Trash2}
                variant="danger"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this chat?")) {
                    deleteChat(contextMenu.chatId);
                  }
                }}
              >
                Delete Chat
              </ContextMenuItem>
            </>
          )}
        </ContextMenu>
      )}

      {/* Hover tooltip for collapsed sidebar chats */}
      {hoverTooltip.visible && (
        <div
          className="fixed z-[9999] px-2.5 py-1.5 text-xs text-dark-100 bg-dark-800 border border-dark-700/50 rounded-lg shadow-lg whitespace-nowrap pointer-events-none"
          style={{
            left: hoverTooltip.x,
            top: hoverTooltip.y,
            transform: "translateY(-50%)",
          }}
        >
          {hoverTooltip.text}
        </div>
      )}
    </div>
  );
}

export default Chat;
