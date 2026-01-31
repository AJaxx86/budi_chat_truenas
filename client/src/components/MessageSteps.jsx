import React, { memo, useState } from 'react';
import { Brain, Wrench, CheckCircle, ChevronDown, Loader2, Globe, Calculator, Code } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Format duration in a human-readable way
 */
const formatDuration = (ms) => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

/**
 * Get icon for tool type
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
      return <Wrench className={className} />;
  }
};

/**
 * Format tool name for display
 */
const formatToolName = (name) => {
  if (!name) return 'Tool';
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Get brief description from tool arguments
 */
const getToolDescription = (toolName, toolArguments) => {
  try {
    if (!toolArguments) return null;
    const args = typeof toolArguments === 'string' ? JSON.parse(toolArguments) : toolArguments;
    if (toolName === 'web_search' && args.query) {
      return `"${args.query}"`;
    }
    if (toolName === 'calculator' && args.expression) {
      return args.expression;
    }
    if (toolName === 'code_interpreter') {
      return 'Running code...';
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Individual step component for reasoning
 */
const ReasoningStep = memo(({ step, index, isExpanded, onToggle, isStreaming }) => {
  const thinkingLabel = index > 0 ? `Thinking ${index + 1}` : 'Thinking';

  return (
    <div className="step-item step-reasoning">
      <div className="step-timeline">
        <div className={`step-dot step-dot-reasoning ${!step.isComplete ? 'step-dot-active' : ''}`}>
          {!step.isComplete ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Brain className="w-3 h-3" />
          )}
        </div>
        <div className="step-line" />
      </div>

      <div className="step-content">
        <button
          type="button"
          onClick={onToggle}
          className="step-header step-header-reasoning"
        >
          <span className="step-label">
            {isStreaming && !step.isComplete ? (
              <>{thinkingLabel}...</>
            ) : (
              thinkingLabel
            )}
          </span>
          {step.duration_ms && (
            <span className="step-duration">{formatDuration(step.duration_ms)}</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && step.content && (
          <div
            className="step-body markdown-content"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(marked.parse(step.content))
            }}
          />
        )}
      </div>
    </div>
  );
});

ReasoningStep.displayName = 'ReasoningStep';

/**
 * Individual step component for tool call
 */
const ToolCallStep = memo(({ step, isExpanded, onToggle }) => {
  const description = getToolDescription(step.tool_name, step.tool_arguments);

  return (
    <div className="step-item step-tool-call">
      <div className="step-timeline">
        <div className={`step-dot step-dot-tool ${!step.isComplete ? 'step-dot-active' : ''}`}>
          {!step.isComplete ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <ToolIcon name={step.tool_name} className="w-3 h-3" />
          )}
        </div>
        <div className="step-line" />
      </div>

      <div className="step-content">
        <button
          type="button"
          onClick={onToggle}
          className="step-header step-header-tool"
        >
          <span className="step-label">
            {formatToolName(step.tool_name)}
          </span>
          {description && (
            <span className="step-description">{description}</span>
          )}
          {step.duration_ms && (
            <span className="step-duration">{formatDuration(step.duration_ms)}</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && step.tool_arguments && (
          <div className="step-body">
            <pre className="step-code">
              {typeof step.tool_arguments === 'string'
                ? JSON.stringify(JSON.parse(step.tool_arguments), null, 2)
                : JSON.stringify(step.tool_arguments, null, 2)
              }
            </pre>
          </div>
        )}
      </div>
    </div>
  );
});

ToolCallStep.displayName = 'ToolCallStep';

/**
 * Individual step component for tool result
 */
const ToolResultStep = memo(({ step, isExpanded, onToggle }) => {
  return (
    <div className="step-item step-tool-result">
      <div className="step-timeline">
        <div className="step-dot step-dot-result">
          <CheckCircle className="w-3 h-3" />
        </div>
        <div className="step-line" />
      </div>

      <div className="step-content">
        <button
          type="button"
          onClick={onToggle}
          className="step-header step-header-result"
        >
          <span className="step-label">
            Result: {formatToolName(step.tool_name)}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && step.content && (
          <div className="step-body">
            <pre className="step-code step-result-content">
              {step.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
});

ToolResultStep.displayName = 'ToolResultStep';

/**
 * Main component that renders all steps in a timeline
 */
const MessageSteps = memo(({ steps = [], isStreaming = false }) => {
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  const toggleStep = (stepId) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  if (!steps || steps.length === 0) return null;

  // Count reasoning steps for labeling (Thinking 1, Thinking 2, etc.)
  let reasoningCount = 0;

  return (
    <div className="message-steps-container">
      {steps.map((step) => {
        const isExpanded = expandedSteps.has(step.id);

        if (step.step_type === 'reasoning' || step.type === 'reasoning') {
          const currentReasoningIndex = reasoningCount++;
          return (
            <ReasoningStep
              key={step.id}
              step={step}
              index={currentReasoningIndex}
              isExpanded={isExpanded}
              onToggle={() => toggleStep(step.id)}
              isStreaming={isStreaming}
            />
          );
        }

        if (step.step_type === 'tool_call' || step.type === 'tool_call') {
          return (
            <ToolCallStep
              key={step.id}
              step={step}
              isExpanded={isExpanded}
              onToggle={() => toggleStep(step.id)}
            />
          );
        }

        if (step.step_type === 'tool_result' || step.type === 'tool_result') {
          return (
            <ToolResultStep
              key={step.id}
              step={step}
              isExpanded={isExpanded}
              onToggle={() => toggleStep(step.id)}
            />
          );
        }

        return null;
      })}
    </div>
  );
});

MessageSteps.displayName = 'MessageSteps';

export default MessageSteps;
