import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ContextMenu({ x, y, onClose, children }) {
    const menuRef = useRef(null);

    useEffect(() => {
        console.log('ContextMenu mounted at', { x, y });
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                console.log('Clicked outside context menu');
                onClose();
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                console.log('Escape pressed');
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        document.addEventListener('contextmenu', (e) => {
            // Close existing menu if opening a new one elsewhere (though usually handled by parent)
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                console.log('Right click outside context menu');
                onClose();
            }
        });

        return () => {
            console.log('ContextMenu unmounting');
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('contextmenu', onClose);
        };
    }, [onClose]);

    // Adjust position to keep menu on screen
    const style = {
        top: y,
        left: x,
    };

    // Simple bounds checking could go here, but fixed positioning usually sufficient for now with basic css
    console.log('ContextMenu rendering');
    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[160px] bg-dark-800 border border-dark-600 rounded-lg shadow-xl py-1 overflow-hidden"
            style={style}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
        >
            {children}
        </div>,
        document.body
    );
}

export function ContextMenuItem({ onClick, children, icon: Icon, className = '', variant = 'default' }) {
    const variantStyles = {
        default: 'text-dark-200 hover:bg-dark-700/50 hover:text-dark-100',
        danger: 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
    };

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick && onClick(e);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${variantStyles[variant]} ${className}`}
        >
            {Icon && <Icon className="w-4 h-4" />}
            {children}
        </button>
    );
}
