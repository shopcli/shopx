import { UberEatsAgent } from './agents/uberEatsAgent';
import { AgentConfig } from './lib/types';
import * as dotenv from 'dotenv';

dotenv.config();

export class FoodOrderingAgent {
  private agent: UberEatsAgent;

  constructor(config?: AgentConfig) {
    this.agent = new UberEatsAgent(config);
  }

  async orderFromPrompt(prompt: string, keepBrowserOpen: boolean = true) {
    console.log('🍔 Food Ordering Agent Started');
    console.log(`📝 User Request: ${prompt}`);
    console.log('─'.repeat(50));

    try {
      const result = await this.agent.orderMeal(prompt, keepBrowserOpen);

      console.log('─'.repeat(50));
      console.log('✅ Order Summary:');
      console.log(`   Cuisine: ${result.decision.cuisine_type}`);
      console.log(`   Price Range: ${result.decision.price_range}`);
      console.log(`   Items Selected: ${result.selectedItems.selected_items.join(', ')}`);
      console.log(`   Estimated Cost: $${result.selectedItems.total_estimated_cost}`);
      console.log('─'.repeat(50));
      console.log(result.message);

      return result;
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npm start -- "your food order request"');
    console.log('Example: npm start -- "I want a healthy lunch under $20"');
    process.exit(1);
  }

  const prompt = args.join(' ');
  const agent = new FoodOrderingAgent();

  agent.orderFromPrompt(prompt, true) // Keep browser open by default
    .then(() => {
      console.log('✨ Process completed - Browser left open for manual checkout');
      console.log('💡 Press Ctrl+C to exit when done');
      // Don't exit automatically - let user complete checkout
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}