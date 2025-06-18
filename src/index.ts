#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { z } from "zod";

// Types and Interfaces
interface TikTokConfig {
  accessToken: string;
  advertiserId: string;
  appId?: string;
  appSecret?: string;
  apiBaseUrl: string;
  rateLimitRpm: number;
}

interface RateLimiter {
  requests: number[];
  maxRequests: number;
  windowMs: number;
}

interface APIResponse<T = any> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

// Validation Schemas
const BaseToolSchema = z.object({
  access_token: z.string().optional(),
  advertiser_id: z.string().optional(),
});

const CampaignCreateSchema = BaseToolSchema.extend({
  campaign_name: z.string().min(1).max(512),
  objective_type: z.enum(['REACH', 'TRAFFIC', 'APP_INSTALL', 'VIDEO_VIEW', 'LEAD_GENERATION', 'CONVERSIONS', 'CATALOG_SALES']),
  budget: z.number().positive(),
  budget_mode: z.enum(['BUDGET_MODE_DAY', 'BUDGET_MODE_TOTAL']),
  schedule_type: z.enum(['SCHEDULE_FROM_NOW', 'SCHEDULE_START_END']).default('SCHEDULE_FROM_NOW'),
  schedule_start_time: z.string().optional(),
  schedule_end_time: z.string().optional(),
});

const CampaignGetSchema = BaseToolSchema.extend({
  campaign_ids: z.array(z.string()).optional(),
  page: z.number().int().positive().default(1),
  page_size: z.number().int().min(1).max(1000).default(20),
  filtering: z.object({
    campaign_name: z.string().optional(),
    primary_status: z.enum(['ENABLE', 'DISABLE', 'DELETE']).optional(),
    objective_type: z.string().optional(),
  }).optional(),
});

const VideoUploadSchema = BaseToolSchema.extend({
  video_file: z.string().url().or(z.string().min(1)), // URL or base64
  upload_type: z.enum(['UPLOAD_BY_FILE', 'UPLOAD_BY_URL', 'UPLOAD_BY_FILE_ID']),
  video_name: z.string().min(1).max(100),
  flaw_detect: z.boolean().default(true),
  auto_bind_enabled: z.boolean().default(true),
  auto_fix_enabled: z.boolean().default(true),
});

const ReportSchema = BaseToolSchema.extend({
  report_type: z.enum(['BASIC', 'AUDIENCE', 'PLAYABLE_REPORT']),
  data_level: z.enum(['AUCTION_ADVERTISER', 'AUCTION_CAMPAIGN', 'AUCTION_ADGROUP', 'AUCTION_AD']),
  dimensions: z.array(z.string()).min(1),
  metrics: z.array(z.string()).min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  filters: z.array(z.object({
    field_name: z.string(),
    filter_type: z.enum(['IN', 'EQUALS', 'GREATER_THAN', 'LESS_THAN']),
    filter_value: z.union([z.string(), z.array(z.string())]),
  })).optional(),
  page: z.number().int().positive().default(1),
  page_size: z.number().int().min(1).max(1000).default(20,
});

// Enhanced Logger
class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...(data && { data }),
    };
    console.error(JSON.stringify(logEntry));
  }

  info(message: string, data?: any) {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: any) {
    this.log('WARN', message, data);
  }

  error(message: string, error?: any) {
    this.log('ERROR', message, error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error);
  }

  debug(message: string, data?: any) {
    if (process.env.DEBUG === 'true') {
      this.log('DEBUG', message, data);
    }
  }
}

// Rate Limiter Implementation
class SimpleRateLimiter {
  private requests: number[] = [];
  
  constructor(
    private maxRequests: number = 200,
    private windowMs: number = 60 * 60 * 1000 // 1 hour
  ) {}

  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    // Remove requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }

  async waitForAvailability(): Promise<void> {
    while (!(await this.checkLimit())) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = oldestRequest + this.windowMs - Date.now();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 1000)));
      }
    }
  }
}

// Enhanced TikTok API Client
class TikTokAPIClient {
  private config: TikTokConfig;
  private rateLimiter: SimpleRateLimiter;
  private logger: Logger;

