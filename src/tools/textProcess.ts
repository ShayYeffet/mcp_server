/**
 * Text Processing Tool
 * Advanced text manipulation, analysis, and transformation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

export interface TextProcessArgs {
  operation: 'analyze' | 'transform' | 'extract' | 'compare' | 'generate';
  input?: string;
  text?: string;
  output?: string;
  transformType?: 'uppercase' | 'lowercase' | 'title' | 'camel' | 'snake' | 'kebab' | 'reverse' | 'sort_lines' | 'remove_duplicates' | 'trim_lines';
  extractType?: 'emails' | 'urls' | 'phone_numbers' | 'dates' | 'numbers' | 'words' | 'lines';
  compareWith?: string;
  generateType?: 'lorem' | 'uuid' | 'password' | 'hash';
  generateCount?: number;
  generateLength?: number;
  pattern?: string;
  replacement?: string;
  encoding?: 'utf8' | 'ascii' | 'base64' | 'hex';
}

export const textProcessTool: Tool = {
  name: 'text_process',
  description: 'Advanced text processing - analyze, transform, extract patterns, compare, generate text',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze', 'transform', 'extract', 'compare', 'generate'],
        description: 'Text processing operation to perform'
      },
      input: {
        type: 'string',
        description: 'Input file path (relative to workspace)'
      },
      text: {
        type: 'string',
        description: 'Input text (alternative to file)'
      },
      output: {
        type: 'string',
        description: 'Output file path (relative to workspace)'
      },
      transformType: {
        type: 'string',
        enum: ['uppercase', 'lowercase', 'title', 'camel', 'snake', 'kebab', 'reverse', 'sort_lines', 'remove_duplicates', 'trim_lines'],
        description: 'Type of text transformation'
      },
      extractType: {
        type: 'string',
        enum: ['emails', 'urls', 'phone_numbers', 'dates', 'numbers', 'words', 'lines'],
        description: 'Type of pattern to extract'
      },
      compareWith: {
        type: 'string',
        description: 'Text or file path to compare with'
      },
      generateType: {
        type: 'string',
        enum: ['lorem', 'uuid', 'password', 'hash'],
        description: 'Type of text to generate'
      },
      generateCount: {
        type: 'number',
        description: 'Number of items to generate',
        default: 1
      },
      generateLength: {
        type: 'number',
        description: 'Length of generated text/password',
        default: 12
      },
      pattern: {
        type: 'string',
        description: 'Regular expression pattern for find/replace'
      },
      replacement: {
        type: 'string',
        description: 'Replacement text for pattern matching'
      },
      encoding: {
        type: 'string',
        enum: ['utf8', 'ascii', 'base64', 'hex'],
        description: 'Text encoding for input/output',
        default: 'utf8'
      }
    },
    required: ['operation']
  }
};

export async function executeTextProcess(
  args: TextProcessArgs,
  config: ServerConfig
): Promise<{ message: string; result?: string; analysis?: any; matches?: string[]; comparison?: any }> {
  const { operation, input, text, output, encoding = 'utf8' } = args;

  // Get input text
  let inputText = '';
  if (input) {
    const inputPath = validatePath(input, config.workspaceRoot);
    if (!fs.existsSync(inputPath)) {
      throw new WorkspaceError(ErrorCode.NOT_FOUND, `Input file not found: ${input}`);
    }
    inputText = fs.readFileSync(inputPath, encoding as BufferEncoding);
  } else if (text) {
    inputText = text;
  } else if (operation !== 'generate') {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Either input file or text must be provided');
  }

  // Check read-only mode for write operations
  if (config.readOnly && output) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'File output operations not allowed in read-only mode'
    );
  }

  try {
    let result: any;

    switch (operation) {
      case 'analyze':
        result = await analyzeText(inputText);
        break;
      
      case 'transform':
        result = await transformText(inputText, args);
        break;
      
      case 'extract':
        result = await extractPatterns(inputText, args);
        break;
      
      case 'compare':
        result = await compareTexts(inputText, args, config);
        break;
      
      case 'generate':
        result = await generateText(args);
        break;
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown operation: ${operation}`);
    }

    // Save output if specified
    if (output && result.result) {
      const outputPath = validatePath(output, config.workspaceRoot);
      fs.writeFileSync(outputPath, result.result, encoding as BufferEncoding);
      result.message += ` Output saved to ${output}.`;
    }

    return result;
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Text processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function analyzeText(text: string): Promise<{ message: string; analysis: any }> {
  const lines = text.split('\n');
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, '').length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  // Word frequency
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleanWord) {
      wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
    }
  });

  const topWords = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  // Reading time estimate (average 200 words per minute)
  const readingTimeMinutes = Math.ceil(words.length / 200);

  const analysis = {
    characters,
    charactersNoSpaces,
    words: words.length,
    lines: lines.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    averageWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
    averageCharactersPerWord: words.length > 0 ? Math.round(charactersNoSpaces / words.length) : 0,
    readingTimeMinutes,
    topWords,
    uniqueWords: Object.keys(wordFreq).length
  };

  return {
    message: 'Text analysis completed successfully',
    analysis
  };
}

async function transformText(text: string, args: TextProcessArgs): Promise<{ message: string; result: string }> {
  const { transformType, pattern, replacement } = args;
  let result = text;

  if (pattern && replacement !== undefined) {
    // Custom pattern replacement
    const regex = new RegExp(pattern, 'g');
    result = text.replace(regex, replacement);
    return {
      message: 'Pattern replacement completed',
      result
    };
  }

  switch (transformType) {
    case 'uppercase':
      result = text.toUpperCase();
      break;
    
    case 'lowercase':
      result = text.toLowerCase();
      break;
    
    case 'title':
      result = text.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
      break;
    
    case 'camel':
      result = text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      ).replace(/\s+/g, '');
      break;
    
    case 'snake':
      result = text.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '');
      break;
    
    case 'kebab':
      result = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      break;
    
    case 'reverse':
      result = text.split('').reverse().join('');
      break;
    
    case 'sort_lines':
      result = text.split('\n').sort().join('\n');
      break;
    
    case 'remove_duplicates':
      const lines = text.split('\n');
      result = [...new Set(lines)].join('\n');
      break;
    
    case 'trim_lines':
      result = text.split('\n').map(line => line.trim()).join('\n');
      break;
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown transform type: ${transformType}`);
  }

  return {
    message: `Text transformation (${transformType}) completed successfully`,
    result
  };
}

async function extractPatterns(text: string, args: TextProcessArgs): Promise<{ message: string; matches: string[] }> {
  const { extractType } = args;
  let regex: RegExp;
  let matches: string[] = [];

  switch (extractType) {
    case 'emails':
      regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      break;
    
    case 'urls':
      regex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
      break;
    
    case 'phone_numbers':
      regex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
      break;
    
    case 'dates':
      regex = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g;
      break;
    
    case 'numbers':
      regex = /\b\d+\.?\d*\b/g;
      break;
    
    case 'words':
      regex = /\b\w+\b/g;
      break;
    
    case 'lines':
      matches = text.split('\n').filter(line => line.trim().length > 0);
      return {
        message: `Extracted ${matches.length} non-empty lines`,
        matches
      };
    
    default:
      throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown extract type: ${extractType}`);
  }

  const regexMatches = text.match(regex);
  matches = regexMatches ? [...new Set(regexMatches)] : [];

  return {
    message: `Extracted ${matches.length} unique ${extractType}`,
    matches
  };
}

async function compareTexts(text1: string, args: TextProcessArgs, config: ServerConfig): Promise<{ message: string; comparison: any }> {
  const { compareWith } = args;
  
  if (!compareWith) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'compareWith parameter is required for comparison');
  }

  let text2 = '';
  
  // Check if compareWith is a file path or direct text
  try {
    const comparePath = validatePath(compareWith, config.workspaceRoot);
    if (fs.existsSync(comparePath)) {
      text2 = fs.readFileSync(comparePath, 'utf8');
    } else {
      text2 = compareWith; // Treat as direct text
    }
  } catch {
    text2 = compareWith; // Treat as direct text
  }

  // Simple text comparison
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  
  const similarity = calculateSimilarity(text1, text2);
  const differences = findDifferences(lines1, lines2);

  const comparison = {
    similarity: Math.round(similarity * 100),
    text1Length: text1.length,
    text2Length: text2.length,
    text1Lines: lines1.length,
    text2Lines: lines2.length,
    identical: text1 === text2,
    differences: differences.slice(0, 20) // Limit to first 20 differences
  };

  return {
    message: `Text comparison completed. Similarity: ${comparison.similarity}%`,
    comparison
  };
}

async function generateText(args: TextProcessArgs): Promise<{ message: string; result: string }> {
  const { generateType, generateCount = 1, generateLength = 12 } = args;
  let results: string[] = [];

  for (let i = 0; i < generateCount; i++) {
    switch (generateType) {
      case 'lorem':
        results.push(generateLoremIpsum(generateLength));
        break;
      
      case 'uuid':
        results.push(generateUUID());
        break;
      
      case 'password':
        results.push(generatePassword(generateLength));
        break;
      
      case 'hash':
        results.push(generateRandomHash());
        break;
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown generate type: ${generateType}`);
    }
  }

  return {
    message: `Generated ${generateCount} ${generateType}(s) successfully`,
    result: results.join('\n')
  };
}

function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

function findDifferences(lines1: string[], lines2: string[]): Array<{line: number, type: string, content: string}> {
  const differences: Array<{line: number, type: string, content: string}> = [];
  const maxLines = Math.max(lines1.length, lines2.length);
  
  for (let i = 0; i < maxLines; i++) {
    const line1 = lines1[i];
    const line2 = lines2[i];
    
    if (line1 !== line2) {
      if (line1 === undefined) {
        differences.push({ line: i + 1, type: 'added', content: line2 });
      } else if (line2 === undefined) {
        differences.push({ line: i + 1, type: 'removed', content: line1 });
      } else {
        differences.push({ line: i + 1, type: 'modified', content: `"${line1}" → "${line2}"` });
      }
    }
  }
  
  return differences;
}

function generateLoremIpsum(wordCount: number): string {
  const words = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
    'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
    'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
    'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
    'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
    'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'
  ];
  
  const result: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    result.push(words[Math.floor(Math.random() * words.length)]);
  }
  
  return result.join(' ');
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generatePassword(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomHash(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}