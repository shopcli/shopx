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
      openRouterApiKey: config.openRouterApiKey || process.env.OPENROUTER_API_KEY || '',
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

    console.log('Selecting restaurant...');

    await this.page.waitForSelector('a[href*="/store/"]', { timeout: 10000 });

    const restaurants = await this.page.$$eval('a[href*="/store/"]', (links): Restaurant[] =>
      links.map(link => ({
        url: link.href,
        name: (link.querySelector('h3') as HTMLElement)?.textContent || 'Unknown',
        rating: (link.querySelector('[aria-label*="rating"]') as HTMLElement)?.textContent || 'No rating'
      }))
    );

    if (restaurants.length === 0) {
      throw new Error('No restaurants found');
    }

    let selectedRestaurant = restaurants[0];

    if (preferences.restaurant_preferences) {
      const preferred = restaurants.find(r =>
        r.name.toLowerCase().includes(preferences.restaurant_preferences!.toLowerCase())
      );
      if (preferred) selectedRestaurant = preferred;
    }

    console.log(`Selected restaurant: ${selectedRestaurant.name}`);
    await this.page.goto(selectedRestaurant.url, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async extractMenuItems(): Promise<MenuItem[]> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Extracting menu items...');

    await this.autoScroll();

    const items = await this.page.$$eval(
      '[data-testid*="menu-item"], [data-test*="store-item"]',
      (elements): MenuItem[] =>
        elements.map(el => {
          const name = (el.querySelector('h3, [data-testid*="item-name"]') as HTMLElement)?.textContent || 'Unknown Item';
          const priceElement = el.querySelector('[data-testid*="price"], span[aria-label*="price"]') as HTMLElement;
          const price = priceElement ? priceElement.textContent || '$0.00' : '$0.00';
          const description = (el.querySelector('div[data-testid*="description"], span[color="textSecondary"]') as HTMLElement)?.textContent || '';

          return { name, price, description };
        })
    );

    return items.filter(item => item.name !== 'Unknown Item');
  }

  async addItemToCart(itemName: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`Adding ${itemName} to cart...`);

    const itemElement = await this.page.evaluateHandle((name: string) => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.find(el => el.textContent?.includes(name));
    }, itemName);

    if (itemElement) {
      await (itemElement as any).click();
      await new Promise(resolve => setTimeout(resolve, 2000));

      const addToCartButton = await this.page.$(
        '[data-testid*="add-to-cart"], button:has-text("Add to Cart"), button:has-text("Add 1 to Cart")'
      );

      if (addToCartButton) {
        const requiredOptions = await this.page.$$('[role="radio"], input[type="radio"]');
        if (requiredOptions.length > 0) {
          await requiredOptions[0].click();
        }

        await addToCartButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } else {
      console.log(`Could not find item: ${itemName}`);
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

      console.log('Getting meal recommendations from AI...');
      const mealDecision = await this.openRouter.decideMeal(prompt);
      console.log('AI Decision:', mealDecision);

      await this.navigateToUberEats();
      await this.setDeliveryAddress();

      const searchQuery = mealDecision.restaurant_preferences || mealDecision.cuisine_type || 'food';
      await this.searchForFood(searchQuery);

      await this.selectRestaurant(mealDecision);

      const menuItems = await this.extractMenuItems();
      console.log(`Found ${menuItems.length} menu items`);

      const selectedItems = await this.openRouter.analyzeMenuItems(menuItems, mealDecision);
      console.log('Selected items:', selectedItems);

      for (const itemName of selectedItems.selected_items || []) {
        await this.addItemToCart(itemName);
      }

      console.log('Order prepared successfully!');
      console.log('Note: Checkout process not automated for safety. Please complete manually.');

      return {
        success: true,
        decision: mealDecision,
        selectedItems: selectedItems,
        message: 'Order prepared in cart. Please complete checkout manually.'
      };

    } catch (error) {
      console.error('Error during order process:', error);
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