import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Plus, Settings as SettingsIcon, LogOut, Brain, 
  Send, Trash2, Edit2, GitBranch, Bot, User as UserIcon,
  Sparkles, ChevronDown, Zap, Menu, X
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: true,
  gfm: true
});

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
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);

  const [chatSettings, setChatSettings] = useState({
    model: 'gpt-4-turbo-preview',
    temperature: 0.7,
    system_prompt: '',
    agent_mode: false
  });

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (currentChat) {
      loadMessages(currentChat.id);
    }
  }, [currentChat]);

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
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: 'New Chat',
          ...chatSettings
        })
      });
      const data = await res.json();
      setChats([data, ...chats]);
      setCurrentChat(data);
      setMessages([]);
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

  const deleteChat = async (chatId) => {
    if (!confirm('Are you sure you want to delete this chat?')) return;

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
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const forkChat = async (messageId) => {
    if (!currentChat) return;

    try {
      const res = await fetch(`/api/chats/${currentChat.id}/fork`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ message_id: messageId })
      });
      const data = await res.json();
      setChats([data, ...chats]);
      setCurrentChat(data);
    } catch (error) {
      console.error('Failed to fork chat:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentChat || streaming) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setStreaming(true);
    setStreamingMessage('');

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
        body: JSON.stringify({ content: userMessage })
      });

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
              
              if (data.type === 'content') {
                setStreamingMessage(prev => prev + data.content);
              } else if (data.type === 'done') {
                setStreamingMessage('');
                loadMessages(currentChat.id);
                loadChats();
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
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please check your API key configuration.');
    } finally {
      setStreaming(false);
    }
  };

  const renderMessage = (message) => {
    const html = DOMPurify.sanitize(marked(message.content || ''));
    return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg gradient-text">AI Chat Hub</h1>
                <p className="text-xs text-gray-500">{user?.name}</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={createNewChat}
            className="w-full gradient-primary text-white py-2.5 rounded-lg font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2"
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
                  ? 'bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
              onClick={() => setCurrentChat(chat)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{chat.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {chat.message_count} messages
                    {chat.agent_mode === 1 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-accent-600">
                        <Zap className="w-3 h-3" />
                        Agent
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={() => navigate('/memories')}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
          >
            <Brain className="w-4 h-4 text-accent-500" />
            Memories
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
          >
            <SettingsIcon className="w-4 h-4 text-gray-600" />
            Settings
          </button>
          {user?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-accent-50 transition-all text-sm font-medium text-accent-600"
            >
              <Sparkles className="w-4 h-4" />
              Admin Panel
            </button>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-red-50 transition-all text-sm font-medium text-red-600"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            {currentChat ? (
              <>
                <h2 className="font-semibold text-lg">{currentChat.title}</h2>
                {chatSettings.agent_mode && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-accent-100 text-accent-700 rounded-full text-xs font-medium">
                    <Zap className="w-3 h-3" />
                    Agent Mode
                  </span>
                )}
              </>
            ) : (
              <p className="text-gray-500">Select a chat or create a new one</p>
            )}
          </div>

          {currentChat && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all text-sm font-medium"
            >
              <SettingsIcon className="w-4 h-4" />
              Chat Settings
            </button>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && currentChat && (
          <div className="bg-gradient-to-r from-primary-50 to-accent-50 border-b border-gray-200 p-6">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model
                  </label>
                  <select
                    value={chatSettings.model}
                    onChange={(e) => setChatSettings({ ...chatSettings, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={chatSettings.system_prompt}
                  onChange={(e) => setChatSettings({ ...chatSettings, system_prompt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
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
                    className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent-500" />
                    Enable Agent Mode (with tools)
                  </span>
                </label>

                <button
                  onClick={updateChatSettings}
                  className="px-4 py-2 gradient-primary text-white rounded-lg font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all"
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
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-primary-100 to-accent-100 mb-4">
                    <Bot className="w-8 h-8 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Start a conversation</h3>
                  <p className="text-gray-500">Type a message below to begin chatting with AI</p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-primary-500 to-accent-500'
                      : 'bg-gray-200'
                  }`}>
                    {message.role === 'user' ? (
                      <UserIcon className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-gray-600" />
                    )}
                  </div>

                  <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-2xl rounded-tr-sm px-4 py-3'
                        : 'bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm'
                    }`}>
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        renderMessage(message)
                      )}
                    </div>

                    {message.role === 'assistant' && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => forkChat(message.id)}
                          className="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
                        >
                          <GitBranch className="w-3 h-3" />
                          Fork from here
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {streaming && streamingMessage && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="inline-block max-w-[80%] bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      {renderMessage({ content: streamingMessage })}
                    </div>
                  </div>
                </div>
              )}

              {streaming && !streamingMessage && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-gray-600 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <div className="inline-block bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-primary mb-6 shadow-xl shadow-primary-500/30">
                  <MessageSquare className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold gradient-text mb-2">Welcome to AI Chat Hub</h2>
                <p className="text-gray-600 mb-6">Create a new chat to get started</p>
                <button
                  onClick={createNewChat}
                  className="px-6 py-3 gradient-primary text-white rounded-lg font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all inline-flex items-center gap-2"
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
          <div className="border-t border-gray-200 bg-white p-4">
            <form onSubmit={sendMessage} className="max-w-4xl mx-auto">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  disabled={streaming}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || streaming}
                  className="px-6 py-3 gradient-primary text-white rounded-xl font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
