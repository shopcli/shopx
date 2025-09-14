#!/usr/bin/env node
import { FoodDeliveryCLI } from './cli';
import { OrderProcessor } from './orderProcessor';

async function testOrderProcessor() {
  console.log('🧪 Testing Order Processor...\n');
  
  const processor = new OrderProcessor();
  
  try {
    const testPrompts = [
      "Hey ShopX I want pizza",
      "I want Chinese food",
      "I'm hungry for sushi",
      "I want a burger with fries"
    ];

    for (const prompt of testPrompts) {
      console.log(`\n📝 Testing: "${prompt}"`);
      console.log('─'.repeat(40));
      
      const result = await processor.processOrder(prompt);
      
      console.log(`✅ Cuisine: ${result.cuisineType}`);
      console.log(`💰 Price Range: ${result.priceRange}`);
      console.log(`🎲 Random Toppings: ${result.randomToppings.join(', ')}`);
      console.log(`🔍 Enhanced Prompt: ${result.enhancedPrompt}`);
    }
    
    console.log('\n✅ Order Processor test completed successfully!');
    
  } catch (error) {
    console.error('❌ Order Processor test failed:', error);
  }
}

async function testCLI() {
  console.log('\n🧪 Testing CLI Interface...\n');
  
  try {
    const cli = new FoodDeliveryCLI();
    console.log('✅ CLI created successfully!');
    console.log('💡 Run "npm run food-cli" to test the interactive CLI');
    
  } catch (error) {
    console.error('❌ CLI test failed:', error);
  }
}

async function runTests() {
  console.log('🚀 Starting ShopX Food Delivery Tests\n');
  
  await testOrderProcessor();
  await testCLI();
  
  console.log('\n🎉 All tests completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Set OPENROUTER_API_KEY in your .env file');
  console.log('2. Run: npm run food-cli');
  console.log('3. Try: "Hey ShopX I want pizza"');
}

if (require.main === module) {
  runTests().catch(console.error);
}
