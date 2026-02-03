import React, { useMemo, useRef, useEffect, useState } from 'react';
import { getIconComponent } from './WorkspaceModal';
import { MessageSquare, Zap } from 'lucide-react';

function WorkspaceModule({
    workspace = null,
    isActive = false,
    isGeneral = false,
    delay = 0,
    onSelect,
    index,
    totalCount,
    onKeyNavigation
}) {
    const [isAnimated, setIsAnimated] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const IconComponent = isGeneral ? MessageSquare : getIconComponent(workspace?.icon);
    const color = isGeneral ? '#78716c' : (workspace?.color || '#78716c');
    const name = isGeneral ? 'General' : workspace?.name;
    const description = isGeneral ? 'No specific context' : workspace?.description;

    useEffect(() => {
        const timer = setTimeout(() => setIsAnimated(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            onKeyNavigation(index + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            onKeyNavigation(index - 1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            onKeyNavigation(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            onKeyNavigation(totalCount - 1);
        }
    };

    return (
        <button
            onClick={() => onSelect(isGeneral ? null : workspace?.id)}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`ws-card ${isActive ? 'ws-card-active' : ''} ${isAnimated ? 'ws-card-visible' : ''}`}
            style={{
                '--ws-color': color,
                '--ws-color-dim': `${color}99`,
                '--ws-glow': `${color}15`,
                '--ws-glow-strong': `${color}30`,
                '--ws-border': `${color}40`,
                '--animation-delay': `${delay}ms`,
            }}
        >
            {/* Decorative corner accents */}
            <div className="ws-card-corner ws-card-corner-tl" />
            <div className="ws-card-corner ws-card-corner-br" />

            {/* Scan line effect on hover */}
            <div className={`ws-card-scanline ${isHovered ? 'ws-card-scanline-active' : ''}`} />

            {/* Main content */}
            <div className="ws-card-inner">
                {/* Icon with glow ring */}
                <div className={`ws-card-icon-wrap ${isActive ? 'ws-card-icon-wrap-active' : ''}`}>
                    <div className="ws-card-icon-glow" />
                    <div className="ws-card-icon">
                        <IconComponent className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                </div>

                {/* Text content */}
                <div className="ws-card-text">
                    <span className="ws-card-name">{name}</span>
                    {description && (
                        <span className="ws-card-desc">{description}</span>
                    )}
                </div>

                {/* Status indicator */}
                <div className={`ws-card-status ${isActive ? 'ws-card-status-active' : ''}`}>
                    {isActive ? (
                        <Zap className="w-3 h-3" fill="currentColor" />
                    ) : (
                        <div className="ws-card-status-dot" />
                    )}
                </div>
            </div>

            {/* Active border glow */}
            {isActive && <div className="ws-card-active-glow" />}
        </button>
    );
}

export default function WorkspaceQuickSelect({
    workspaces = [],
    activeWorkspace,
    onSelect
}) {
    const containerRef = useRef(null);

    // Sort workspaces alphabetically
    const sortedWorkspaces = useMemo(() => {
        return [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
    }, [workspaces]);

    // All items including General
    const allItems = useMemo(() => {
        return [{ id: null, isGeneral: true }, ...sortedWorkspaces.map(ws => ({ ...ws, isGeneral: false }))];
    }, [sortedWorkspaces]);

    const totalCount = allItems.length;

    // Handle keyboard navigation
    const handleKeyNavigation = (targetIndex) => {
        if (targetIndex < 0) targetIndex = totalCount - 1;
        if (targetIndex >= totalCount) targetIndex = 0;

        const buttons = containerRef.current?.querySelectorAll('[role="radio"]');
        if (buttons && buttons[targetIndex]) {
            buttons[targetIndex].focus();
        }
    };

    const isGeneralActive = !activeWorkspace;

    return (
        <div className="ws-console" ref={containerRef}>
            {/* Header */}
            <div className="ws-console-header">
                <div className="ws-console-header-line" />
                <div className="ws-console-header-content">
                    <span className="ws-console-label">SELECT WORKSPACE</span>
                </div>
                <div className="ws-console-header-line" />
            </div>

            {/* Workspace Grid - centered with flex */}
            <div
                className="ws-grid-container"
                role="radiogroup"
                aria-label="Select workspace"
            >
                <div className="ws-grid">
                    {/* General option */}
                    <WorkspaceModule
                        isGeneral={true}
                        isActive={isGeneralActive}
                        delay={0}
                        onSelect={onSelect}
                        index={0}
                        totalCount={totalCount}
                        onKeyNavigation={handleKeyNavigation}
                    />

                    {/* Workspace modules */}
                    {sortedWorkspaces.map((ws, i) => (
                        <WorkspaceModule
                            key={ws.id}
                            workspace={ws}
                            isActive={activeWorkspace === ws.id}
                            delay={(i + 1) * 80}
                            onSelect={onSelect}
                            index={i + 1}
                            totalCount={totalCount}
                            onKeyNavigation={handleKeyNavigation}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
