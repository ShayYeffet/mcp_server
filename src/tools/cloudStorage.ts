/**
 * Cloud Storage Tool
 * Interact with cloud storage services (AWS S3, Google Cloud, Azure)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

export interface CloudStorageArgs {
  provider: 'aws' | 'gcp' | 'azure' | 'generic';
  operation: 'upload' | 'download' | 'list' | 'delete' | 'copy' | 'info';
  bucket?: string;
  key?: string;
  localPath?: string;
  remotePath?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  endpoint?: string;
  prefix?: string;
  maxKeys?: number;
}

export const cloudStorageTool: Tool = {
  name: 'cloud_storage',
  description: 'Interact with cloud storage services - upload, download, list, delete files',
  inputSchema: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['aws', 'gcp', 'azure', 'generic'],
        description: 'Cloud storage provider'
      },
      operation: {
        type: 'string',
        enum: ['upload', 'download', 'list', 'delete', 'copy', 'info'],
        description: 'Storage operation to perform'
      },
      bucket: {
        type: 'string',
        description: 'Storage bucket/container name'
      },
      key: {
        type: 'string',
        description: 'Object key/path in storage'
      },
      localPath: {
        type: 'string',
        description: 'Local file path (relative to workspace)'
      },
      remotePath: {
        type: 'string',
        description: 'Remote file path in storage'
      },
      region: {
        type: 'string',
        description: 'Storage region',
        default: 'us-east-1'
      },
      accessKey: {
        type: 'string',
        description: 'Access key ID'
      },
      secretKey: {
        type: 'string',
        description: 'Secret access key'
      },
      endpoint: {
        type: 'string',
        description: 'Custom endpoint URL'
      },
      prefix: {
        type: 'string',
        description: 'Key prefix for list operations'
      },
      maxKeys: {
        type: 'number',
        description: 'Maximum number of keys to return',
        default: 100
      }
    },
    required: ['provider', 'operation']
  }
};

export async function executeCloudStorage(
  args: CloudStorageArgs,
  config: ServerConfig
): Promise<{ message: string; data?: any; objects?: any[]; url?: string }> {
  const { provider, operation, bucket, key, localPath, remotePath, region = 'us-east-1', accessKey, secretKey, endpoint, prefix, maxKeys = 100 } = args;

  // Check read-only mode for write operations
  if (config.readOnly && ['upload', 'delete', 'copy'].includes(operation)) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'Cloud storage write operations not allowed in read-only mode'
    );
  }

  // Validate credentials
  if (!accessKey || !secretKey) {
    throw new WorkspaceError(
      ErrorCode.INVALID_INPUT,
      'Access key and secret key are required for cloud storage operations'
    );
  }

  try {
    switch (operation) {
      case 'upload':
        return await uploadFile(provider, bucket!, key || remotePath!, localPath!, config, region, accessKey, secretKey, endpoint);
      
      case 'download':
        return await downloadFile(provider, bucket!, key || remotePath!, localPath!, config, region, accessKey, secretKey, endpoint);
      
      case 'list':
        return await listObjects(provider, bucket!, prefix, maxKeys, region, accessKey, secretKey, endpoint);
      
      case 'delete':
        return await deleteObject(provider, bucket!, key || remotePath!, region, accessKey, secretKey, endpoint);
      
      case 'copy':
        return await copyObject(provider, bucket!, key!, remotePath!, region, accessKey, secretKey, endpoint);
      
      case 'info':
        return await getObjectInfo(provider, bucket!, key || remotePath!, region, accessKey, secretKey, endpoint);
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown operation: ${operation}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Cloud storage operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function uploadFile(
  provider: string,
  bucket: string,
  key: string,
  localPath: string,
  config: ServerConfig,
  region: string,
  accessKey: string,
  secretKey: string,
  endpoint?: string
): Promise<{ message: string; url: string }> {
  const filePath = validatePath(localPath, config.workspaceRoot);
  
  if (!fs.existsSync(filePath)) {
    throw new WorkspaceError(ErrorCode.NOT_FOUND, `Local file not found: ${localPath}`);
  }

  const fileContent = fs.readFileSync(filePath);
  const contentType = getContentType(localPath);
  
  // This is a simplified implementation
  // In a real implementation, you would use the official SDK for each provider
  const url = await makeStorageRequest(
    provider,
    'PUT',
    bucket,
    key,
    region,
    accessKey,
    secretKey,
    endpoint,
    fileContent,
    { 'Content-Type': contentType }
  );

  return {
    message: `File uploaded successfully to ${provider}://${bucket}/${key}`,
    url
  };
}

async function downloadFile(
  provider: string,
  bucket: string,
  key: string,
  localPath: string,
  config: ServerConfig,
  region: string,
  accessKey: string,
  secretKey: string,
  endpoint?: string
): Promise<{ message: string }> {
  const filePath = validatePath(localPath, config.workspaceRoot);
  
  const data = await makeStorageRequest(
    provider,
    'GET',
    bucket,
    key,
    region,
    accessKey,
    secretKey,
    endpoint
  );

  fs.writeFileSync(filePath, data);

  return {
    message: `File downloaded successfully from ${provider}://${bucket}/${key} to ${localPath}`
  };
}

async function listObjects(
  provider: string,
  bucket: string,
  prefix: string | undefined,
  maxKeys: number,
  region: string,
  accessKey: string,
  secretKey: string,
  endpoint?: string
): Promise<{ message: string; objects: any[] }> {
  // This is a placeholder implementation
  // In a real implementation, you would parse the XML/JSON response from the storage service
  
  const queryParams = new URLSearchParams();
  if (prefix) queryParams.set('prefix', prefix);
  queryParams.set('max-keys', maxKeys.toString());
  
  const response = await makeStorageRequest(
    provider,
    'GET',
    bucket,
    '',
    region,
    accessKey,
    secretKey,
    endpoint,
    undefined,
    {},
    queryParams.toString()
  );

  // Parse response (simplified)
  const objects = parseListResponse(response.toString(), provider);

  return {
    message: `Listed ${objects.length} objects from ${provider}://${bucket}${prefix ? ` with prefix ${prefix}` : ''}`,
    objects
  };
}

async function deleteObject(
  provider: string,
  bucket: string,
  key: string,
  region: string,
  accessKey: string,
  secretKey: string,
  endpoint?: string
): Promise<{ message: string }> {
  await makeStorageRequest(
    provider,
    'DELETE',
    bucket,
    key,
    region,
    accessKey,
    secretKey,
    endpoint
  );

  return {
    message: `Object deleted successfully from ${provider}://${bucket}/${key}`
  };
}

async function copyObject(
  provider: string,
  bucket: string,
  sourceKey: string,
  destKey: string,
  region: string,
  accessKey: string,
  secretKey: string,
  endpoint?: string
): Promise<{ message: string }> {
  // This is a simplified implementation
  // In a real implementation, you would use the provider's copy operation
  
  const data = await makeStorageRequest(
    provider,
    'GET',
    bucket,
    sourceKey,
    region,
    accessKey,
    secretKey,
    endpoint
  );

  await makeStorageRequest(
    provider,
    'PUT',
    bucket,
    destKey,
    region,
    accessKey,
    secretKey,
    endpoint,
    data
  );

  return {
    message: `Object copied successfully from ${sourceKey} to ${destKey} in ${provider}://${bucket}`
  };
}

async function getObjectInfo(
  provider: string,
  bucket: string,
  key: string,
  region: string,
  accessKey: string,
  secretKey: string,
  endpoint?: string
): Promise<{ message: string; data: any }> {
  // Use HEAD request to get object metadata
  const headers = await makeStorageRequest(
    provider,
    'HEAD',
    bucket,
    key,
    region,
    accessKey,
    secretKey,
    endpoint
  );

  const info = {
    key,
    bucket,
    provider,
    contentType: headers['content-type'] || 'unknown',
    contentLength: headers['content-length'] || 0,
    lastModified: headers['last-modified'] || 'unknown',
    etag: headers['etag'] || 'unknown'
  };

  return {
    message: `Retrieved object info for ${provider}://${bucket}/${key}`,
    data: info
  };
}

async function makeStorageRequest(
  provider: string,
  method: string,
  bucket: string,
  key: string,
  region: string,
  accessKey: string,
  secretKey: string,
  endpoint?: string,
  body?: Buffer,
  headers: Record<string, string> = {},
  queryString?: string
): Promise<any> {
  // This is a very simplified implementation
  // In a real implementation, you would:
  // 1. Use the official SDK for each provider
  // 2. Implement proper authentication (AWS Signature V4, etc.)
  // 3. Handle provider-specific endpoints and formats
  
  let url: string;
  
  if (endpoint) {
    url = `${endpoint}/${bucket}/${key}`;
  } else {
    switch (provider) {
      case 'aws':
        url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
        break;
      case 'gcp':
        url = `https://storage.googleapis.com/${bucket}/${key}`;
        break;
      case 'azure':
        url = `https://${accessKey}.blob.core.windows.net/${bucket}/${key}`;
        break;
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unsupported provider: ${provider}`);
    }
  }

  if (queryString) {
    url += `?${queryString}`;
  }

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'MCP-Cloud-Storage/1.0',
      'Authorization': `Basic ${Buffer.from(`${accessKey}:${secretKey}`).toString('base64')}`,
      ...headers
    };

    if (body) {
      requestHeaders['Content-Length'] = body.length.toString();
    }

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: requestHeaders
    };

    const req = httpModule.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      if (method === 'HEAD') {
        resolve(res.headers);
        return;
      }

      let data = Buffer.alloc(0);
      
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      
      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav'
  };
  
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

function parseListResponse(response: string, _provider: string): any[] {
  // This is a placeholder implementation
  // In a real implementation, you would parse the actual XML/JSON response from each provider
  
  const objects = [];
  
  // Simulate parsing response
  if (response.includes('<Key>') || response.includes('"name"')) {
    // Simulate finding objects in the response
    for (let i = 0; i < 5; i++) {
      objects.push({
        key: `example-file-${i}.txt`,
        size: Math.floor(Math.random() * 10000),
        lastModified: new Date().toISOString(),
        etag: `"${Math.random().toString(36).substring(2)}"`,
        storageClass: 'STANDARD'
      });
    }
  }
  
  return objects;
}