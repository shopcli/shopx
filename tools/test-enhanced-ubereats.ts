import { UberEatsAgent } from './agents/uberEatsAgent';
import { OpenRouterClient } from './lib/openrouter';

async function testEnhancedUberEats() {
  console.log('🚀 Testing Enhanced UberEats Agent with OpenRouter Integration');
  console.log('===============================================================\n');

  // Test the OpenAI client directly first
  const apiKey = process.env.OPENAI_API_KEY || 'test-key';
  const openRouter = new OpenRouterClient(apiKey);

  try {
    console.log('1. Testing AI Category Decision Making...');
    const mealDecision = await openRouter.decideMeal("I want something healthy and vegetarian for lunch, preferably under $15");
    console.log('   ✅ AI Decision:', JSON.stringify(mealDecision, null, 2));
    console.log();

    console.log('2. Testing AI Restaurant Selection...');
    const mockRestaurants = [
      { url: 'test1', name: 'Healthy Garden Cafe', rating: '4.5', deliveryTime: '20-30 min', priceLevel: 2 },
      { url: 'test2', name: 'Pizza Palace', rating: '4.0', deliveryTime: '15-25 min', priceLevel: 1 },
      { url: 'test3', name: 'Vegan Delights', rating: '4.7', deliveryTime: '25-35 min', priceLevel: 3 }
    ];

    const restaurantSelection = await openRouter.selectBestRestaurant(mockRestaurants, mealDecision);
    console.log('   ✅ Restaurant Selection:', restaurantSelection);
    console.log();

    console.log('3. Testing AI Menu Analysis...');
    const mockMenuItems = [
      { name: 'Quinoa Buddha Bowl', price: '$12.99', description: 'Quinoa, vegetables, avocado, tahini dressing' },
      { name: 'Veggie Burger', price: '$10.99', description: 'Plant-based patty with fries' },
      { name: 'Green Smoothie', price: '$6.99', description: 'Spinach, banana, mango, coconut water' },
      { name: 'Loaded Nachos', price: '$14.99', description: 'Cheese, sour cream, guacamole' }
    ];

    const menuAnalysis = await openRouter.analyzeMenuItems(mockMenuItems, mealDecision);
    console.log('   ✅ Menu Analysis:', JSON.stringify(menuAnalysis, null, 2));
    console.log();

    console.log('🎉 All OpenRouter integrations working correctly!');
    console.log('\n📝 Summary of Enhancements:');
    console.log('   • Enhanced category decision-making with detailed cuisine analysis');
    console.log('   • AI-powered restaurant selection based on multiple factors');
    console.log('   • Intelligent menu item analysis with nutritional and value assessment');
    console.log('   • Improved error handling and fallback strategies');
    console.log('   • Better logging and user feedback');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\n💡 Note: This test requires a valid OPENAI_API_KEY environment variable');
    console.log('   The UberEats agent will still work with fallback logic if the API key is not available');
  }
}

// Run the test
testEnhancedUberEats().catch(console.error);