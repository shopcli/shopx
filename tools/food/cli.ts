#!/usr/bin/env node
import { FoodOrderingAgent, DeliveryPlatform } from './index';
import { OrderProcessor } from './orderProcessor';
import * as readline from 'readline';

class FoodDeliveryCLI {
  private rl: readline.Interface;
  private orderProcessor: OrderProcessor;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.orderProcessor = new OrderProcessor();
  }

  async start() {
    console.log('🍔 Welcome to ShopX Food Delivery!');
    console.log('Type "Hey ShopX I want pizza" or any food order');
    console.log('Type "help" for commands, "exit" to quit\n');

    this.promptUser();
  }

  private promptUser() {
    this.rl.question('🍕 What would you like to order? ', async (input) => {
      const command = input.trim().toLowerCase();

      if (command === 'exit' || command === 'quit') {
        console.log('👋 Thanks for using ShopX Food Delivery!');
        this.rl.close();
        return;
      }

      if (command === 'help') {
        this.showHelp();
        this.promptUser();
        return;
      }

      if (command === 'platforms') {
        this.showPlatforms();
        this.promptUser();
        return;
      }

      // Check if it's a food order
      if (this.isFoodOrder(input)) {
        await this.processFoodOrder(input);
      } else {
        console.log('🤔 I didn\'t understand that. Try "Hey ShopX I want pizza" or type "help" for commands.\n');
        this.promptUser();
      }
    });
  }

  private isFoodOrder(input: string): boolean {
    const foodKeywords = [
      'pizza', 'burger', 'sushi', 'chinese', 'italian', 'mexican', 'indian',
      'thai', 'japanese', 'korean', 'lunch', 'dinner', 'breakfast', 'food',
      'eat', 'hungry', 'order', 'delivery', 'restaurant', 'meal'
    ];
    
    const lowerInput = input.toLowerCase();
    return foodKeywords.some(keyword => lowerInput.includes(keyword)) || 
           lowerInput.includes('hey shopx') || 
           lowerInput.includes('shopx');
  }

  private async processFoodOrder(input: string) {
    try {
      console.log('\n🤖 Processing your order...');
      
      // Process the order with AI
      const orderRequest = await this.orderProcessor.processOrder(input);
      
      console.log(`\n📋 Order Analysis:`);
      console.log(`   Cuisine: ${orderRequest.cuisineType}`);
      console.log(`   Price Range: ${orderRequest.priceRange}`);
      console.log(`   Random Toppings: ${orderRequest.randomToppings.join(', ')}`);
      console.log(`   Enhanced Order: ${orderRequest.enhancedPrompt}\n`);

      // Auto-select platform based on cuisine (like shop.app auto-selects)
      const platform = this.selectPlatformByCuisine(orderRequest.cuisineType);
      console.log(`🌐 Auto-selected platform: ${platform.toUpperCase()}`);

      // Create and run the food ordering agent
      const agent = new FoodOrderingAgent(platform);
      
      console.log(`\n🚀 Starting order on ${platform.toUpperCase()}...`);
      console.log('─'.repeat(50));
      
      try {
        await agent.orderFromPrompt(orderRequest.enhancedPrompt, true);
        
        console.log('\n✨ Order process completed! Browser left open for manual checkout.');
        console.log('💡 Complete your order in the browser, then return here.\n');
        
      } catch (error) {
        console.log('\n⚠️  Authentication required!');
        console.log('🔐 Please log in to your account in the browser window that opened.');
        console.log('💡 After logging in, the automation will continue automatically.');
        console.log('⏳ Waiting for you to complete login...\n');
        
        // Wait for user to complete login
        await this.waitForLogin();
        
        // Try again after login
        console.log('🔄 Retrying order after login...');
        await agent.orderFromPrompt(orderRequest.enhancedPrompt, true);
      }
      
      // Don't close the agent - keep browser open for checkout
      console.log('🌐 Browser will stay open for you to complete checkout');
      console.log('💡 Press Ctrl+C in this terminal when done with your order\n');
      
    } catch (error) {
      console.error('❌ Error processing order:', error);
    }
    
    this.promptUser();
  }

  private selectPlatformByCuisine(cuisineType: string): DeliveryPlatform {
    // Auto-select platform based on cuisine (like shop.app logic)
    // For testing, let's use Fantuan as default
    if (cuisineType.toLowerCase().includes('pizza') || 
        cuisineType.toLowerCase().includes('burger') ||
        cuisineType.toLowerCase().includes('italian') ||
        cuisineType.toLowerCase().includes('american')) {
      return 'fantuan'; // Use Fantuan for testing
    } else {
      return 'fantuan'; // Default to Fantuan for all other cuisines
    }
  }

  private async waitForLogin(): Promise<void> {
    return new Promise((resolve) => {
      console.log('Press Enter when you have completed login...');
      this.rl.question('', () => {
        console.log('✅ Login completed, continuing...');
        resolve();
      });
    });
  }


  private showHelp() {
    console.log('\n📖 ShopX Food Delivery Commands:');
    console.log('  • "Hey ShopX I want pizza" - Order food with random toppings');
    console.log('  • "I want Chinese food" - Order specific cuisine');
    console.log('  • "I\'m hungry for sushi" - Natural language food orders');
    console.log('  • "platforms" - Show available delivery platforms');
    console.log('  • "help" - Show this help message');
    console.log('  • "exit" - Quit the application\n');
  }

  private showPlatforms() {
    console.log('\n🌐 Available Delivery Platforms:');
    console.log('  • UberEats - Wide variety of restaurants');
    console.log('  • Fantuan - Chinese food delivery\n');
  }
}

// Start the CLI
if (require.main === module) {
  const cli = new FoodDeliveryCLI();
  cli.start().catch(console.error);
}

export { FoodDeliveryCLI };
