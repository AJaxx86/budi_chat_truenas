import fetch from 'node-fetch';
import db from '../database.js';

let modelsCache = null;
let lastFetchError = null;
let lastFetchedAt = null;

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

function getAuthHeader() {
  let apiKey = process.env.DEFAULT_OPENROUTER_API_KEY;
  try {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'default_openai_api_key'").get();
    if (setting?.value) apiKey = setting.value;
  } catch (error) {
    console.error('Failed to read default API key from settings:', error);
  }
  if (!apiKey) return null;
  return { Authorization: `Bearer ${apiKey}` };
}

export async function refreshModels({ force = false } = {}) {
  if (modelsCache && !force) return modelsCache;

  const headers = getAuthHeader();
  const requestOptions = headers ? { headers } : {};

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, requestOptions);
    if (!response.ok) {
      throw new Error(`OpenRouter API responded with ${response.status}`);
    }
    const data = await response.json();
    modelsCache = data?.data || [];
    lastFetchError = null;
    lastFetchedAt = Date.now();
    return modelsCache;
  } catch (error) {
    lastFetchError = error;
    if (!modelsCache) {
      throw error;
    }
    return modelsCache;
  }
}

export async function ensureModelsCache() {
  if (modelsCache) return modelsCache;
  return refreshModels({ force: true });
}

export function getModelsCacheInfo() {
  return { lastFetchedAt, lastFetchError };
}

export function getModelCapabilities(modelId) {
  if (!modelsCache || !modelId) return null;
  const model = modelsCache.find((m) => m.id === modelId);
  if (!model) return null;

  const supportedParameters = model.supported_parameters || [];
  const inputModalities = model.architecture?.input_modalities || [];

  const reasoning = supportedParameters.includes('reasoning') ||
    supportedParameters.includes('include_reasoning') ||
    supportedParameters.includes('reasoning_effort');

  const tools = supportedParameters.includes('tools');
  const vision = supportedParameters.includes('vision') ||
    supportedParameters.includes('image_input') ||
    inputModalities.includes('image');

  return { reasoning, tools, vision, inputModalities };
}

// Warm cache on server start
void refreshModels({ force: true }).catch((error) => {
  console.error('Failed to warm OpenRouter models cache:', error);
});
