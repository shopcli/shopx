import { UberEatsAgent } from './agents/uberEatsAgent';
import { FantuanAgent } from './agents/fantuanAgent';
import { AgentConfig } from './types';
import * as dotenv from 'dotenv';

dotenv.config();

export type DeliveryPlatform = 'ubereats' | 'fantuan';

export class FoodOrderingAgent {
  private agent: UberEatsAgent | FantuanAgent;
  private platform: DeliveryPlatform;

  constructor(platform: DeliveryPlatform = 'ubereats', config?: AgentConfig) {
    this.platform = platform;
    
    if (platform === 'fantuan') {
      this.agent = new FantuanAgent(config);
    } else {
      this.agent = new UberEatsAgent(config);
    }
  }

  async orderFromPrompt(prompt: string, keepBrowserOpen: boolean = true) {
    console.log('🍔 Food Ordering Agent Started');
    console.log(`🌐 Platform: ${this.platform.toUpperCase()}`);
    console.log(`📝 User Request: ${prompt}`);
    console.log('─'.repeat(50));

    try {
      const result = await this.agent.orderMeal(prompt, keepBrowserOpen);

      console.log('─'.repeat(50));
      console.log('✅ Order Summary:');
      console.log(`   Platform: ${this.platform.toUpperCase()}`);
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

  async close(): Promise<void> {
    await this.agent.close();
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npm start -- [platform] "your food order request"');
    console.log('Platforms: ubereats, fantuan');
    console.log('Examples:');
    console.log('  npm start -- ubereats "I want a healthy lunch under $20"');
    console.log('  npm start -- fantuan "I want Chinese food for dinner"');
    process.exit(1);
  }

  const platform = args[0] as DeliveryPlatform;
  const prompt = args.slice(1).join(' ');

  if (!['ubereats', 'fantuan'].includes(platform)) {
    console.log('❌ Invalid platform. Use: ubereats or fantuan');
    process.exit(1);
  }

  const agent = new FoodOrderingAgent(platform);

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
