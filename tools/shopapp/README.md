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

### Command Line

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

## Environment Variables

- `OPENROUTE_API_KEY`: Your OpenRoute API key for AI functionality

## Dependencies

- Playwright for browser automation
- Axios for API calls
- TypeScript for type safety
