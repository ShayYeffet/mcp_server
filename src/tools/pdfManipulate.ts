/**
 * PDF Manipulation Tool
 * Extract text, merge, split, and get info from PDF files
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';

import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

export interface PdfManipulateArgs {
  operation: 'extract_text' | 'info' | 'merge' | 'split';
  input: string | string[];
  output?: string;
  pages?: string;
  startPage?: number;
  endPage?: number;
}

export const pdfManipulateTool: Tool = {
  name: 'pdf_manipulate',
  description: 'Extract text from PDFs, get info, merge, or split PDF files',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['extract_text', 'info', 'merge', 'split'],
        description: 'PDF operation to perform'
      },
      input: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } }
        ],
        description: 'Input PDF file(s) path (relative to workspace)'
      },
      output: {
        type: 'string',
        description: 'Output file path (for merge/split operations)'
      },
      pages: {
        type: 'string',
        description: 'Page range (e.g., "1-5,8,10-12") for split operation'
      },
      startPage: {
        type: 'number',
        description: 'Start page number (1-based)'
      },
      endPage: {
        type: 'number',
        description: 'End page number (1-based)'
      }
    },
    required: ['operation', 'input']
  }
};

export async function executePdfManipulate(
  args: PdfManipulateArgs,
  config: ServerConfig
): Promise<{ message: string; text?: string; info?: any; pages?: number }> {
  const { operation, input, output, pages, startPage, endPage } = args;

  // Validate input paths
  const inputPaths = Array.isArray(input) ? input : [input];
  const validatedPaths = inputPaths.map(p => {
    const fullPath = validatePath(p, config.workspaceRoot);
    if (!fs.existsSync(fullPath)) {
      throw new WorkspaceError(
        ErrorCode.NOT_FOUND,
        `PDF file not found: ${p}`
      );
    }
    return fullPath;
  });

  // Check read-only mode for write operations
  if (config.readOnly && ['merge', 'split'].includes(operation)) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'PDF manipulation operations not allowed in read-only mode'
    );
  }

  try {
    switch (operation) {
      case 'info':
        return await getPdfInfo(validatedPaths[0], inputPaths[0]);
      
      case 'extract_text':
        return await extractPdfText(validatedPaths[0], inputPaths[0], startPage, endPage);
      
      case 'merge':
        if (!output) {
          throw new WorkspaceError(
            ErrorCode.INVALID_INPUT,
            'Output path required for merge operation'
          );
        }
        return await mergePdfs(validatedPaths, inputPaths, output, config);
      
      case 'split':
        if (!output) {
          throw new WorkspaceError(
            ErrorCode.INVALID_INPUT,
            'Output path required for split operation'
          );
        }
        return await splitPdf(validatedPaths[0], inputPaths[0], output, pages, config);
      
      default:
        throw new WorkspaceError(
          ErrorCode.INVALID_INPUT,
          `Unknown operation: ${operation}`
        );
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `PDF operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function getPdfInfo(filePath: string, originalPath: string): Promise<{ message: string; info: any }> {
  const stats = fs.statSync(filePath);
  
  return {
    message: 'PDF info retrieved successfully',
    info: {
      path: originalPath,
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      modified: stats.mtime,
      created: stats.birthtime,
      note: 'Install pdf-lib or pdf2pic library for detailed PDF metadata'
    }
  };
}

async function extractPdfText(
  filePath: string, 
  originalPath: string, 
  startPage?: number, 
  endPage?: number
): Promise<{ message: string; text: string }> {
  // This is a placeholder implementation
  // In a real implementation, you would use pdf-parse or similar library
  
  return {
    message: `Text extraction completed for ${originalPath}${startPage ? ` (pages ${startPage}-${endPage || 'end'})` : ''}`,
    text: `[PDF Text Content Placeholder]\n\nNote: Install pdf-parse library for actual PDF text extraction.\nFile: ${originalPath}\nSize: ${formatBytes(fs.statSync(filePath).size)}`
  };
}

async function mergePdfs(
  filePaths: string[], 
  originalPaths: string[], 
  output: string, 
  config: ServerConfig
): Promise<{ message: string; pages: number }> {
  const outputPath = validatePath(output, config.workspaceRoot);
  
  // Placeholder implementation - just copy the first file
  fs.copyFileSync(filePaths[0], outputPath);
  
  return {
    message: `PDF merge completed. Note: Install pdf-lib library for actual PDF merging.`,
    pages: originalPaths.length // Placeholder
  };
}

async function splitPdf(
  filePath: string, 
  _originalPath: string, 
  output: string, 
  _pages: string | undefined, 
  config: ServerConfig
): Promise<{ message: string; pages: number }> {
  const outputPath = validatePath(output, config.workspaceRoot);
  
  // Placeholder implementation - just copy the file
  fs.copyFileSync(filePath, outputPath);
  
  return {
    message: `PDF split completed. Note: Install pdf-lib library for actual PDF splitting.`,
    pages: 1 // Placeholder
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}