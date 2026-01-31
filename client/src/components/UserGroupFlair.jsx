import React from 'react';

/**
 * UserGroupFlair - Displays a styled badge for a user's group
 * @param {Object} props
 * @param {Object} props.groupInfo - Group info object with id, name, color
 * @param {string} props.size - Size variant: 'sm' or 'md' (default: 'sm')
 */
function UserGroupFlair({ groupInfo, size = 'sm' }) {
    const defaultGroup = { id: 'user', name: 'User', color: '#3b82f6' };
    const group = groupInfo || defaultGroup;

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-1 text-xs'
    };

    return (
        <span
            className={`inline-flex items-center rounded-md font-semibold uppercase tracking-wider ${sizeClasses[size]}`}
            style={{
                backgroundColor: `${group.color}20`,
                color: group.color,
                border: `1px solid ${group.color}40`
            }}
        >
            {group.name}
        </span>
    );
}

export default UserGroupFlair;
