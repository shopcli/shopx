import { UberEatsAgent } from './agents/uberEatsAgent';

async function testPizzaOrder() {
  console.log('🍕 Testing UberEats Agent with "I want a pizza"');
  console.log('================================================\n');

  const agent = new UberEatsAgent({
    headless: false, // Set to true for headless mode
    timeout: 60000 // Increased timeout for demo
  });

  try {
    const result = await agent.orderMeal("I want a pizza");
    console.log('\n🎉 Order Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testPizzaOrder().catch(console.error);