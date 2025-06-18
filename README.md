# TikTok Business MCP Server

A comprehensive Model Context Protocol (MCP) server that provides tools for interacting with TikTok's Business APIs. This server enables programmatic access to TikTok's advertising platform, business center, account management, creator marketplace, and more through a standardized interface.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

### Comprehensive API Coverage
- **Campaign Management**: Create, read, update, and manage advertising campaigns
- **Ad Group Management**: Manage ad groups within campaigns  
- **Ad Management**: Create and manage individual ads
- **Creative Management**: Upload and manage video/image creatives
- **Reporting**: Generate comprehensive advertising reports and analytics
- **Account Management**: Manage Business Center advertiser accounts
- **Pixel Management**: Create and manage tracking pixels
- **Content Publishing**: Publish content to TikTok accounts
- **Creator Discovery**: Search and find creators for collaborations
- **Product Management**: Upload and manage product catalogs
- **Targeting Tools**: Get supported languages, regions, and interest categories

### Enhanced Developer Experience
- ✅ **Standardized Authentication**: Consistent environment variable-based authentication
- ✅ **Built-in Rate Limiting**: Automatic handling of TikTok API rate limits
- ✅ **Input Validation**: Comprehensive parameter validation with detailed error messages
- ✅ **Type Safety**: Full TypeScript implementation with strict typing
- ✅ **Error Handling**: Robust error handling with specific error codes and messages
- ✅ **Structured Logging**: JSON-structured logs for better debugging and monitoring
- ✅ **Retry Logic**: Automatic retry for transient failures and rate limit exceeded

## 📋 Prerequisites

- Node.js 18.0 or higher
- TikTok for Business Developer Account
- Valid TikTok Business API credentials

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ebgolden/tiktok-business-mcp.git
cd tiktok-business-mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

## 🔑 API Credentials Setup

### Step 1: Create TikTok for Business Developer Account

