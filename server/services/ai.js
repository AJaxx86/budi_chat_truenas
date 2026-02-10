import db from '../database.js';
import OpenAI from 'openai';

export async function getApiKey(userId) {
  const keyInfo = await getApiKeyInfo(userId);
  return keyInfo?.key || null;
}

export async function getApiKeyInfo(userId) {
  const user = db.prepare(`
    SELECT openai_api_key, use_default_key, user_group FROM users WHERE id = ?
  `).get(userId);

  if (!user) return null;

  if (user.openai_api_key) {
    return { key: user.openai_api_key, isDefault: false };
  }

  // Check if user is allowed to use default key
  let canUseDefaultKey = !!user.use_default_key;

  // If not explicitly allowed on user level, check group permissions
  if (!canUseDefaultKey) {
    const groupId = user.user_group || 'user';
    const group = db.prepare('SELECT permissions FROM user_groups WHERE id = ?').get(groupId);

    if (group && group.permissions) {
      try {
        const permissions = JSON.parse(group.permissions);
        if (permissions.can_use_default_key) {
          canUseDefaultKey = true;
        }
      } catch (e) {
        console.error('Error parsing group permissions:', e);
      }
    }
  }

  if (canUseDefaultKey) {
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

export async function executeToolCall(toolCall, userId = null, workspaceId = null) {
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
        return await executeWebSearch(parsedArgs.query, userId);

      case 'web_fetch':
        return await executeWebFetch(parsedArgs.url, userId);

      case 'calculator':
        return await executeCalculator(parsedArgs.expression);

      case 'code_interpreter':
        return await executeCodeInterpreter(parsedArgs.code);

      case 'workspace_search':
        return await executeWorkspaceSearch(parsedArgs.query, parsedArgs.limit, userId, workspaceId);

      case 'add_memory':
        return await executeAddMemory(parsedArgs.content, parsedArgs.category, parsedArgs.importance, userId);

      case 'read_memories':
        return await executeReadMemories(parsedArgs.category, parsedArgs.query, parsedArgs.limit, userId);

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error executing ${name}: ${error.message}`;
  }
}

// Simple rate limiter for web search
const searchRateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per user

function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = searchRateLimits.get(userId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  if (now > userLimit.resetAt) {
    userLimit.count = 0;
    userLimit.resetAt = now + RATE_LIMIT_WINDOW;
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  userLimit.count++;
  searchRateLimits.set(userId, userLimit);
  return true;
}

async function executeWebSearch(query, userId) {
  // Try to get API key from database settings first, fallback to env var
  const dbSetting = db.prepare(`
    SELECT value FROM settings WHERE key = 'brave_search_api_key'
  `).get();
  const apiKey = dbSetting?.value || process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    return 'Web search is not configured. Please set the Brave Search API key in Admin Settings.';
  }

  // Check rate limit
  if (userId && !checkRateLimit(userId)) {
    return 'Rate limit exceeded for web search. Please wait a moment before searching again.';
  }

  try {
    const maxResults = parseInt(process.env.WEB_SEARCH_MAX_RESULTS) || 5;
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Brave Search API error:', response.status, errorText);
      return `Web search failed: ${response.status} - Unable to retrieve search results.`;
    }

    const data = await response.json();

    if (!data.web?.results || data.web.results.length === 0) {
      return `No search results found for "${query}".`;
    }

    // Format results
    const results = data.web.results.map((result, index) => {
      const title = result.title || 'No title';
      const url = result.url || '';
      const description = result.description || 'No description available';
      return `${index + 1}. **${title}**\n   URL: ${url}\n   ${description}`;
    }).join('\n\n');

    return `Web search results for "${query}":\n\n${results}`;
  } catch (error) {
    console.error('Web search error:', error);
    return `Web search failed: ${error.message}`;
  }
}

async function executeWebFetch(url, userId) {
  // Clean URL - remove any leading characters (like colons) before http
  // This handles cases where models might output ":https://..." or "URL: https://..."
  let cleanUrl = url ? url.trim() : '';
  const urlMatch = cleanUrl.match(/(https?:\/\/[^\s]+)/);

  if (urlMatch) {
    cleanUrl = urlMatch[1];
  }

  // Validate URL
  if (!cleanUrl || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
    return 'Invalid URL. Please provide a valid HTTP/HTTPS URL.';
  }

  // Use cleaned URL
  url = cleanUrl;

  // Rate limit (share with web_search)
  if (userId && !checkRateLimit(userId)) {
    return 'Rate limit exceeded. Please wait a moment before fetching again.';
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BudiChat/1.0)' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return `Failed to fetch URL: HTTP ${response.status}`;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/json')) {
      return `Cannot read this content type: ${contentType}`;
    }

    const html = await response.text();

    // Convert HTML to readable text (strip tags, normalize whitespace)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();

    const maxLength = 10000;
    const truncated = text.length > maxLength
      ? text.substring(0, maxLength) + '\n... (truncated)'
      : text;

    return `Content from ${url}:\n\n${truncated}`;
  } catch (error) {
    if (error.name === 'AbortError') {
      return `Failed to fetch URL: Request timed out after 10 seconds`;
    }
    return `Failed to fetch URL: ${error.message}`;
  }
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

async function executeWorkspaceSearch(query, limit = 10, userId, workspaceId) {
  // Validate workspace context
  if (!workspaceId) {
    return 'No workspace context available. Workspace search is only available when chatting within a workspace.';
  }

  if (!userId) {
    return 'User context required for workspace search.';
  }

  // Clamp limit to reasonable bounds
  const maxLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 20);

  try {
    if (!query || query.trim().length === 0) {
      return 'Please provide a valid search query.';
    }

    // Robust FTS5 Query Construction
    // 1. Split by whitespace to get individual terms
    // 2. Remove any characters that aren't alphanumeric or safe punctuation
    // 3. Wrap terms in quotes to treat them as literals
    // 4. Join with OR for broad recall (ranked by relevance)

    const terms = query
      .replace(/[^\w\s\u00C0-\u00FF]/g, ' ') // Replace special chars with space to be safe
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => `"${term}"*`); // Quote and prefix match

    if (terms.length === 0) {
      // Fallback for when stripping leaves nothing (e.g. search was just "???")
      return `No valid search terms found in "${query}".`;
    }

    const searchQuery = terms.join(' OR ');

    // Search messages within workspace using FTS5
    // Note: We avoid using FTS5 highlight() function as it causes SQL logic errors 
    // with certain prefix queries. We fetch content and truncate manually.
    const results = db.prepare(`
      SELECT 
        m.content,
        m.role,
        m.created_at,
        c.title as chat_title,
        c.id as chat_id
      FROM messages_fts mf
      JOIN messages m ON m.rowid = mf.rowid
      JOIN chats c ON c.id = m.chat_id
      WHERE messages_fts MATCH ?
        AND c.workspace_id = ?
        AND c.user_id = ?
      ORDER BY rank
      LIMIT ?
    `).all(searchQuery, workspaceId, userId, maxLimit);

    if (results.length === 0) {
      return `No results found for "${query}" in this workspace.`;
    }

    // Format results in token-efficient format
    const formattedResults = results.map((result, index) => {
      // Parse date for friendlier display
      const date = new Date(result.created_at);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const role = result.role === 'user' ? 'User' : 'AI';

      // Clean up newlines for compact display
      const cleanContent = result.content.replace(/\n+/g, ' ');

      // Simple truncation (keeps start of message)
      const truncated = cleanContent.length > 200
        ? cleanContent.substring(0, 200) + '...'
        : cleanContent;

      return `[${index + 1}] "${result.chat_title}" (${dateStr}) - ${role}: ${truncated}`;
    }).join('\n\n');

    return `Found ${results.length} result(s) for "${query}":\n\n${formattedResults}`;
  } catch (error) {
    console.error('Workspace search error:', error);
    return `Workspace search failed: ${error.message}`;
  }
}

async function executeAddMemory(content, category = 'general', importance = 1, userId) {
  if (!userId) {
    return 'Error: User context required to store memories.';
  }

  if (!content || content.trim().length === 0) {
    return 'Error: Memory content cannot be empty.';
  }

  // Validate and clamp importance
  const validImportance = Math.min(Math.max(parseInt(importance) || 1, 1), 5);

  // Validate category
  const validCategory = category && category.trim() ? category.trim().toLowerCase() : 'general';

  try {
    const result = db.prepare(`
      INSERT INTO memories (user_id, content, category, importance, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(userId, content.trim(), validCategory, validImportance);

    if (result.changes > 0) {
      return `Memory stored successfully (ID: ${result.lastInsertRowid}, category: ${validCategory}, importance: ${validImportance}/5)`;
    } else {
      return 'Error: Failed to store memory.';
    }
  } catch (error) {
    console.error('Add memory error:', error);
    return `Error storing memory: ${error.message}`;
  }
}

async function executeReadMemories(category = null, query = null, limit = 10, userId) {
  if (!userId) {
    return 'Error: User context required to read memories.';
  }

  try {
    const maxLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

    let sql = `
      SELECT id, content, category, importance, created_at
      FROM memories
      WHERE user_id = ?
    `;
    const params = [userId];

    // Filter by category if provided
    if (category && category.trim()) {
      sql += ` AND category = ?`;
      params.push(category.trim().toLowerCase());
    }

    // Search by query if provided
    if (query && query.trim()) {
      sql += ` AND content LIKE ?`;
      params.push(`%${query.trim()}%`);
    }

    // Order by importance (highest first), then by creation date (newest first)
    sql += ` ORDER BY importance DESC, created_at DESC LIMIT ?`;
    params.push(maxLimit);

    const memories = db.prepare(sql).all(...params);

    if (memories.length === 0) {
      if (category && query) {
        return `No memories found for category '${category}' matching '${query}'.`;
      } else if (category) {
        return `No memories found for category '${category}'.`;
      } else if (query) {
        return `No memories found matching '${query}'.`;
      } else {
        return 'No memories found. The user has not stored any memories yet.';
      }
    }

    // Format results
    const formattedMemories = memories.map((mem, index) => {
      const date = new Date(mem.created_at);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const importanceStars = '★'.repeat(mem.importance) + '☆'.repeat(5 - mem.importance);

      return `[${index + 1}] ${importanceStars} [${mem.category}] (${dateStr})\n    ${mem.content}`;
    }).join('\n\n');

    const filterInfo = [];
    if (category) filterInfo.push(`category: '${category}'`);
    if (query) filterInfo.push(`query: '${query}'`);
    const filterStr = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : '';

    return `Found ${memories.length} memory/memories${filterStr}:\n\n${formattedMemories}`;
  } catch (error) {
    console.error('Read memories error:', error);
    return `Error reading memories: ${error.message}`;
  }
}
