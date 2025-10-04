import db from '../database.js';

export async function getApiKey(userId) {
  const user = db.prepare(`
    SELECT openai_api_key, use_default_key FROM users WHERE id = ?
  `).get(userId);

  if (user.openai_api_key) {
    return user.openai_api_key;
  }

  if (user.use_default_key) {
    const defaultKey = db.prepare(`
      SELECT value FROM settings WHERE key = 'default_openai_api_key'
    `).get();
    
    return defaultKey?.value || process.env.DEFAULT_OPENROUTER_API_KEY;
  }

  return null;
}

export async function executeToolCall(toolCall) {
  const { name, arguments: args } = toolCall.function;
  let parsedArgs;

  try {
    parsedArgs = JSON.parse(args);
  } catch (error) {
    return `Error parsing arguments: ${error.message}`;
  }

  try {
    switch (name) {
      case 'web_search':
        return await executeWebSearch(parsedArgs.query);
      
      case 'calculator':
        return await executeCalculator(parsedArgs.expression);
      
      case 'code_interpreter':
        return await executeCodeInterpreter(parsedArgs.code);
      
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error executing ${name}: ${error.message}`;
  }
}

async function executeWebSearch(query) {
  // This is a placeholder - you would integrate with a real search API
  // like Google Custom Search, Bing Search, or SerpAPI
  return `Web search results for "${query}":\n\n[This is a placeholder. To enable real web search, integrate with a search API like Google Custom Search or SerpAPI in server/services/ai.js]`;
}

async function executeCalculator(expression) {
  try {
    // Simple eval for basic math - in production, use a proper math parser
    // to avoid security issues
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    const result = Function(`'use strict'; return (${sanitized})`)();
    return `${expression} = ${result}`;
  } catch (error) {
    return `Error calculating: ${error.message}`;
  }
}

async function executeCodeInterpreter(code) {
  // This is a placeholder - implementing a safe code interpreter requires
  // running code in a sandboxed environment (Docker container, VM, etc.)
  return `Code execution result:\n\n[This is a placeholder. To enable code execution, implement a sandboxed execution environment in server/services/ai.js]\n\nCode:\n${code}`;
}