1. Visit the [TikTok for Business Developer Portal](https://ads.tiktok.com/marketing_api/docs)
2. Create an account and register your application
3. Complete the application review process

### Step 2: Obtain API Credentials

You'll need the following credentials:

- **Access Token**: Long-term access token (recommended) or OAuth token
- **Advertiser ID**: Your advertiser account ID from TikTok Ads Manager
- **App ID** (Optional): For token refresh functionality
- **App Secret** (Optional): For token refresh functionality

### Step 3: Find Your Advertiser ID

1. Log into [TikTok Ads Manager](https://ads.tiktok.com/)
2. The Advertiser ID is displayed in the URL or account settings
3. Format: Usually a long numeric string (e.g., `1234567890123456789`)

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# Required
TIKTOK_ACCESS_TOKEN=your_long_term_access_token
TIKTOK_ADVERTISER_ID=your_advertiser_id

# Optional - for token refresh functionality
TIKTOK_APP_ID=your_app_id
TIKTOK_APP_SECRET=your_app_secret

# Optional - server configuration
TIKTOK_API_BASE_URL=https://business-api.tiktok.com
TIKTOK_RATE_LIMIT_RPM=200
DEBUG=true
```

### MCP Client Configuration

Add this server to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "tiktok-business-api": {
      "command": "node",
      "args": ["path/to/tiktok-business-mcp/dist/index.js"],
      "env": {
        "TIKTOK_ACCESS_TOKEN": "your_long_term_access_token",
        "TIKTOK_ADVERTISER_ID": "your_advertiser_id",
        "TIKTOK_APP_ID": "your_app_id",
        "TIKTOK_APP_SECRET": "your_app_secret",
        "DEBUG": "true"
      }
    }
  }
}
```

## 📖 Usage Examples

### Campaign Management

#### Create a New Campaign

```json
{
  "tool": "tiktok_campaign_create",
  "arguments": {
    "campaign_name": "Holiday Sales Campaign 2024",
    "objective_type": "CONVERSIONS",
    "budget": 1000.00,
    "budget_mode": "BUDGET_MODE_TOTAL",
    "schedule_type": "SCHEDULE_START_END",
    "schedule_start_time": "2024-12-01 00:00:00",
    "schedule_end_time": "2024-12-31 23:59:59"
  }
}
```

#### Retrieve Campaigns with Filtering

```json
{
  "tool": "tiktok_campaign_get",
  "arguments": {
    "page": 1,
    "page_size": 20,
    "filtering": {
      "primary_status": "ENABLE",
      "objective_type": "CONVERSIONS"
    }
  }
}
```

### Creative Management

#### Upload Video Creative

```json
{
  "tool": "tiktok_video_upload",
  "arguments": {
    "video_file": "https://example.com/product-demo.mp4",
    "upload_type": "UPLOAD_BY_URL",
    "video_name": "Holiday Product Demo Video",
    "flaw_detect": true,
    "auto_bind_enabled": true,
    "auto_fix_enabled": true
  }
}
```

### Reporting and Analytics

#### Generate Performance Report

```json
{
  "tool": "tiktok_report_get",
  "arguments": {
    "report_type": "BASIC",
    "data_level": "AUCTION_CAMPAIGN", 
    "dimensions": ["stat_time_day", "campaign_id"],
    "metrics": ["spend", "impressions", "clicks", "ctr", "cpm", "conversions"],
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "filters": [
      {
        "field_name": "campaign_name",
        "filter_type": "IN",
        "filter_value": ["Holiday Sales Campaign 2024"]
      }
    ],
    "page": 1,
    "page_size": 100
  }
}
```

## 🛠️ Available Tools

| Tool Name | Description | Required Parameters |
|-----------|-------------|-------------------|
| `tiktok_campaign_create` | Create new advertising campaign | campaign_name, objective_type, budget, budget_mode |
| `tiktok_campaign_get` | Retrieve campaign information | None (uses pagination) |
| `tiktok_video_upload` | Upload video creative | video_file, upload_type, video_name |
| `tiktok_report_get` | Generate advertising reports | report_type, data_level, dimensions, metrics, start_date, end_date |

### Campaign Objectives

- `REACH`: Maximize reach and brand awareness
- `TRAFFIC`: Drive traffic to website or app
- `APP_INSTALL`: Increase mobile app installations  
- `VIDEO_VIEW`: Maximize video views and engagement
- `LEAD_GENERATION`: Generate leads and contacts
- `CONVERSIONS`: Drive specific conversion actions
- `CATALOG_SALES`: Promote products from catalog

### Available Metrics

**Performance Metrics:**
- `spend`, `impressions`, `clicks`, `ctr`, `cpm`, `cpc`

**Conversion Metrics:**  
- `conversions`, `conversion_rate`, `cost_per_conversion`

**Engagement Metrics:**
- `video_play_actions`, `video_watched_2s`, `video_watched_6s`
- `likes`, `comments`, `shares`, `follows`

### Report Dimensions

- `stat_time_day`: Daily breakdown
- `campaign_id`: Campaign-level data
- `adgroup_id`: Ad group-level data  
- `ad_id`: Ad-level data
- `age`: Audience age breakdown
- `gender`: Audience gender breakdown

## 🔐 Security Best Practices

### Token Management
- Use long-term access tokens when possible for production
- Store tokens securely using environment variables or secret management systems
- Never expose tokens in client-side code or version control
- Implement token rotation if using app credentials
- Monitor token expiration and refresh automatically

### Network Security
- All API calls use HTTPS encryption
- Implement IP whitelisting if required by your infrastructure
- Use secure network connections for production deployments

### Error Handling
- Sensitive information is never logged in error messages
- API errors are sanitized before returning to clients
- Rate limiting protects against abuse

## 📊 Rate Limiting

TikTok Business APIs have the following rate limits:

| API Category | Rate Limit | Window |
|--------------|------------|---------|
| Standard APIs | 200 requests | 1 hour |
| Reporting APIs | 50 requests | 1 hour |
| Upload APIs | 20 files | 1 hour |

The server automatically handles rate limiting with:
- Built-in rate limiter with configurable limits
- Automatic retry with exponential backoff
- Queue management for burst requests

## 🐛 Troubleshooting

### Common Issues

#### Authentication Errors

**Error**: `Authentication failed. Please check your access token.`

**Solutions**:
- Verify `TIKTOK_ACCESS_TOKEN` is set correctly
- Check token hasn't expired in TikTok Ads Manager
- Ensure token has required permissions for the operation
- Verify `TIKTOK_ADVERTISER_ID` matches your account

```bash
# Test your credentials
curl -H "Access-Token: $TIKTOK_ACCESS_TOKEN" \
     "https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_id=$TIKTOK_ADVERTISER_ID"
```

#### Environment Variable Issues

**Error**: `TIKTOK_ACCESS_TOKEN environment variable is required`

**Solutions**:
- Check environment variable names are exact (case-sensitive)
- Verify no extra spaces or quotes in values
- Ensure `.env` file is in correct location
- Check MCP client configuration includes all required variables

#### Rate Limiting Issues

**Error**: `Rate limit exceeded`

**Solutions**:
- The server automatically retries after rate limits
- Reduce request frequency if encountering persistent limits
- Consider upgrading your TikTok API access level
- Implement request batching where possible

#### API Parameter Validation Errors

**Error**: `Invalid parameters: campaign_name: String must contain at least 1 character(s)`

**Solutions**:
- Check all required parameters are provided
- Verify parameter formats match documentation
- Use the JSON schema validation in your IDE
- Review parameter constraints in tool descriptions

### Debug Mode

Enable detailed logging:

```bash
DEBUG=true node dist/index.js
```

This will output detailed request/response logs and timing information.

### Health Check

Test server connectivity:

```bash
# Check if server starts properly
node dist/index.js --health-check

# Test with minimal configuration
TIKTOK_ACCESS_TOKEN=test TIKTOK_ADVERTISER_ID=test node dist/index.js
```

## 🔧 Development

### Prerequisites for Development

```bash
npm install -g typescript nodemon
```

### Development Setup

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Run linting
npm run lint

# Format code
npm run format
```

### Project Structure

```
tiktok-business-mcp/
├── src/
│   ├── index.ts              # Main server implementation
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Tools

1. Add the API method in the client class
2. Register the tool in the main server
3. Add tests for the new functionality
4. Update documentation

## 📈 Performance Optimization

### Best Practices

- **Batch Operations**: Use batch endpoints when available
- **Caching**: Implement caching for frequently accessed data
- **Pagination**: Use appropriate page sizes (20-100 items)
- **Filtering**: Apply filters to reduce data transfer
- **Compression**: Enable gzip compression for large responses

### Monitoring

Monitor these metrics:
- Request latency and error rates
- Rate limit utilization
- Token expiration warnings
- API quota usage

## 🤝 Contributing

We welcome contributions!

### Development Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Lint your code (`npm run lint`)
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to your branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Code Standards

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Follow semantic versioning for releases

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### For TikTok API Issues
- Visit [TikTok API for Business Developer Portal](https://ads.tiktok.com/marketing_api/docs)
- Click "?" on the top right to submit a ticket under Marketing API category

### For MCP Issues
- Visit [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- Check [MCP GitHub Repository](https://github.com/modelcontextprotocol) for updates

### For This Project
- Open an issue on GitHub
- Check existing issues for similar problems
- Provide detailed error messages and environment information

## 📚 Additional Resources

- [TikTok Business API Documentation](https://ads.tiktok.com/marketing_api/docs)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

**Made with ❤️ for the TikTok developer community**
