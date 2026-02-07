#!/usr/bin/env node
/**
 * Creator Fusion MCP Server
 * 
 * Provides AI agents with tools to analyze creators across TikTok and YouTube.
 * Includes authenticity auditing, performance tracking, and rate card generation.
 * 
 * Compatible with Claude Desktop, OpenClaw, and any MCP-enabled client.
 * 
 * @agent-capability creator-analysis, influencer-marketing, authenticity-detection
 * @tool-discovery enabled
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ApifyClient } from "apify-client";
import { z } from "zod";

// Initialize Apify client
const apifyToken = process.env.APIFY_TOKEN;
if (!apifyToken) {
  console.error("APIFY_TOKEN environment variable is required");
  process.exit(1);
}

const apifyClient = new ApifyClient({ token: apifyToken });

// Actor IDs
const ACTORS = {
  tiktokProfile: "apricot_blackberry/tiktok-profile-scraper",
  authenticityAudit: "apricot_blackberry/audience-authenticity-audit",
  contentPerformance: "apricot_blackberry/content-performance-tracker",
  youtubeAnalyzer: "apricot_blackberry/youtube-creator-analyzer",
  brandCompatibility: "apricot_blackberry/brand-compatibility-scorer",
  competitiveIntel: "apricot_blackberry/competitive-intelligence",
};

// Tool definitions
const tools: Tool[] = [
  {
    name: "get_tiktok_profile",
    description: `Fetch detailed profile data for a TikTok creator.

Returns:
- Follower/following counts, total likes, video count
- Engagement rate calculated from recent content
- Account age and growth velocity
- Bio link extraction for cross-platform verification
- Verification status and commerce account detection

Use when you need raw TikTok metrics for a creator.`,
    inputSchema: {
      type: "object",
      properties: {
        usernames: {
          type: "array",
          items: { type: "string" },
          description: "TikTok usernames to fetch (without @ symbol)"
        }
      },
      required: ["usernames"]
    }
  },
  {
    name: "audit_creator_authenticity",
    description: `Detect fake followers, bot engagement, and suspicious patterns on creator profiles.

Returns an authenticity score (0-100) based on 6 weighted signals:
- Engagement rate vs tier benchmarks (30%)
- Follower/following ratio analysis (15%)
- Growth pattern vs account age (20%)
- Content consistency (15%)
- Profile completeness (10%)
- Trust signals (verification, bio links) (10%)

Includes actionable recommendations: PROCEED, PROCEED_WITH_CAUTION, VERIFY, or AVOID.

Use before partnering with a creator to validate authenticity.`,
    inputSchema: {
      type: "object",
      properties: {
        tiktokUsernames: {
          type: "array",
          items: { type: "string" },
          description: "TikTok usernames to audit (without @)"
        },
        includeRawData: {
          type: "boolean",
          default: false,
          description: "Include raw profile data in response"
        }
      },
      required: ["tiktokUsernames"]
    }
  },
  {
    name: "analyze_content_performance",
    description: `Analyze creator content performance patterns and get improvement recommendations.

Returns:
- Performance rating vs tier benchmarks
- Posting frequency and consistency scores
- Growth velocity (followers/month)
- Overall performance score (0-100)
- Actionable recommendations for improvement

Can also compare two creators side-by-side using compareMode.`,
    inputSchema: {
      type: "object",
      properties: {
        tiktokUsernames: {
          type: "array",
          items: { type: "string" },
          description: "TikTok usernames to analyze"
        },
        compareMode: {
          type: "boolean",
          default: false,
          description: "Compare exactly 2 creators head-to-head"
        }
      },
      required: ["tiktokUsernames"]
    }
  },
  {
    name: "analyze_youtube_creator",
    description: `Comprehensive YouTube creator analysis for brand partnerships.

Requires user's own YouTube Data API key (free from Google Cloud Console).

Returns:
- Creator Fusion Score™ (0-100) with letter grade
- Engagement analytics (rate, views, likes, comments)
- Sponsorship history detection (brands, promo codes, affiliate networks)
- Engagement authenticity analysis (5 statistical signals)
- Sponsorship rate card (integration, dedicated, shorts, usage rights)
- Partnership readiness assessment with strengths/red flags

Zero proxy cost - uses official YouTube API.`,
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "YouTube Data API v3 key"
        },
        channels: {
          type: "array",
          items: { type: "string" },
          description: "Channel URLs, @handles, or channel IDs"
        },
        videosPerChannel: {
          type: "number",
          default: 30,
          description: "Recent videos to analyze (5-200)"
        },
        enableSponsorshipDetection: {
          type: "boolean",
          default: true
        },
        enableAuthenticityCheck: {
          type: "boolean",
          default: true
        },
        enableRateCard: {
          type: "boolean",
          default: true
        }
      },
      required: ["apiKey", "channels"]
    }
  },
  {
    name: "generate_rate_card",
    description: `Generate a sponsorship rate card for a TikTok creator.

Uses the TikTok profile data to estimate sponsorship rates based on:
- Follower count and tier
- Engagement rate
- Content niche (when detectable)
- Industry CPM benchmarks

Returns low/mid/high estimates for different deal types.`,
    inputSchema: {
      type: "object",
      properties: {
        tiktokUsername: {
          type: "string",
          description: "TikTok username (without @)"
        }
      },
      required: ["tiktokUsername"]
    }
  },
  {
    name: "score_brand_compatibility",
    description: `Match a brand with compatible TikTok creators.

Analyzes:
- Niche alignment (30%)
- Engagement quality (25%)
- Brand safety (20%)
- Audience size fit (15%)
- Sponsorship readiness (10%)

Returns compatibility scores, strengths, flags, and recommendations.
Can rank multiple creators for one brand using rankMode.`,
    inputSchema: {
      type: "object",
      properties: {
        brand: {
          type: "object",
          description: "Brand details: { category: 'technology', name: 'Acme', targetTier: 'micro' }"
        },
        tiktokUsernames: {
          type: "array",
          items: { type: "string" },
          description: "Creators to evaluate"
        },
        rankMode: {
          type: "boolean",
          default: false,
          description: "Rank creators and return sorted list with top pick"
        }
      },
      required: ["brand", "tiktokUsernames"]
    }
  },
  {
    name: "analyze_competitive_landscape",
    description: `Analyze competitor creators and benchmark performance.

Two modes:
- landscape: Analyze group as competitive market (rankings, market share, insights)
- benchmark: Compare target against competitors (percentiles, gap analysis)

Returns market leader, fastest growing, highest engagement, and strategic insights.`,
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["landscape", "benchmark"],
          default: "landscape"
        },
        tiktokUsernames: {
          type: "array",
          items: { type: "string" },
          description: "Creators to analyze (landscape mode)"
        },
        targetUsername: {
          type: "string",
          description: "Target to benchmark (benchmark mode)"
        },
        competitorUsernames: {
          type: "array",
          items: { type: "string" },
          description: "Competitors (benchmark mode)"
        }
      },
      required: ["mode"]
    }
  }
];

// Input validation schemas
const TikTokProfileInput = z.object({
  usernames: z.array(z.string())
});

const AuthenticityAuditInput = z.object({
  tiktokUsernames: z.array(z.string()),
  includeRawData: z.boolean().default(false)
});

const ContentPerformanceInput = z.object({
  tiktokUsernames: z.array(z.string()),
  compareMode: z.boolean().default(false)
});

const YouTubeAnalyzerInput = z.object({
  apiKey: z.string(),
  channels: z.array(z.string()),
  videosPerChannel: z.number().min(5).max(200).default(30),
  enableSponsorshipDetection: z.boolean().default(true),
  enableAuthenticityCheck: z.boolean().default(true),
  enableRateCard: z.boolean().default(true)
});

const RateCardInput = z.object({
  tiktokUsername: z.string()
});

const BrandCompatibilityInput = z.object({
  brand: z.object({
    category: z.string().optional(),
    name: z.string().optional(),
    targetTier: z.string().optional()
  }),
  tiktokUsernames: z.array(z.string()),
  rankMode: z.boolean().default(false)
});

const CompetitiveIntelInput = z.object({
  mode: z.enum(["landscape", "benchmark"]),
  tiktokUsernames: z.array(z.string()).optional(),
  targetUsername: z.string().optional(),
  competitorUsernames: z.array(z.string()).optional()
});

// Create MCP server
const server = new Server(
  {
    name: "creator-fusion-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_tiktok_profile": {
        const input = TikTokProfileInput.parse(args);
        
        const run = await apifyClient.actor(ACTORS.tiktokProfile).call({
          usernames: input.usernames,
          delayBetweenRequests: 1000
        }, { memory: 1024, timeout: 120 });

        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(items, null, 2)
          }]
        };
      }

      case "audit_creator_authenticity": {
        const input = AuthenticityAuditInput.parse(args);
        
        const run = await apifyClient.actor(ACTORS.authenticityAudit).call({
          tiktokUsernames: input.tiktokUsernames,
          includeRawData: input.includeRawData
        }, { memory: 1024, timeout: 180 });

        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        
        // Summarize for quick reading
        const summary = items.map((item: any) => ({
          username: item.username,
          score: item.audit?.overallScore,
          rating: item.audit?.rating?.label,
          recommendation: item.audit?.recommendation?.action,
          redFlags: item.redFlags?.length || 0,
          greenFlags: item.greenFlags?.length || 0
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ summary, details: items }, null, 2)
          }]
        };
      }

      case "analyze_content_performance": {
        const input = ContentPerformanceInput.parse(args);
        
        const run = await apifyClient.actor(ACTORS.contentPerformance).call({
          tiktokUsernames: input.tiktokUsernames,
          compareMode: input.compareMode
        }, { memory: 1024, timeout: 180 });

        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(items, null, 2)
          }]
        };
      }

      case "analyze_youtube_creator": {
        const input = YouTubeAnalyzerInput.parse(args);
        
        const run = await apifyClient.actor(ACTORS.youtubeAnalyzer).call({
          apiKey: input.apiKey,
          channels: input.channels,
          videosPerChannel: input.videosPerChannel,
          enableSponsorshipDetection: input.enableSponsorshipDetection,
          enableAuthenticityCheck: input.enableAuthenticityCheck,
          enableRateCard: input.enableRateCard
        }, { memory: 256, timeout: 300 });

        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(items, null, 2)
          }]
        };
      }

      case "generate_rate_card": {
        const input = RateCardInput.parse(args);
        
        // First get the profile data
        const profileRun = await apifyClient.actor(ACTORS.tiktokProfile).call({
          usernames: [input.tiktokUsername],
          delayBetweenRequests: 1000
        }, { memory: 1024, timeout: 60 });

        const { items } = await apifyClient.dataset(profileRun.defaultDatasetId).listItems();
        
        if (!items.length) {
          return {
            content: [{
              type: "text",
              text: `Could not find TikTok profile: @${input.tiktokUsername}`
            }],
            isError: true
          };
        }

        const profile = items[0] as any;
        
        // Generate rate card from profile data
        const rateCard = generateTikTokRateCard(profile);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              username: profile.username,
              followers: profile.followers,
              engagementRate: profile.engagementRate,
              rateCard
            }, null, 2)
          }]
        };
      }

      case "score_brand_compatibility": {
        const input = BrandCompatibilityInput.parse(args);
        
        const run = await apifyClient.actor(ACTORS.brandCompatibility).call({
          brand: input.brand,
          tiktokUsernames: input.tiktokUsernames,
          rankMode: input.rankMode
        }, { memory: 1024, timeout: 180 });

        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(items, null, 2)
          }]
        };
      }

      case "analyze_competitive_landscape": {
        const input = CompetitiveIntelInput.parse(args);
        
        const runInput: any = { mode: input.mode };
        
        if (input.mode === "benchmark") {
          runInput.targetUsername = input.targetUsername;
          runInput.competitorUsernames = input.competitorUsernames;
        } else {
          runInput.tiktokUsernames = input.tiktokUsernames;
        }
        
        const run = await apifyClient.actor(ACTORS.competitiveIntel).call(runInput, { 
          memory: 1024, 
          timeout: 240 
        });

        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(items, null, 2)
          }]
        };
      }

      default:
        return {
          content: [{
            type: "text",
            text: `Unknown tool: ${name}`
          }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});

// TikTok rate card generator
function generateTikTokRateCard(profile: any) {
  const followers = profile.followers || 0;
  const engagementRate = profile.engagementRate || 0;
  
  // Determine tier
  let tier = 'Nano';
  if (followers >= 1000000) tier = 'Mega';
  else if (followers >= 500000) tier = 'Macro';
  else if (followers >= 100000) tier = 'Mid-Tier';
  else if (followers >= 10000) tier = 'Micro';
  
  // Base CPM by tier (TikTok is generally higher than YouTube)
  const cpmTable: Record<string, { low: number; mid: number; high: number }> = {
    'Nano': { low: 10, mid: 20, high: 40 },
    'Micro': { low: 15, mid: 30, high: 50 },
    'Mid-Tier': { low: 20, mid: 40, high: 70 },
    'Macro': { low: 25, mid: 50, high: 90 },
    'Mega': { low: 30, mid: 60, high: 120 },
  };
  
  const floors: Record<string, { post: number; story: number }> = {
    'Nano': { post: 50, story: 25 },
    'Micro': { post: 200, story: 100 },
    'Mid-Tier': { post: 1000, story: 400 },
    'Macro': { post: 5000, story: 2000 },
    'Mega': { post: 15000, story: 5000 },
  };
  
  const cpm = cpmTable[tier];
  const floor = floors[tier];
  
  // Engagement multiplier
  let engagementMult = 1.0;
  if (engagementRate >= 10) engagementMult = 1.4;
  else if (engagementRate >= 7) engagementMult = 1.25;
  else if (engagementRate >= 5) engagementMult = 1.1;
  else if (engagementRate >= 3) engagementMult = 1.0;
  else if (engagementRate >= 1) engagementMult = 0.85;
  else engagementMult = 0.7;
  
  // Estimate average views (TikTok typically 10-30% of followers see each post)
  const estViews = followers * 0.15;
  
  // Calculate rates
  const calcRate = (baseCpm: number, mult: number, floorValue: number) => {
    const rate = Math.round((estViews / 1000) * baseCpm * mult);
    return Math.max(rate, floorValue);
  };
  
  return {
    tier,
    estimatedViewsPerPost: Math.round(estViews),
    engagementMultiplier: engagementMult,
    
    sponsoredPost: {
      low: calcRate(cpm.low, engagementMult, floor.post),
      mid: calcRate(cpm.mid, engagementMult, Math.round(floor.post * 1.5)),
      high: calcRate(cpm.high, engagementMult, Math.round(floor.post * 2.5)),
      currency: 'USD'
    },
    
    storyMention: {
      low: calcRate(cpm.low * 0.3, engagementMult, floor.story),
      mid: calcRate(cpm.mid * 0.3, engagementMult, Math.round(floor.story * 1.5)),
      high: calcRate(cpm.high * 0.3, engagementMult, Math.round(floor.story * 2.5)),
      currency: 'USD'
    },
    
    disclaimer: 'Estimates based on industry benchmarks. Actual rates depend on niche, exclusivity, and negotiation.'
  };
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Creator Fusion MCP server running on stdio");
}

main().catch(console.error);
