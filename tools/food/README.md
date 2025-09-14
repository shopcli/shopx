# 🍔 ShopX Food Delivery System

AI-powered food delivery automation for Canadian platforms.

## Features

- **Natural Language Processing**: "Hey ShopX I want pizza" → AI adds random toppings
- **Multi-Platform Support**: UberEats, Fantuan (Chinese food)
- **Smart Order Processing**: AI analyzes your request and enhances it
- **Random Toppings**: Automatically adds random toppings based on cuisine type
- **Interactive CLI**: Terminal-based interface for easy ordering

## Quick Start

1. **Install Dependencies**
   ```bash
   cd tools
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   # Create .env file
   echo "OPENROUTER_API_KEY=your_api_key_here" > .env
   ```

3. **Run the Food CLI**
   ```bash
   npm run food-cli
   ```

4. **Try It Out**
   ```
   🍕 What would you like to order? Hey ShopX I want pizza
   ```

## Usage Examples

### Interactive CLI
```bash
npm run food-cli
```

Then type:
- "Hey ShopX I want pizza" → Gets pizza with random toppings
- "I want Chinese food" → Orders from Fantuan
- "I'm hungry for sushi" → AI processes and orders sushi
- "I want a burger" → Orders burger with random addons

### Programmatic Usage
```typescript
import { FoodOrderingAgent } from './food/index';

const agent = new FoodOrderingAgent('ubereats');
await agent.orderFromPrompt("I want pizza with extra cheese");
```

## How It Works

1. **Order Processing**: AI analyzes your request
2. **Random Enhancement**: Adds random toppings/addons based on cuisine
3. **Platform Selection**: Choose UberEats or Fantuan
4. **Automated Ordering**: Browser automation handles the rest
5. **Manual Checkout**: Browser stays open for final confirmation

## Supported Platforms

- **UberEats**: Wide variety of restaurants
- **Fantuan**: Chinese food delivery

## Random Toppings by Cuisine

- **Pizza**: pepperoni, mushrooms, onions, green peppers, etc.
- **Burgers**: extra pickles, bacon, avocado, fried egg, etc.
- **Sushi**: extra wasabi, ginger, spicy mayo, eel sauce, etc.

## File Structure

```
/tools/food/
├── index.ts              # Main food ordering agent
├── cli.ts                # Interactive CLI interface
├── orderProcessor.ts     # AI-powered order processing
├── types.ts              # TypeScript interfaces
├── test.ts               # Test suite
├── agents/
│   ├── uberEatsAgent.ts  # UberEats automation
│   └── fantuanAgent.ts   # Fantuan automation
└── README.md             # This file
```

## Commands

- `npm run food-cli` - Start interactive CLI
- `npm run food-dev` - Run food agent directly
- `npm run test` - Run test suite

## Environment Variables

- `OPENROUTER_API_KEY` - Required for AI processing

## Browser Automation

The system uses Playwright for browser automation:
- Automatically handles login cookies
- Performs searches and selections
- Keeps browser open for manual checkout
- Takes screenshots for verification

## Error Handling

- Graceful fallbacks for missing API keys
- Cookie management for persistent sessions
- Timeout handling for slow networks
- Clear error messages and recovery suggestions
