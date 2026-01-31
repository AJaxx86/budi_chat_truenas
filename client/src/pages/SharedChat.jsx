import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquare, User as UserIcon, Bot, Brain, ChevronDown, Clock, Eye, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
    breaks: true,
    gfm: true
});

// Memoized ThinkingSection for shared view
function ThinkingSection({ reasoning, isExpanded, onToggle }) {
    if (!reasoning) return null;

    return (
        <div className="mb-4">
            <button
                type="button"
                onClick={onToggle}
                className="flex items-center gap-2 text-sm font-medium text-dark-400 hover:text-dark-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.03] select-none"
            >
                <Brain className="w-4 h-4 text-accent-400" />
                <span>Thinking</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div
                    className="mt-2 px-4 py-3 text-sm text-dark-300 rounded-xl border border-white/[0.06] italic bg-dark-900/40 text-left max-h-[300px] overflow-y-auto prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(marked.parse(reasoning))
                    }}
                />
            )}
        </div>
    );
}

function SharedChat() {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chatData, setChatData] = useState(null);
    const [expandedThinking, setExpandedThinking] = useState(new Set());

    useEffect(() => {
        loadSharedChat();
    }, [token]);

    const loadSharedChat = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`/api/share/${token}`);

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to load shared chat');
            }

            const data = await res.json();
            setChatData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleThinking = (messageId) => {
        setExpandedThinking(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    const renderMessage = (content) => {
        const html = DOMPurify.sanitize(marked(content || ''));
        return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-mesh flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-dark-400">Loading shared conversation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
                <div className="glass-card rounded-2xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <h1 className="text-xl font-bold text-dark-100 mb-2">Unable to Load Chat</h1>
                    <p className="text-dark-400 mb-6">{error}</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go to Homepage
                    </Link>
                </div>
            </div>
        );
    }

    const { chat, messages, share_info } = chatData;

    return (
        <div className="min-h-screen bg-mesh">
            {/* Header */}
            <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-semibold text-dark-100 truncate max-w-[300px] sm:max-w-none">
                                    {chat.title}
                                </h1>
                                <p className="text-xs text-dark-500">
                                    Shared by {chat.owner_name}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-dark-500">
                            <div className="hidden sm:flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                <span>{share_info.view_count} views</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{new Date(chat.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Chat Content */}
            <main className="max-w-4xl mx-auto px-4 py-6">
                {/* Chat Info */}
                <div className="glass-card rounded-2xl p-4 mb-6">
                    <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-primary-400" />
                            <span className="text-dark-400">Model:</span>
                            <span className="text-dark-200 font-medium">{chat.model}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-primary-400" />
                            <span className="text-dark-400">Messages:</span>
                            <span className="text-dark-200 font-medium">{messages.length}</span>
                        </div>
                        {chat.system_prompt && (
                            <div className="w-full pt-2 border-t border-white/[0.06]">
                                <p className="text-dark-500 text-xs mb-1">System Prompt:</p>
                                <p className="text-dark-300 text-sm italic">{chat.system_prompt}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="space-y-6">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {message.role !== 'user' && (
                                <div className="flex-shrink-0 w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg glow">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                            )}

                            <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                                {message.role === 'assistant' && message.reasoning_content && (
                                    <ThinkingSection
                                        reasoning={message.reasoning_content}
                                        isExpanded={expandedThinking.has(message.id)}
                                        onToggle={() => toggleThinking(message.id)}
                                    />
                                )}

                                <div className={`rounded-2xl px-5 py-4 ${message.role === 'user'
                                        ? 'bg-primary-500/10 border border-primary-500/20 text-dark-100'
                                        : 'glass-card text-dark-200'
                                    }`}>
                                    {renderMessage(message.content)}
                                </div>

                                <div className={`mt-2 text-xs text-dark-500 ${message.role === 'user' ? 'text-right' : ''}`}>
                                    {new Date(message.created_at).toLocaleString()}
                                </div>
                            </div>

                            {message.role === 'user' && (
                                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-dark-700 flex items-center justify-center">
                                    <UserIcon className="w-5 h-5 text-dark-300" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-12 pt-6 border-t border-white/[0.06] text-center">
                    <p className="text-dark-500 text-sm mb-4">
                        This is a read-only view of a shared conversation.
                    </p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-medium hover:opacity-90 transition-opacity shine"
                    >
                        <Sparkles className="w-4 h-4" />
                        Start Your Own Conversation
                    </Link>
                </div>
            </main>
        </div>
    );
}

export default SharedChat;
