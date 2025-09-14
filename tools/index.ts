// Main entry point for ShopX tools
export { FoodOrderingAgent, DeliveryPlatform } from './food/index';
export { FoodDeliveryCLI } from './food/cli';
export { OrderProcessor } from './food/orderProcessor';

// Re-export for backward compatibility
import { FoodOrderingAgent, DeliveryPlatform } from './food/index';

// CLI Interface for backward compatibility
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npm start -- [platform] "your food order request"');
    console.log('Platforms: ubereats, fantuan');
    console.log('Examples:');
    console.log('  npm start -- ubereats "I want a healthy lunch under $20"');
    console.log('  npm start -- fantuan "I want Chinese food for dinner"');
    console.log('\nOr run the interactive CLI:');
    console.log('  npm run food-cli');
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