# Shop App Agent

Automated shopping agent for shop.app that can search for products and make selections based on user prompts.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env and add your OpenRoute API key
```

3. Build the project:

```bash
npm run build
```

## Usage

### Capture Cookies (First Time Setup)

```bash
npm run capture-cookies
```

This will:

1. Open a browser window to shop.app
2. Wait for you to manually login
3. Press Enter in the terminal when logged in
4. Automatically capture and save cookies to `cookies.json`

### Run the Agent

```bash
npm run dev "I want a plain white t shirt for a man"
```

### Programmatic

```typescript
import ShopAppAgent from './agent'

const agent = new ShopAppAgent()
await agent.run('I want a plain white t shirt for a man')
```

## Features

- **Smart Search Query Generation**: Uses OpenRoute API to convert natural language requests into effective search queries
- **Product Extraction**: Automatically extracts product information from search results
- **AI-Powered Selection**: Uses AI to select the 5 best products matching user requirements
- **Automated Navigation**: Handles clicking through to products and buy now buttons
- **Robust Error Handling**: Graceful handling of missing elements and network issues

## Cookie Management

The agent supports loading cookies from `cookies.json` to avoid logging in every time:

```json
{
  "cookies": [
    {
      "name": "_shopify_y",
      "value": "your-value",
      "domain": "shop.app",
      "path": "/",
      "secure": true,
      "httpOnly": false,
      "sameSite": "None"
    }
  ],
  "domain": "shop.app",
  "lastUpdated": "2025-09-13T21:52:30.949Z"
}
```

- Place your `cookies.json` file in the same directory as `agent.ts`
- The agent will automatically load cookies on startup
- Cookies are automatically saved after successful interactions

## Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key for AI functionality

## Dependencies

- Playwright for browser automation
- Axios for API calls
- TypeScript for type safety
