/**
 * JSON Processing Tool
 * Parse, validate, transform, and manipulate JSON data
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

export interface JsonProcessArgs {
  operation: 'parse' | 'stringify' | 'validate' | 'transform' | 'merge' | 'extract' | 'minify' | 'prettify';
  input?: string;
  output?: string;
  data?: any;
  jsonPath?: string;
  transformRules?: Record<string, any>;
  mergeStrategy?: 'shallow' | 'deep';
  indent?: number;
  encoding?: string;
}

export const jsonProcessTool: Tool = {
  name: 'json_process',
  description: 'Process JSON data - parse, validate, transform, merge, extract, format',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse', 'stringify', 'validate', 'transform', 'merge', 'extract', 'minify', 'prettify'],
        description: 'JSON operation to perform'
      },
      input: {
        type: 'string',
        description: 'Input JSON file path (relative to workspace)'
      },
      output: {
        type: 'string',
        description: 'Output JSON file path (relative to workspace)'
      },
      data: {
        description: 'JSON data to process'
      },
      jsonPath: {
        type: 'string',
        description: 'JSONPath expression for extraction (e.g., "$.users[*].name")'
      },
      transformRules: {
        type: 'object',
        description: 'Transformation rules to apply',
        additionalProperties: true
      },
      mergeStrategy: {
        type: 'string',
        enum: ['shallow', 'deep'],
        description: 'Merge strategy for combining objects',
        default: 'deep'
      },
      indent: {
        type: 'number',
        description: 'Indentation spaces for prettify',
        default: 2
      },
      encoding: {
        type: 'string',
        description: 'File encoding',
        default: 'utf8'
      }
    },
    required: ['operation']
  }
};

export async function executeJsonProcess(
  args: JsonProcessArgs,
  config: ServerConfig
): Promise<{ message: string; data?: any; valid?: boolean; errors?: string[] }> {
  const { operation, input, output, data, encoding = 'utf8' } = args;

  // Check read-only mode for write operations
  if (config.readOnly && ['stringify', 'transform', 'merge', 'minify', 'prettify'].includes(operation) && output) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'JSON write operations not allowed in read-only mode'
    );
  }

  try {
    switch (operation) {
      case 'parse':
        return await parseJson(input, config, encoding);
      
      case 'stringify':
        return await stringifyJson(data, output, config, args.indent, encoding);
      
      case 'validate':
        return await validateJson(input || data, config, encoding);
      
      case 'transform':
        return await transformJson(input, output, args, config, encoding);
      
      case 'merge':
        return await mergeJson(input, data, output, args, config, encoding);
      
      case 'extract':
        return await extractFromJson(input || data, args.jsonPath!, config, encoding);
      
      case 'minify':
        return await minifyJson(input, output, config, encoding);
      
      case 'prettify':
        return await prettifyJson(input, output, config, args.indent, encoding);
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown operation: ${operation}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `JSON processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function parseJson(
  input: string | undefined,
  config: ServerConfig,
  encoding: string
): Promise<{ message: string; data: any }> {
  if (!input) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Input file path is required for parse operation');
  }

  const inputPath = validatePath(input, config.workspaceRoot);
  
  if (!fs.existsSync(inputPath)) {
    throw new WorkspaceError(ErrorCode.NOT_FOUND, `JSON file not found: ${input}`);
  }

  const content = fs.readFileSync(inputPath, encoding as BufferEncoding);
  
  try {
    const data = JSON.parse(content);
    return {
      message: `JSON file parsed successfully from ${input}`,
      data
    };
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.INVALID_INPUT,
      `Invalid JSON in file ${input}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function stringifyJson(
  data: any,
  output: string | undefined,
  config: ServerConfig,
  indent: number = 2,
  encoding: string
): Promise<{ message: string; data?: string }> {
  if (data === undefined) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Data is required for stringify operation');
  }

  try {
    const jsonString = JSON.stringify(data, null, indent);
    
    if (output) {
      const outputPath = validatePath(output, config.workspaceRoot);
      fs.writeFileSync(outputPath, jsonString, encoding as BufferEncoding);
      return {
        message: `JSON data stringified and saved to ${output}`
      };
    }

    return {
      message: 'JSON data stringified successfully',
      data: jsonString
    };
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `JSON stringify failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function validateJson(
  input: string | any,
  config: ServerConfig,
  encoding: string
): Promise<{ message: string; valid: boolean; errors?: string[] }> {
  let jsonContent: string;
  
  if (typeof input === 'string' && input.includes('.json')) {
    // It's a file path
    const inputPath = validatePath(input, config.workspaceRoot);
    
    if (!fs.existsSync(inputPath)) {
      throw new WorkspaceError(ErrorCode.NOT_FOUND, `JSON file not found: ${input}`);
    }
    
    jsonContent = fs.readFileSync(inputPath, encoding as BufferEncoding);
  } else if (typeof input === 'string') {
    // It's JSON string
    jsonContent = input;
  } else {
    // It's already an object
    try {
      JSON.stringify(input);
      return {
        message: 'JSON data is valid',
        valid: true
      };
    } catch (error) {
      return {
        message: 'JSON data is invalid',
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  try {
    JSON.parse(jsonContent);
    return {
      message: 'JSON is valid',
      valid: true
    };
  } catch (error) {
    return {
      message: 'JSON is invalid',
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

async function transformJson(
  input: string | undefined,
  output: string | undefined,
  args: JsonProcessArgs,
  config: ServerConfig,
  encoding: string
): Promise<{ message: string; data?: any }> {
  if (!input) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Input file is required for transform operation');
  }

  const { data } = await parseJson(input, config, encoding);
  const { transformRules } = args;
  
  if (!transformRules) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Transform rules are required');
  }

  const transformedData = applyTransformRules(data, transformRules);

  if (output) {
    await stringifyJson(transformedData, output, config, 2, encoding);
    return {
      message: `JSON transformed and saved to ${output}`
    };
  }

  return {
    message: 'JSON transformed successfully',
    data: transformedData
  };
}

async function mergeJson(
  input: string | undefined,
  data: any,
  output: string | undefined,
  args: JsonProcessArgs,
  config: ServerConfig,
  encoding: string
): Promise<{ message: string; data?: any }> {
  let baseData: any = {};
  
  if (input) {
    const result = await parseJson(input, config, encoding);
    baseData = result.data;
  }

  if (!data) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Data to merge is required');
  }

  const mergedData = args.mergeStrategy === 'shallow' 
    ? { ...baseData, ...data }
    : deepMerge(baseData, data);

  if (output) {
    await stringifyJson(mergedData, output, config, 2, encoding);
    return {
      message: `JSON merged and saved to ${output}`
    };
  }

  return {
    message: 'JSON merged successfully',
    data: mergedData
  };
}

async function extractFromJson(
  input: string | any,
  jsonPath: string,
  config: ServerConfig,
  encoding: string
): Promise<{ message: string; data: any }> {
  let data: any;
  
  if (typeof input === 'string' && input.includes('.json')) {
    const result = await parseJson(input, config, encoding);
    data = result.data;
  } else {
    data = input;
  }

  // Simple JSONPath implementation (basic support)
  const extracted = evaluateJsonPath(data, jsonPath);

  return {
    message: `Data extracted using JSONPath: ${jsonPath}`,
    data: extracted
  };
}

async function minifyJson(
  input: string | undefined,
  output: string | undefined,
  config: ServerConfig,
  encoding: string
): Promise<{ message: string; data?: string }> {
  if (!input) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Input file is required for minify operation');
  }

  const { data } = await parseJson(input, config, encoding);
  const minified = JSON.stringify(data);

  if (output) {
    const outputPath = validatePath(output, config.workspaceRoot);
    fs.writeFileSync(outputPath, minified, encoding as BufferEncoding);
    return {
      message: `JSON minified and saved to ${output}`
    };
  }

  return {
    message: 'JSON minified successfully',
    data: minified
  };
}

async function prettifyJson(
  input: string | undefined,
  output: string | undefined,
  config: ServerConfig,
  indent: number = 2,
  encoding: string
): Promise<{ message: string; data?: string }> {
  if (!input) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Input file is required for prettify operation');
  }

  const { data } = await parseJson(input, config, encoding);
  const prettified = JSON.stringify(data, null, indent);

  if (output) {
    const outputPath = validatePath(output, config.workspaceRoot);
    fs.writeFileSync(outputPath, prettified, encoding as BufferEncoding);
    return {
      message: `JSON prettified and saved to ${output}`
    };
  }

  return {
    message: 'JSON prettified successfully',
    data: prettified
  };
}

function applyTransformRules(data: any, rules: Record<string, any>): any {
  if (Array.isArray(data)) {
    return data.map(item => applyTransformRules(item, rules));
  }
  
  if (typeof data === 'object' && data !== null) {
    const result: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      const rule = rules[key];
      
      if (rule) {
        if (typeof rule === 'string') {
          switch (rule) {
            case 'uppercase':
              result[key] = typeof value === 'string' ? value.toUpperCase() : value;
              break;
            case 'lowercase':
              result[key] = typeof value === 'string' ? value.toLowerCase() : value;
              break;
            case 'number':
              result[key] = Number(value) || 0;
              break;
            case 'string':
              result[key] = String(value);
              break;
            case 'remove':
              // Don't include this key
              break;
            default:
              result[key] = value;
          }
        } else if (typeof rule === 'object' && rule.rename) {
          result[rule.rename] = value;
        } else {
          result[key] = value;
        }
      } else {
        result[key] = typeof value === 'object' ? applyTransformRules(value, rules) : value;
      }
    }
    
    return result;
  }
  
  return data;
}

function deepMerge(target: any, source: any): any {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source];
  }
  
  if (typeof target === 'object' && target !== null && typeof source === 'object' && source !== null) {
    const result = { ...target };
    
    for (const [key, value] of Object.entries(source)) {
      if (key in result) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  return source;
}

function evaluateJsonPath(data: any, path: string): any {
  // Simple JSONPath implementation - supports basic paths like $.key, $.array[*], $.key.subkey
  if (path === '$') return data;
  
  const parts = path.replace(/^\$\.?/, '').split(/[\.\[\]]+/).filter(p => p);
  let current = data;
  
  for (const part of parts) {
    if (part === '*') {
      if (Array.isArray(current)) {
        return current;
      } else if (typeof current === 'object') {
        return Object.values(current);
      }
      return [];
    } else if (!isNaN(Number(part))) {
      current = current[Number(part)];
    } else {
      current = current[part];
    }
    
    if (current === undefined) break;
  }
  
  return current;
}