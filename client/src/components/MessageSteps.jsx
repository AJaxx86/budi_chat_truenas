import React, { memo, useState, useMemo } from 'react';
import { Brain, Wrench, ChevronDown, Loader2, Globe, Calculator, Code, AlertCircle } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Format duration in a human-readable way
 */
const formatDuration = (ms) => {
  if (ms === undefined || ms === null || ms <= 0) return null;
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
const ToolIcon = ({ name, className = "w-2.5 h-2.5" }) => {
  switch (name) {
    case 'web_search':
      return <Globe className={className} />;
    case 'web_fetch':
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
    if (toolName === 'web_fetch' && args.url) {
      // Truncate long URLs
      const url = args.url.length > 50 ? args.url.substring(0, 50) + '...' : args.url;
      return url;
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
 * Check if result indicates an error
 */
const isErrorResult = (result) => {
  if (!result) return false;
  const lowerResult = result.toLowerCase();
  return lowerResult.includes('error') ||
         lowerResult.includes('failed') ||
         lowerResult.includes('exception') ||
         lowerResult.startsWith('{"error');
};

/**
 * Format tool result for display - truncate if too long, indicate errors
 */
const formatToolResult = (result) => {
  if (!result) return null;

  // Check for error
  if (isErrorResult(result)) {
    return { type: 'error', content: result };
  }

  // Truncate if too long
  const maxLength = 2000;
  if (result.length > maxLength) {
    return {
      type: 'success',
      content: result.substring(0, maxLength) + '\n... (truncated)'
    };
  }

  return { type: 'success', content: result };
};

/**
 * Individual step component for reasoning
 */
const ReasoningStep = memo(({ step, index, isExpanded, onToggle, isStreaming }) => {
  const thinkingLabel = 'Thinking';
  const duration = formatDuration(step.duration_ms);

  return (
    <div className="step-item step-reasoning">
      <div className="step-timeline">
        <div className={`step-dot step-dot-reasoning ${!step.isComplete ? 'step-dot-active' : ''}`}>
          {!step.isComplete ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          ) : (
            <Brain className="w-2.5 h-2.5" />
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
          {duration && (
            <span className="step-duration">{duration}</span>
          )}
          <ChevronDown className={`step-chevron ${isExpanded ? 'step-chevron-expanded' : ''}`} />
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
 * Unified tool step component that shows both call and result
 */
const ToolStep = memo(({ callStep, resultStep, isExpanded, onToggle }) => {
  // Support both camelCase (from streaming) and snake_case (from DB)
  const toolName = callStep.toolName || callStep.tool_name;
  const toolArgs = callStep.toolArguments || callStep.tool_arguments;
  const description = getToolDescription(toolName, toolArgs);

  // Step is complete when both call and result are complete (or just call if no result expected)
  const isComplete = resultStep ? resultStep.isComplete : callStep.isComplete;

  // Use result step's duration if available, otherwise use call step's
  const duration = formatDuration(resultStep?.duration_ms || callStep.duration_ms);

  // Get the result content
  const resultContent = resultStep?.content;
  const formattedResult = formatToolResult(resultContent);
  const hasError = formattedResult?.type === 'error';

  return (
    <div className={`step-item step-tool ${hasError ? 'step-tool-error' : ''}`}>
      <div className="step-timeline">
        <div className={`step-dot step-dot-tool ${!isComplete ? 'step-dot-active' : ''} ${hasError ? 'step-dot-error' : ''}`}>
          {!isComplete ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          ) : hasError ? (
            <AlertCircle className="w-2.5 h-2.5" />
          ) : (
            <ToolIcon name={toolName} className="w-2.5 h-2.5" />
          )}
        </div>
        <div className="step-line" />
      </div>

      <div className="step-content">
        <button
          type="button"
          onClick={onToggle}
          className={`step-header step-header-tool ${hasError ? 'step-header-error' : ''}`}
        >
          <span className="step-label">
            {formatToolName(toolName)}
          </span>
          {description && (
            <span className="step-description">{description}</span>
          )}
          {duration && (
            <span className="step-duration">{duration}</span>
          )}
          <ChevronDown className={`step-chevron ${isExpanded ? 'step-chevron-expanded' : ''}`} />
        </button>

        {isExpanded && (
          <div className="step-body">
            {formattedResult ? (
              <pre className={`step-code step-result-content ${hasError ? 'step-result-error' : ''}`}>
                {formattedResult.content}
              </pre>
            ) : !isComplete ? (
              <p className="text-dark-500 text-xs italic">Waiting for result...</p>
            ) : (
              <p className="text-dark-500 text-xs italic">No result available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

ToolStep.displayName = 'ToolStep';

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

  // Process steps to merge tool_call and tool_result pairs
  const processedSteps = useMemo(() => {
    if (!steps || steps.length === 0) return [];

    // First pass: collect all tool_results by their tool_call_id
    const toolResults = {};
    for (const step of steps) {
      const stepType = step.type || step.step_type;
      if (stepType === 'tool_result') {
        const callId = step.toolCallId || step.tool_call_id;
        if (callId) {
          toolResults[callId] = step;
        }
      }
    }

    // Second pass: build output, merging tool_call with its result
    const output = [];
    let reasoningCount = 0;

    for (const step of steps) {
      const stepType = step.type || step.step_type;

      // Skip tool_result steps - they're merged with tool_call
      if (stepType === 'tool_result') continue;

      if (stepType === 'reasoning') {
        output.push({
          ...step,
          processedType: 'reasoning',
          reasoningIndex: reasoningCount++
        });
      } else if (stepType === 'tool_call') {
        const callId = step.toolCallId || step.tool_call_id;
        output.push({
          ...step,
          processedType: 'tool',
          resultStep: callId ? toolResults[callId] : null
        });
      }
    }

    return output;
  }, [steps]);

  if (processedSteps.length === 0) return null;

  return (
    <div className="message-steps-container">
      {processedSteps.map((step) => {
        const isExpanded = expandedSteps.has(step.id);

        if (step.processedType === 'reasoning') {
          return (
            <ReasoningStep
              key={step.id}
              step={step}
              index={step.reasoningIndex}
              isExpanded={isExpanded}
              onToggle={() => toggleStep(step.id)}
              isStreaming={isStreaming}
            />
          );
        }

        if (step.processedType === 'tool') {
          return (
            <ToolStep
              key={step.id}
              callStep={step}
              resultStep={step.resultStep}
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
