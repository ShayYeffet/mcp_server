/**
 * Notification Tool
 * Send system notifications, emails, or webhooks
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

const execAsync = promisify(exec);

export interface SendNotificationArgs {
  type: 'system' | 'webhook' | 'email';
  title?: string;
  message: string;
  url?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  payload?: any;
  email?: {
    to: string;
    subject: string;
    smtp?: {
      host: string;
      port: number;
      user: string;
      password: string;
    };
  };
  priority?: 'low' | 'normal' | 'high' | 'critical';
  sound?: boolean;
}

export const sendNotificationTool: Tool = {
  name: 'send_notification',
  description: 'Send system notifications, webhooks, or email alerts',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['system', 'webhook', 'email'],
        description: 'Type of notification to send'
      },
      title: {
        type: 'string',
        description: 'Notification title (for system notifications)'
      },
      message: {
        type: 'string',
        description: 'Notification message content'
      },
      url: {
        type: 'string',
        description: 'Webhook URL (for webhook notifications)'
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST'],
        description: 'HTTP method for webhook',
        default: 'POST'
      },
      headers: {
        type: 'object',
        description: 'HTTP headers for webhook',
        additionalProperties: { type: 'string' }
      },
      payload: {
        type: 'object',
        description: 'Payload data for webhook'
      },
      email: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject' },
          smtp: {
            type: 'object',
            properties: {
              host: { type: 'string', description: 'SMTP server host' },
              port: { type: 'number', description: 'SMTP server port' },
              user: { type: 'string', description: 'SMTP username' },
              password: { type: 'string', description: 'SMTP password' }
            },
            required: ['host', 'port', 'user', 'password']
          }
        },
        required: ['to', 'subject']
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'critical'],
        description: 'Notification priority',
        default: 'normal'
      },
      sound: {
        type: 'boolean',
        description: 'Play notification sound',
        default: true
      }
    },
    required: ['type', 'message']
  }
};

export async function executeSendNotification(
  args: SendNotificationArgs,
  _config: ServerConfig
): Promise<{ message: string; status: string; details?: any }> {
  const { type, title, message, url, method = 'POST', headers, payload, email, priority = 'normal', sound = true } = args;

  try {
    switch (type) {
      case 'system':
        return await sendSystemNotification(title || 'MCP Server', message, priority, sound);
      
      case 'webhook':
        if (!url) {
          throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'URL is required for webhook notifications');
        }
        return await sendWebhook(url, method, message, headers, payload);
      
      case 'email':
        if (!email) {
          throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Email configuration is required for email notifications');
        }
        return await sendEmail(email, message);
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown notification type: ${type}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function sendSystemNotification(
  title: string,
  message: string,
  priority: string,
  sound: boolean
): Promise<{ message: string; status: string }> {
  try {
    if (process.platform === 'win32') {
      // Windows notification using PowerShell
      const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title.replace(/'/g, "''")}', 'OK', 'Information')"`;
      
      await execAsync(command, { timeout: 5000 });
      
      return {
        message: 'System notification sent successfully',
        status: 'sent'
      };
    } else if (process.platform === 'darwin') {
      // macOS notification using osascript
      const soundParam = sound ? 'with sound name "default"' : '';
      const command = `osascript -e 'display notification "${message}" with title "${title}" ${soundParam}'`;
      
      await execAsync(command, { timeout: 5000 });
      
      return {
        message: 'System notification sent successfully',
        status: 'sent'
      };
    } else {
      // Linux notification using notify-send
      try {
        const urgencyMap = { low: 'low', normal: 'normal', high: 'normal', critical: 'critical' };
        const urgency = urgencyMap[priority as keyof typeof urgencyMap] || 'normal';
        const command = `notify-send -u ${urgency} "${title}" "${message}"`;
        
        await execAsync(command, { timeout: 5000 });
        
        return {
          message: 'System notification sent successfully',
          status: 'sent'
        };
      } catch {
        // Fallback to console output
        console.log(`NOTIFICATION: ${title}\n${message}`);
        return {
          message: 'Notification displayed in console (notify-send not available)',
          status: 'fallback'
        };
      }
    }
  } catch (error) {
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `System notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function sendWebhook(
  url: string,
  method: string,
  message: string,
  headers?: Record<string, string>,
  payload?: any
): Promise<{ message: string; status: string; details: any }> {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      // Prepare payload
      const data = payload || { message };
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Ultimate-MCP-Server/2.0',
          ...headers
        }
      };

      const req = httpModule.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const success = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          
          resolve({
            message: success ? 'Webhook sent successfully' : 'Webhook sent with non-success status',
            status: success ? 'sent' : 'error',
            details: {
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              response: responseData,
              url: url
            }
          });
        });
      });

      req.on('error', (error) => {
        reject(new WorkspaceError(
          ErrorCode.UNEXPECTED_ERROR,
          `Webhook request failed: ${error.message}`
        ));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new WorkspaceError(
          ErrorCode.COMMAND_TIMEOUT,
          'Webhook request timed out'
        ));
      });

      if (method === 'POST') {
        req.write(postData);
      }
      req.end();
      
    } catch (error) {
      reject(new WorkspaceError(
        ErrorCode.UNEXPECTED_ERROR,
        `Webhook setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });
}

async function sendEmail(
  emailConfig: SendNotificationArgs['email'],
  _message: string
): Promise<{ message: string; status: string }> {
  if (!emailConfig) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Email configuration is required');
  }

  // This is a placeholder implementation
  // In a real implementation, you would use nodemailer or similar library
  
  return {
    message: `Email notification prepared for ${emailConfig.to}. Note: Install nodemailer library for actual email sending.`,
    status: 'placeholder'
  };
}