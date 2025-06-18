# TikTok Business API MCP Server

A comprehensive Model Context Protocol (MCP) server that provides tools for interacting with TikTok's Business APIs. This server enables programmatic access to TikTok's advertising platform, business center, account management, creator marketplace, and more.

## Features

This MCP server provides access to the following TikTok Business API categories:

### 🎯 Marketing API
- **Campaign Management**: Create, read, update, and manage advertising campaigns
- **Ad Group Management**: Manage ad groups within campaigns
- **Ad Management**: Create and manage individual ads
- **Creative Management**: Upload and manage video/image creatives
- **Reporting**: Generate comprehensive advertising reports and analytics

### 🏢 Business Center API
- **Account Management**: Manage Business Center advertiser accounts
- **Pixel Management**: Create and manage tracking pixels
- **Transaction Management**: Handle business center transactions

### 👤 Accounts API
- **Account Information**: Get account details and insights
- **Content Publishing**: Publish content to TikTok accounts
- **Comment Management**: Manage comments on posts

### 🎨 Creator Marketplace API
- **Creator Discovery**: Search and find creators for collaborations
- **Campaign Management**: Manage creator campaigns

### 🛍️ Catalog API
- **Product Management**: Upload and manage product catalogs
- **Feed Management**: Handle product feeds

### 🔧 Utility APIs
- **Targeting Tools**: Get supported languages, regions, and interest categories
- **Trending Content**: Access trending hashtags and content insights

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd tiktok-business-api-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Getting TikTok API Access

