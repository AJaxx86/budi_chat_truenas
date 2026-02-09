import React, { useState, useMemo } from 'react';
import { Plus, ChevronRight, ChevronDown } from 'lucide-react';
import WorkspaceModal from './WorkspaceModal';
import { getIconComponent } from './WorkspaceModal';

export default function WorkspaceSidebar({
    workspaces = [],
    chats = [],
    activeWorkspace,
    activeChatId,
    streamingChatIds = new Set(),
    onSelectWorkspace,
    onSelectChat,
    onMoveChats,
    onCreateNewChat,
    onCreateWorkspace,
    onUpdateWorkspace,
    onDeleteWorkspace,
    onWorkspaceContextMenu, // Helper for context menu on workspaces
    onChatContextMenu, // Helper for context menu on chats
    renamingId, // ID of workspace currently being renamed
    onRenameSubmit, // Function(id, newName)
    onRenameCancel, // Function()
    renamingChatId, // ID of chat currently being renamed
    onChatRenameSubmit, // Function(id, newName)
    onChatRenameCancel, // Function()
    editingSettingsId, // ID of workspace to edit settings for
    onEditSettingsComplete, // Function()
}) {
    const [expandedWorkspaces, setExpandedWorkspaces] = useState({});
    const [editValue, setEditValue] = useState('');
    const [editChatValue, setEditChatValue] = useState('');

    // Listen for external editing settings request
    React.useEffect(() => {
        if (editingSettingsId) {
            const ws = workspaces.find(w => w.id === editingSettingsId);
            if (ws) {
                setEditingWorkspace(ws);
                setShowModal(true);
            }
            onEditSettingsComplete?.();
        }
    }, [editingSettingsId, workspaces]);

    // Sync edit value when renamingId changes
    React.useEffect(() => {
        if (renamingId) {
            const ws = workspaces.find(w => w.id === renamingId);
            if (ws) setEditValue(ws.name);
        }
    }, [renamingId, workspaces]);

    // Sync edit chat value when renamingChatId changes
    React.useEffect(() => {
        if (renamingChatId) {
            const chat = chats.find(c => c.id === renamingChatId);
            if (chat) setEditChatValue(chat.title);
        }
    }, [renamingChatId, chats]);
    const [showModal, setShowModal] = useState(false);
    const [editingWorkspace, setEditingWorkspace] = useState(null);
    const [dragOverWorkspace, setDragOverWorkspace] = useState(null);

    // Group chats by workspace
    const chatsByWorkspace = useMemo(() => {
        const grouped = {};
        for (const chat of chats) {
            if (chat.workspace_id) {
                if (!grouped[chat.workspace_id]) grouped[chat.workspace_id] = [];
                grouped[chat.workspace_id].push(chat);
            }
        }
        return grouped;
    }, [chats]);

    const handleToggleExpand = (e, workspaceId) => {
        e.stopPropagation();
        setExpandedWorkspaces((prev) => ({
            ...prev,
            [workspaceId]: !prev[workspaceId],
        }));
    };

    const handleSelectWorkspace = (workspaceId) => {
        onSelectWorkspace(workspaceId);
        // Auto-expand when selecting
        setExpandedWorkspaces(prev => ({ ...prev, [workspaceId]: true }));
    };

    const handleSaveWorkspace = async (workspaceData) => {
        if (workspaceData.id) {
            await onUpdateWorkspace(workspaceData);
        } else {
            const newWorkspace = await onCreateWorkspace(workspaceData);
            if (newWorkspace?.id) {
                onSelectWorkspace(newWorkspace.id);
                setExpandedWorkspaces(prev => ({ ...prev, [newWorkspace.id]: true }));
            }
        }
        setEditingWorkspace(null);
        setShowModal(false);
    };

    const handleEditWorkspace = (e, workspace) => {
        e.stopPropagation();
        setEditingWorkspace(workspace);
        setShowModal(true);
    };

    const handleDeleteWorkspace = async (e, workspaceId) => {
        e.stopPropagation();
        if (confirm('Delete this workspace and its chats?')) {
            await onDeleteWorkspace(workspaceId);
        }
    };

    // Drag handlers
    const handleDragOver = (e, workspaceId) => {
        e.preventDefault();
        setDragOverWorkspace(workspaceId);
    };

    const handleDragLeave = () => {
        setDragOverWorkspace(null);
    };

    const handleDrop = async (e, workspaceId) => {
        e.preventDefault();
        const chatId = e.dataTransfer.getData('text/plain');
        if (chatId && onMoveChats) {
            await onMoveChats([chatId], workspaceId);
        }
        setDragOverWorkspace(null);
    };

    return (
        <>
            {/* Section Header */}
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <span className="text-[10px] font-semibold text-dark-500 uppercase tracking-widest">
                    Workspaces
                </span>
                <button
                    onClick={() => {
                        setEditingWorkspace(null);
                        setShowModal(true);
                    }}
                    className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-dark-500 hover:text-accent hover:bg-dark-700/30 transition-colors"
                    title="New Workspace"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Workspaces List */}
            <div className="px-2 pb-2 space-y-0.5">
                {workspaces.map((workspace) => {
                    const IconComponent = getIconComponent(workspace.icon);
                    const isExpanded = expandedWorkspaces[workspace.id];
                    const isActive = activeWorkspace === workspace.id;
                    const workspaceChats = chatsByWorkspace[workspace.id] || [];
                    const isDragOver = dragOverWorkspace === workspace.id;

                    // Check if any chat in this workspace is currently streaming
                    const isGenerating = workspaceChats.some(chat => streamingChatIds.has(chat.id));

                    return (
                        <div key={workspace.id}>
                            {/* Workspace Row */}
                            <div
                                onClick={(e) => handleToggleExpand(e, workspace.id)}
                                onContextMenu={(e) => onWorkspaceContextMenu && onWorkspaceContextMenu(e, workspace.id)}
                                onDragOver={(e) => handleDragOver(e, workspace.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, workspace.id)}
                                className={`group flex items-center gap-2 px-2 py-2.5 md:py-1.5 rounded-lg cursor-pointer transition-all duration-150 min-h-[44px] md:min-h-0 ${isActive
                                    ? 'bg-dark-800/60'
                                    : 'hover:bg-dark-700/30'
                                    } ${isDragOver ? 'ring-1 ring-accent/40 bg-accent/5' : ''}`}
                            >
                                {/* Expand/collapse button */}
                                <button
                                    onClick={(e) => handleToggleExpand(e, workspace.id)}
                                    className="p-0.5 rounded text-dark-500 hover:text-dark-300 transition-colors"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="w-3 h-3" />
                                    ) : (
                                        <ChevronRight className="w-3 h-3" />
                                    )}
                                </button>

                                {/* Icon with Color */}
                                <div className="relative">
                                    <div
                                        className={`flex items-center justify-center w-5 h-5 rounded-md transition-colors ${isActive ? 'bg-dark-700/50' : ''
                                            }`}
                                        style={{ color: workspace.color }}
                                    >
                                        <IconComponent className="w-4 h-4" />
                                    </div>
                                    {/* Generating Animation Pulse */}
                                    {isGenerating && (
                                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: workspace.color }}></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: workspace.color }}></span>
                                        </span>
                                    )}
                                </div>


                                {/* Name or Input */}
                                {renamingId === workspace.id ? (
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.stopPropagation();
                                                onRenameSubmit(workspace.id, editValue);
                                            } else if (e.key === 'Escape') {
                                                e.stopPropagation();
                                                onRenameCancel();
                                            }
                                        }}
                                        onBlur={() => onRenameSubmit(workspace.id, editValue)}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex-1 min-w-0 bg-dark-900 text-sm text-dark-100 px-1.5 py-0.5 rounded border border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent"
                                    />
                                ) : (
                                    <span className={`flex-1 text-sm truncate ${isActive ? 'text-dark-100 font-medium' : 'text-dark-300'
                                        }`}>
                                        {workspace.name}
                                    </span>
                                )}

                                {/* Chat count */}
                                <span className="text-[10px] text-dark-500">
                                    {workspaceChats.length}
                                </span>
                            </div>

                            {/* Expanded chats */}
                            {isExpanded && (
                                <div className="ml-4 pl-2 border-l border-dark-700/40 mt-0.5 space-y-0.5">
                                    {workspaceChats.length === 0 ? (
                                        <div className="px-2 py-1.5 text-xs text-dark-500 italic">
                                            No chats yet
                                        </div>
                                    ) : (
                                        workspaceChats.map((chat) => {
                                            const isChatGenerating = streamingChatIds.has(chat.id);
                                            return (
                                                <div
                                                    key={chat.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('text/plain', chat.id);
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectChat(chat.id);
                                                    }}
                                                    onContextMenu={(e) => onChatContextMenu && onChatContextMenu(e, chat.id)}
                                                    className={`px-2 py-2.5 md:py-1.5 rounded-md cursor-pointer text-xs truncate transition-colors flex items-center justify-between group/chat min-h-[40px] md:min-h-0 ${activeChatId === chat.id
                                                        ? 'bg-dark-700/50 text-dark-100'
                                                        : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/20'
                                                        }`}
                                                >
                                                    {renamingChatId === chat.id ? (
                                                        <input
                                                            type="text"
                                                            value={editChatValue}
                                                            onChange={(e) => setEditChatValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.stopPropagation();
                                                                    onChatRenameSubmit(chat.id, editChatValue);
                                                                } else if (e.key === 'Escape') {
                                                                    e.stopPropagation();
                                                                    onChatRenameCancel();
                                                                }
                                                            }}
                                                            onBlur={() => onChatRenameSubmit(chat.id, editChatValue)}
                                                            autoFocus
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex-1 min-w-0 bg-dark-900 text-[11px] text-dark-100 px-1 py-0.5 rounded border border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent"
                                                        />
                                                    ) : (
                                                        <span className="truncate">{chat.title}</span>
                                                    )}
                                                    {isChatGenerating && (
                                                        <span className="flex h-1.5 w-1.5 relative flex-shrink-0 ml-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Workspace Modal */}
            <WorkspaceModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingWorkspace(null);
                }}
                onSave={handleSaveWorkspace}
                workspace={editingWorkspace}
            />
        </>
    );
}