  constructor(config: TikTokConfig) {
    this.config = config;
    this.rateLimiter = new SimpleRateLimiter(config.rateLimitRpm);
    this.logger = new Logger('TikTokAPIClient');
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    customConfig?: Partial<AxiosRequestConfig>
  ): Promise<T> {
    await this.rateLimiter.waitForAvailability();

    const url = `${this.config.apiBaseUrl}${endpoint}`;
    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        'Access-Token': this.config.accessToken,
        'Content-Type': 'application/json',
        'User-Agent': 'TikTok-Business-MCP-Server/1.0.0',
      },
      timeout: 30000,
      ...customConfig,
    };

    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    try {
      this.logger.debug(`Making ${method} request to ${endpoint}`, { data });
      const response = await axios(config);
      
      const apiResponse: APIResponse<T> = response.data;
      
      if (apiResponse.code !== 0) {
        throw new McpError(
          ErrorCode.InternalError,
          `TikTok API error: ${apiResponse.message} (Code: ${apiResponse.code})`
        );
      }

      this.logger.debug(`Request successful`, { request_id: apiResponse.request_id });
      return apiResponse.data;
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.response?.status === 429) {
          this.logger.warn('Rate limit exceeded, waiting before retry');
          await new Promise(resolve => setTimeout(resolve, 5000));
          return this.makeRequest(method, endpoint, data, customConfig);
        }

        if (axiosError.response?.status === 401) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Authentication failed. Please check your access token.'
          );
        }

        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        this.logger.error(`API request failed`, {
          status: axiosError.response?.status,
          message: errorMessage,
          url
        });

        throw new McpError(
          ErrorCode.InternalError,
          `API request failed: ${errorMessage}`
        );
      }

      this.logger.error('Unexpected error during API request', error);
      throw new McpError(ErrorCode.InternalError, 'Unexpected error occurred');
    }
  }

  // Campaign Management
  async createCampaign(params: z.infer<typeof CampaignCreateSchema>) {
    const requestData = {
      advertiser_id: params.advertiser_id || this.config.advertiserId,
      campaign_name: params.campaign_name,
      objective_type: params.objective_type,
      budget: params.budget,
      budget_mode: params.budget_mode,
      schedule_type: params.schedule_type,
      ...(params.schedule_start_time && { schedule_start_time: params.schedule_start_time }),
      ...(params.schedule_end_time && { schedule_end_time: params.schedule_end_time }),
    };

    return this.makeRequest('POST', '/open_api/v1.3/campaign/create/', requestData);
  }

  async getCampaigns(params: z.infer<typeof CampaignGetSchema>) {
    const requestData = {
      advertiser_id: params.advertiser_id || this.config.advertiserId,
      page: params.page,
      page_size: params.page_size,
      ...(params.campaign_ids && { campaign_ids: params.campaign_ids }),
      ...(params.filtering && { filtering: params.filtering }),
    };

    return this.makeRequest('GET', '/open_api/v1.3/campaign/get/', requestData);
  }

  // Creative Management
  async uploadVideo(params: z.infer<typeof VideoUploadSchema>) {
    const requestData = {
      advertiser_id: params.advertiser_id || this.config.advertiserId,
      upload_type: params.upload_type,
      video_name: params.video_name,
      flaw_detect: params.flaw_detect,
      auto_bind_enabled: params.auto_bind_enabled,
      auto_fix_enabled: params.auto_fix_enabled,
    };

    if (params.upload_type === 'UPLOAD_BY_URL') {
      requestData.video_url = params.video_file;
    } else if (params.upload_type === 'UPLOAD_BY_FILE_ID') {
      requestData.video_id = params.video_file;
    }

    return this.makeRequest('POST', '/open_api/v1.3/file/video/upload/', requestData);
  }

  // Reporting
  async getReport(params: z.infer<typeof ReportSchema>) {
    const requestData = {
      advertiser_id: params.advertiser_id || this.config.advertiserId,
      report_type: params.report_type,
      data_level: params.data_level,
      dimensions: params.dimensions,
      metrics: params.metrics,
      start_date: params.start_date,
      end_date: params.end_date,
      page: params.page,
      page_size: params.page_size,
      ...(params.filters && { filters: params.filters }),
    };

    return this.makeRequest('GET', '/open_api/v1.3/report/integrated/get/', requestData);
  }
}

// Configuration and Initialization
function loadConfig(): TikTokConfig {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;

  if (!accessToken) {
    throw new Error('TIKTOK_ACCESS_TOKEN environment variable is required');
  }

  if (!advertiserId) {
    throw new Error('TIKTOK_ADVERTISER_ID environment variable is required');
  }

  return {
    accessToken,
    advertiserId,
    appId: process.env.TIKTOK_APP_ID,
    appSecret: process.env.TIKTOK_APP_SECRET,
    apiBaseUrl: process.env.TIKTOK_API_BASE_URL || 'https://business-api.tiktok.com',
    rateLimitRpm: parseInt(process.env.TIKTOK_RATE_LIMIT_RPM || '200'),
  };
}

