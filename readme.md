# Semrush MCP Server

An MCP (Model Context Protocol) server that provides access to Semrush API functionality for AI assistants.

## Features

- **Domain Overview**: Get comprehensive domain analytics including organic traffic, keywords, and authority score
- **Keyword Research**: Analyze keyword metrics including search volume, difficulty, and CPC
- **Organic Search Analysis**: Retrieve organic search keywords and rankings for any domain
- **Paid Search Analysis**: Get Google Ads keywords and PPC data for domains
- **Backlinks Overview**: Get backlink metrics and analysis for domains or specific URLs
- **Competitor Research**: Identify and analyze organic competitors
- **Related Keywords**: Discover related keywords and search suggestions

## Prerequisites

- Node.js 18+ 
- A Semrush API key (get one at https://www.semrush.com/api/)

## Installation

1. Clone this repository or create a new directory:
```bash
mkdir semrush-mcp
cd semrush-mcp
```

2. Create the following directory structure:
```
semrush-mcp-server/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

3. Save the provided files in their respective locations

Then manually:
```bash
npm install
npm run build
```

## Configuration

Set your Semrush API key as an environment variable:

```bash
export SEMRUSH_API_KEY="your-api-key-here"
```

Or create a `.env` file:
```
SEMRUSH_API_KEY=your-api-key-here
```

## Usage with Claude Desktop

Add the server to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "semrush": {
      "command": "node",
      "args": ["/path/to/semrush-mcp-server/dist/index.js"],
      "env": {
        "SEMRUSH_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### 1. domain_overview
Get comprehensive domain analytics.

Parameters:
- `domain` (required): Domain to analyze (e.g., "example.com")
- `database` (optional): Database code (default: "us")

### 2. keyword_overview
Get keyword metrics and data.

Parameters:
- `phrase` (required): Keyword phrase to analyze
- `database` (optional): Database code (default: "us")

### 3. domain_organic_search
Get organic search keywords for a domain.

Parameters:
- `domain` (required): Domain to analyze
- `database` (optional): Database code (default: "us")
- `limit` (optional): Number of results (default: 10)
- `offset` (optional): Offset for pagination (default: 0)

### 4. backlinks_overview
Get backlinks overview for a domain or URL.

Parameters:
- `target` (required): Domain or URL to analyze
- `target_type` (optional): "domain" or "url" (default: "domain")

### 5. competitor_research
Find organic competitors for a domain.

Parameters:
- `domain` (required): Domain to analyze
- `database` (optional): Database code (default: "us")
- `limit` (optional): Number of competitors (default: 10)

### 6. domain_adwords
Get paid search (Google Ads) keywords for a domain.

Parameters:
- `domain` (required): Domain to analyze
- `database` (optional): Database code (default: "us")
- `limit` (optional): Number of results (default: 10)

### 7. related_keywords
Get related keywords and suggestions for a seed keyword.

Parameters:
- `phrase` (required): Seed keyword phrase
- `database` (optional): Database code (default: "us")
- `limit` (optional): Number of results (default: 10)

## Database Codes

Common database codes for different regions:
- `us` - United States
- `uk` - United Kingdom
- `ca` - Canada
- `au` - Australia
- `de` - Germany
- `fr` - France
- `es` - Spain
- `it` - Italy
- `br` - Brazil
- `in` - India

## Development

To run the server in development mode:

```bash
npm run dev
```

## Example Usage in Claude

Once configured, you can use natural language to access Semrush data:

- "Analyze the domain example.com using Semrush"
- "What's the search volume for 'digital marketing' keyword?"
- "Show me the top organic keywords for techcrunch.com"
- "Find competitors for shopify.com"
- "Get backlink data for https://example.com/blog-post"
- "What related keywords can you find for 'content marketing'?"
- "Show me the Google Ads keywords that amazon.com is bidding on"

## Troubleshooting

1. **API Key Issues**: Ensure your SEMRUSH_API_KEY environment variable is set correctly
2. **Rate Limits**: Semrush API has rate limits. Check your plan's limits
3. **Database Codes**: Make sure you're using valid database codes for your target regions

## License

MIT
