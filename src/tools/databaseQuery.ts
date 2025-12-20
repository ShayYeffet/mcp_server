/**
 * Database Query Tool
 * Execute SQL queries on SQLite databases
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import sqlite3 from 'sqlite3';
import { ServerConfig } from '../config.js';

const { Database } = sqlite3;
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

export interface DatabaseQueryArgs {
  database: string;
  query: string;
  params?: any[];
  mode?: 'read' | 'write';
}

export const databaseQueryTool: Tool = {
  name: 'database_query',
  description: 'Execute SQL queries on SQLite databases within the workspace',
  inputSchema: {
    type: 'object',
    properties: {
      database: {
        type: 'string',
        description: 'Path to SQLite database file (relative to workspace)'
      },
      query: {
        type: 'string',
        description: 'SQL query to execute'
      },
      params: {
        type: 'array',
        description: 'Parameters for prepared statement',
        items: { type: 'string' }
      },
      mode: {
        type: 'string',
        enum: ['read', 'write'],
        description: 'Query mode - read for SELECT, write for INSERT/UPDATE/DELETE',
        default: 'read'
      }
    },
    required: ['database', 'query']
  }
};

export async function executeDatabaseQuery(
  args: DatabaseQueryArgs,
  config: ServerConfig
): Promise<{ rows?: any[]; changes?: number; lastID?: number; message: string }> {
  const { database, query, params = [], mode = 'read' } = args;

  // Validate database path
  const dbPath = validatePath(database, config.workspaceRoot);
  
  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    throw new WorkspaceError(
      ErrorCode.NOT_FOUND,
      `Database file not found: ${database}`
    );
  }

  // Check read-only mode for write operations
  if (config.readOnly && mode === 'write') {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'Write operations not allowed in read-only mode'
    );
  }

  return new Promise((resolve, reject) => {
    const db = new Database(dbPath, (err) => {
      if (err) {
        reject(new WorkspaceError(
          ErrorCode.FILESYSTEM_ERROR,
          `Failed to open database: ${err.message}`
        ));
        return;
      }

      if (mode === 'read') {
        // Execute SELECT query
        db.all(query, params, (err, rows) => {
          db.close();
          
          if (err) {
            reject(new WorkspaceError(
              ErrorCode.UNEXPECTED_ERROR,
              `Query failed: ${err.message}`
            ));
            return;
          }

          resolve({
            rows,
            message: `Query executed successfully. Retrieved ${rows.length} rows.`
          });
        });
      } else {
        // Execute INSERT/UPDATE/DELETE query
        db.run(query, params, function(err) {
          db.close();
          
          if (err) {
            reject(new WorkspaceError(
              ErrorCode.UNEXPECTED_ERROR,
              `Query failed: ${err.message}`
            ));
            return;
          }

          resolve({
            changes: this.changes,
            lastID: this.lastID,
            message: `Query executed successfully. ${this.changes} rows affected.`
          });
        });
      }
    });
  });
}