/**
 * Web Scraping Tool
 * Extract data from web pages, parse HTML, and scrape content
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { ServerConfig } from '../config.js';
import { WorkspaceError, ErrorCode } from '../utils/errors.js';

export interface WebScrapeArgs {
  url: string;
  operation: 'fetch' | 'extract' | 'links' | 'images' | 'text' | 'metadata';
  selector?: string;
  attribute?: string;
  timeout?: number;
  headers?: Record<string, string>;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export const webScrapeTool: Tool = {
  name: 'web_scrape',
  description: 'Scrape web pages - fetch HTML, extract elements, get links, images, text, metadata',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to scrape'
      },
      operation: {
        type: 'string',
        enum: ['fetch', 'extract', 'links', 'images', 'text', 'metadata'],
        description: 'Scraping operation to perform'
      },
      selector: {
        type: 'string',
        description: 'CSS selector for element extraction'
      },
      attribute: {
        type: 'string',
        description: 'HTML attribute to extract (e.g., "href", "src")'
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        default: 10000
      },
      headers: {
        type: 'object',
        description: 'HTTP headers to send',
        additionalProperties: { type: 'string' }
      },
      followRedirects: {
        type: 'boolean',
        description: 'Follow HTTP redirects',
        default: true
      },
      maxRedirects: {
        type: 'number',
        description: 'Maximum number of redirects to follow',
        default: 5
      }
    },
    required: ['url', 'operation']
  }
};

export async function executeWebScrape(
  args: WebScrapeArgs,
  _config: ServerConfig
): Promise<{ message: string; data?: any; html?: string; links?: string[]; images?: string[]; text?: string; metadata?: any }> {
  const { url, operation, selector, attribute, timeout = 10000, headers, followRedirects = true, maxRedirects = 5 } = args;

  try {
    // Validate URL
    new URL(url);
  } catch (error) {
    throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Invalid URL: ${url}`);
  }

  try {
    const html = await fetchHtml(url, timeout, headers, followRedirects, maxRedirects);

    switch (operation) {
      case 'fetch':
        return {
          message: `HTML fetched successfully from ${url}`,
          html
        };
      
      case 'extract':
        if (!selector) {
          throw new WorkspaceError(ErrorCode.INVALID_INPUT, 'CSS selector is required for extract operation');
        }
        return await extractElements(html, selector, attribute, url);
      
      case 'links':
        return await extractLinks(html, url);
      
      case 'images':
        return await extractImages(html, url);
      
      case 'text':
        return await extractText(html, url);
      
      case 'metadata':
        return await extractMetadata(html, url);
      
      default:
        throw new WorkspaceError(ErrorCode.INVALID_INPUT, `Unknown operation: ${operation}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }
    throw new WorkspaceError(
      ErrorCode.UNEXPECTED_ERROR,
      `Web scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function fetchHtml(
  url: string,
  timeout: number,
  headers?: Record<string, string>,
  followRedirects: boolean = true,
  maxRedirects: number = 5
): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        ...headers
      }
    };

    const req = httpModule.request(options, (res) => {
      // Handle redirects
      if (followRedirects && res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        
        const redirectUrl = new URL(res.headers.location, url).toString();
        fetchHtml(redirectUrl, timeout, headers, followRedirects, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function extractElements(
  html: string,
  selector: string,
  attribute?: string,
  _url?: string
): Promise<{ message: string; data: any[] }> {
  // Simple HTML parsing - in a real implementation, you'd use a proper HTML parser like cheerio
  const elements = parseHtmlElements(html, selector);
  
  let data: any[];
  
  if (attribute) {
    data = elements.map(el => extractAttribute(el, attribute)).filter(val => val !== null);
  } else {
    data = elements.map(el => extractTextContent(el));
  }

  return {
    message: `Extracted ${data.length} elements using selector "${selector}"${attribute ? ` (attribute: ${attribute})` : ''}`,
    data
  };
}

async function extractLinks(html: string, baseUrl: string): Promise<{ message: string; links: string[] }> {
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const link = new URL(match[1], baseUrl).toString();
      if (!links.includes(link)) {
        links.push(link);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return {
    message: `Extracted ${links.length} unique links`,
    links
  };
}

async function extractImages(html: string, baseUrl: string): Promise<{ message: string; images: string[] }> {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: string[] = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    try {
      const img = new URL(match[1], baseUrl).toString();
      if (!images.includes(img)) {
        images.push(img);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return {
    message: `Extracted ${images.length} unique images`,
    images
  };
}

async function extractText(html: string, url: string): Promise<{ message: string; text: string }> {
  // Remove script and style elements
  let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  const text = cleanHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    message: `Extracted text content from ${url} (${text.length} characters)`,
    text
  };
}

async function extractMetadata(html: string, url: string): Promise<{ message: string; metadata: any }> {
  const metadata: any = {
    url,
    title: '',
    description: '',
    keywords: '',
    author: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    twitterTitle: '',
    twitterDescription: '',
    twitterImage: ''
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Extract meta tags
  const metaRegex = /<meta[^>]+>/gi;
  let match;

  while ((match = metaRegex.exec(html)) !== null) {
    const metaTag = match[0];
    
    // Description
    if (metaTag.includes('name="description"') || metaTag.includes("name='description'")) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.description = contentMatch[1];
    }
    
    // Keywords
    if (metaTag.includes('name="keywords"') || metaTag.includes("name='keywords'")) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.keywords = contentMatch[1];
    }
    
    // Author
    if (metaTag.includes('name="author"') || metaTag.includes("name='author'")) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.author = contentMatch[1];
    }
    
    // Open Graph
    if (metaTag.includes('property="og:title"') || metaTag.includes("property='og:title'")) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.ogTitle = contentMatch[1];
    }
    
    if (metaTag.includes('property="og:description"') || metaTag.includes("property='og:description'")) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.ogDescription = contentMatch[1];
    }
    
    if (metaTag.includes('property="og:image"') || metaTag.includes("property='og:image'")) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.ogImage = contentMatch[1];
    }
    
    // Twitter Cards
    if (metaTag.includes('name="twitter:title"') || metaTag.includes("name='twitter:title'")) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.twitterTitle = contentMatch[1];
    }
    
    if (metaTag.includes('name="twitter:description"') || metaTag.includes("name='twitter:description'")) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.twitterDescription = contentMatch[1];
    }
    
    if (metaTag.includes('name="twitter:image"') || metaTag.includes("name='twitter:image'")) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.twitterImage = contentMatch[1];
    }
  }

  return {
    message: `Extracted metadata from ${url}`,
    metadata
  };
}

function parseHtmlElements(html: string, selector: string): string[] {
  // Very basic CSS selector parsing - in a real implementation, use a proper HTML parser
  const elements: string[] = [];
  
  if (selector.startsWith('.')) {
    // Class selector
    const className = selector.substring(1);
    const regex = new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>.*?</[^>]+>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      elements.push(match[0]);
    }
  } else if (selector.startsWith('#')) {
    // ID selector
    const id = selector.substring(1);
    const regex = new RegExp(`<[^>]+id=["']${id}["'][^>]*>.*?</[^>]+>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      elements.push(match[0]);
    }
  } else {
    // Tag selector
    const regex = new RegExp(`<${selector}[^>]*>.*?</${selector}>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      elements.push(match[0]);
    }
  }
  
  return elements;
}

function extractAttribute(element: string, attribute: string): string | null {
  const regex = new RegExp(`${attribute}=["']([^"']+)["']`, 'i');
  const match = element.match(regex);
  return match ? match[1] : null;
}

function extractTextContent(element: string): string {
  return element.replace(/<[^>]*>/g, '').trim();
}