# Creator Fusion MCP Server

MCP (Model Context Protocol) server for the Creator Fusion toolkit. Enables AI assistants like Claude to analyze TikTok and YouTube creators, detect fake followers, and generate sponsorship rate cards.

## Features

- **TikTok Profile Scraping** - Fetch creator metrics, engagement rates, bio links
- **Authenticity Auditing** - Detect fake followers and bot engagement (0-100 score)
- **Content Performance Analysis** - Track posting patterns and growth velocity
- **YouTube Creator Analysis** - Full analysis with sponsorship detection and rate cards
- **Rate Card Generation** - Estimate sponsorship pricing based on metrics

## Installation

```bash
npm install -g @creatorfusion/mcp-server
```

Or use npx:
```bash
npx @creatorfusion/mcp-server
```

## Configuration

### Environment Variables

```bash
APIFY_TOKEN=your_apify_api_token
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "creator-fusion": {
      "command": "npx",
      "args": ["@creatorfusion/mcp-server"],
      "env": {
        "APIFY_TOKEN": "your_apify_token"
      }
    }
  }
}
```

### OpenClaw

Add to your OpenClaw config:

```yaml
mcp:
  servers:
    - name: creator-fusion
      command: npx @creatorfusion/mcp-server
      env:
        APIFY_TOKEN: your_apify_token
```

## Available Tools

### get_tiktok_profile
Fetch detailed TikTok profile data including followers, engagement rate, and bio links.

```json
{
  "usernames": ["charlidamelio", "khaby.lame"]
}
```

### audit_creator_authenticity
Detect fake followers and suspicious engagement patterns. Returns an authenticity score (0-100) with recommendations.

```json
{
  "tiktokUsernames": ["suspicious_creator"],
  "includeRawData": false
}
```

### analyze_content_performance
Analyze posting patterns, growth velocity, and get improvement recommendations.

```json
{
  "tiktokUsernames": ["creator1", "creator2"],
  "compareMode": true
}
```

### analyze_youtube_creator
Comprehensive YouTube analysis with sponsorship detection. Requires user's own YouTube API key.

```json
{
  "apiKey": "YOUR_YOUTUBE_API_KEY",
  "channels": ["@MrBeast", "@mkbhd"],
  "videosPerChannel": 30,
  "enableSponsorshipDetection": true,
  "enableAuthenticityCheck": true,
  "enableRateCard": true
}
```

### generate_rate_card
Generate sponsorship rate estimates for a TikTok creator.

```json
{
  "tiktokUsername": "charlidamelio"
}
```

## Cost Structure

| Tool | Approximate Cost |
|------|------------------|
| TikTok Profile | ~$0.02/profile |
| Authenticity Audit | ~$0.02/profile |
| Content Performance | ~$0.02/profile |
| YouTube Analyzer | ~$0.005/channel + user's API quota |
| Rate Card | ~$0.02 (uses TikTok scraper) |

Costs depend on Apify usage. YouTube analyzer uses the free YouTube Data API (user provides their own key).

## Example Usage (Claude)

> "Analyze @charlidamelio's TikTok profile and check if their engagement looks authentic"

> "Compare the content performance of @khaby.lame vs @charlidamelio"

> "Generate a sponsorship rate card for @addison.rae"

> "Analyze MrBeast's YouTube channel for brand partnership potential" (requires YouTube API key)

## Requirements

- Node.js 18+
- Apify API token
- (Optional) YouTube Data API key for YouTube analysis

## License

MIT - © 2025 Creator Fusion LLC

## Links

- [Creator Fusion Website](https://creatorfusion.net)
- [Apify Store](https://apify.com/apricot_blackberry)
