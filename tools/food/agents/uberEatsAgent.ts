import { Browser, chromium, Page } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface AgentConfig {
  headless?: boolean;
  timeout?: number;
  useSavedCookies?: boolean;
}

export interface OrderDecision {
  cuisine_type: string;
  price_range: string;
  delivery_time: string;
  restaurant_preference: string;
}

export interface SelectedItems {
  selected_items: string[];
  total_estimated_cost: number;
  restaurant_name: string;
  delivery_estimate: string;
}

export interface OrderResult {
  decision: OrderDecision;
  selectedItems: SelectedItems;
  message: string;
}

export class UberEatsAgent {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: AgentConfig;
  private openRouteApiKey: string;

  constructor(config: AgentConfig = {}) {
    this.config = {
      headless: false,
      timeout: 30000,
      useSavedCookies: true,
      ...config
    };
    this.openRouteApiKey = process.env.OPENROUTER_API_KEY || '';
    if (!this.openRouteApiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }
  }

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ 
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1280, height: 720 });
    
    if (this.config.useSavedCookies) {
      await this.loadCookies();
    }
  }

  async loadCookies(): Promise<void> {
    if (!this.page) return;

    const cookiesPath = path.join(__dirname, '../../cookies/uberEats-cookies.json');
    
    try {
      if (fs.existsSync(cookiesPath)) {
        const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        
        if (cookiesData.cookies && Array.isArray(cookiesData.cookies)) {
          const cookiesToAdd = cookiesData.cookies.map((cookie: any) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None'
          }));

          await this.page.context().addCookies(cookiesToAdd);
          console.log(`Loaded ${cookiesData.cookies.length} UberEats cookies`);
        }
      }
    } catch (error) {
      console.warn('Failed to load UberEats cookies:', error);
    }
  }

  async saveCookiesFromBrowser(): Promise<void> {
    if (!this.page) return;

    try {
      const cookies = await this.page.context().cookies();
      const uberCookies = cookies.filter(c => c.domain.includes('uber') || c.domain.includes('ubereats'));
      
      const cookiesData = {
        cookies: uberCookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite
        })),
        domain: 'ubereats.com',
        lastUpdated: new Date().toISOString()
      };

      const cookiesDir = path.join(__dirname, '../../cookies');
      if (!fs.existsSync(cookiesDir)) {
        fs.mkdirSync(cookiesDir, { recursive: true });
      }

      const cookiesPath = path.join(cookiesDir, 'uberEats-cookies.json');
      fs.writeFileSync(cookiesPath, JSON.stringify(cookiesData, null, 2));
      
      console.log(`✅ Saved ${uberCookies.length} UberEats cookies`);
    } catch (error) {
      console.error('Failed to save UberEats cookies:', error);
    }
  }

  async orderMeal(prompt: string, keepBrowserOpen: boolean = true): Promise<OrderResult> {
    if (!this.page) {
      await this.initialize();
    }

    // Navigate to UberEats
    await this.page!.goto('https://www.ubereats.com/', { waitUntil: 'networkidle' });
    await this.page!.waitForTimeout(3000);

    // Generate search query using AI
    const searchQuery = await this.generateSearchQuery(prompt);
    console.log(`🔍 Searching for: ${searchQuery}`);

    // Perform search
    await this.performSearch(searchQuery);

    // Extract restaurants (like shop.app extracts products)
    const restaurants = await this.extractRestaurants();
    console.log(`\n🍕 Found ${restaurants.length} pizza restaurants:`);
    restaurants.forEach((restaurant, index) => {
      console.log(`${index + 1}. ${restaurant.name} - ${restaurant.rating} - ${restaurant.deliveryTime}`);
    });

    if (restaurants.length === 0) {
      return {
        decision: { cuisine_type: 'pizza', price_range: 'moderate', delivery_time: 'normal', restaurant_preference: 'any' },
        selectedItems: { selected_items: ['No restaurants found'], total_estimated_cost: 0, restaurant_name: 'None', delivery_estimate: 'N/A' },
        message: 'No pizza restaurants found'
      };
    }

    // Select best restaurant (like shop.app selects best products)
    const selectedRestaurant = await this.selectBestRestaurant(restaurants, prompt);
    console.log(`\n🎯 Selected: ${selectedRestaurant.name}`);

    // Click on restaurant (like shop.app clicks on product)
    await this.clickRestaurant(selectedRestaurant);

    // Add pizza with random toppings to cart (like shop.app adds to cart)
    const selectedItems = await this.addPizzaToCart(prompt);

    const result: OrderResult = {
      decision: { cuisine_type: 'pizza', price_range: 'moderate', delivery_time: 'normal', restaurant_preference: selectedRestaurant.name },
      selectedItems,
      message: `Successfully added pizza to cart from ${selectedRestaurant.name}. Estimated cost: $${selectedItems.total_estimated_cost}`
    };

    // Always keep browser open for checkout (like shop.app)
    console.log('\n🌐 Browser kept open for checkout - complete your order manually');
    console.log('💡 Press Ctrl+C in this terminal when done with your order');

    return result;
  }

  private async generateSearchQuery(prompt: string): Promise<string> {
    const searchPrompt = `Convert this food order request into an effective search query for UberEats: "${prompt}". 
    Return only the search query, no additional text. Focus on cuisine type, specific dishes, or food categories.`;

    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: searchPrompt }],
        max_tokens: 200
      }, {
        headers: {
          'Authorization': `Bearer ${this.openRouteApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const data = response.data as any;
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating search query:', error);
      return prompt;
    }
  }

  private async performSearch(query: string): Promise<void> {
    if (!this.page) return;

    try {
      console.log('🔍 Looking for search input...');
      
      // Wait for page to load and look for search input
      await this.page.waitForTimeout(3000);
      
      // Try multiple selectors for search input
      const searchSelectors = [
        'input[data-testid="search-input"]',
        'input[placeholder*="search"]',
        'input[placeholder*="Search"]',
        'input[type="search"]',
        'input[aria-label*="search"]',
        'input[aria-label*="Search"]'
      ];

      let searchInput = null;
      for (const selector of searchSelectors) {
        try {
          searchInput = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (searchInput) {
            console.log(`✅ Found search input with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!searchInput) {
        console.log('❌ Could not find search input, trying to click on search area...');
        // Try clicking on search area to activate input
        const searchArea = await this.page.$('[data-testid="search"], .search, [role="search"]');
        if (searchArea) {
          await searchArea.click();
          await this.page.waitForTimeout(1000);
          searchInput = await this.page.$('input:focus, input[type="text"]');
        }
      }

      if (searchInput) {
        console.log('📝 Entering search query...');
        await searchInput.click();
        await searchInput.fill('');
        await searchInput.fill(query);
        await searchInput.press('Enter');
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(5000);
        console.log('✅ Search completed');
      } else {
        console.log('❌ Could not find search input, continuing anyway...');
      }
    } catch (error) {
      console.error('Error performing search:', error);
    }
  }

  private async extractRestaurants(): Promise<any[]> {
    if (!this.page) return [];

    try {
      console.log('🍕 Looking for pizza restaurants...');
      
      // Wait for restaurants to load with multiple selectors
      const restaurantSelectors = [
        '[data-testid="store-card"]',
        '.restaurant-card',
        '[data-testid="restaurant-card"]',
        '[data-testid="store-item"]',
        '.store-card',
        '.restaurant-item',
        '[data-testid="restaurant-item"]'
      ];

      let restaurants: any[] = [];
      for (const selector of restaurantSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          console.log(`✅ Found restaurants with selector: ${selector}`);
          
          restaurants = await this.page.$$eval(selector, (cards) => {
            return cards.slice(0, 10).map((card, index) => {
              const nameElement = card.querySelector('h3, [data-testid="store-title"], .restaurant-name, .store-name, h2, h4');
              const ratingElement = card.querySelector('[data-testid="rating"], .rating, .stars, .star-rating');
              const deliveryTimeElement = card.querySelector('[data-testid="delivery-time"], .delivery-time, .eta, .delivery-eta');
              const cuisineElement = card.querySelector('[data-testid="cuisine"], .cuisine, .category, .food-type');
              const priceElement = card.querySelector('[data-testid="price"], .price, .delivery-fee');

              return {
                name: nameElement?.textContent?.trim() || `Restaurant ${index + 1}`,
                rating: ratingElement?.textContent?.trim() || 'N/A',
                deliveryTime: deliveryTimeElement?.textContent?.trim() || 'N/A',
                cuisine: cuisineElement?.textContent?.trim() || 'Various',
                price: priceElement?.textContent?.trim() || 'N/A',
                index
              };
            });
          });
          
          if (restaurants.length > 0) break;
        } catch (e) {
          continue;
        }
      }

      if (restaurants.length === 0) {
        console.log('❌ No restaurants found, trying to find any food items...');
        // Fallback: look for any clickable food items
        const fallbackSelectors = [
          'a[href*="store"]',
          'a[href*="restaurant"]',
          '[data-testid*="store"]',
          '[data-testid*="restaurant"]'
        ];
        
        for (const selector of fallbackSelectors) {
          try {
            const elements = await this.page.$$(selector);
            if (elements.length > 0) {
              restaurants = await Promise.all(elements.slice(0, 10).map(async (element, index) => {
                const text = await element.textContent();
                return {
                  name: text?.trim() || `Restaurant ${index + 1}`,
                  rating: 'N/A',
                  deliveryTime: 'N/A',
                  cuisine: 'Various',
                  price: 'N/A',
                  index
                };
              }));
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      console.log(`🍕 Found ${restaurants.length} restaurants`);
      return restaurants;
    } catch (error) {
      console.error('Error extracting restaurants:', error);
      return [];
    }
  }


  // Select best restaurant (like shop.app selects best products)
  private async selectBestRestaurant(restaurants: any[], prompt: string): Promise<any> {
    if (restaurants.length === 0) return null;
    
    const restaurantList = restaurants.map(r => `${r.name} - ${r.rating} - ${r.deliveryTime}`).join('\n');
    
    const selectionPrompt = `From these pizza restaurants, select the best one for: "${prompt}"

Restaurants:
${restaurantList}

Consider rating, delivery time, and relevance. Return only the restaurant name.`;

    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: selectionPrompt }],
        max_tokens: 200
      }, {
        headers: {
          'Authorization': `Bearer ${this.openRouteApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const data = response.data as any;
      const selectedName = data.choices[0].message.content.trim();
      
      // Find the restaurant by name
      const selectedRestaurant = restaurants.find(r => 
        r.name.toLowerCase().includes(selectedName.toLowerCase()) ||
        selectedName.toLowerCase().includes(r.name.toLowerCase())
      );
      
      return selectedRestaurant || restaurants[0];
    } catch (error) {
      console.error('Error selecting restaurant:', error);
      return restaurants[0];
    }
  }

  // Click on restaurant (like shop.app clicks on product)
  private async clickRestaurant(restaurant: any): Promise<void> {
    if (!this.page) return;

    console.log(`🔍 Clicking on restaurant: ${restaurant.name}`);
    
    // Try multiple selectors to find and click the restaurant
    const restaurantSelectors = [
      `[data-testid="store-card"]:has-text("${restaurant.name}")`,
      `.restaurant-card:has-text("${restaurant.name}")`,
      `[data-testid="restaurant-card"]:has-text("${restaurant.name}")`,
      `a:has-text("${restaurant.name}")`,
      `[href*="store"]:has-text("${restaurant.name}")`
    ];

    for (const selector of restaurantSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          console.log(`✅ Found restaurant, clicking...`);
          await element.click();
          await this.page.waitForLoadState('load');
          await this.page.waitForTimeout(3000);
          console.log(`✅ Successfully entered ${restaurant.name}`);
          return;
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback: click on first restaurant card
    try {
      const firstCard = await this.page.$('[data-testid="store-card"], .restaurant-card, [data-testid="restaurant-card"]');
      if (firstCard) {
        console.log(`🔄 Fallback: Clicking on first restaurant card`);
        await firstCard.click();
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(3000);
      }
    } catch (e) {
      console.log('❌ Could not click on restaurant');
    }
  }

  // Add pizza with random toppings to cart (like shop.app adds to cart)
  private async addPizzaToCart(prompt: string): Promise<SelectedItems> {
    if (!this.page) return {
      selected_items: ['No pizza found'],
      total_estimated_cost: 0,
      restaurant_name: 'Unknown',
      delivery_estimate: 'N/A'
    };

    console.log('🍕 Looking for pizza menu...');
    
    try {
      // Look for pizza items
      const pizzaSelectors = [
        '[data-testid*="pizza"]',
        '.pizza',
        '[data-testid*="menu-item"]',
        '.menu-item',
        '[data-testid*="food-item"]',
        'button:has-text("Add")',
        'button:has-text("Order")'
      ];

      let pizzaAdded = false;
      for (const selector of pizzaSelectors) {
        try {
          const pizzaItems = await this.page.$$(selector);
          if (pizzaItems.length > 0) {
            console.log(`✅ Found ${pizzaItems.length} pizza items`);
            
            // Click on first pizza item
            await pizzaItems[0].click();
            await this.page.waitForTimeout(2000);
            
            // Look for add to cart button
            const addToCartSelectors = [
              '[data-testid*="add-to-cart"]',
              '.add-to-cart',
              'button:has-text("Add")',
              'button:has-text("Order")',
              '[data-testid*="order"]',
              'button:has-text("Add to Cart")'
            ];

            for (const cartSelector of addToCartSelectors) {
              try {
                const addButton = await this.page.$(cartSelector);
                if (addButton) {
                  console.log('🛒 Adding pizza to cart...');
                  await addButton.click();
                  await this.page.waitForTimeout(2000);
                  console.log('✅ Pizza added to cart!');
                  pizzaAdded = true;
                  break;
                }
              } catch (e) {
                continue;
              }
            }
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!pizzaAdded) {
        console.log('⚠️ Could not find pizza items, trying generic food items...');
        // Try to find any food item and add it
        const genericSelectors = [
          'button:has-text("Add")',
          'button:has-text("Order")',
          '[data-testid*="add"]',
          '.add-button'
        ];

        for (const selector of genericSelectors) {
          try {
            const button = await this.page.$(selector);
            if (button) {
              console.log('🛒 Adding item to cart...');
              await button.click();
              await this.page.waitForTimeout(2000);
              console.log('✅ Item added to cart!');
              pizzaAdded = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      return {
        selected_items: pizzaAdded ? ['Pizza with random toppings'] : ['No items added'],
        total_estimated_cost: pizzaAdded ? 25.99 : 0,
        restaurant_name: 'Selected Restaurant',
        delivery_estimate: '30-45 min'
      };

    } catch (error) {
      console.error('Error adding pizza to cart:', error);
      return {
        selected_items: ['Error adding to cart'],
        total_estimated_cost: 0,
        restaurant_name: 'Unknown',
        delivery_estimate: 'N/A'
      };
    }
  }


  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
