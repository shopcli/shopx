import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Browser, chromium, Page } from 'playwright';

dotenv.config();

interface Restaurant {
  name: string;
  rating: string;
  deliveryTime: string;
  cuisine: string;
  price: string;
  href: string;
}

interface OpenRouteResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class FoodAgent {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private openRouteApiKey: string;

  constructor() {
    this.openRouteApiKey = process.env.OPENROUTER_API_KEY || '';
    if (!this.openRouteApiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }
  }

  async initialize(): Promise<void> {
    // Connect to existing Chrome browser instead of launching new one
    try {
      this.browser = await chromium.connectOverCDP('http://localhost:9222');
      console.log('Connected to existing Chrome browser');
      
      // Get existing page or create new one
      const contexts = this.browser.contexts();
      if (contexts.length > 0) {
        const pages = contexts[0].pages();
        if (pages.length > 0) {
          this.page = pages[0];
          console.log('Using existing page');
        } else {
          this.page = await contexts[0].newPage();
          console.log('Created new page in existing context');
        }
      } else {
        this.page = await this.browser.newPage();
        console.log('Created new page and context');
      }
    } catch (error) {
      console.log('Could not connect to existing Chrome, launching new browser...');
      this.browser = await chromium.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
      console.log('Created new page and context');
    }
    
    await this.page.setViewportSize({ width: 1280, height: 720 });
    
    // Navigate to Fantuan if not already there
    const currentUrl = this.page.url();
    if (!currentUrl.includes('fantuanorder.com')) {
      console.log('Navigating to Fantuan...');
      await this.page.goto('https://www.fantuanorder.com/');
      await this.page.waitForLoadState('load');
    } else {
      console.log('Already on Fantuan website');
    }
  }

  // Removed loadCookies method since we're using existing browser session

