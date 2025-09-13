import { OpenRouterClient } from './lib/openrouter';
import * as dotenv from 'dotenv';

dotenv.config();

async function runDemo() {
  console.log('🍔 Food Ordering Agent Demo Mode');
  console.log('─'.repeat(50));

  const prompt = process.argv.slice(2).join(' ') || 'I want a pizza';
  console.log(`📝 User Request: "${prompt}"`);
  console.log('─'.repeat(50));

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OPENROUTER_API_KEY not found in .env file');
    console.log('\nTo set up:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Add your OpenRouter API key');
    process.exit(1);
  }

  const openRouter = new OpenRouterClient(apiKey);

  try {
    console.log('🤖 Getting AI meal recommendations...');
    const decision = await openRouter.decideMeal(prompt);

    console.log('\n✅ AI Decision:');
    console.log(`   Cuisine: ${decision.cuisine_type}`);
    console.log(`   Restaurant: ${decision.restaurant_preferences || 'Any'}`);
    console.log(`   Price Range: ${decision.price_range}`);

    if (decision.items && decision.items.length > 0) {
      console.log('   Items to order:');
      decision.items.forEach((item: any) => {
        console.log(`     - ${item.name || item.item || 'Item'} x${item.quantity || 1}`);
      });
    }

    if (decision.dietary_restrictions && decision.dietary_restrictions.length > 0) {
      console.log(`   Dietary: ${decision.dietary_restrictions.join(', ')}`);
    }

    if (decision.special_instructions) {
      console.log(`   Notes: ${decision.special_instructions}`);
    }

    console.log('\n📱 What would happen next (Demo Mode):');
    console.log('   1. Open Uber Eats website');
    console.log('   2. Set delivery address to Engineering 7, UWaterloo');
    console.log(`   3. Search for "${decision.cuisine_type}" restaurants`);
    console.log('   4. Select a restaurant matching preferences');
    console.log('   5. Browse menu and select items');
    console.log('   6. Add items to cart');
    console.log('   7. Prepare order (manual checkout required)');

    console.log('\n─'.repeat(50));
    console.log('✨ Demo completed successfully!');
    console.log('💡 To run the full agent, use: npm start -- "your order"');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

runDemo();