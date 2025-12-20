/**
 * Encryption/Decryption Tool
 * Encrypt and decrypt files or text using various algorithms
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

export interface EncryptDecryptArgs {
  operation: 'encrypt' | 'decrypt' | 'hash' | 'generate_key';
  algorithm?: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  hashAlgorithm?: 'sha256' | 'sha512' | 'md5' | 'sha1';
  input?: string;
  output?: string;
  text?: string;
  password?: string;
  keyFile?: string;
}

export const encryptDecryptTool: Tool = {
  name: 'encrypt_decrypt',
  description: 'Encrypt/decrypt files or text, generate hashes, create encryption keys',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['encrypt', 'decrypt', 'hash', 'generate_key'],
        description: 'Cryptographic operation to perform'
      },
      algorithm: {
        type: 'string',
        enum: ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'],
        description: 'Encryption algorithm',
        default: 'aes-256-gcm'
      },
      hashAlgorithm: {
        type: 'string',
        enum: ['sha256', 'sha512', 'md5', 'sha1'],
        description: 'Hash algorithm',
        default: 'sha256'
      },
      input: {
        type: 'string',
        description: 'Input file path (relative to workspace)'
      },
      output: {
        type: 'string',
        description: 'Output file path (relative to workspace)'
      },
      text: {
        type: 'string',
        description: 'Text to encrypt/decrypt/hash (alternative to file)'
      },
      password: {
        type: 'string',
        description: 'Password for encryption/decryption'
      },
      keyFile: {
        type: 'string',
        description: 'Path to key file (relative to workspace)'
      }
    },
    required: ['operation']
  }
};

export async function executeEncryptDecrypt(
  args: EncryptDecryptArgs,
  config: ServerConfig
): Promise<{ message: string; result?: string; hash?: string; key?: string }> {
  const { 
    operation, 
    algorithm = 'aes-256-gcm', 
    hashAlgorithm = 'sha256',
    input, 
    output, 
    text, 
    password,
    keyFile 
  } = args;

  // Check read-only mode for write operations
  if (config.readOnly && ['encrypt', 'decrypt', 'generate_key'].includes(operation) && (output || keyFile)) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'Encryption operations that create files not allowed in read-only mode'
    );
  }

  try {
    switch (operation) {
      case 'hash':
        return await generateHash(input, text, hashAlgorithm, config);
      
      case 'generate_key':
        return await generateEncryptionKey(output, config);
      
      case 'encrypt':
        return await encryptData(input, output, text, password, keyFile, algorithm, config);
      
      case 'decrypt':
        return await decryptData(input, output, text, password, keyFile, algorithm, config);
      
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
      `Encryption operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function generateHash(
  input: string | undefined, 
  text: string | undefined, 
  algorithm: string, 
  config: ServerConfig
): Promise<{ message: string; hash: string }> {
  let data: string;
  
  if (input) {
    const inputPath = validatePath(input, config.workspaceRoot);
    if (!fs.existsSync(inputPath)) {
      throw new WorkspaceError(ErrorCode.NOT_FOUND, `Input file not found: ${input}`);
    }
    data = fs.readFileSync(inputPath, 'utf8');
  } else if (text) {
    data = text;
  } else {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Either input file or text must be provided');
  }

  const hash = crypto.createHash(algorithm).update(data).digest('hex');
  
  return {
    message: `${algorithm.toUpperCase()} hash generated successfully`,
    hash
  };
}

async function generateEncryptionKey(
  output: string | undefined, 
  config: ServerConfig
): Promise<{ message: string; key: string }> {
  const key = crypto.randomBytes(32).toString('hex');
  
  if (output) {
    const outputPath = validatePath(output, config.workspaceRoot);
    fs.writeFileSync(outputPath, key);
    return {
      message: `Encryption key generated and saved to ${output}`,
      key: '[Key saved to file]'
    };
  }
  
  return {
    message: 'Encryption key generated successfully',
    key
  };
}

async function encryptData(
  input: string | undefined,
  output: string | undefined,
  text: string | undefined,
  password: string | undefined,
  keyFile: string | undefined,
  algorithm: string,
  config: ServerConfig
): Promise<{ message: string; result?: string }> {
  if (!password && !keyFile) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Password or key file must be provided');
  }

  let data: string;
  if (input) {
    const inputPath = validatePath(input, config.workspaceRoot);
    if (!fs.existsSync(inputPath)) {
      throw new WorkspaceError(ErrorCode.NOT_FOUND, `Input file not found: ${input}`);
    }
    data = fs.readFileSync(inputPath, 'utf8');
  } else if (text) {
    data = text;
  } else {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Either input file or text must be provided');
  }

  // Get encryption key
  let key: Buffer;
  if (keyFile) {
    const keyPath = validatePath(keyFile, config.workspaceRoot);
    if (!fs.existsSync(keyPath)) {
      throw new WorkspaceError(ErrorCode.NOT_FOUND, `Key file not found: ${keyFile}`);
    }
    const keyHex = fs.readFileSync(keyPath, 'utf8').trim();
    key = Buffer.from(keyHex, 'hex');
  } else if (password) {
    key = crypto.scryptSync(password, 'salt', 32);
  } else {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'No encryption key available');
  }

  // Encrypt data
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const result = iv.toString('hex') + ':' + encrypted;

  if (output) {
    const outputPath = validatePath(output, config.workspaceRoot);
    fs.writeFileSync(outputPath, result);
    return {
      message: `Data encrypted and saved to ${output}`
    };
  }

  return {
    message: 'Data encrypted successfully',
    result
  };
}

async function decryptData(
  input: string | undefined,
  output: string | undefined,
  text: string | undefined,
  password: string | undefined,
  keyFile: string | undefined,
  algorithm: string,
  config: ServerConfig
): Promise<{ message: string; result?: string }> {
  if (!password && !keyFile) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Password or key file must be provided');
  }

  let encryptedData: string;
  if (input) {
    const inputPath = validatePath(input, config.workspaceRoot);
    if (!fs.existsSync(inputPath)) {
      throw new WorkspaceError(ErrorCode.NOT_FOUND, `Input file not found: ${input}`);
    }
    encryptedData = fs.readFileSync(inputPath, 'utf8');
  } else if (text) {
    encryptedData = text;
  } else {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Either input file or text must be provided');
  }

  // Get decryption key
  let key: Buffer;
  if (keyFile) {
    const keyPath = validatePath(keyFile, config.workspaceRoot);
    if (!fs.existsSync(keyPath)) {
      throw new WorkspaceError(ErrorCode.NOT_FOUND, `Key file not found: ${keyFile}`);
    }
    const keyHex = fs.readFileSync(keyPath, 'utf8').trim();
    key = Buffer.from(keyHex, 'hex');
  } else if (password) {
    key = crypto.scryptSync(password, 'salt', 32);
  } else {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'No decryption key available');
  }

  try {
    // Parse encrypted data
    const [, encrypted] = encryptedData.split(':');
    
    // Decrypt data
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    if (output) {
      const outputPath = validatePath(output, config.workspaceRoot);
      fs.writeFileSync(outputPath, decrypted);
      return {
        message: `Data decrypted and saved to ${output}`
      };
    }

    return {
      message: 'Data decrypted successfully',
      result: decrypted
    };
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      'Decryption failed - invalid key or corrupted data'
    );
  }
}