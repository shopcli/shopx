import puppeteer, { Browser, Page } from 'puppeteer';
import { OpenRouterClient } from '../lib/openrouter';
import {
  AgentConfig,
  MealDecision,
  MenuItem,
  Restaurant,
  SelectedItems,
  OrderResult
} from '../lib/types';

export class UberEatsAgent {
  private config: Required<AgentConfig>;
  private openRouter: OpenRouterClient;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(config: AgentConfig = {}) {
    this.config = {
      headless: config.headless !== false,
      address: config.address || 'Engineering 7, 200 University Ave W, Waterloo, ON N2L 3G5',
      openRouterApiKey: config.openRouterApiKey || process.env.OPENAI_API_KEY || '',
      timeout: config.timeout || 30000
    };

    this.openRouter = new OpenRouterClient(this.config.openRouterApiKey);
  }

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 }
    });

    this.page = await this.browser.newPage();
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    this.page.setDefaultTimeout(this.config.timeout);
  }

  async navigateToUberEats(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Navigating to Uber Eats...');
    await this.page.goto('https://www.ubereats.com/', { waitUntil: 'networkidle2' });

    try {
      const acceptCookies = await this.page.$('[data-testid="accept-cookies"]');
      if (acceptCookies) {
        await acceptCookies.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (e) {
      // Cookie banner might not be present
    }
  }

  async setDeliveryAddress(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Setting delivery address...');

    const addressSelectors = [
      'input[placeholder*="Enter delivery address"]',
      'input[placeholder*="address"]',
      '[data-testid="address-input"]',
      '#location-typeahead-home-input'
    ];

    let addressInput = null;
    for (const selector of addressSelectors) {
      addressInput = await this.page.$(selector);
      if (addressInput) break;
    }

    if (addressInput) {
      await addressInput.click();
      await this.page.keyboard.type(this.config.address, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      await this.page.keyboard.press('ArrowDown');
      await this.page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('Could not find address input, continuing...');
    }
  }

  async searchForFood(query: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`Searching for: ${query}`);

    const searchSelectors = [
      'input[placeholder*="Food, groceries, drinks"]',
      'input[placeholder*="Search"]',
      '[data-testid="search-input"]',
      'input[type="search"]'
    ];

    let searchInput = null;
    for (const selector of searchSelectors) {
      searchInput = await this.page.$(selector);
      if (searchInput) break;
    }

    if (searchInput) {
      await searchInput.click();
      await this.page.keyboard.type(query, { delay: 50 });
      await this.page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      throw new Error('Could not find search input');
    }
  }

  async selectRestaurant(preferences: Partial<MealDecision> = {}): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Analyzing restaurants with AI...');

    await this.page.waitForSelector('a[href*="/store/"]', { timeout: 10000 });

    const restaurants = await this.page.$$eval('a[href*="/store/"]', (links): Restaurant[] =>
      links.map(link => ({
        url: link.href,
        name: (link.querySelector('h3') as HTMLElement)?.textContent || 'Unknown',
        rating: (link.querySelector('[aria-label*="rating"]') as HTMLElement)?.textContent || 'No rating',
        deliveryTime: (link.querySelector('[data-testid*="delivery-time"], span[aria-label*="minutes"]') as HTMLElement)?.textContent || 'Unknown',
        priceLevel: (link.querySelectorAll('[data-testid*="price-bucket"] span').length || 1)
      }))
    );

    if (restaurants.length === 0) {
      throw new Error('No restaurants found');
    }

    console.log(`Found ${restaurants.length} restaurants, using AI to select best match...`);

    let selectedRestaurant = restaurants[0];
    let reasoning = 'Default selection (first restaurant)';

    if (restaurants.length > 1 && preferences) {
      try {
        const aiSelection = await this.openRouter.selectBestRestaurant(restaurants, preferences as MealDecision);
        selectedRestaurant = aiSelection.selectedRestaurant;
        reasoning = aiSelection.reasoning;
        console.log(`AI Selection Reasoning: ${reasoning}`);
      } catch (error) {
        console.log('AI restaurant selection failed, using fallback logic');
        if (preferences.restaurant_preferences) {
          const preferred = restaurants.find(r =>
            r.name.toLowerCase().includes(preferences.restaurant_preferences!.toLowerCase())
          );
          if (preferred) {
            selectedRestaurant = preferred;
            reasoning = `Found restaurant matching preference: ${preferences.restaurant_preferences}`;
          }
        }
      }
    }

    console.log(`Selected restaurant: ${selectedRestaurant.name} - ${reasoning}`);
    await this.page.goto(selectedRestaurant.url, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async extractMenuItems(): Promise<MenuItem[]> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Extracting menu items...');

    await this.autoScroll();

    // Try multiple selector strategies for menu items
    const selectorStrategies = [
      '[data-testid*="menu-item"], [data-test*="store-item"]',
      '[data-testid*="item"], [role="button"]:has(h3)',
      'div[data-testid] h3, div[data-test] h3',
      'li:has(h3), div:has(h3):has([data-testid*="price"])',
      'button:has(h3), a:has(h3)',
    ];

    let items: MenuItem[] = [];

    for (const selector of selectorStrategies) {
      try {
        console.log(`Trying selector: ${selector}`);

        items = await this.page.$$eval(
          selector,
          (elements): MenuItem[] => {
            const menuItems: MenuItem[] = [];

            elements.forEach(el => {
              // Try different ways to extract item name
              let name = '';
              const nameSelectors = ['h3', '[data-testid*="item-name"]', '[data-testid*="title"]', 'span[class*="title"]', 'div[class*="title"]'];

              for (const nameSelector of nameSelectors) {
                const nameEl = el.querySelector(nameSelector) as HTMLElement;
                if (nameEl?.textContent?.trim()) {
                  name = nameEl.textContent.trim();
                  break;
                }
              }

              // If no name found, try the element's own text content
              if (!name && el.textContent) {
                const text = el.textContent.trim();
                if (text.length > 3 && text.length < 100) {
                  name = text.split('\n')[0].trim();
                }
              }

              // Extract price
              let price = '$0.00';
              const priceSelectors = ['[data-testid*="price"]', 'span[aria-label*="price"]', 'span[class*="price"]', 'div[class*="price"]'];

              for (const priceSelector of priceSelectors) {
                const priceEl = el.querySelector(priceSelector) as HTMLElement;
                if (priceEl?.textContent?.includes('$')) {
                  price = priceEl.textContent.trim();
                  break;
                }
              }

              // Look for price in text content if not found
              if (price === '$0.00' && el.textContent) {
                const priceMatch = el.textContent.match(/\$\d+\.?\d*/);
                if (priceMatch) {
                  price = priceMatch[0];
                }
              }

              // Extract description
              const descSelectors = ['[data-testid*="description"]', 'span[color="textSecondary"]', 'p', 'div[class*="description"]'];
              let description = '';

              for (const descSelector of descSelectors) {
                const descEl = el.querySelector(descSelector) as HTMLElement;
                if (descEl?.textContent?.trim()) {
                  description = descEl.textContent.trim();
                  break;
                }
              }

              if (name && name !== 'Unknown Item' && name.length > 2) {
                menuItems.push({ name, price, description });
              }
            });

            return menuItems;
          }
        );

        console.log(`Found ${items.length} items with selector: ${selector}`);

        if (items.length > 0) {
          break; // Use first successful strategy
        }
      } catch (error) {
        console.log(`Selector ${selector} failed:`, error);
        continue;
      }
    }

    // If still no items found, try a more general approach
    if (items.length === 0) {
      console.log('Trying fallback extraction...');

      items = await this.page.evaluate(() => {
        const menuItems: any[] = [];

        // Look for any element that contains both text that looks like a food item and a price
        const allElements = Array.from(document.querySelectorAll('*'));

        allElements.forEach(el => {
          if (el.children.length === 0) return; // Skip leaf nodes

          const text = el.textContent || '';
          const hasPrice = /\$\d+\.?\d*/.test(text);
          const hasName = text.length > 10 && text.length < 200;

          if (hasPrice && hasName) {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length >= 2) {
              const name = lines[0];
              const priceMatch = text.match(/\$\d+\.?\d*/);
              const price = priceMatch ? priceMatch[0] : '$0.00';

              if (name && name.length > 2 && name.length < 50) {
                menuItems.push({
                  name,
                  price,
                  description: lines.slice(1, 3).join(' ')
                });
              }
            }
          }
        });

        return menuItems;
      });
    }

    console.log(`Final result: Found ${items.length} menu items`);
    if (items.length > 0) {
      console.log('Sample items:', items.slice(0, 3));
    }

    return items;
  }

  async addItemToCart(itemName: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`Adding ${itemName} to cart...`);

    try {
      // Try to find and click the item
      const clicked = await this.page.evaluate((name: string) => {
        const elements = Array.from(document.querySelectorAll('*'));
        const element = elements.find(el => el.textContent?.includes(name));
        if (element && element instanceof HTMLElement) {
          element.click();
          return true;
        }
        return false;
      }, itemName);

      if (clicked) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Look for add to cart button and click it
        const buttonClicked = await this.page.evaluate(() => {
          // First try data-testid selector
          let button = document.querySelector('[data-testid*="add-to-cart"]') as HTMLElement;

          if (!button) {
            // Try finding button by text content
            const buttons = Array.from(document.querySelectorAll('button'));
            button = buttons.find(btn =>
              btn.textContent?.includes('Add to Cart') ||
              btn.textContent?.includes('Add 1 to Cart') ||
              btn.textContent?.includes('Add to Order') ||
              btn.textContent?.includes('Add') ||
              btn.getAttribute('aria-label')?.includes('Add')
            ) as HTMLElement;
          }

          if (button) {
            button.click();
            return true;
          }
          return false;
        });

        if (buttonClicked) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Handle any required options
          const requiredOptions = await this.page.$$('[role="radio"], input[type="radio"]');
          if (requiredOptions.length > 0) {
            await requiredOptions[0].click();
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log(`✅ Added ${itemName} to cart`);
        } else {
          console.log(`⚠️ Could not find add to cart button for ${itemName}`);
        }
      } else {
        console.log(`⚠️ Could not find item: ${itemName}`);
      }
    } catch (error) {
      console.error(`❌ Error adding ${itemName} to cart:`, error);
    }
  }

  private async autoScroll(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  async orderMeal(prompt: string): Promise<OrderResult> {
    try {
      await this.initialize();

      console.log('🤖 Getting intelligent meal recommendations from OpenRouter...');
      const mealDecision = await this.openRouter.decideMeal(prompt);
      console.log('🎯 AI Decision:', JSON.stringify(mealDecision, null, 2));

      await this.navigateToUberEats();
      await this.setDeliveryAddress();

      const searchQuery = mealDecision.cuisine_type || mealDecision.restaurant_preferences || 'food';
      console.log(`🔍 Searching for category: "${searchQuery}"`);
      console.log(`📋 Search Strategy: ${(mealDecision as any).search_strategy || 'Using AI-recommended cuisine type'}`);

      await this.searchForFood(searchQuery);
      await this.selectRestaurant(mealDecision);

      console.log('📋 Extracting and analyzing menu items...');
      const menuItems = await this.extractMenuItems();
      console.log(`Found ${menuItems.length} menu items`);

      console.log('🤖 Using AI to select optimal menu items...');
      const selectedItems = await this.openRouter.analyzeMenuItems(menuItems, mealDecision);
      console.log('✅ AI Menu Analysis:', JSON.stringify(selectedItems, null, 2));

      console.log('🛒 Adding selected items to cart...');
      for (const itemName of selectedItems.selected_items || []) {
        await this.addItemToCart(itemName);
      }

      console.log('🎉 Order prepared successfully!');
      console.log('⚠️  Note: Checkout process not automated for safety. Please complete manually.');

      return {
        success: true,
        decision: mealDecision,
        selectedItems: selectedItems,
        message: 'Order prepared in cart with AI optimization. Please complete checkout manually.'
      };

    } catch (error) {
      console.error('❌ Error during order process:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}