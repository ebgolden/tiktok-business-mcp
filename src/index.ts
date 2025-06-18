#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosError } from "axios";
import { z } from "zod";

// Base TikTok Business API configuration
const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";
const TIKTOK_AUTH_BASE = "https://business-api.tiktok.com/open_api/v1.3/oauth2";

// Load credentials from environment variables (secure approach)
const TIKTOK_APP_ID = process.env.TIKTOK_APP_ID;
const TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET; 
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const TIKTOK_REFRESH_TOKEN = process.env.TIKTOK_REFRESH_TOKEN;
const DEFAULT_ADVERTISER_ID = process.env.TIKTOK_ADVERTISER_ID;

// Validate required environment variables
if (!TIKTOK_ACCESS_TOKEN) {
  console.error("❌ TIKTOK_ACCESS_TOKEN environment variable is required");
  console.error("💡 Set up your credentials:");
  console.error("   export TIKTOK_ACCESS_TOKEN='your_long_term_token'");
  console.error("   export TIKTOK_ADVERTISER_ID='your_advertiser_id'");
  console.error("   export TIKTOK_APP_ID='your_app_id' (optional, for refresh)");
  console.error("   export TIKTOK_APP_SECRET='your_app_secret' (optional, for refresh)");
  process.exit(1);
}

// Token refresh functionality for long-term tokens
async function refreshAccessToken() {
  if (!TIKTOK_APP_ID || !TIKTOK_APP_SECRET || !TIKTOK_REFRESH_TOKEN) {
    throw new Error("Cannot refresh token: Missing app credentials or refresh token");
  }

  try {
    const response = await axios.post(`${TIKTOK_AUTH_BASE}/access_token/`, {
      app_id: TIKTOK_APP_ID,
      secret: TIKTOK_APP_SECRET,
      auth_code: TIKTOK_REFRESH_TOKEN,
      grant_type: "authorization_code"
    });

    if (response.data.code === 0) {
      // In a production environment, you'd want to update your stored credentials
      console.log("✅ Access token refreshed successfully");
      return response.data.data.access_token;
    } else {
      throw new Error(`Token refresh failed: ${response.data.message}`);
    }
  } catch (error) {
    console.error("❌ Failed to refresh access token:", error.message);
    throw error;
  }
}

// Common schemas for validation (no longer require tokens in prompts)
const AdvertiserIdSchema = z.string().min(1, "Advertiser ID is required").optional();
const CampaignIdSchema = z.string().min(1, "Campaign ID is required");
const AdGroupIdSchema = z.string().min(1, "Ad Group ID is required");
const AdIdSchema = z.string().min(1, "Ad ID is required");

// Pagination schema
const PaginationSchema = z.object({
  page: z.number().min(1).optional().default(1),
  page_size: z.number().min(1).max(1000).optional().default(10),
});

// Helper function to make TikTok API requests (using stored credentials)
async function makeTikTokRequest(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  data?: any,
  params?: any,
  retryRefresh: boolean = true
) {
  try {
    const config = {
      method,
      url: `${TIKTOK_API_BASE}${endpoint}`,
      headers: {
        "Access-Token": TIKTOK_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      ...(data && { data }),
      ...(params && { params }),
    };

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      // If token expired and we can refresh, try once
      if (error.response?.status === 401 && retryRefresh && TIKTOK_REFRESH_TOKEN) {
        try {
          await refreshAccessToken();
          return makeTikTokRequest(endpoint, method, data, params, false);
        } catch (refreshError) {
          throw new McpError(
            ErrorCode.InternalError,
            `TikTok API authentication failed and token refresh failed: ${refreshError.message}`
          );
        }
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `TikTok API error: ${error.response?.data?.message || error.message}`
      );
    }
    throw error;
  }
}