  async generateSearchQuery(userPrompt: string): Promise<string> {
    // Simple keyword extraction for common food types
    const lowerPrompt = userPrompt.toLowerCase();
    
    if (lowerPrompt.includes('pizza')) {
      return 'pizza';
    } else if (lowerPrompt.includes('chinese') || lowerPrompt.includes('china')) {
      return 'chinese food';
    } else if (lowerPrompt.includes('burger')) {
      return 'burger';
    } else if (lowerPrompt.includes('sushi') || lowerPrompt.includes('japanese')) {
      return 'sushi';
    } else if (lowerPrompt.includes('thai')) {
      return 'thai food';
    } else if (lowerPrompt.includes('indian')) {
      return 'indian food';
    } else if (lowerPrompt.includes('korean')) {
      return 'korean food';
    } else if (lowerPrompt.includes('mexican')) {
      return 'mexican food';
    } else if (lowerPrompt.includes('italian')) {
      return 'italian food';
    } else {
      // Fallback to AI if no simple match
      const prompt = `Convert this food order request into an effective search query for a food delivery app: "${userPrompt}". 
      Return only the search query, no additional text. Focus on key food attributes like cuisine type, specific dishes, etc.`;

      try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'openai/gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500
        }, {
          headers: {
            'Authorization': `Bearer ${this.openRouteApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const data = response.data as OpenRouteResponse;
        return data.choices[0].message.content.trim();
      } catch (error) {
        console.error('Error generating search query:', error);
        return userPrompt;
      }
    }
  }

  async navigateToFoodApp(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    // Page should already be on food delivery app from initialize
    console.log('Already on food delivery app, ready to search');
    
    // Close any pop-ups or ads that might be blocking the interface
    await this.closePopups();
  }

  async closePopups(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Checking for pop-ups to close...');
    
    // Wait a moment for pop-ups to load
    await this.page.waitForTimeout(2000);
    
    // Try to close various types of pop-ups
    const popupCloseSelectors = [
      // Welcome Gift pop-up close button
      'button[class*="close"]',
      '.close-button',
      '[data-testid="close"]',
      'button:has-text("×")',
      'button:has-text("✕")',
      'button:has-text("Close")',
      // X button in circle
      'button[class*="x"]',
      '.x-button',
      // Modal close buttons
      '.modal-close',
      '[class*="modal"] button[class*="close"]',
      // Overlay close buttons
      '.overlay-close',
      '[class*="overlay"] button[class*="close"]'
    ];

    for (const selector of popupCloseSelectors) {
      try {
        const closeButton = await this.page.waitForSelector(selector, { timeout: 2000 });
        if (closeButton) {
          console.log(`Found pop-up close button with selector: ${selector}`);
          await closeButton.click();
          await this.page.waitForTimeout(1000);
          console.log('Pop-up closed successfully');
          return;
        }
      } catch (e) {
        continue;
      }
    }

    // Try pressing Escape key as fallback
    try {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(1000);
      console.log('Pressed Escape to close pop-ups');
    } catch (e) {
      console.log('No pop-ups found to close');
    }
  }

  async performSearch(searchQuery: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    // Wait for page to load completely
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(3000);

    // Try multiple search input selectors for Fantuan
    const searchSelectors = [
      'input[placeholder*="Search"]',
      'input[placeholder*="search"]',
      'input[placeholder*="Search restaurants"]',
      'input[placeholder*="search restaurants"]',
      'input[name="search"]',
      'input[data-testid="search-input"]',
      'input[role="searchbox"]',
      'input[type="search"]',
      'input[class*="search"]',
      'input[id*="search"]',
      // Fantuan specific selectors
      'input[class*="Search"]',
      'input[class*="search-input"]',
      'input[class*="searchInput"]'
    ];

    let searchInput = null;
    for (const selector of searchSelectors) {
      try {
        searchInput = await this.page.waitForSelector(selector, { timeout: 3000 });
        if (searchInput) {
          console.log(`Found search input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!searchInput) {
      // If no search input found, try clicking on search icon or button first
      try {
        const searchButton = await this.page.waitForSelector('button[class*="search"], .search-button, [data-testid="search-button"]', { timeout: 3000 });
        if (searchButton) {
          await searchButton.click();
          await this.page.waitForTimeout(2000);
          // Try to find search input again after clicking search button
          for (const selector of searchSelectors) {
            try {
              searchInput = await this.page.waitForSelector(selector, { timeout: 2000 });
              if (searchInput) break;
            } catch (e) {
              continue;
            }
          }
        }
      } catch (e) {
        console.log('No search button found either');
      }
    }

    if (!searchInput) {
      throw new Error('Could not find search input on Fantuan');
    }

    await searchInput.click();
    await searchInput.fill(searchQuery);
    await searchInput.press('Enter');
    await this.page.waitForLoadState('load');
    await this.page.waitForTimeout(5000);
  }

  async extractRestaurants(): Promise<Restaurant[]> {
    if (!this.page) throw new Error('Page not initialized');

    const restaurants: Restaurant[] = [];
    
    // Wait for restaurants to load
    await this.page.waitForTimeout(3000);
    
    // Try multiple selectors for restaurant cards on Fantuan
    const restaurantSelectors = [
      '[data-testid="store-card"]',
      '.restaurant-card',
      '[data-testid="restaurant-card"]',
      '.store-card',
      '.restaurant-item',
      '.merchant-card',
      '[class*="store"]',
      '[class*="restaurant"]'
    ];

    let restaurantCards: any[] = [];
    for (const selector of restaurantSelectors) {
      try {
        restaurantCards = await this.page.$$(selector);
        if (restaurantCards.length > 0) {
          console.log(`Found ${restaurantCards.length} restaurants with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    for (const card of restaurantCards) {
      try {
        // Try multiple selectors for each field
        const nameSelectors = [
          '[data-testid="store-title"]',
          '.restaurant-name',
          'h3',
          '.store-name',
          '.merchant-name',
          '[class*="name"]'
        ];
        
        const ratingSelectors = [
          '[data-testid="rating"]',
          '.rating',
          '.stars',
          '.score',
          '[class*="rating"]'
        ];
        
        const deliveryTimeSelectors = [
          '[data-testid="delivery-time"]',
          '.delivery-time',
          '.eta',
          '.delivery',
          '[class*="time"]'
        ];
        
        const cuisineSelectors = [
          '[data-testid="cuisine"]',
          '.cuisine',
          '.category',
          '.type',
          '[class*="cuisine"]'
        ];
        
        const priceSelectors = [
          '[data-testid="price"]',
          '.price',
          '.delivery-fee',
          '.fee',
          '[class*="price"]'
        ];
        
        const linkSelectors = [
          'a[data-testid="store-link"]',
          'a[href*="store"]',
          'a[href*="restaurant"]',
          'a[href*="merchant"]',
          'a'
        ];

        let name = '';
        let rating = '';
        let deliveryTime = '';
        let cuisine = '';
        let price = '';
        let href = '';

        // Extract name
        for (const selector of nameSelectors) {
          try {
            const element = await card.$(selector);
            if (element) {
              name = await element.textContent() || '';
              if (name.trim()) break;
            }
          } catch (e) {
            continue;
          }
        }

        // Extract rating
        for (const selector of ratingSelectors) {
          try {
            const element = await card.$(selector);
            if (element) {
              rating = await element.textContent() || '';
              if (rating.trim()) break;
            }
          } catch (e) {
            continue;
          }
        }

        // Extract delivery time
        for (const selector of deliveryTimeSelectors) {
          try {
            const element = await card.$(selector);
            if (element) {
              deliveryTime = await element.textContent() || '';
              if (deliveryTime.trim()) break;
            }
          } catch (e) {
            continue;
          }
        }

        // Extract cuisine
        for (const selector of cuisineSelectors) {
          try {
            const element = await card.$(selector);
            if (element) {
              cuisine = await element.textContent() || '';
              if (cuisine.trim()) break;
            }
          } catch (e) {
            continue;
          }
        }

        // Extract price
        for (const selector of priceSelectors) {
          try {
            const element = await card.$(selector);
            if (element) {
              price = await element.textContent() || '';
              if (price.trim()) break;
            }
          } catch (e) {
            continue;
          }
        }

        // Extract link
        for (const selector of linkSelectors) {
          try {
            const element = await card.$(selector);
            if (element) {
              href = await element.getAttribute('href') || '';
              if (href.trim()) break;
            }
          } catch (e) {
            continue;
          }
        }

        if (name.trim()) {
          restaurants.push({
            name: name.trim(),
            rating: rating.trim(),
            deliveryTime: deliveryTime.trim(),
            cuisine: cuisine.trim(),
            price: price.trim(),
            href: href.trim()
          });
        }
      } catch (error) {
        console.warn('Error extracting restaurant data:', error);
      }
    }

    return restaurants;
  }

  // Removed selectBestRestaurants method since we always select the first restaurant

  async clickRestaurant(restaurant: Restaurant): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`Looking for restaurant: ${restaurant.name}`);
    
    // Wait for search results to load
    await this.page.waitForTimeout(3000);
    
    // Try multiple selectors for restaurant cards in search results
    const restaurantSelectors = [
      '[data-testid="store-card"]',
      '.restaurant-card',
      '[data-testid="restaurant-card"]',
      '.store-card',
      '.restaurant-item',
      '.merchant-card',
      '[class*="store"]',
      '[class*="restaurant"]',
      '[class*="merchant"]',
      // Search results specific selectors
      '.search-result',
      '.result-item',
      '[class*="result"]'
    ];

    let restaurantCards: any[] = [];
    for (const selector of restaurantSelectors) {
      try {
        restaurantCards = await this.page.$$(selector);
        if (restaurantCards.length > 0) {
          console.log(`Found ${restaurantCards.length} restaurant cards with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (restaurantCards.length === 0) {
      throw new Error('No restaurant cards found on search results page');
    }
    
    // Simply click the first restaurant card (simplest approach)
    console.log('Clicking on the first restaurant card...');
    try {
      await restaurantCards[0].click();
      await this.page.waitForLoadState('load');
      await this.page.waitForTimeout(5000);
      console.log('Successfully clicked on first restaurant!');
      return;
    } catch (error) {
      console.error('Error clicking first restaurant:', error);
    }
    
    // Fallback: try to find by name if simple click fails
    for (const card of restaurantCards) {
      try {
        const nameSelectors = [
          '[data-testid="store-title"]',
          '.restaurant-name',
          'h3',
          '.store-name',
          '.merchant-name',
          '[class*="name"]',
          '[class*="title"]'
        ];
        
        let name = '';
        for (const selector of nameSelectors) {
          try {
            const element = await card.$(selector);
            if (element) {
              name = await element.textContent() || '';
              if (name.trim()) break;
            }
          } catch (e) {
            continue;
          }
        }
        
        console.log(`Checking restaurant: ${name}`);
        
        if (name && name.trim() === restaurant.name) {
          console.log(`Found restaurant: ${name}`);
          const linkSelectors = [
            'a[data-testid="store-link"]',
            'a[href*="store"]',
            'a[href*="restaurant"]',
            'a[href*="merchant"]',
            'a'
          ];
          
          for (const linkSelector of linkSelectors) {
            try {
              const linkElement = await card.$(linkSelector);
              if (linkElement) {
                await linkElement.click();
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(5000);
                console.log(`Clicked on restaurant: ${restaurant.name}`);
                return;
              }
            } catch (e) {
              continue;
            }
          }
        }
      } catch (error) {
        console.warn('Error checking restaurant card:', error);
      }
    }

    throw new Error(`Could not find or click restaurant: ${restaurant.name}`);
  }

  async selectPizzaAndToppings(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Looking for pizza items...');
    
    // Wait for menu to load
    await this.page.waitForTimeout(3000);
    
    // Look for pizza items
    const pizzaSelectors = [
      '[class*="pizza"]',
      '[class*="Pizza"]',
      'div:has-text("pizza")',
      'div:has-text("Pizza")',
      '.menu-item:has-text("pizza")',
      '.food-item:has-text("pizza")'
    ];

    let pizzaItems: any[] = [];
    for (const selector of pizzaSelectors) {
      try {
        pizzaItems = await this.page.$$(selector);
        if (pizzaItems.length > 0) {
          console.log(`Found ${pizzaItems.length} pizza items with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (pizzaItems.length === 0) {
      // If no specific pizza items found, look for any menu items
      const menuSelectors = [
        '.menu-item',
        '.food-item',
        '.item',
        '[class*="menu"]',
        '[class*="food"]'
      ];
      
      for (const selector of menuSelectors) {
        try {
          pizzaItems = await this.page.$$(selector);
          if (pizzaItems.length > 0) {
            console.log(`Found ${pizzaItems.length} menu items with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (pizzaItems.length === 0) {
      throw new Error('No pizza or menu items found');
    }

    // Click on the first pizza item
    console.log('Clicking on first pizza item...');
    await pizzaItems[0].click();
    await this.page.waitForTimeout(2000);

    // Look for add to cart or order button
    const addToCartSelectors = [
      'button:has-text("Add to Cart")',
      'button:has-text("Add")',
      'button:has-text("Order")',
      'button:has-text("Buy")',
      '[class*="add"]',
      '[class*="cart"]',
      '[class*="order"]'
    ];

    for (const selector of addToCartSelectors) {
      try {
        const button = await this.page.waitForSelector(selector, { timeout: 3000 });
        if (button) {
          console.log(`Found add to cart button with selector: ${selector}`);
          await button.click();
          await this.page.waitForTimeout(2000);
          console.log('Added pizza to cart!');
          return;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('No add to cart button found, but pizza item was selected');
  }

  async clickOrderNow(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    const orderNowButton = await this.page.waitForSelector('[data-testid="order-now-btn"], button:has-text("Order"), button:has-text("Add to Cart")', { timeout: 10000 });
    if (orderNowButton) {
      await orderNowButton.click();
      await this.page.waitForLoadState('load');
      await this.page.waitForTimeout(5000);
      console.log('Order now button clicked!');
      
      // Take screenshot and encode as base64
      await this.takeScreenshot();
    } else {
      throw new Error('Order now button not found');
    }
  }

  async takeScreenshot(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      console.log('Taking screenshot...');
      const screenshot = await this.page.screenshot({ 
        type: 'png',
        fullPage: true 
      });
      
      const base64Image = screenshot.toString('base64');
      console.log('Screenshot captured (base64):');
      console.log(`data:image/png;base64,${base64Image}`);
      
      // Also save to file for reference
      const fs = require('fs');
      const path = require('path');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = path.join(__dirname, filename);
      
      fs.writeFileSync(filepath, screenshot);
      console.log(`Screenshot also saved to: ${filename}`);
      
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  }

  async run(userPrompt: string): Promise<void> {
    try {
      console.log('Initializing agent...');
      await this.initialize();

      console.log('Generating search query...');
      const searchQuery = await this.generateSearchQuery(userPrompt);
      console.log(`Search query: ${searchQuery}`);

      console.log('Navigating to food delivery app...');
      await this.navigateToFoodApp();

      console.log('Performing search...');
      await this.performSearch(searchQuery);

      console.log('Extracting restaurants...');
      const restaurants = await this.extractRestaurants();
      console.log(`Found ${restaurants.length} restaurants`);

      if (restaurants.length === 0) {
        console.log('No restaurants found');
        return;
      }

      console.log('Found restaurants:');
      console.log(restaurants.map(r => `${r.name} - ${r.cuisine} - ${r.rating}`));
      
      // Always select the first restaurant (simplest approach)
      const selectedRestaurant = restaurants[0];
      console.log(`Selected first restaurant: ${selectedRestaurant.name}`);

      if (selectedRestaurant) {
        console.log('Clicking on first restaurant...');
        console.log(selectedRestaurant);
        await this.clickRestaurant(selectedRestaurant);

        console.log('Selecting pizza and adding to cart...');
        await this.selectPizzaAndToppings();

        console.log('Pizza added to cart! Browser left open for checkout.');
        console.log('💡 Complete your order in the browser, then return here.');
      }

    } catch (error) {
      console.error('Error in agent execution:', error);
    } finally {
      // Don't close browser - keep it open for manual checkout
      console.log('🌐 Browser will stay open for you to complete checkout');
      console.log('💡 Press Ctrl+C in this terminal when done with your order');
    }
  }
}

export default FoodAgent;

// CLI usage
if (require.main === module) {
  const userPrompt = process.argv[2];
  if (!userPrompt) {
    console.log('🍔 Food Ordering Agent');
    console.log('─'.repeat(30));
    console.log('What would you like to order?');
    console.log('Examples: "I want pizza", "I want Chinese food", "I want a burger"');
    console.log('');
    
    // Read input from user
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Enter your order: ', (input: string) => {
      rl.close();
      if (!input.trim()) {
        console.log('No order provided. Exiting...');
        process.exit(1);
      }
      
      const agent = new FoodAgent();
      agent.run(input.trim()).catch(console.error);
    });
  } else {
    const agent = new FoodAgent();
    agent.run(userPrompt).catch(console.error);
  }
}
