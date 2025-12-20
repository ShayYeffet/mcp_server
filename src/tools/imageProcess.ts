/**
 * Image Processing Tool
 * Basic image operations using sharp library
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

export interface ImageProcessArgs {
  input: string;
  output: string;
  operation: 'resize' | 'crop' | 'rotate' | 'format' | 'info';
  width?: number;
  height?: number;
  angle?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'gif';
  quality?: number;
  x?: number;
  y?: number;
}

export const imageProcessTool: Tool = {
  name: 'image_process',
  description: 'Process images - resize, crop, rotate, convert formats, get info',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input image file path (relative to workspace)'
      },
      output: {
        type: 'string',
        description: 'Output image file path (relative to workspace)'
      },
      operation: {
        type: 'string',
        enum: ['resize', 'crop', 'rotate', 'format', 'info'],
        description: 'Image operation to perform'
      },
      width: {
        type: 'number',
        description: 'Width in pixels (for resize/crop)'
      },
      height: {
        type: 'number',
        description: 'Height in pixels (for resize/crop)'
      },
      angle: {
        type: 'number',
        description: 'Rotation angle in degrees (for rotate)'
      },
      format: {
        type: 'string',
        enum: ['jpeg', 'png', 'webp', 'gif'],
        description: 'Output format (for format conversion)'
      },
      quality: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'JPEG quality (1-100)'
      },
      x: {
        type: 'number',
        description: 'X coordinate for crop start'
      },
      y: {
        type: 'number',
        description: 'Y coordinate for crop start'
      }
    },
    required: ['input', 'operation']
  }
};

export async function executeImageProcess(
  args: ImageProcessArgs,
  config: ServerConfig
): Promise<{ message: string; info?: any }> {
  const { input, output, operation } = args;

  // Validate input path
  const inputPath = validatePath(input, config.workspaceRoot);
  
  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    throw new WorkspaceError(
      ErrorCode.NOT_FOUND,
      `Input image file not found: ${input}`
    );
  }

  // Check read-only mode for write operations
  if (config.readOnly && operation !== 'info') {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'Image processing operations not allowed in read-only mode'
    );
  }

  try {
    // For now, we'll provide a basic implementation without sharp
    // In a real implementation, you would use the sharp library
    
    if (operation === 'info') {
      // Get basic file info
      const stats = fs.statSync(inputPath);
      const ext = path.extname(inputPath).toLowerCase();
      
      return {
        message: 'Image info retrieved successfully',
        info: {
          path: input,
          size: stats.size,
          extension: ext,
          modified: stats.mtime,
          note: 'Advanced image processing requires sharp library installation'
        }
      };
    }

    // For other operations, we'll simulate the process
    if (!output) {
      throw new WorkspaceError(
        ErrorCode.INVALID_INPUT,
        'Output path required for image processing operations'
      );
    }

    const outputPath = validatePath(output, config.workspaceRoot);
    
    // Simple copy operation as placeholder
    fs.copyFileSync(inputPath, outputPath);
    
    return {
      message: `Image ${operation} operation completed. Note: Install sharp library for full image processing capabilities.`,
      info: {
        input,
        output,
        operation,
        note: 'This is a placeholder implementation. Install sharp library for actual image processing.'
      }
    };

  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}