// MCP Server setup
const server = new Server(
  {
    name: "tiktok-business-api-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions with comprehensive TikTok Business API coverage
const tools = [
  // MARKETING API - Campaign Management
  {
    name: "tiktok_campaign_create",
    description: "Create a new TikTok advertising campaign",
    inputSchema: {
      type: "object",
      properties: {
        advertiser_id: { 
          type: "string", 
          description: "Advertiser account ID (optional if set in environment)" 
        },
        campaign_name: { type: "string", description: "Name of the campaign" },
        objective_type: { 
          type: "string", 
          enum: ["REACH", "TRAFFIC", "APP_INSTALL", "VIDEO_VIEW", "CONVERSIONS", "LEAD_GENERATION"],
          description: "Campaign objective type"
        },
        budget: { type: "number", description: "Campaign budget amount" },
        budget_mode: { 
          type: "string", 
          enum: ["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL"],
          description: "Budget mode (daily or total)"
        },
        app_promotion_type: { 
          type: "string", 
          enum: ["APP_INSTALL", "APP_RETARGETING"],
          description: "App promotion type (required for APP_INSTALL objective)"
        }
      },
      required: ["campaign_name", "objective_type", "budget", "budget_mode"]
    }
  },
  {
    name: "tiktok_campaign_get",
    description: "Get campaign information by advertiser ID",
    inputSchema: {
      type: "object",
      properties: {
        advertiser_id: { 
          type: "string", 
          description: "Advertiser account ID (optional if set in environment)" 
        },
        campaign_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Optional array of specific campaign IDs to retrieve"
        },
        campaign_name: { type: "string", description: "Filter by campaign name" },
        objective_type: { type: "string", description: "Filter by objective type" },
        primary_status: { type: "string", description: "Filter by primary status" },
        page: { type: "number", description: "Page number for pagination" },
        page_size: { type: "number", description: "Number of results per page" }
      },
      required: []
    }
  },
  {
    name: "tiktok_campaign_update",
    description: "Update an existing campaign",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        campaign_id: { type: "string", description: "Campaign ID to update" },
        campaign_name: { type: "string", description: "New campaign name" },
        budget: { type: "number", description: "New budget amount" },
        budget_mode: { type: "string", description: "New budget mode" }
      },
      required: ["access_token", "advertiser_id", "campaign_id"]
    }
  },
  {
    name: "tiktok_campaign_status_update",
    description: "Update campaign status (enable/disable/delete)",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        campaign_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Array of campaign IDs to update"
        },
        operation_status: { 
          type: "string", 
          enum: ["ENABLE", "DISABLE", "DELETE"],
          description: "Operation to perform"
        }
      },
      required: ["access_token", "advertiser_id", "campaign_ids", "operation_status"]
    }
  },

  // MARKETING API - Ad Group Management
  {
    name: "tiktok_adgroup_create",
    description: "Create a new ad group within a campaign",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        campaign_id: { type: "string", description: "Parent campaign ID" },
        adgroup_name: { type: "string", description: "Name of the ad group" },
        placement_type: { 
          type: "string", 
          enum: ["PLACEMENT_TYPE_AUTOMATIC", "PLACEMENT_TYPE_MANUAL"],
          description: "Placement type"
        },
        placements: { 
          type: "array", 
          items: { type: "string" },
          description: "Array of placement IDs for manual placement"
        },
        target_audience_settings: {
          type: "object",
          description: "Targeting settings including demographics, interests, etc."
        },
        budget: { type: "number", description: "Ad group budget" },
        schedule_type: { 
          type: "string", 
          enum: ["SCHEDULE_START_END", "SCHEDULE_FROM_NOW"],
          description: "Schedule type"
        },
        schedule_start_time: { type: "string", description: "Start time (YYYY-MM-DD HH:mm:ss)" },
        schedule_end_time: { type: "string", description: "End time (YYYY-MM-DD HH:mm:ss)" }
      },
      required: ["access_token", "advertiser_id", "campaign_id", "adgroup_name", "placement_type"]
    }
  },
  {
    name: "tiktok_adgroup_get",
    description: "Get ad group information",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        campaign_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Filter by campaign IDs"
        },
        adgroup_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Filter by specific ad group IDs"
        },
        page: { type: "number", description: "Page number for pagination" },
        page_size: { type: "number", description: "Number of results per page" }
      },
      required: ["access_token", "advertiser_id"]
    }
  },

  // MARKETING API - Ad Management
  {
    name: "tiktok_ad_create",
    description: "Create a new ad within an ad group",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        adgroup_id: { type: "string", description: "Parent ad group ID" },
        ad_name: { type: "string", description: "Name of the ad" },
        ad_format: { 
          type: "string", 
          enum: ["SINGLE_VIDEO", "SINGLE_IMAGE", "CAROUSEL", "SPARK_AD"],
          description: "Ad format type"
        },
        ad_text: { type: "string", description: "Ad text/copy" },
        call_to_action: { 
          type: "string", 
          description: "Call to action button text"
        },
        creative_material_mode: { 
          type: "string", 
          enum: ["CUSTOM", "DYNAMIC"],
          description: "Creative material mode"
        },
        video_id: { type: "string", description: "Video creative ID" },
        image_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Array of image creative IDs"
        },
        landing_page_url: { type: "string", description: "Landing page URL" },
        display_name: { type: "string", description: "Display name for the ad" }
      },
      required: ["access_token", "advertiser_id", "adgroup_id", "ad_name", "ad_format"]
    }
  },
  {
    name: "tiktok_ad_get",
    description: "Get ad information",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        campaign_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Filter by campaign IDs"
        },
        adgroup_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Filter by ad group IDs"
        },
        ad_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Filter by specific ad IDs"
        },
        page: { type: "number", description: "Page number for pagination" },
        page_size: { type: "number", description: "Number of results per page" }
      },
      required: ["access_token", "advertiser_id"]
    }
  },

  // MARKETING API - Creative Management
  {
    name: "tiktok_video_upload",
    description: "Upload a video creative for ads",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        video_file: { type: "string", description: "Video file path or URL" },
        video_signature: { type: "string", description: "MD5 hash of the video file" },
        video_size: { type: "number", description: "Video file size in bytes" },
        video_name: { type: "string", description: "Name for the video creative" },
        upload_type: { 
          type: "string", 
          enum: ["UPLOAD_BY_FILE", "UPLOAD_BY_URL"],
          description: "Upload method"
        }
      },
      required: ["access_token", "advertiser_id", "video_file", "upload_type"]
    }
  },
  {
    name: "tiktok_image_upload",
    description: "Upload an image creative for ads",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        image_file: { type: "string", description: "Image file path or URL" },
        image_signature: { type: "string", description: "MD5 hash of the image file" },
        image_size: { type: "number", description: "Image file size in bytes" },
        image_name: { type: "string", description: "Name for the image creative" },
        upload_type: { 
          type: "string", 
          enum: ["UPLOAD_BY_FILE", "UPLOAD_BY_URL"],
          description: "Upload method"
        }
      },
      required: ["access_token", "advertiser_id", "image_file", "upload_type"]
    }
  },

  // MARKETING API - Reporting
  {
    name: "tiktok_report_integrated_get",
    description: "Get integrated advertising reports with metrics",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        report_type: { 
          type: "string", 
          enum: ["BASIC", "AUDIENCE", "PLAYABLE_MATERIAL", "RESERVATION"],
          description: "Type of report to generate"
        },
        data_level: { 
          type: "string", 
          enum: ["AUCTION_ADVERTISER", "AUCTION_CAMPAIGN", "AUCTION_ADGROUP", "AUCTION_AD"],
          description: "Level of data aggregation"
        },
        dimensions: { 
          type: "array", 
          items: { type: "string" },
          description: "Dimensions to group by (e.g., stat_time_day, gender, age)"
        },
        metrics: { 
          type: "array", 
          items: { type: "string" },
          description: "Metrics to include (e.g., spend, impressions, clicks, ctr, cpm)"
        },
        start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
        end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
        filters: {
          type: "object",
          description: "Additional filters for campaigns, ad groups, or ads"
        },
        page: { type: "number", description: "Page number for pagination" },
        page_size: { type: "number", description: "Number of results per page" }
      },
      required: ["access_token", "advertiser_id", "report_type", "data_level", "start_date", "end_date"]
    }
  },

  // BUSINESS CENTER API
  {
    name: "tiktok_bc_advertiser_get",
    description: "Get Business Center advertiser accounts",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        bc_id: { type: "string", description: "Business Center ID" },
        page: { type: "number", description: "Page number for pagination" },
        page_size: { type: "number", description: "Number of results per page" }
      },
      required: ["access_token", "bc_id"]
    }
  },
  {
    name: "tiktok_bc_pixel_create",
    description: "Create a tracking pixel in Business Center",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        bc_id: { type: "string", description: "Business Center ID" },
        pixel_name: { type: "string", description: "Name of the pixel" },
        description: { type: "string", description: "Description of the pixel" }
      },
      required: ["access_token", "bc_id", "pixel_name"]
    }
  },
  {
    name: "tiktok_bc_pixel_get",
    description: "Get Business Center pixels",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        bc_id: { type: "string", description: "Business Center ID" },
        pixel_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Optional array of specific pixel IDs to retrieve"
        },
        page: { type: "number", description: "Page number for pagination" },
        page_size: { type: "number", description: "Number of results per page" }
      },
      required: ["access_token", "bc_id"]
    }
  },

  // ACCOUNTS API
  {
    name: "tiktok_account_info_get",
    description: "Get TikTok account information",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" }
      },
      required: ["access_token", "advertiser_id"]
    }
  },
  {
    name: "tiktok_post_create",
    description: "Create and publish content to TikTok account",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        video_id: { type: "string", description: "Video creative ID to post" },
        post_text: { type: "string", description: "Caption text for the post" },
        privacy_level: { 
          type: "string", 
          enum: ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIEND", "SELF_ONLY"],
          description: "Privacy level for the post"
        },
        comment_setting: { 
          type: "string", 
          enum: ["EVERYONE", "FRIENDS", "OFF"],
          description: "Who can comment on the post"
        },
        duet_setting: { 
          type: "string", 
          enum: ["EVERYONE", "FRIENDS", "OFF"],
          description: "Who can duet with the post"
        },
        stitch_setting: { 
          type: "string", 
          enum: ["EVERYONE", "FRIENDS", "OFF"],
          description: "Who can stitch the post"
        }
      },
      required: ["access_token", "advertiser_id", "video_id"]
    }
  },
  {
    name: "tiktok_comment_list",
    description: "Get comments for TikTok posts",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        video_id: { type: "string", description: "Video ID to get comments for" },
        cursor: { type: "string", description: "Pagination cursor" },
        count: { type: "number", description: "Number of comments to retrieve" }
      },
      required: ["access_token", "advertiser_id", "video_id"]
    }
  },

  // CATALOG API
  {
    name: "tiktok_catalog_get",
    description: "Get product catalogs",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        bc_id: { type: "string", description: "Business Center ID" },
        catalog_id: { type: "string", description: "Specific catalog ID (optional)" }
      },
      required: ["access_token", "bc_id"]
    }
  },
  {
    name: "tiktok_catalog_product_upload",
    description: "Upload products to a catalog",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        bc_id: { type: "string", description: "Business Center ID" },
        catalog_id: { type: "string", description: "Catalog ID" },
        products: { 
          type: "array", 
          items: {
            type: "object",
            properties: {
              sku_id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              price: { type: "number" },
              availability: { type: "string" },
              image_url: { type: "string" },
              landing_page_url: { type: "string" }
            }
          },
          description: "Array of product objects to upload"
        }
      },
      required: ["access_token", "bc_id", "catalog_id", "products"]
    }
  },

  // CREATOR MARKETPLACE API
  {
    name: "tiktok_creator_search",
    description: "Search for creators in TikTok Creator Marketplace",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        creator_audience_countries: { 
          type: "array", 
          items: { type: "string" },
          description: "Target audience countries"
        },
        creator_follower_count_min: { type: "number", description: "Minimum follower count" },
        creator_follower_count_max: { type: "number", description: "Maximum follower count" },
        creator_audience_age_groups: { 
          type: "array", 
          items: { type: "string" },
          description: "Target audience age groups"
        },
        creator_audience_genders: { 
          type: "array", 
          items: { type: "string" },
          description: "Target audience genders"
        },
        page: { type: "number", description: "Page number for pagination" },
        page_size: { type: "number", description: "Number of results per page" }
      },
      required: ["access_token", "advertiser_id"]
    }
  },

  // UTILITY/TOOL APIs
  {
    name: "tiktok_tool_language",
    description: "Get supported languages for TikTok advertising",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" }
      },
      required: ["access_token", "advertiser_id"]
    }
  },
  {
    name: "tiktok_tool_region",
    description: "Get supported regions/countries for targeting",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        placements: { 
          type: "array", 
          items: { type: "string" },
          description: "Placement types to get regions for"
        }
      },
      required: ["access_token", "advertiser_id"]
    }
  },
  {
    name: "tiktok_tool_interest_category",
    description: "Get interest categories for audience targeting",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        placements: { 
          type: "array", 
          items: { type: "string" },
          description: "Placement types to get interests for"
        },
        special_industries: { 
          type: "array", 
          items: { type: "string" },
          description: "Special industry categories"
        }
      },
      required: ["access_token", "advertiser_id"]
    }
  },
  {
    name: "tiktok_trending_hashtags",
    description: "Get trending hashtags for content inspiration",
    inputSchema: {
      type: "object",
      properties: {
        access_token: { type: "string", description: "TikTok API access token" },
        advertiser_id: { type: "string", description: "Advertiser account ID" },
        country_code: { type: "string", description: "Country code for localized trends" },
        industry: { type: "string", description: "Industry vertical for relevant hashtags" }
      },
      required: ["access_token", "advertiser_id"]
    }
  }
];

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Campaign Management
      case "tiktok_campaign_create": {
        const validated = z.object({
          advertiser_id: AdvertiserIdSchema.default(DEFAULT_ADVERTISER_ID),
          campaign_name: z.string(),
          objective_type: z.enum(["REACH", "TRAFFIC", "APP_INSTALL", "VIDEO_VIEW", "CONVERSIONS", "LEAD_GENERATION"]),
          budget: z.number(),
          budget_mode: z.enum(["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL"]),
          app_promotion_type: z.enum(["APP_INSTALL", "APP_RETARGETING"]).optional(),
        }).parse(args);

        if (!validated.advertiser_id) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Advertiser ID is required. Set TIKTOK_ADVERTISER_ID environment variable or provide advertiser_id parameter."
          );
        }

        const result = await makeTikTokRequest(
          "/campaign/create/",
          "POST",
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_campaign_get": {
        const validated = z.object({
          advertiser_id: AdvertiserIdSchema.default(DEFAULT_ADVERTISER_ID),
          campaign_ids: z.array(z.string()).optional(),
          campaign_name: z.string().optional(),
          objective_type: z.string().optional(),
          primary_status: z.string().optional(),
          ...PaginationSchema.shape,
        }).parse(args);

        if (!validated.advertiser_id) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Advertiser ID is required. Set TIKTOK_ADVERTISER_ID environment variable or provide advertiser_id parameter."
          );
        }

        const result = await makeTikTokRequest(
          "/campaign/get/",
          "GET",
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_campaign_update": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          campaign_id: CampaignIdSchema,
          campaign_name: z.string().optional(),
          budget: z.number().optional(),
          budget_mode: z.string().optional(),
        }).parse(args);

        const result = await makeTikTokRequest(
          "/campaign/update/",
          "POST",
          validated.access_token,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_campaign_status_update": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          campaign_ids: z.array(z.string()),
          operation_status: z.enum(["ENABLE", "DISABLE", "DELETE"]),
        }).parse(args);

        const result = await makeTikTokRequest(
          "/campaign/status/update/",
          "POST",
          validated.access_token,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // Ad Group Management
      case "tiktok_adgroup_create": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          campaign_id: CampaignIdSchema,
          adgroup_name: z.string(),
          placement_type: z.enum(["PLACEMENT_TYPE_AUTOMATIC", "PLACEMENT_TYPE_MANUAL"]),
          placements: z.array(z.string()).optional(),
          target_audience_settings: z.object({}).optional(),
          budget: z.number().optional(),
          schedule_type: z.enum(["SCHEDULE_START_END", "SCHEDULE_FROM_NOW"]).optional(),
          schedule_start_time: z.string().optional(),
          schedule_end_time: z.string().optional(),
        }).parse(args);

        const result = await makeTikTokRequest(
          "/adgroup/create/",
          "POST",
          validated.access_token,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_adgroup_get": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          campaign_ids: z.array(z.string()).optional(),
          adgroup_ids: z.array(z.string()).optional(),
          ...PaginationSchema.shape,
        }).parse(args);

        const result = await makeTikTokRequest(
          "/adgroup/get/",
          "GET",
          validated.access_token,
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // Ad Management
      case "tiktok_ad_create": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          adgroup_id: AdGroupIdSchema,
          ad_name: z.string(),
          ad_format: z.enum(["SINGLE_VIDEO", "SINGLE_IMAGE", "CAROUSEL", "SPARK_AD"]),
          ad_text: z.string().optional(),
          call_to_action: z.string().optional(),
          creative_material_mode: z.enum(["CUSTOM", "DYNAMIC"]).optional(),
          video_id: z.string().optional(),
          image_ids: z.array(z.string()).optional(),
          landing_page_url: z.string().optional(),
          display_name: z.string().optional(),
        }).parse(args);

        const result = await makeTikTokRequest(
          "/ad/create/",
          "POST",
          validated.access_token,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_ad_get": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          campaign_ids: z.array(z.string()).optional(),
          adgroup_ids: z.array(z.string()).optional(),
          ad_ids: z.array(z.string()).optional(),
          ...PaginationSchema.shape,
        }).parse(args);

        const result = await makeTikTokRequest(
          "/ad/get/",
          "GET",
          validated.access_token,
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // Creative Management
      case "tiktok_video_upload": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          video_file: z.string(),
          video_signature: z.string().optional(),
          video_size: z.number().optional(),
          video_name: z.string().optional(),
          upload_type: z.enum(["UPLOAD_BY_FILE", "UPLOAD_BY_URL"]),
        }).parse(args);

        const result = await makeTikTokRequest(
          "/file/video/ad/upload/",
          "POST",
          validated.access_token,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_image_upload": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          image_file: z.string(),
          image_signature: z.string().optional(),
          image_size: z.number().optional(),
          image_name: z.string().optional(),
          upload_type: z.enum(["UPLOAD_BY_FILE", "UPLOAD_BY_URL"]),
        }).parse(args);

        const result = await makeTikTokRequest(
          "/file/image/ad/upload/",
          "POST",
          validated.access_token,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // Reporting
      case "tiktok_report_integrated_get": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          report_type: z.enum(["BASIC", "AUDIENCE", "PLAYABLE_MATERIAL", "RESERVATION"]),
          data_level: z.enum(["AUCTION_ADVERTISER", "AUCTION_CAMPAIGN", "AUCTION_ADGROUP", "AUCTION_AD"]),
          dimensions: z.array(z.string()).optional(),
          metrics: z.array(z.string()).optional(),
          start_date: z.string(),
          end_date: z.string(),
          filters: z.object({}).optional(),
          ...PaginationSchema.shape,
        }).parse(args);

        const result = await makeTikTokRequest(
          "/report/integrated/get/",
          "GET",
          validated.access_token,
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // Business Center APIs
      case "tiktok_bc_advertiser_get": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          bc_id: z.string(),
          ...PaginationSchema.shape,
        }).parse(args);

        const result = await makeTikTokRequest(
          "/bc/advertiser/get/",
          "GET",
          validated.access_token,
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_bc_pixel_create": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          bc_id: z.string(),
          pixel_name: z.string(),
          description: z.string().optional(),
        }).parse(args);

        const result = await makeTikTokRequest(
          "/bc/pixel/create/",
          "POST",
          validated.access_token,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_bc_pixel_get": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          bc_id: z.string(),
          pixel_ids: z.array(z.string()).optional(),
          ...PaginationSchema.shape,
        }).parse(args);

        const result = await makeTikTokRequest(
          "/bc/pixel/get/",
          "GET",
          validated.access_token,
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // Account APIs
      case "tiktok_account_info_get": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
        }).parse(args);

        const result = await makeTikTokRequest(
          "/advertiser/info/",
          "GET",
          validated.access_token,
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // Utility Tools
      case "tiktok_tool_language": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
        }).parse(args);

        const result = await makeTikTokRequest(
          "/tool/language/",
          "GET",
          validated.access_token,
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_tool_region": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          placements: z.array(z.string()).optional(),
        }).parse(args);

        const result = await makeTikTokRequest(
          "/tool/region/",
          "GET",
          validated.access_token,
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "tiktok_tool_interest_category": {
        const validated = z.object({
          access_token: AccessTokenSchema,
          advertiser_id: AdvertiserIdSchema,
          placements: z.array(z.string()).optional(),
          special_industries: z.array(z.string()).optional(),
        }).parse(args);

        const result = await makeTikTokRequest(
          "/tool/interest_category/",
          "GET",
          validated.access_token,
          null,
          validated
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // Note: Some endpoints like trending hashtags, creator search, etc. 
      // may require different API bases or additional authentication
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.issues.map(i => i.message).join(", ")}`
      );
    }
    throw error;
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TikTok Business API MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});