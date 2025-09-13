# ShopX Food Ordering Agent

AI-powered agent that orders food from Uber Eats based on natural language prompts.

## Features

- Natural language food ordering
- AI-powered meal decisions using OpenRouter
- Automated restaurant selection
- Smart menu item selection based on preferences
- Support for dietary restrictions and budget constraints

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env and add your OpenRouter API key
```

3. Build the project:
```bash
npm run build
```

## Usage

### CLI
```bash
npm start -- "I want a healthy lunch under $20"
npm start -- "Order me some spicy Indian food for dinner"
npm start -- "Get me a vegetarian meal with lots of protein"
```

### Programmatic
```typescript
import { FoodOrderingAgent } from './dist';

const agent = new FoodOrderingAgent({
  openRouterApiKey: 'your_api_key',
  headless: false // Set to true for production
});

const result = await agent.orderFromPrompt("I want sushi for lunch");
```

## Configuration

- **Address**: Hardcoded to Engineering 7, University of Waterloo
- **Headless Mode**: Set via config or environment variable
- **Timeout**: Default 30 seconds, configurable

## Architecture

- **OpenRouter Integration**: Uses GPT-3.5 for meal decisions
- **Puppeteer**: Automates browser interactions with Uber Eats
- **TypeScript**: Fully typed for better development experience

## Safety Note

The agent prepares orders but does NOT complete checkout automatically for safety reasons. Manual confirmation is required to place the final order.

## Development

```bash
npm run dev     # Run in development mode
npm run build   # Build TypeScript
npm run lint    # Run linter
npm run typecheck # Type checking
```