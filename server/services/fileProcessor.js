import { readFileSync } from 'fs';
import pdf from 'pdf-parse';
import Papa from 'papaparse';

// Maximum text size to store (50KB)
const MAX_TEXT_SIZE = 50 * 1024;

/**
 * Extract text content from various file types
 */
export async function extractText(filePath, mimetype) {
  try {
    switch (mimetype) {
      case 'application/pdf':
        return await extractPDF(filePath);

      case 'text/plain':
        return extractTXT(filePath);

      case 'text/csv':
        return extractCSV(filePath);

      case 'text/markdown':
      case 'text/x-markdown':
        return extractTXT(filePath);

      case 'application/json':
        return extractJSON(filePath);

      default:
        return null;
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw error;
  }
}

/**
 * Extract text from PDF files
 */
async function extractPDF(filePath) {
  const buffer = readFileSync(filePath);
  const data = await pdf(buffer);

  let text = data.text;

  // Clean up extracted text
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Truncate if too large
  if (text.length > MAX_TEXT_SIZE) {
    text = text.substring(0, MAX_TEXT_SIZE) + '\n\n[... content truncated ...]';
  }

  return {
    text,
    metadata: {
      pages: data.numpages,
      info: data.info
    }
  };
}

/**
 * Extract text from plain text files
 */
function extractTXT(filePath) {
  let text = readFileSync(filePath, 'utf-8');

  // Truncate if too large
  if (text.length > MAX_TEXT_SIZE) {
    text = text.substring(0, MAX_TEXT_SIZE) + '\n\n[... content truncated ...]';
  }

  return {
    text,
    metadata: {
      chars: text.length
    }
  };
}

/**
 * Extract and format CSV files
 */
function extractCSV(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true
  });

  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors);
  }

  const { data, meta } = result;

  // Format as readable text
  let text = `CSV File with ${data.length} rows and ${meta.fields?.length || 0} columns\n\n`;
  text += `Columns: ${meta.fields?.join(', ') || 'N/A'}\n\n`;

  // Add sample data (first 50 rows)
  const sampleRows = data.slice(0, 50);
  text += 'Data:\n';

  for (const row of sampleRows) {
    const rowText = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
    text += `- ${rowText}\n`;
  }

  if (data.length > 50) {
    text += `\n[... ${data.length - 50} more rows ...]`;
  }

  // Truncate if still too large
  if (text.length > MAX_TEXT_SIZE) {
    text = text.substring(0, MAX_TEXT_SIZE) + '\n\n[... content truncated ...]';
  }

  return {
    text,
    metadata: {
      rows: data.length,
      columns: meta.fields?.length || 0,
      fields: meta.fields
    }
  };
}

/**
 * Extract and format JSON files
 */
function extractJSON(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  try {
    const data = JSON.parse(content);
    let text = JSON.stringify(data, null, 2);

    // Truncate if too large
    if (text.length > MAX_TEXT_SIZE) {
      text = text.substring(0, MAX_TEXT_SIZE) + '\n\n[... content truncated ...]';
    }

    return {
      text,
      metadata: {
        type: Array.isArray(data) ? 'array' : typeof data,
        size: Array.isArray(data) ? data.length : Object.keys(data).length
      }
    };
  } catch (error) {
    // Return raw content if JSON parsing fails
    let text = content;
    if (text.length > MAX_TEXT_SIZE) {
      text = text.substring(0, MAX_TEXT_SIZE) + '\n\n[... content truncated ...]';
    }
    return {
      text,
      metadata: { error: 'Invalid JSON' }
    };
  }
}

/**
 * Check if a mimetype is extractable
 */
export function isExtractable(mimetype) {
  const extractableTypes = [
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/x-markdown',
    'application/json'
  ];
  return extractableTypes.includes(mimetype);
}

/**
 * Get file type category
 */
export function getFileCategory(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('text/')) return 'text';
  if (mimetype === 'application/json') return 'json';
  return 'other';
}
