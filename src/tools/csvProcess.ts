/**
 * CSV Processing Tool
 * Read, write, transform, and analyze CSV files
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';
import { validatePath } from '../utils/pathUtils.js';

export interface CsvProcessArgs {
  operation: 'read' | 'write' | 'transform' | 'analyze' | 'filter' | 'merge' | 'split';
  input?: string;
  output?: string;
  data?: any[];
  delimiter?: string;
  headers?: boolean;
  encoding?: string;
  filterColumn?: string;
  filterValue?: string;
  transformRules?: Record<string, string>;
  mergeFiles?: string[];
  splitColumn?: string;
}

export const csvProcessTool: Tool = {
  name: 'csv_process',
  description: 'Process CSV files - read, write, transform, analyze, filter, merge, split',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['read', 'write', 'transform', 'analyze', 'filter', 'merge', 'split'],
        description: 'CSV operation to perform'
      },
      input: {
        type: 'string',
        description: 'Input CSV file path (relative to workspace)'
      },
      output: {
        type: 'string',
        description: 'Output CSV file path (relative to workspace)'
      },
      data: {
        type: 'array',
        description: 'Data array for write operation',
        items: { type: 'object' }
      },
      delimiter: {
        type: 'string',
        description: 'CSV delimiter character',
        default: ','
      },
      headers: {
        type: 'boolean',
        description: 'Whether CSV has headers',
        default: true
      },
      encoding: {
        type: 'string',
        description: 'File encoding',
        default: 'utf8'
      },
      filterColumn: {
        type: 'string',
        description: 'Column name to filter by'
      },
      filterValue: {
        type: 'string',
        description: 'Value to filter for'
      },
      transformRules: {
        type: 'object',
        description: 'Column transformation rules',
        additionalProperties: { type: 'string' }
      },
      mergeFiles: {
        type: 'array',
        description: 'CSV files to merge',
        items: { type: 'string' }
      },
      splitColumn: {
        type: 'string',
        description: 'Column to split data by'
      }
    },
    required: ['operation']
  }
};

export async function executeCsvProcess(
  args: CsvProcessArgs,
  config: ServerConfig
): Promise<{ message: string; data?: any[]; analysis?: any; files?: string[] }> {
  const { operation, input, output, data, delimiter = ',', headers = true, encoding = 'utf8' } = args;

  // Check read-only mode for write operations
  if (config.readOnly && ['write', 'transform', 'filter', 'merge', 'split'].includes(operation)) {
    throw new WorkspaceError(
      ErrorCode.READ_ONLY_MODE,
      'CSV write operations not allowed in read-only mode'
    );
  }

  try {
    switch (operation) {
      case 'read':
        return await readCsv(input!, config, delimiter, headers, encoding);
      
      case 'write':
        return await writeCsv(output!, data!, config, delimiter, headers, encoding);
      
      case 'analyze':
        return await analyzeCsv(input!, config, delimiter, headers, encoding);
      
      case 'filter':
        return await filterCsv(input!, output!, args, config, delimiter, headers, encoding);
      
      case 'transform':
        return await transformCsv(input!, output!, args, config, delimiter, headers, encoding);
      
      case 'merge':
        return await mergeCsvFiles(args.mergeFiles!, output!, config, delimiter, headers, encoding);
      
      case 'split':
        return await splitCsv(input!, args.splitColumn!, config, delimiter, headers, encoding);
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown operation: ${operation}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `CSV processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function readCsv(
  input: string,
  config: ServerConfig,
  delimiter: string,
  headers: boolean,
  encoding: string
): Promise<{ message: string; data: any[] }> {
  const inputPath = validatePath(input, config.workspaceRoot);
  
  if (!fs.existsSync(inputPath)) {
    throw new WorkspaceError(ErrorCode.NOT_FOUND, `CSV file not found: ${input}`);
  }

  const content = fs.readFileSync(inputPath, encoding as BufferEncoding);
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return { message: 'CSV file is empty', data: [] };
  }

  const data: any[] = [];
  let headerRow: string[] = [];

  if (headers && lines.length > 0) {
    headerRow = parseCsvLine(lines[0], delimiter);
    lines.shift();
  }

  for (const line of lines) {
    const values = parseCsvLine(line, delimiter);
    
    if (headers) {
      const row: any = {};
      headerRow.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    } else {
      data.push(values);
    }
  }

  return {
    message: `CSV file read successfully. ${data.length} rows loaded.`,
    data
  };
}

async function writeCsv(
  output: string,
  data: any[],
  config: ServerConfig,
  delimiter: string,
  headers: boolean,
  encoding: string
): Promise<{ message: string }> {
  const outputPath = validatePath(output, config.workspaceRoot);
  
  if (data.length === 0) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'No data provided for CSV write');
  }

  let csvContent = '';
  
  // Write headers if needed
  if (headers && typeof data[0] === 'object' && !Array.isArray(data[0])) {
    const headerRow = Object.keys(data[0]);
    csvContent += headerRow.map(h => escapeCsvValue(h, delimiter)).join(delimiter) + '\n';
  }

  // Write data rows
  for (const row of data) {
    let values: string[];
    
    if (Array.isArray(row)) {
      values = row.map(v => escapeCsvValue(String(v), delimiter));
    } else if (typeof row === 'object') {
      values = Object.values(row).map(v => escapeCsvValue(String(v), delimiter));
    } else {
      values = [escapeCsvValue(String(row), delimiter)];
    }
    
    csvContent += values.join(delimiter) + '\n';
  }

  fs.writeFileSync(outputPath, csvContent, encoding as BufferEncoding);

  return {
    message: `CSV file written successfully. ${data.length} rows saved to ${output}.`
  };
}

async function analyzeCsv(
  input: string,
  config: ServerConfig,
  delimiter: string,
  headers: boolean,
  encoding: string
): Promise<{ message: string; analysis: any }> {
  const { data } = await readCsv(input, config, delimiter, headers, encoding);
  
  if (data.length === 0) {
    return {
      message: 'CSV analysis completed',
      analysis: { rows: 0, columns: 0, empty: true }
    };
  }

  const analysis: any = {
    rows: data.length,
    columns: 0,
    columnInfo: {},
    dataTypes: {},
    nullCounts: {},
    uniqueCounts: {}
  };

  // Analyze structure
  if (typeof data[0] === 'object' && !Array.isArray(data[0])) {
    const columns = Object.keys(data[0]);
    analysis.columns = columns.length;
    analysis.columnNames = columns;

    // Analyze each column
    for (const col of columns) {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
      const nonEmptyValues = values.length;
      const uniqueValues = new Set(values).size;
      
      analysis.columnInfo[col] = {
        nonEmpty: nonEmptyValues,
        empty: data.length - nonEmptyValues,
        unique: uniqueValues,
        sampleValues: [...new Set(values)].slice(0, 5)
      };

      // Detect data type
      if (values.every(v => !isNaN(Number(v)) && v !== '')) {
        analysis.dataTypes[col] = 'number';
      } else if (values.every(v => /^\d{4}-\d{2}-\d{2}/.test(v))) {
        analysis.dataTypes[col] = 'date';
      } else {
        analysis.dataTypes[col] = 'string';
      }
    }
  } else {
    analysis.columns = Array.isArray(data[0]) ? data[0].length : 1;
  }

  return {
    message: `CSV analysis completed. ${analysis.rows} rows, ${analysis.columns} columns.`,
    analysis
  };
}

async function filterCsv(
  input: string,
  output: string,
  args: CsvProcessArgs,
  config: ServerConfig,
  delimiter: string,
  headers: boolean,
  encoding: string
): Promise<{ message: string }> {
  const { filterColumn, filterValue } = args;
  
  if (!filterColumn || !filterValue) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Filter column and value are required');
  }

  const { data } = await readCsv(input, config, delimiter, headers, encoding);
  
  const filteredData = data.filter(row => {
    if (typeof row === 'object' && !Array.isArray(row)) {
      return String(row[filterColumn]).toLowerCase().includes(filterValue.toLowerCase());
    }
    return false;
  });

  await writeCsv(output, filteredData, config, delimiter, headers, encoding);

  return {
    message: `CSV filtered successfully. ${filteredData.length} rows match the filter criteria.`
  };
}

async function transformCsv(
  input: string,
  output: string,
  args: CsvProcessArgs,
  config: ServerConfig,
  delimiter: string,
  headers: boolean,
  encoding: string
): Promise<{ message: string }> {
  const { transformRules } = args;
  
  if (!transformRules) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'Transform rules are required');
  }

  const { data } = await readCsv(input, config, delimiter, headers, encoding);
  
  const transformedData = data.map(row => {
    if (typeof row === 'object' && !Array.isArray(row)) {
      const newRow = { ...row };
      
      for (const [column, rule] of Object.entries(transformRules)) {
        if (newRow[column] !== undefined) {
          switch (rule) {
            case 'uppercase':
              newRow[column] = String(newRow[column]).toUpperCase();
              break;
            case 'lowercase':
              newRow[column] = String(newRow[column]).toLowerCase();
              break;
            case 'trim':
              newRow[column] = String(newRow[column]).trim();
              break;
            case 'number':
              newRow[column] = Number(newRow[column]) || 0;
              break;
            default:
              // Custom transformation (could be a regex or formula)
              break;
          }
        }
      }
      
      return newRow;
    }
    return row;
  });

  await writeCsv(output, transformedData, config, delimiter, headers, encoding);

  return {
    message: `CSV transformed successfully. ${transformedData.length} rows processed.`
  };
}

async function mergeCsvFiles(
  mergeFiles: string[],
  output: string,
  config: ServerConfig,
  delimiter: string,
  headers: boolean,
  encoding: string
): Promise<{ message: string }> {
  if (mergeFiles.length < 2) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'At least 2 files are required for merge');
  }

  let allData: any[] = [];
  
  for (const file of mergeFiles) {
    const { data } = await readCsv(file, config, delimiter, headers, encoding);
    allData = allData.concat(data);
  }

  await writeCsv(output, allData, config, delimiter, headers, encoding);

  return {
    message: `CSV files merged successfully. ${allData.length} total rows from ${mergeFiles.length} files.`
  };
}

async function splitCsv(
  input: string,
  splitColumn: string,
  config: ServerConfig,
  delimiter: string,
  headers: boolean,
  encoding: string
): Promise<{ message: string; files: string[] }> {
  const { data } = await readCsv(input, config, delimiter, headers, encoding);
  
  if (data.length === 0) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'No data to split');
  }

  const groups: Record<string, any[]> = {};
  
  for (const row of data) {
    if (typeof row === 'object' && !Array.isArray(row)) {
      const groupValue = String(row[splitColumn] || 'unknown');
      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }
      groups[groupValue].push(row);
    }
  }

  const outputFiles: string[] = [];
  const baseName = input.replace(/\.csv$/i, '');
  
  for (const [groupValue, groupData] of Object.entries(groups)) {
    const fileName = `${baseName}_${groupValue.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    await writeCsv(fileName, groupData, config, delimiter, headers, encoding);
    outputFiles.push(fileName);
  }

  return {
    message: `CSV split successfully into ${outputFiles.length} files.`,
    files: outputFiles
  };
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function escapeCsvValue(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}