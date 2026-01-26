import React, { useState, useEffect } from 'react';
import { Share2, X, Link2, Copy, Check, Trash2, ExternalLink, Eye, Clock, Loader2 } from 'lucide-react';

function ShareDialog({ chatId, chatTitle, isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [shareInfo, setShareInfo] = useState(null);
    const [copied, setCopied] = useState(false);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (isOpen && chatId) {
            loadShareInfo();
        }
    }, [isOpen, chatId]);

    const loadShareInfo = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/share/info/${chatId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            setShareInfo(data);
        } catch (error) {
            console.error('Failed to load share info:', error);
        } finally {
            setLoading(false);
        }
    };

    const createShareLink = async () => {
        try {
            setCreating(true);
            const res = await fetch(`/api/share/${chatId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({})
            });
            const data = await res.json();
            setShareInfo({
                shared: true,
                ...data
            });
        } catch (error) {
            console.error('Failed to create share link:', error);
            alert('Failed to create share link');
        } finally {
            setCreating(false);
        }
    };

    const revokeShareLink = async () => {
        if (!confirm('Are you sure you want to revoke this share link? Anyone with the link will no longer be able to view this chat.')) {
            return;
        }

        try {
            setDeleting(true);
            await fetch(`/api/share/${chatId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            setShareInfo({ shared: false });
        } catch (error) {
            console.error('Failed to revoke share link:', error);
            alert('Failed to revoke share link');
        } finally {
            setDeleting(false);
        }
    };

    const copyToClipboard = async () => {
        if (!shareInfo?.share_url) return;

        const fullUrl = `${window.location.origin}${shareInfo.share_url}`;
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const openInNewTab = () => {
        if (!shareInfo?.share_url) return;
        window.open(shareInfo.share_url, '_blank');
    };

    if (!isOpen) return null;

    const fullShareUrl = shareInfo?.share_url
        ? `${window.location.origin}${shareInfo.share_url}`
        : '';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-dark-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                            <Share2 className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-dark-100">Share Chat</h2>
                            <p className="text-sm text-dark-500 truncate max-w-[200px]">{chatTitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                        </div>
                    ) : shareInfo?.shared ? (
                        /* Existing share link */
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                                <div className="flex items-center gap-2 mb-3">
                                    <Link2 className="w-4 h-4 text-green-400" />
                                    <span className="text-sm font-medium text-dark-200">Share Link Active</span>
                                </div>

                                {/* URL Display */}
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-dark-900 border border-dark-600">
                                    <input
                                        type="text"
                                        value={fullShareUrl}
                                        readOnly
                                        className="flex-1 bg-transparent text-sm text-dark-300 outline-none truncate"
                                    />
                                    <button
                                        onClick={copyToClipboard}
                                        className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-dark-200 transition-colors"
                                        title="Copy link"
                                    >
                                        {copied ? (
                                            <Check className="w-4 h-4 text-green-400" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={openInNewTab}
                                        className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-dark-200 transition-colors"
                                        title="Open in new tab"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-4 mt-3 text-xs text-dark-500">
                                    <div className="flex items-center gap-1">
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>{shareInfo.view_count || 0} views</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Created {new Date(shareInfo.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={copyToClipboard}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors font-medium"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" />
                                            Copy Link
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={revokeShareLink}
                                    disabled={deleting}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                    title="Revoke share link"
                                >
                                    {deleting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* No share link yet */
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
                                <Link2 className="w-8 h-8 text-dark-500" />
                            </div>
                            <h3 className="text-lg font-medium text-dark-200 mb-2">Share this conversation</h3>
                            <p className="text-sm text-dark-500 mb-6">
                                Create a public link that anyone can use to view this chat (read-only).
                            </p>
                            <button
                                onClick={createShareLink}
                                disabled={creating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shine"
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Share2 className="w-4 h-4" />
                                        Create Share Link
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div className="px-5 pb-5">
                    <p className="text-xs text-dark-600 text-center">
                        Shared chats are read-only and don't include your personal information.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ShareDialog;
