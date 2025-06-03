import { config } from 'dotenv';
config(); // Load environment variables from .env file

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { z } from 'zod';

// Semrush API configuration
const SEMRUSH_API_BASE = 'https://api.semrush.com';
const API_KEY = process.env.SEMRUSH_API_KEY;

if (!API_KEY) {
  console.error('SEMRUSH_API_KEY environment variable is required');
  process.exit(1);
}

// Helper function to parse CSV data from Semrush API
function parseCSV(csvData: string): Record<string, any>[] | { error: string } {
  if (!csvData || typeof csvData !== 'string') {
    return { error: 'Invalid or empty CSV data' };
  }
  try {
    const lines = csvData.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) {
        return { error: 'CSV data is empty after trimming' };
    }
    if (lines.length === 1 && lines[0].startsWith('ERROR ::')) {
        return { error: lines[0] };
    }
    if (lines.length <= 1 && !lines[0].includes(';')) { // Likely not a valid CSV if only one line and no delimiter
        return { error: 'No data rows found or invalid CSV header' };
    }
    const headers = lines[0].split(';');
    const dataRows = lines.slice(1);
    if (dataRows.length === 0 && lines.length === 1) { // Only header row means no data
        // Return headers so client knows what fields were expected, but indicate no data
        return { error: 'No data results, only headers returned' }; 
    }
    const results = dataRows.map(line => {
      const values = line.split(';');
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      return row;
    });
    return results;
  } catch (error: any) {
    console.error('Error parsing CSV:', error.message);
    return { error: 'Failed to parse CSV data' };
  }
}

// Tool schemas
const DomainOverviewSchema = z.object({
  domain: z.string().describe('Domain to analyze'),
  database: z.string().default('us').describe('Database code (e.g., us, uk, ca)'),
});

const KeywordOverviewSchema = z.object({
  phrase: z.string().describe('Keyword phrase to analyze'),
  database: z.string().default('us').describe('Database code'),
});

const DomainOrganicSearchSchema = z.object({
  domain: z.string().describe('Domain to analyze'),
  database: z.string().default('us').describe('Database code'),
  limit: z.coerce.number().default(10).describe('Number of results'),
  offset: z.coerce.number().default(0).describe('Offset for pagination'),
});

const BacklinksOverviewSchema = z.object({
  target: z.string().describe('Domain to analyze'),
  target_type: z.enum(['root_domain', 'domain', 'url']).default('root_domain').describe('Type of target: root_domain, domain (for subdomains), or url'),
});

const CompetitorResearchSchema = z.object({
  domain: z.string().describe('Domain to analyze'),
  database: z.string().default('us').describe('Database code'),
  limit: z.coerce.number().default(10).describe('Number of competitors'),
});

const DomainAdwordsSchema = z.object({
  domain: z.string().describe('Domain to analyze'),
  database: z.string().default('us').describe('Database code'),
  limit: z.coerce.number().default(10).describe('Number of results'),
});

const RelatedKeywordsSchema = z.object({
  phrase: z.string().describe('Seed keyword phrase'),
  database: z.string().default('us').describe('Database code'),
  limit: z.coerce.number().default(10).describe('Number of results'),
});

