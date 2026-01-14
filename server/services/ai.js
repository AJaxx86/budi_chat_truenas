import db from '../database.js';
import OpenAI from 'openai';

export async function getApiKey(userId) {
  const keyInfo = await getApiKeyInfo(userId);
  return keyInfo?.key || null;
}

export async function getApiKeyInfo(userId) {
  const user = db.prepare(`
    SELECT openai_api_key, use_default_key FROM users WHERE id = ?
  `).get(userId);

  if (user.openai_api_key) {
    return { key: user.openai_api_key, isDefault: false };
  }

  if (user.use_default_key) {
    const defaultKey = db.prepare(`
      SELECT value FROM settings WHERE key = 'default_openai_api_key'
    `).get();

    const key = defaultKey?.value || process.env.DEFAULT_OPENROUTER_API_KEY;
    if (key) {
      return { key, isDefault: true };
    }
  }

  return null;
}

export async function generateChatTitle(userMessage, userId) {
  try {
    // Get the title generation model from settings
    const setting = db.prepare(`
      SELECT value FROM settings WHERE key = 'title_generation_model'
    `).get();

    const titleModel = setting?.value || 'google/gemini-2.5-flash-lite';

    // Get API key for the user
    const apiKey = await getApiKey(userId);
    if (!apiKey) {
      return null;
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1'
    });

    const response = await openai.chat.completions.create({
      model: titleModel,
      messages: [
        {
          role: 'system',
          content: 'Generate a short, concise title (max 50 characters) for a chat based on the user\'s message. Return only the title, nothing else.'
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 50
    });

    const title = response.choices[0]?.message?.content?.trim() || null;
    return title;
  } catch (error) {
    console.error('Title generation error:', error);
    return null;
  }
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
