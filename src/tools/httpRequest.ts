/**
 * HTTP Request Tool
 * Make HTTP requests to external APIs and services
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

export interface HttpRequestArgs {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  url: string;
  redirected: boolean;
}

export const httpRequestTool: Tool = {
  name: 'http_request',
  description: 'Make HTTP requests to external APIs and services',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to make the request to'
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        description: 'HTTP method to use',
        default: 'GET'
      },
      headers: {
        type: 'object',
        description: 'HTTP headers to send with the request',
        additionalProperties: { type: 'string' }
      },
      body: {
        type: 'string',
        description: 'Request body (for POST, PUT, PATCH methods)'
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        default: 30000
      },
      followRedirects: {
        type: 'boolean',
        description: 'Whether to follow HTTP redirects',
        default: true
      }
    },
    required: ['url']
  }
};

export async function executeHttpRequest(
  args: HttpRequestArgs,
  _config: ServerConfig
): Promise<HttpResponse> {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    timeout = 30000,
    followRedirects = true
  } = args;

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Invalid URL: ${url}`);
  }

  // Security check - only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new WorkspaceError(
      ErrorCode.SECURITY_VIOLATION,
      `Only HTTP and HTTPS protocols are allowed, got: ${parsedUrl.protocol}`
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const requestOptions: RequestInit = {
      method,
      headers: {
        'User-Agent': 'Ultimate-MCP-Server/2.0.0',
        ...headers
      },
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual'
    };

    // Add body for methods that support it
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestOptions.body = body;
      
      // Set content-type if not provided
      if (!headers['Content-Type'] && !headers['content-type']) {
        try {
          JSON.parse(body);
          (requestOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
        } catch {
          (requestOptions.headers as Record<string, string>)['Content-Type'] = 'text/plain';
        }
      }
    }

    const response = await fetch(url, requestOptions);
    clearTimeout(timeoutId);

    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Get response body
    let responseBody = '';
    try {
      responseBody = await response.text();
    } catch (error) {
      // Some responses might not have a readable body
      responseBody = '';
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      url: response.url,
      redirected: response.redirected
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new WorkspaceError(ErrorCode.COMMAND_TIMEOUT, `Request timed out after ${timeout}ms`);
      }
      throw new WorkspaceError(
        ErrorCode.UNEXPECTED_ERROR,
        `HTTP request failed: ${error.message}`
      );
    }
    throw new WorkspaceError(ErrorCode.UNEXPECTED_ERROR, 'HTTP request failed with unknown error');
  }
}