// Main Server Implementation
async function main() {
  const logger = new Logger('TikTokMCPServer');
  
  try {
    const config = loadConfig();
    const apiClient = new TikTokAPIClient(config);
    
    const server = new Server(
      {
        name: "tiktok-business-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Tool Definitions
    const tools = [
      {
        name: "tiktok_campaign_create",
        description: "Create a new TikTok advertising campaign",
        inputSchema: {
          type: "object",
          properties: {
            campaign_name: { type: "string", description: "Campaign name (1-512 characters)" },
            objective_type: { 
              type: "string", 
              enum: ['REACH', 'TRAFFIC', 'APP_INSTALL', 'VIDEO_VIEW', 'LEAD_GENERATION', 'CONVERSIONS', 'CATALOG_SALES'],
              description: "Campaign objective" 
            },
            budget: { type: "number", minimum: 0.01, description: "Campaign budget" },
            budget_mode: { 
              type: "string", 
              enum: ['BUDGET_MODE_DAY', 'BUDGET_MODE_TOTAL'],
              description: "Budget allocation mode" 
            },
            schedule_type: { 
              type: "string", 
              enum: ['SCHEDULE_FROM_NOW', 'SCHEDULE_START_END'],
              description: "Campaign scheduling type" 
            },
            schedule_start_time: { type: "string", description: "Start time (YYYY-MM-DD HH:mm:ss)" },
            schedule_end_time: { type: "string", description: "End time (YYYY-MM-DD HH:mm:ss)" },
          },
          required: ["campaign_name", "objective_type", "budget", "budget_mode"],
        },
      },
      {
        name: "tiktok_campaign_get",
        description: "Retrieve campaign information with filtering and pagination",
        inputSchema: {
          type: "object",
          properties: {
            campaign_ids: { 
              type: "array", 
              items: { type: "string" },
              description: "Specific campaign IDs to retrieve" 
            },
            page: { type: "number", minimum: 1, default: 1, description: "Page number" },
            page_size: { type: "number", minimum: 1, maximum: 1000, default: 20, description: "Results per page" },
            filtering: {
              type: "object",
              properties: {
                campaign_name: { type: "string", description: "Filter by campaign name" },
                primary_status: { 
                  type: "string", 
                  enum: ['ENABLE', 'DISABLE', 'DELETE'],
                  description: "Filter by campaign status" 
                },
                objective_type: { type: "string", description: "Filter by objective type" },
              },
            },
          },
          required: [],
        },
      },
      {
        name: "tiktok_video_upload",
        description: "Upload video creative for advertising campaigns",
        inputSchema: {
          type: "object",
          properties: {
            video_file: { type: "string", description: "Video URL, file ID, or base64 content" },
            upload_type: { 
              type: "string", 
              enum: ['UPLOAD_BY_FILE', 'UPLOAD_BY_URL', 'UPLOAD_BY_FILE_ID'],
              description: "Upload method" 
            },
            video_name: { type: "string", maxLength: 100, description: "Video name" },
            flaw_detect: { type: "boolean", default: true, description: "Enable flaw detection" },
            auto_bind_enabled: { type: "boolean", default: true, description: "Enable auto-binding" },
            auto_fix_enabled: { type: "boolean", default: true, description: "Enable auto-fix" },
          },
          required: ["video_file", "upload_type", "video_name"],
        },
      },
      {
        name: "tiktok_report_get",
        description: "Generate comprehensive advertising reports and analytics",
        inputSchema: {
          type: "object",
          properties: {
            report_type: { 
              type: "string", 
              enum: ['BASIC', 'AUDIENCE', 'PLAYABLE_REPORT'],
              description: "Report type" 
            },
            data_level: { 
              type: "string", 
              enum: ['AUCTION_ADVERTISER', 'AUCTION_CAMPAIGN', 'AUCTION_ADGROUP', 'AUCTION_AD'],
              description: "Data aggregation level" 
            },
            dimensions: { 
              type: "array", 
              items: { type: "string" },
              description: "Report dimensions (e.g., stat_time_day, campaign_id)" 
            },
            metrics: { 
              type: "array", 
              items: { type: "string" },
              description: "Metrics to include (e.g., spend, impressions, clicks)" 
            },
            start_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "End date (YYYY-MM-DD)" },
            filters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field_name: { type: "string" },
                  filter_type: { type: "string", enum: ['IN', 'EQUALS', 'GREATER_THAN', 'LESS_THAN'] },
                  filter_value: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
                },
                required: ["field_name", "filter_type", "filter_value"],
              },
            },
            page: { type: "number", minimum: 1, default: 1 },
            page_size: { type: "number", minimum: 1, maximum: 1000, default: 20 },
          },
          required: ["report_type", "data_level", "dimensions", "metrics", "start_date", "end_date"],
        },
      },
    ];

    // Register handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools,
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        logger.info(`Executing tool: ${name}`, { args });

        switch (name) {
          case "tiktok_campaign_create": {
            const params = CampaignCreateSchema.parse(args);
            const result = await apiClient.createCampaign(params);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "tiktok_campaign_get": {
            const params = CampaignGetSchema.parse(args);
            const result = await apiClient.getCampaigns(params);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "tiktok_video_upload": {
            const params = VideoUploadSchema.parse(args);
            const result = await apiClient.uploadVideo(params);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "tiktok_report_get": {
            const params = ReportSchema.parse(args);
            const result = await apiClient.getReport(params);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid parameters: ${errorMessage}`
          );
        }

        if (error instanceof McpError) {
          throw error;
        }

        logger.error(`Tool execution failed: ${name}`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('TikTok Business MCP Server started successfully');
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
