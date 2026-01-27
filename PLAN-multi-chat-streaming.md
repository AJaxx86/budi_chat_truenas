# Plan: Multi-Chat Background Streaming Support

## Problem
When switching chats while a response is being generated, the UI freezes/breaks. Users should be able to send a message in one chat, switch to another chat, and have both streams complete independently.

## Root Cause
The streaming architecture uses **shared global state** instead of per-chat isolation:
- Single `streaming` boolean for all chats
- Single `streamingMessage` / `streamingReasoning` accumulators
- Single `abortControllerRef`
- When switching chats, streaming state is cleared but the stream continues running, causing state conflicts

## Solution Overview
Introduce a **per-chat streaming state system** using a `Map<chatId, StreamState>` structure that isolates each chat's streaming state.

---

## File to Modify
`client/src/pages/Chat.jsx`

---

## Implementation Steps

### Step 1: Add Per-Chat State Structure

**Replace these global state variables (lines 207-209, 218, 229-232):**
```javascript
const [streaming, setStreaming] = useState(false);
const [streamingMessage, setStreamingMessage] = useState('');
const [streamingReasoning, setStreamingReasoning] = useState('');
const abortControllerRef = useRef(null);
const [thinkingStartTime, setThinkingStartTime] = useState(null);
const [thinkingComplete, setThinkingComplete] = useState(false);
const [lastThinkingStats, setLastThinkingStats] = useState(null);
```

**With per-chat Map:**
```javascript
// Per-chat streaming state: Map<chatId, { streaming, message, reasoning, ... }>
const [streamingStates, setStreamingStates] = useState(new Map());
// Per-chat abort controllers
const abortControllersRef = useRef(new Map());
```

### Step 2: Add Helper Functions

```javascript
// Factory for initial stream state
const createInitialStreamState = () => ({
  streaming: false,
  streamingMessage: '',
  streamingReasoning: '',
  thinkingStartTime: null,
  thinkingComplete: false,
  lastThinkingStats: null,
});

// Update streaming state for a specific chat
const updateStreamState = useCallback((chatId, updates) => {
  setStreamingStates(prev => {
    const newMap = new Map(prev);
    const current = prev.get(chatId) || createInitialStreamState();
    newMap.set(chatId, { ...current, ...updates });
    return newMap;
  });
}, []);

// Clear streaming state for a chat
const clearStreamState = useCallback((chatId) => {
  setStreamingStates(prev => {
    const newMap = new Map(prev);
    newMap.delete(chatId);
    return newMap;
  });
}, []);

// Get set of currently streaming chat IDs (for sidebar indicators)
const streamingChatIds = useMemo(() => {
  const ids = new Set();
  for (const [chatId, state] of streamingStates) {
    if (state.streaming) ids.add(chatId);
  }
  return ids;
}, [streamingStates]);
```

### Step 3: Add Derived State for Current Chat

```javascript
// Derived streaming state for the active chat
const currentStreamState = useMemo(() => {
  if (!currentChat?.id) return createInitialStreamState();
  return streamingStates.get(currentChat.id) || createInitialStreamState();
}, [streamingStates, currentChat?.id]);

// Destructure for easy access (maintains API compatibility)
const {
  streaming,
  streamingMessage,
  streamingReasoning,
  thinkingStartTime,
  thinkingComplete,
  lastThinkingStats
} = currentStreamState;
```

### Step 4: Update Chat Switch Effect (lines 296-314)

**Change from clearing streaming state to just loading messages:**
```javascript
useEffect(() => {
  if (isCreatingChatRef.current) return;

  // Don't clear streaming states - they're per-chat now
  setUsageStats(null);

  if (currentChat?.id) {
    loadMessages(currentChat.id);
  } else {
    setMessages([]);
  }
}, [currentChat?.id]);
```

### Step 5: Refactor sendMessage Function

Key changes to the stream processing loop:
1. Create AbortController per-chat in the Map
2. Use `updateStreamState(chatId, {...})` instead of global setters
3. On `done` event, reload messages for that specific chat
4. Clean up that chat's state in finally block

### Step 6: Update stopGeneration Function

```javascript
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
```

### Step 7: Update Thinking Timer Effect

```javascript
useEffect(() => {
  let interval;
  if (streaming && thinkingStartTime && !thinkingComplete) {
    interval = setInterval(() => {
      // Force update - use a local counter or forceUpdate pattern
    }, 100);
  }
  return () => clearInterval(interval);
}, [streaming, thinkingStartTime, thinkingComplete]);
```

### Step 8: Add Sidebar Streaming Indicators

In the chat list map (around line 1104), add indicator for streaming chats:
```jsx
{chats.map(chat => {
  const isStreaming = streamingChatIds.has(chat.id);
  return (
    <div key={chat.id} ...>
      {/* Existing chat item content */}
      {isStreaming && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/20 text-accent text-[10px] font-medium">
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          Generating
        </span>
      )}
    </div>
  );
})}
```

### Step 9: Add Cleanup on Unmount

```javascript
useEffect(() => {
  return () => {
    for (const controller of abortControllersRef.current.values()) {
      controller.abort();
    }
    abortControllersRef.current.clear();
  };
}, []);
```

### Step 10: Handle Delete Chat While Streaming

In the delete chat handler, abort any active stream first:
```javascript
const controller = abortControllersRef.current.get(chatId);
if (controller) {
  controller.abort();
  abortControllersRef.current.delete(chatId);
  clearStreamState(chatId);
}
```

---

## Verification

1. **Basic flow**: Send message in Chat A, switch to Chat B, verify Chat A doesn't freeze
2. **Parallel streams**: Send in Chat A, switch to Chat B, send in Chat B - both should complete
3. **Sidebar indicators**: Verify "Generating" badge shows on streaming chats
4. **Stop button**: Verify stop only stops current chat's stream
5. **Switch back**: Switch away from streaming chat, switch back - should show streaming state
6. **Completion**: When stream completes in background, messages should appear when returning to that chat
7. **Delete while streaming**: Delete a streaming chat - should abort cleanly

---

## Summary

This plan introduces per-chat streaming state isolation using a `Map<chatId, StreamState>` structure. Each chat maintains its own streaming state, abort controller, and thinking timer. The sidebar shows which chats are actively generating. Switching chats no longer clears streaming state - it just loads the new chat's messages while background streams continue independently.
