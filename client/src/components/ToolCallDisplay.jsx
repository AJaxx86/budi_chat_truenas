import React, { memo } from 'react';
import { Globe, Calculator, Code, Check, Loader2 } from 'lucide-react';

/**
 * Formats tool name for display
 */
const formatToolName = (name) => {
    switch (name) {
        case 'web_search':
            return 'Web Search';
        case 'calculator':
            return 'Calculator';
        case 'code_interpreter':
            return 'Code Interpreter';
        default:
            return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
};

/**
 * Gets the appropriate icon for a tool
 */
const ToolIcon = ({ name, className = "w-3.5 h-3.5" }) => {
    switch (name) {
        case 'web_search':
            return <Globe className={className} />;
        case 'calculator':
            return <Calculator className={className} />;
        case 'code_interpreter':
            return <Code className={className} />;
        default:
            return <Code className={className} />;
    }
};

/**
 * Extracts a brief description from tool arguments
 */
const getToolDescription = (toolCall) => {
    try {
        const args = JSON.parse(toolCall.function.arguments);
        if (toolCall.function.name === 'web_search' && args.query) {
            return `"${args.query}"`;
        }
        if (toolCall.function.name === 'calculator' && args.expression) {
            return args.expression;
        }
        if (toolCall.function.name === 'code_interpreter') {
            return 'Running code...';
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Single tool call indicator - minimal display
 */
const ToolCallItem = memo(({ toolCall, isComplete, result }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const description = getToolDescription(toolCall);
    const hasResult = result !== undefined && result !== null;

    return (
        <div className="tool-call-item">
            <div
                className={`tool-call-header ${hasResult ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
                onClick={() => hasResult && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`tool-call-icon ${isComplete ? 'tool-call-icon-complete' : 'tool-call-icon-running'}`}>
                        <ToolIcon name={toolCall.function.name} />
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                        <span className="tool-call-name">
                            {formatToolName(toolCall.function.name)}
                        </span>
                        {description && (
                            <span className="tool-call-description">
                                {description}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isComplete ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                        <Loader2 className="w-3 h-3 text-accent animate-spin" />
                    )}
                    {hasResult && (
                        <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>

            {isExpanded && hasResult && (
                <div className="tool-call-result">
                    <div className="text-xs text-dark-400 font-mono whitespace-pre-wrap break-words bg-dark-900/50 rounded p-2 mt-1 border border-dark-700/50">
                        {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                    </div>
                </div>
            )}
        </div>
    );
});

ToolCallItem.displayName = 'ToolCallItem';

/**
 * Container for displaying active tool calls
 */
const ToolCallDisplay = memo(({ toolCalls = [], toolResults = {} }) => {
    if (!toolCalls || toolCalls.length === 0) return null;

    return (
        <div className="tool-call-container">
            {toolCalls.map((toolCall) => (
                <ToolCallItem
                    key={toolCall.id}
                    toolCall={toolCall}
                    isComplete={toolCall.id in toolResults}
                    result={toolResults[toolCall.id]}
                />
            ))}
        </div>
    );
});

ToolCallDisplay.displayName = 'ToolCallDisplay';

export default ToolCallDisplay;