// Helper function to make Semrush API calls
async function callSemrushAPI(reportType: string, params: Record<string, any>, isAnalyticsV1: boolean = false) {
  try {
    let requestUrl: string;
    let queryParams: Record<string, any>;

    if (isAnalyticsV1) {
      requestUrl = `${SEMRUSH_API_BASE}/analytics/v1/`; // Note the trailing slash for consistency
      queryParams = {
        key: API_KEY,
        type: reportType, // e.g., 'backlinks_overview'
        ...params,
      };
    } else {
      requestUrl = SEMRUSH_API_BASE + '/'; // Main API endpoint: https://api.semrush.com/
      queryParams = {
        key: API_KEY,
        type: reportType, // e.g., 'domain_ranks'
        ...params,
      };
    }
    
    console.error(`Calling Semrush API. URL: ${requestUrl}, Params: ${JSON.stringify(queryParams)}`);

    const response = await axios.get(requestUrl, {
      params: queryParams,
    });
    
    if (typeof response.data === 'string') {
        const parsed = parseCSV(response.data);
        // If CSV parsing itself returns an error object, or if it's an array but empty (parsed from only headers or error string)
        if (parsed && typeof parsed === 'object' && ('error' in parsed || (Array.isArray(parsed) && 'headers' in parsed && parsed.length === 0))) {
            return parsed; // Return the error object or {error: ..., headers:..., data: []}
        }
        return parsed; // Otherwise, return the array of parsed objects or results from parseCSV
    }
    return response.data; // If not a string, return as is (might be JSON error from API)
  } catch (error: any) {
    console.error(`Semrush API call failed for type/path ${reportType}. Error: ${error.message}`);
    if (error.response) {
      console.error('Semrush API Error Response Status:', error.response.status);
      console.error('Semrush API Error Response Data:', error.response.data);
      let errorMessage = error.response.data;
      if (typeof errorMessage === 'string') {
        const semrushErrorMatch = errorMessage.match(/ERROR :: (.+)/);
        if (semrushErrorMatch && semrushErrorMatch[1]) {
          errorMessage = semrushErrorMatch[1];
        }
      }
      throw new Error(`Semrush API error (${error.response.status}): ${errorMessage || error.response.statusText}`);
    }
    throw new Error(`Semrush API request failed: ${error.message}`);
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'semrush-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'domain_overview',
        description: 'Get domain analytics overview including organic traffic, keywords, and authority score',
        inputSchema: {
          type: 'object',
          properties: DomainOverviewSchema.shape,
          required: ['domain'],
        },
      },
      {
        name: 'keyword_overview',
        description: 'Get keyword metrics including search volume, difficulty, and CPC',
        inputSchema: {
          type: 'object',
          properties: KeywordOverviewSchema.shape,
          required: ['phrase'],
        },
      },
      {
        name: 'domain_organic_search',
        description: 'Get organic search keywords for a domain',
        inputSchema: {
          type: 'object',
          properties: DomainOrganicSearchSchema.shape,
          required: ['domain'],
        },
      },
      {
        name: 'backlinks_overview',
        description: 'Get backlinks overview for a domain or URL. Target type can be root_domain, domain, or url.',
        inputSchema: {
          type: 'object',
          properties: BacklinksOverviewSchema.shape,
          required: ['target', 'target_type'],
        },
      },
      {
        name: 'competitor_research',
        description: 'Find organic competitors for a domain',
        inputSchema: {
          type: 'object',
          properties: CompetitorResearchSchema.shape,
          required: ['domain'],
        },
      },
      {
        name: 'domain_adwords',
        description: 'Get paid search (Google Ads) keywords for a domain',
        inputSchema: {
          type: 'object',
          properties: DomainAdwordsSchema.shape,
          required: ['domain'],
        },
      },
      {
        name: 'related_keywords',
        description: 'Get related keywords and suggestions for a seed keyword',
        inputSchema: {
          type: 'object',
          properties: RelatedKeywordsSchema.shape,
          required: ['phrase'],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let data: any;

  try {
    switch (name) {
      case 'domain_overview': {
        const { domain, database } = DomainOverviewSchema.parse(args);
        data = await callSemrushAPI('domain_ranks', {
          domain,
          database,
          export_columns: 'Db,Dn,Rk,Or,Ot,Oc,Ad,At,Ac,Sh,Sv',
        });
        break;
      }

      case 'keyword_overview': {
        const { phrase, database } = KeywordOverviewSchema.parse(args);
        data = await callSemrushAPI('phrase_all', {
          phrase,
          database,
          export_columns: 'Ph,Nq,Cp,Co,Nr,Td',
        });
        break;
      }

      case 'domain_organic_search': {
        const { domain, database, limit, offset } = DomainOrganicSearchSchema.parse(args);
        data = await callSemrushAPI('domain_organic', {
          domain,
          database,
          display_limit: limit,
          display_offset: offset,
          export_columns: 'Ph,Po,Nq,Cp,Ur,Tr,Tc,Co,Nr,Td',
        });
        break;
      }

      case 'backlinks_overview': {
        const { target, target_type } = BacklinksOverviewSchema.parse(args);
        data = await callSemrushAPI('backlinks_overview', { 
          target,
          target_type,
          export_columns: 'ascore,total,domains_num,urls_num,ips_num,ipclassc_num,follows_num,nofollows_num,sponsored_num,ugc_num,texts_num,images_num,forms_num,frames_num',
        }, true); // Pass true for isAnalyticsV1
        break;
      }

      case 'competitor_research': {
        const { domain, database, limit } = CompetitorResearchSchema.parse(args);
        data = await callSemrushAPI('domain_organic_competitors', { 
          domain,
          database,
          display_limit: limit,
          export_columns: 'Dn,Cr,Np,Or,Ot,Oc,Ad,At,Ac',
        });
        break;
      }

      case 'domain_adwords': {
        const { domain, database, limit } = DomainAdwordsSchema.parse(args);
        data = await callSemrushAPI('domain_adwords', {
          domain,
          database,
          display_limit: limit,
          export_columns: 'Ph,Po,Pp,Pd,Nq,Cp,Ur,Tr,Tc,Co,Nr,Td,Avg,Sym,Sp',
        });
        break;
      }

      case 'related_keywords': {
        const { phrase, database, limit } = RelatedKeywordsSchema.parse(args);
        data = await callSemrushAPI('phrase_related', {
          phrase,
          database,
          display_limit: limit,
          export_columns: 'Ph,Nq,Cp,Co,Nr,Td,Rr',
        });
        break;
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
    
    let responseText;
    if (data && typeof data === 'object' && 'error' in data) {
      // If data itself is an error object from parseCSV or API call
      responseText = `Error: ${data.error}`;
      if (data.headers && Array.isArray(data.data) && data.data.length === 0) {
        responseText += ` (Expected columns: ${data.headers.join(', ')})`;
      }
    } else if (Array.isArray(data)) {
        if (data.length === 0) {
            responseText = "No results found.";
        } else {
            responseText = data.map(row => JSON.stringify(row)).join('\n---\n');
        }
    } else if (typeof data === 'object' && data !== null) {
      responseText = JSON.stringify(data, null, 2);
    } else if (typeof data === 'string') {
      responseText = data; // Already a string (e.g. simple error message or non-CSV/JSON response)
    } else {
      responseText = "Received an unexpected data format from the API.";
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };

  } catch (error: any) {
    console.error(`Error executing tool ${name}:`, error.message);
    let displayError = error.message;
    if (error instanceof z.ZodError) {
      displayError = `Invalid parameters for ${name}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      throw new McpError(ErrorCode.InvalidParams, displayError);
    }
    throw new McpError(
      ErrorCode.InternalError,
      displayError || `An unexpected error occurred while executing tool ${name}`
    );
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Semrush MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error during server startup:', error);
  process.exit(1);
});