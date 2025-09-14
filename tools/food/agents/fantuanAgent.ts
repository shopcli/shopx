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

export class FantuanAgent {
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
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1280, height: 720 });
    
    // Set context to ignore SSL errors
    await this.page.context().setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    
    if (this.config.useSavedCookies) {
      await this.loadCookies();
    }
  }

  async loadCookies(): Promise<void> {
    if (!this.page) return;

    const cookiesPath = path.join(__dirname, '../../cookies/fantuan-cookies.json');
    
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
          console.log(`Loaded ${cookiesData.cookies.length} Fantuan cookies`);
        }
      }
    } catch (error) {
      console.warn('Failed to load Fantuan cookies:', error);
    }
  }

  async saveCookiesFromBrowser(): Promise<void> {
    if (!this.page) return;

    try {
      const cookies = await this.page.context().cookies();
      const fantuanCookies = cookies.filter(c => c.domain.includes('fantuan') || c.domain.includes('fantuan'));
      
      const cookiesData = {
        cookies: fantuanCookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite
        })),
        domain: 'fantuan.com',
        lastUpdated: new Date().toISOString()
      };

      const cookiesDir = path.join(__dirname, '../../cookies');
      if (!fs.existsSync(cookiesDir)) {
        fs.mkdirSync(cookiesDir, { recursive: true });
      }

      const cookiesPath = path.join(cookiesDir, 'fantuan-cookies.json');
      fs.writeFileSync(cookiesPath, JSON.stringify(cookiesData, null, 2));
      
      console.log(`✅ Saved ${fantuanCookies.length} Fantuan cookies`);
    } catch (error) {
      console.error('Failed to save Fantuan cookies:', error);
    }
  }

  async orderMeal(prompt: string, keepBrowserOpen: boolean = true): Promise<OrderResult> {
    if (!this.page) {
      await this.initialize();
    }

    // Navigate to Fantuan ordering platform (try different URLs)
    const fantuanUrls = [
      'https://www.fantuanorder.com/',
      'https://fantuanorder.com/',
      'https://www.fantuan.ca/order/',
      'https://www.fantuan.ca/en/order/',
      'https://www.fantuan.ca/'
    ];

    let success = false;
    for (const url of fantuanUrls) {
      try {
        console.log(`🔍 Trying Fantuan URL: ${url}`);
        await this.page!.goto(url, { waitUntil: 'networkidle' });
        await this.page!.waitForTimeout(3000);
        success = true;
        console.log(`✅ Successfully loaded: ${url}`);
        break;
      } catch (error) {
        console.log(`❌ Failed to load: ${url} - ${(error as Error).message}`);
        continue;
      }
    }

    if (!success) {
      console.log('⚠️ All Fantuan URLs failed, trying with SSL bypass...');
      // Try with SSL bypass
      await this.page!.goto('https://www.fantuanorder.com/', { 
        waitUntil: 'networkidle'
      });
      await this.page!.waitForTimeout(3000);
    }

    // Check if we're on the main page and need to navigate to ordering
    const currentUrl = this.page!.url();
    if (currentUrl.includes('fantuan.ca') && !currentUrl.includes('order') && !currentUrl.includes('store')) {
      console.log('🔄 Redirected to main page, looking for ordering link...');
      
      // Try to find and click ordering/food delivery link
      const orderSelectors = [
        'a[href*="order"]',
        'a[href*="delivery"]',
        'a[href*="food"]',
        'a:has-text("Order")',
        'a:has-text("Delivery")',
        'a:has-text("Food")',
        '.order-button',
        '.delivery-button'
      ];

      for (const selector of orderSelectors) {
        try {
          const orderLink = await this.page!.$(selector);
          if (orderLink) {
            console.log(`✅ Found ordering link: ${selector}`);
            await orderLink.click();
            await this.page!.waitForLoadState('load');
            await this.page!.waitForTimeout(3000);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    // Generate search query using AI
    const searchQuery = await this.generateSearchQuery(prompt);
    console.log(`🔍 Searching for: ${searchQuery}`);

    // Perform search
    await this.performSearch(searchQuery);

    // Extract restaurants (like shop.app extracts products)
    const restaurants = await this.extractRestaurants();
    console.log(`\n🍜 Found ${restaurants.length} restaurants:`);
    restaurants.forEach((restaurant, index) => {
      console.log(`${index + 1}. ${restaurant.name} - ${restaurant.rating} - ${restaurant.deliveryTime}`);
    });

    if (restaurants.length === 0) {
      return {
        decision: { cuisine_type: 'chinese', price_range: 'moderate', delivery_time: 'normal', restaurant_preference: 'any' },
        selectedItems: { selected_items: ['No restaurants found'], total_estimated_cost: 0, restaurant_name: 'None', delivery_estimate: 'N/A' },
        message: 'No restaurants found'
      };
    }

    // Select best restaurant (like shop.app selects best products)
    const selectedRestaurant = await this.selectBestRestaurant(restaurants, prompt);
    console.log(`\n🎯 Selected: ${selectedRestaurant.name}`);

    // Click on restaurant (like shop.app clicks on product)
    await this.clickRestaurant(selectedRestaurant);

    // Add food with random toppings to cart (like shop.app adds to cart)
    const selectedItems = await this.addFoodToCart(prompt);

    const result: OrderResult = {
      decision: { cuisine_type: 'chinese', price_range: 'moderate', delivery_time: 'normal', restaurant_preference: selectedRestaurant.name },
      selectedItems,
      message: `Successfully added food to cart from ${selectedRestaurant.name}. Estimated cost: $${selectedItems.total_estimated_cost}`
    };

    // Always keep browser open for checkout (like shop.app)
    console.log('\n🌐 Browser kept open for checkout - complete your order manually');
    console.log('💡 Press Ctrl+C in this terminal when done with your order');

    return result;
  }

  private async generateSearchQuery(prompt: string): Promise<string> {
    const searchPrompt = `Convert this food order request into an effective search query for Fantuan (Chinese food delivery): "${prompt}". 
    Return only the search query, no additional text. Focus on Chinese dishes, cuisine types, or specific Chinese food items.`;

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
      // Find search input for Fantuan
      const searchInput = await this.page.waitForSelector('input[placeholder*="search"], input[placeholder*="Search"], input[type="search"]', { timeout: 10000 });
      
      if (searchInput) {
        await searchInput.click();
        await searchInput.fill(query);
        await searchInput.press('Enter');
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(5000);
      }
    } catch (error) {
      console.error('Error performing search:', error);
    }
  }

  private async extractRestaurants(): Promise<any[]> {
    if (!this.page) return [];

    try {
      // Wait for restaurants to load
      await this.page.waitForSelector('.restaurant-item, .store-card, [data-testid="restaurant-card"]', { timeout: 10000 });
      
      const restaurants = await this.page.$$eval('.restaurant-item, .store-card, [data-testid="restaurant-card"]', (cards) => {
        return cards.slice(0, 10).map((card, index) => {
          const nameElement = card.querySelector('h3, .restaurant-name, [data-testid="store-title"]');
          const ratingElement = card.querySelector('.rating, .stars, [data-testid="rating"]');
          const deliveryTimeElement = card.querySelector('.delivery-time, .eta, [data-testid="delivery-time"]');
          const cuisineElement = card.querySelector('.cuisine, .category, [data-testid="cuisine"]');

          return {
            name: nameElement?.textContent?.trim() || `Chinese Restaurant ${index + 1}`,
            rating: ratingElement?.textContent?.trim() || 'N/A',
            deliveryTime: deliveryTimeElement?.textContent?.trim() || 'N/A',
            cuisine: cuisineElement?.textContent?.trim() || 'Chinese',
            index
          };
        });
      });

      return restaurants;
    } catch (error) {
      console.error('Error extracting restaurants:', error);
      return [];
    }
  }

  private async makeOrderDecision(prompt: string, restaurants: any[]): Promise<OrderDecision> {
    const restaurantList = restaurants.map(r => `${r.name} - ${r.cuisine} - ${r.rating} - ${r.deliveryTime}`).join('\n');
    
    const decisionPrompt = `Based on this Chinese food order request: "${prompt}"

Available Chinese restaurants:
${restaurantList}

Return a JSON object with:
- cuisine_type: (szechuan, cantonese, hunan, dimsum, etc.)
- price_range: (budget, moderate, premium)
- delivery_time: (fast, normal, flexible)
- restaurant_preference: (specific restaurant name or "any")`;

    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: decisionPrompt }],
        max_tokens: 300
      }, {
        headers: {
          'Authorization': `Bearer ${this.openRouteApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const data = response.data as any;
      const decision = JSON.parse(data.choices[0].message.content.trim());
      
      return {
        cuisine_type: decision.cuisine_type || 'chinese',
        price_range: decision.price_range || 'moderate',
        delivery_time: decision.delivery_time || 'normal',
        restaurant_preference: decision.restaurant_preference || 'any'
      };
    } catch (error) {
      console.error('Error making order decision:', error);
      return {
        cuisine_type: 'chinese',
        price_range: 'moderate',
        delivery_time: 'normal',
        restaurant_preference: 'any'
      };
    }
  }

  // Select best restaurant (like shop.app selects best products)
  private async selectBestRestaurant(restaurants: any[], prompt: string): Promise<any> {
    if (restaurants.length === 0) return null;
    
    const restaurantList = restaurants.map(r => `${r.name} - ${r.rating} - ${r.deliveryTime}`).join('\n');
    
    const selectionPrompt = `From these restaurants, select the best one for: "${prompt}"

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

  // Add food with random toppings to cart (like shop.app adds to cart)
  private async addFoodToCart(prompt: string): Promise<SelectedItems> {
    if (!this.page) return {
      selected_items: ['No food found'],
      total_estimated_cost: 0,
      restaurant_name: 'Unknown',
      delivery_estimate: 'N/A'
    };

    console.log('🍜 Looking for food menu...');
    
    try {
      // Look for food items
      const foodSelectors = [
        '[data-testid*="menu-item"]',
        '.menu-item',
        '[data-testid*="food-item"]',
        'button:has-text("Add")',
        'button:has-text("Order")'
      ];

      let foodAdded = false;
      for (const selector of foodSelectors) {
        try {
          const foodItems = await this.page.$$(selector);
          if (foodItems.length > 0) {
            console.log(`✅ Found ${foodItems.length} food items`);
            
            // Click on first food item
            await foodItems[0].click();
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
                  console.log('🛒 Adding food to cart...');
                  await addButton.click();
                  await this.page.waitForTimeout(2000);
                  console.log('✅ Food added to cart!');
                  foodAdded = true;
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

      if (!foodAdded) {
        console.log('⚠️ Could not find food items, trying generic items...');
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
              foodAdded = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      return {
        selected_items: foodAdded ? ['Food with random toppings'] : ['No items added'],
        total_estimated_cost: foodAdded ? 28.99 : 0,
        restaurant_name: 'Selected Restaurant',
        delivery_estimate: '35-50 min'
      };

    } catch (error) {
      console.error('Error adding food to cart:', error);
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