1. **Create a TikTok for Business Developer Account**
   - Visit [TikTok for Business Developer Portal](https://ads.tiktok.com/marketing_api/docs)
   - Create an account and register your application

2. **Get API Credentials**
   - Obtain your App ID and App Secret
   - Set up OAuth2 flow to get access tokens
   - Configure redirect URLs for your application

3. **Authentication Flow**
   - Direct users to TikTok's authorization URL
   - Exchange authorization codes for access tokens
   - Use access tokens with the MCP tools

### MCP Client Setup

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "tiktok-business-api": {
      "command": "node",
      "args": ["path/to/tiktok-business-api-mcp/dist/index.js"]
    }
  }
}
```

## Usage Examples

### Campaign Management

#### Create a Campaign
```javascript
{
  "tool": "tiktok_campaign_create",
  "arguments": {
    "access_token": "your_access_token",
    "advertiser_id": "your_advertiser_id",
    "campaign_name": "Holiday Sales Campaign",
    "objective_type": "CONVERSIONS",
    "budget": 1000.00,
    "budget_mode": "BUDGET_MODE_TOTAL"
  }
}
```

#### Get Campaign Information
```javascript
{
  "tool": "tiktok_campaign_get",
  "arguments": {
    "access_token": "your_access_token",
    "advertiser_id": "your_advertiser_id",
    "page": 1,
    "page_size": 20
  }
}
```

### Creative Management

#### Upload a Video Creative
```javascript
{
  "tool": "tiktok_video_upload",
  "arguments": {
    "access_token": "your_access_token",
    "advertiser_id": "your_advertiser_id",
    "video_file": "https://example.com/video.mp4",
    "upload_type": "UPLOAD_BY_URL",
    "video_name": "Product Demo Video"
  }
}
```

### Reporting

#### Generate Performance Report
```javascript
{
  "tool": "tiktok_report_integrated_get",
  "arguments": {
    "access_token": "your_access_token",
    "advertiser_id": "your_advertiser_id",
    "report_type": "BASIC",
    "data_level": "AUCTION_CAMPAIGN",
    "dimensions": ["stat_time_day"],
    "metrics": ["spend", "impressions", "clicks", "ctr", "cpm"],
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }
}
```

### Business Center Management

#### Create a Tracking Pixel
```javascript
{
  "tool": "tiktok_bc_pixel_create",
  "arguments": {
    "access_token": "your_access_token",
    "bc_id": "your_business_center_id",
    "pixel_name": "Website Conversion Pixel",
    "description": "Tracks conversions on our e-commerce site"
  }
}
```

### Utility Tools

#### Get Supported Languages
```javascript
{
  "tool": "tiktok_tool_language",
  "arguments": {
    "access_token": "your_access_token",
    "advertiser_id": "your_advertiser_id"
  }
}
```

#### Get Interest Categories for Targeting
```javascript
{
  "tool": "tiktok_tool_interest_category",
  "arguments": {
    "access_token": "your_access_token",
    "advertiser_id": "your_advertiser_id",
    "placements": ["PLACEMENT_TIKTOK"]
  }
}
```

## Available Tools

| Tool Name | Description | API Category |
|-----------|-------------|--------------|
| `tiktok_campaign_create` | Create a new advertising campaign | Marketing |
| `tiktok_campaign_get` | Get campaign information | Marketing |
| `tiktok_campaign_update` | Update existing campaign | Marketing |
| `tiktok_campaign_status_update` | Enable/disable/delete campaigns | Marketing |
| `tiktok_adgroup_create` | Create ad group within campaign | Marketing |
| `tiktok_adgroup_get` | Get ad group information | Marketing |
| `tiktok_ad_create` | Create new ad within ad group | Marketing |
| `tiktok_ad_get` | Get ad information | Marketing |
| `tiktok_video_upload` | Upload video creative | Marketing |
| `tiktok_image_upload` | Upload image creative | Marketing |
| `tiktok_report_integrated_get` | Generate advertising reports | Marketing |
| `tiktok_bc_advertiser_get` | Get Business Center advertisers | Business Center |
| `tiktok_bc_pixel_create` | Create tracking pixel | Business Center |
| `tiktok_bc_pixel_get` | Get pixel information | Business Center |
| `tiktok_account_info_get` | Get account information | Accounts |
| `tiktok_post_create` | Create and publish content | Accounts |
| `tiktok_comment_list` | Get comments for posts | Accounts |
| `tiktok_catalog_get` | Get product catalogs | Catalog |
| `tiktok_catalog_product_upload` | Upload products to catalog | Catalog |
| `tiktok_creator_search` | Search for creators | Creator Marketplace |
| `tiktok_tool_language` | Get supported languages | Utility |
| `tiktok_tool_region` | Get supported regions | Utility |
| `tiktok_tool_interest_category` | Get interest categories | Utility |
| `tiktok_trending_hashtags` | Get trending hashtags | Utility |

## Authentication

All tools require a valid TikTok API access token. The authentication flow typically involves:

1. **OAuth2 Authorization**: Direct users to TikTok's OAuth endpoint
2. **Code Exchange**: Exchange authorization code for access token
3. **Token Usage**: Include access token in tool calls

### Access Token Management

- Access tokens have limited lifespans
- Implement token refresh logic for long-running applications
- Store tokens securely and never expose them in client-side code

## Error Handling

The server provides comprehensive error handling for:

- **Invalid Parameters**: Validation errors with detailed messages
- **API Errors**: TikTok API response errors with context
- **Authentication Errors**: Token validation and expiration issues
- **Rate Limiting**: API rate limit exceeded errors

## Rate Limits

TikTok Business APIs have rate limits that vary by endpoint:

- **Standard APIs**: Typically 200-1000 requests per hour
- **Reporting APIs**: Lower limits due to computational requirements
- **Upload APIs**: File size and frequency limitations

Monitor your usage and implement appropriate retry logic.

## Best Practices

### 1. Authentication Security
- Store access tokens securely
- Implement token rotation
- Use HTTPS for all API calls

### 2. Error Handling
- Implement retry logic for transient errors
- Log API responses for debugging
- Handle rate limiting gracefully

### 3. Performance Optimization
- Use batch operations when available
- Implement caching for frequently accessed data
- Optimize image/video uploads

### 4. Campaign Management
- Start with small test campaigns
- Monitor performance metrics regularly
- Use A/B testing for creative optimization

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify access token validity
   - Check token scopes and permissions
   - Ensure correct advertiser ID

2. **API Errors**
   - Check parameter validation
   - Verify required fields are provided
   - Review TikTok API documentation for endpoint-specific requirements

3. **Rate Limiting**
   - Implement exponential backoff
   - Monitor API usage dashboard
   - Consider upgrading API tier if needed

### Debug Mode

Enable detailed logging by setting environment variables:
```bash
DEBUG=true node dist/index.js
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For TikTok API-specific issues:
- [TikTok Business API Documentation](https://ads.tiktok.com/marketing_api/docs)
- [TikTok Developer Support](https://ads.tiktok.com/help/)

For MCP-specific issues:
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Open an issue](https://github.com/your-repo/issues)

## Changelog

### v1.0.0
- Initial release with comprehensive TikTok Business API coverage
- Support for Marketing, Business Center, Accounts, Creator Marketplace, and Catalog APIs
- Full TypeScript implementation with input validation
- Comprehensive error handling and documentation
