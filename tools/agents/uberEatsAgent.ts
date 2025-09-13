import puppeteer, { Browser, Page } from 'puppeteer';
import { OpenRouterClient } from '../lib/openrouter';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  AgentConfig,
  MealDecision,
  MenuItem,
  Restaurant,
  SelectedItems,
  OrderResult,
  UberEatsCookies
} from '../lib/types';

export class UberEatsAgent {
  private config: Required<AgentConfig>;
  private openRouter: OpenRouterClient;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cookiesPath: string;

  constructor(config: AgentConfig = {}) {
    this.config = {
      headless: config.headless !== false,
      address: config.address || 'Engineering 7, 200 University Ave W, Waterloo, ON N2L 3G5',
      openRouterApiKey: config.openRouterApiKey || process.env.OPENROUTER_API_KEY || '',
      timeout: config.timeout || 30000,
      useSavedCookies: config.useSavedCookies !== false,
      cookiesPath: config.cookiesPath || ''
    };

    this.openRouter = new OpenRouterClient(this.config.openRouterApiKey);

    // Setup cookies path
    const cookiesDir = path.join(process.cwd(), 'cookies');
    if (!fs.existsSync(cookiesDir)) {
      fs.mkdirSync(cookiesDir, { recursive: true });
    }
    this.cookiesPath = this.config.cookiesPath || path.join(cookiesDir, 'ubereats-cookies.json');
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

    // Load saved cookies if available
    if (this.config.useSavedCookies) {
      await this.loadSavedCookies();
    }
  }

  private getBrowserCookiePaths(): string[] {
    const userHome = os.homedir();
    const paths: string[] = [];

    if (process.platform === 'win32') {
      // Windows paths
      paths.push(
        path.join(userHome, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Network', 'Cookies'),
        path.join(userHome, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Network', 'Cookies'),
        path.join(userHome, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles')
      );
    } else if (process.platform === 'darwin') {
      // macOS paths
      paths.push(
        path.join(userHome, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Cookies'),
        path.join(userHome, 'Library', 'Application Support', 'Microsoft Edge', 'Default', 'Cookies'),
        path.join(userHome, 'Library', 'Application Support', 'Firefox', 'Profiles')
      );
    } else {
      // Linux paths
      paths.push(
        path.join(userHome, '.config', 'google-chrome', 'Default', 'Cookies'),
        path.join(userHome, '.config', 'microsoft-edge', 'Default', 'Cookies'),
        path.join(userHome, '.mozilla', 'firefox')
      );
    }

    return paths.filter(p => fs.existsSync(p));
  }

  private async extractCookiesFromBrowser(): Promise<any[]> {
    console.log('🔍 Searching for UberEats cookies in browser data...');

    try {
      // First, try to read from a manually exported cookies file
      const manualCookiesPath = path.join(process.cwd(), 'cookies', 'manual-cookies.json');
      if (fs.existsSync(manualCookiesPath)) {
        console.log('📋 Found manual cookies file');
        const manualCookies = JSON.parse(fs.readFileSync(manualCookiesPath, 'utf8'));
        return manualCookies;
      }

      // Try to find browser cookie databases (this is complex and requires additional libraries)
      console.log('💡 To use saved cookies, please:');
      console.log('   1. Open UberEats in your browser and log in');
      console.log('   2. Use browser dev tools (F12) → Application → Cookies');
      console.log('   3. Export cookies or use a browser extension to export');
      console.log('   4. Save as cookies/manual-cookies.json');
      console.log('   5. Or use the saveCookiesFromBrowser() method after login');

      return [];
    } catch (error) {
      console.log('⚠️ Could not extract cookies from browser:', error);
      return [];
    }
  }

  private async loadSavedCookies(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      // First try our saved cookies
      if (fs.existsSync(this.cookiesPath)) {
        console.log('📋 Loading saved UberEats cookies...');
        const savedCookies: UberEatsCookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf8'));

        if (savedCookies.cookies && savedCookies.cookies.length > 0) {
          await this.page.setCookie(...savedCookies.cookies);
          console.log(`✅ Loaded ${savedCookies.cookies.length} saved cookies`);
          return;
        }
      }

      // Try to extract from browser
      const browserCookies = await this.extractCookiesFromBrowser();
      if (browserCookies.length > 0) {
        await this.page.setCookie(...browserCookies);
        console.log(`✅ Loaded ${browserCookies.length} cookies from browser`);

        // Save for next time
        await this.saveCookies({
          cookies: browserCookies,
          domain: 'ubereats.com',
          lastUpdated: new Date().toISOString()
        });
      }

    } catch (error) {
      console.log('⚠️ Failed to load saved cookies:', error);
    }
  }

  private async saveCookies(cookieData: UberEatsCookies): Promise<void> {
    try {
      fs.writeFileSync(this.cookiesPath, JSON.stringify(cookieData, null, 2));
      console.log('✅ Cookies saved successfully');
    } catch (error) {
      console.error('❌ Failed to save cookies:', error);
    }
  }

  async saveCookiesFromBrowser(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      console.log('💾 Saving current session cookies...');
      const cookies = await this.page.cookies();
      const uberEatsCookies = cookies.filter(cookie =>
        cookie.domain.includes('uber') ||
        cookie.domain.includes('ubereats') ||
        cookie.name.toLowerCase().includes('uber')
      );

      if (uberEatsCookies.length > 0) {
        await this.saveCookies({
          cookies: uberEatsCookies,
          domain: 'ubereats.com',
          lastUpdated: new Date().toISOString()
        });
        console.log(`✅ Saved ${uberEatsCookies.length} UberEats cookies`);
      } else {
        console.log('⚠️ No UberEats-related cookies found');
      }
    } catch (error) {
      console.error('❌ Failed to save cookies from browser:', error);
    }
  }

  private async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Wait for page to be stable
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get current URL to check if we're still on UberEats
      const currentUrl = this.page.url();
      if (!currentUrl.includes('ubereats.com')) {
        console.log(`⚠️ Page navigated away from UberEats to: ${currentUrl}`);
        return false;
      }

      // Check for sign-in indicators using page evaluation
      const loginStatus = await this.page.evaluate(() => {
        // Look for sign-in buttons (if present, user is NOT logged in)
        const signInSelectors = [
          '[data-testid="sign-in"]',
          'a[href*="login"]',
          'button[aria-label*="Sign in"]',
          'button[aria-label*="Log in"]'
        ];

        const signInButton = signInSelectors.some(selector => {
          const element = document.querySelector(selector);
          return element !== null;
        });

        // Also check by button text content
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const signInByText = buttons.some(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('sign in') || text.includes('log in');
        });

        if (signInButton || signInByText) {
          return false; // Sign in buttons found = not logged in
        }

        // Look for user account indicators
        const accountSelectors = [
          '[data-testid="account"]',
          '[data-testid="user"]',
          '.account-menu',
          '[aria-label*="account"]',
          '[aria-label*="Account"]'
        ];

        const hasAccountIndicators = accountSelectors.some(selector => {
          return document.querySelector(selector) !== null;
        });

        // Also check for common account-related text
        const accountText = buttons.some(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('account') || text.includes('profile') || text.includes('menu');
        });

        return hasAccountIndicators || accountText;
      });

      return loginStatus;
    } catch (error) {
      console.log('Error checking login status:', error);
      return false;
    }
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

    // Wait a moment for page to be ready, but don't scroll
    await new Promise(resolve => setTimeout(resolve, 2000));

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
      // Enhanced approach: find menu item with multiple strategies and click it to open modal
      const itemClicked = await this.page.evaluate((name: string) => {
        console.log(`Searching for item: "${name}"`);

        // Strategy 1: Look for UberEats specific menu item patterns
        const menuItemSelectors = [
          '[data-testid*="menu-item"]',
          '[data-testid*="store-item"]',
          '[data-testid="store-item"]',
          '[data-testid*="item"]',
          'div[role="button"]',
          'button[role="button"]',
          'article',
          'li[role="menuitem"]',
          'div[data-testid]'
        ];

        let targetItem = null;

        // First try exact selectors
        for (const selector of menuItemSelectors) {
          const items = Array.from(document.querySelectorAll(selector));
          targetItem = items.find(item => {
            const text = item.textContent || '';
            const hasName = text.toLowerCase().includes(name.toLowerCase());
            const hasPrice = text.includes('$') || text.includes('€') || text.match(/\d+\.\d+/);
            const isReasonableSize = text.length > 10 && text.length < 500;

            return hasName && hasPrice && isReasonableSize;
          });

          if (targetItem) {
            console.log(`Found item using selector: ${selector}`);
            break;
          }
        }

        // Strategy 2: Look for elements containing the item name that are clickable
        if (!targetItem) {
          console.log('Trying clickable element search by name...');
          const clickableElements = Array.from(document.querySelectorAll('div, button, article, li, span, a'));

          targetItem = clickableElements.find(el => {
            const htmlEl = el as HTMLElement;
            const text = el.textContent || '';
            const hasName = text.toLowerCase().includes(name.toLowerCase());
            const isVisible = htmlEl.offsetHeight > 0 && htmlEl.offsetWidth > 0;
            const hasClickEvent = htmlEl.onclick !== null ||
                                el.getAttribute('role') === 'button' ||
                                htmlEl.style.cursor === 'pointer' ||
                                el.tagName.toLowerCase() === 'button';
            const isReasonableSize = text.length > 5 && text.length < 400;

            return hasName && isVisible && isReasonableSize;
          });

          if (targetItem) {
            console.log('Found item using clickable element search');
          }
        }

        // Strategy 3: Most permissive search - any visible element with the name
        if (!targetItem) {
          console.log('Trying most permissive search...');
          const allElements = Array.from(document.querySelectorAll('*'));

          targetItem = allElements.find(el => {
            const htmlEl = el as HTMLElement;
            const text = el.textContent || '';
            const hasName = text.toLowerCase().includes(name.toLowerCase());
            const isVisible = htmlEl.offsetHeight > 0 && htmlEl.offsetWidth > 0;
            const isSmallEnough = text.length < 200; // Avoid huge containers

            return hasName && isVisible && isSmallEnough && el.children.length <= 10; // Not too nested
          });

          if (targetItem) {
            console.log('Found item using permissive search');
          }
        }

        if (targetItem) {
          console.log(`Attempting to click item: "${targetItem.textContent?.substring(0, 100)}"`);

          // Try multiple click methods
          try {
            // Method 1: Direct click
            (targetItem as HTMLElement).click();
            console.log('✅ Direct click successful');
            return true;
          } catch (e1) {
            try {
              // Method 2: Dispatch click event
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
              });
              targetItem.dispatchEvent(clickEvent);
              console.log('✅ Event dispatch click successful');
              return true;
            } catch (e2) {
              console.log('❌ Both click methods failed:', e1, e2);
            }
          }
        }

        // Debug info if no item found
        console.log(`❌ Could not find clickable item for: "${name}"`);

        // Log available items for debugging
        const debugItems = Array.from(document.querySelectorAll('[data-testid*="item"], div[role="button"], button'))
          .slice(0, 10)
          .map((item, i) => {
            const text = item.textContent?.substring(0, 60) || '';
            return `${i + 1}. ${text}`;
          });

        console.log('Available items for debugging:', debugItems);
        return false;
      }, itemName);

      if (itemClicked) {
        // Wait for modal/overlay to appear and verify it actually opened
        console.log('Waiting for modal to appear...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if modal actually opened
        const modalExists = await this.page.evaluate(() => {
          const modalSelectors = [
            '[data-testid*="modal"]',
            '[role="dialog"]',
            '.modal',
            '[class*="modal"]',
            'div[class*="overlay"]',
            'div[class*="drawer"]'
          ];

          for (const selector of modalSelectors) {
            const modal = document.querySelector(selector);
            if (modal) {
              console.log(`Found modal using selector: ${selector}`);
              return true;
            }
          }

          console.log('No modal found - checking for any dialog-like elements...');
          const dialogElements = Array.from(document.querySelectorAll('div, section'))
            .filter(el => {
              const style = window.getComputedStyle(el);
              return style.position === 'fixed' || style.position === 'absolute';
            });

          if (dialogElements.length > 0) {
            console.log(`Found ${dialogElements.length} potential modal elements`);
            return true;
          }

          return false;
        });

        if (!modalExists) {
          console.log('❌ Modal did not open - trying to click item again with different approach');

          // Try clicking again with a more aggressive approach
          const retryClicked = await this.page.evaluate((name: string) => {
            console.log(`Retry clicking for: "${name}"`);

            // Find any element containing the item name and try clicking its parent or itself
            const allElements = Array.from(document.querySelectorAll('*'));
            const candidates = allElements.filter(el => {
              const text = el.textContent || '';
              return text.toLowerCase().includes(name.toLowerCase()) && text.length < 150;
            });

            console.log(`Found ${candidates.length} elements containing "${name}"`);

            for (const candidate of candidates.slice(0, 5)) { // Try first 5 matches
              try {
                // Try clicking the element itself
                (candidate as HTMLElement).click();
                console.log(`Clicked element: ${candidate.textContent?.substring(0, 50)}`);

                // Also try clicking its parent if it exists
                if (candidate.parentElement) {
                  (candidate.parentElement as HTMLElement).click();
                  console.log(`Also clicked parent element`);
                }

                return true;
              } catch (e) {
                console.log(`Failed to click candidate:`, e);
              }
            }

            return false;
          }, itemName);

          if (retryClicked) {
            console.log('Retry click completed - waiting for modal again...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } else {
          console.log('✅ Modal detected successfully');
        }

        // Try multiple strategies to find and click the final "Add to Order" button
        let finalButtonClicked = false;

        // Strategy 1: Look for common "Add to Order" button patterns
        const addToOrderSelectors = [
          'button:contains("Add 1 to order")',
          'button:contains("Add to Cart")',
          'button:contains("Add to Order")',
          'button:contains("Add 1 to Cart")',
          '[data-testid*="add-to-order"]',
          '[data-testid*="add-to-cart"]',
          'button[aria-label*="Add to order"]',
          'button[aria-label*="Add to cart"]'
        ];

        for (const selector of addToOrderSelectors) {
          try {
            const button = await this.page.$(selector.replace(':contains', ''));
            if (button) {
              console.log(`Found button with selector: ${selector}`);
              await button.click();
              finalButtonClicked = true;
              break;
            }
          } catch (e) {
            // Selector might not be valid, continue
          }
        }

        // Strategy 2: Use evaluate to find buttons by text content
        if (!finalButtonClicked) {
          console.log('Trying text-based button search...');
          finalButtonClicked = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            console.log(`Found ${buttons.length} buttons to check`);

            // Look for buttons with specific text patterns
            const targetTexts = [
              'Add 1 to order',
              'Add to order',
              'Add to cart',
              'Add 1 to cart',
              'Add to Order',
              'Add to Cart',
              'Add 1 to Order',
              'Add 1 to Cart'
            ];

            for (const text of targetTexts) {
              const button = buttons.find(btn => {
                const btnText = btn.textContent?.trim() || '';
                return btnText.toLowerCase().includes(text.toLowerCase());
              });

              if (button && button instanceof HTMLElement) {
                console.log(`Found and clicking button with text: "${button.textContent}"`);
                button.click();
                return true;
              }
            }

            // Fallback: look for any button in a modal/overlay
            const modals = Array.from(document.querySelectorAll('[role="dialog"], .modal, [data-testid*="modal"]'));
            if (modals.length > 0) {
              console.log(`Found ${modals.length} modals, looking for buttons inside`);
              for (const modal of modals) {
                const modalButtons = Array.from(modal.querySelectorAll('button'));
                const addButton = modalButtons.find(btn => {
                  const text = btn.textContent?.toLowerCase() || '';
                  return text.includes('add') && (text.includes('order') || text.includes('cart'));
                });

                if (addButton && addButton instanceof HTMLElement) {
                  console.log(`Found and clicking modal button: "${addButton.textContent}"`);
                  addButton.click();
                  return true;
                }
              }
            }

            console.log('No suitable "Add to Order" button found');
            return false;
          });
        }

        // Strategy 3: Handle mandatory choices with random selection (no LLM)
        console.log('Checking for required options and making random selections...');

        // Handle required customizations using random selection
        const choicesHandled = await this.page.evaluate(() => {
          let totalHandled = 0;
          console.log('🔍 Searching for required choices in the modal...');

          // Strategy 1: Look for UberEats specific required choice containers
          const requiredContainers = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent || '';
            return (text.includes('Required') || text.includes('Choose') || text.includes('Select')) &&
                   text.length < 200; // Avoid huge containers
          });

          console.log(`Found ${requiredContainers.length} potential required choice containers`);

          requiredContainers.forEach((container, index) => {
            console.log(`Processing container ${index + 1}: "${container.textContent?.substring(0, 80)}"`);

            // Look for radio buttons or checkboxes within this container
            const inputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');

            if (inputs.length > 0) {
              // Check if any are already selected
              const selected = Array.from(inputs).some(input => (input as HTMLInputElement).checked);

              if (!selected) {
                // Randomly select one
                const randomIndex = Math.floor(Math.random() * inputs.length);
                const randomInput = inputs[randomIndex] as HTMLInputElement;

                console.log(`✅ Randomly selecting option ${randomIndex + 1} of ${inputs.length} in container ${index + 1}`);
                randomInput.click();
                totalHandled++;
              } else {
                console.log(`⚠️ Container ${index + 1} already has a selection`);
              }
            }
          });

          // Strategy 2: Look for any unselected radio button groups in the modal
          console.log('🔍 Looking for unselected radio button groups...');

          const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
          const radioGroups = new Map<string, HTMLInputElement[]>();

          // Group radios by name attribute
          allRadios.forEach(radio => {
            const name = radio.getAttribute('name') || `group_${Math.random()}`;
            if (!radioGroups.has(name)) {
              radioGroups.set(name, []);
            }
            radioGroups.get(name)!.push(radio as HTMLInputElement);
          });

          console.log(`Found ${radioGroups.size} radio button groups`);

          // Select random option from each unselected group
          radioGroups.forEach((radios, groupName) => {
            const hasSelection = radios.some(radio => radio.checked);

            if (!hasSelection && radios.length > 0) {
              const randomIndex = Math.floor(Math.random() * radios.length);
              const randomRadio = radios[randomIndex];

              console.log(`✅ Randomly selecting option ${randomIndex + 1} of ${radios.length} from group "${groupName}"`);
              randomRadio.click();
              totalHandled++;
            } else if (hasSelection) {
              console.log(`⚠️ Group "${groupName}" already has a selection`);
            }
          });

          // Strategy 3: Look for clickable elements that might be choice buttons
          console.log('🔍 Looking for clickable choice elements...');

          const clickableChoices = Array.from(document.querySelectorAll('div, button, span')).filter(el => {
            const text = el.textContent || '';
            const style = window.getComputedStyle(el);

            // Look for elements that look like choice options
            return text.length > 2 && text.length < 50 &&
                   (style.cursor === 'pointer' || el.getAttribute('role') === 'button') &&
                   (text.includes('$') || // Has price
                    text.match(/^[A-Za-z\s]{3,30}$/) || // Simple text option
                    text.includes('Small') || text.includes('Medium') || text.includes('Large')); // Size options
          });

          console.log(`Found ${clickableChoices.length} potential clickable choices`);

          // Click a few random choices (but not too many)
          const choicesToClick = Math.min(3, clickableChoices.length);
          for (let i = 0; i < choicesToClick; i++) {
            const randomIndex = Math.floor(Math.random() * clickableChoices.length);
            const choice = clickableChoices[randomIndex];

            try {
              (choice as HTMLElement).click();
              console.log(`✅ Clicked choice: "${choice.textContent?.substring(0, 30)}"`);
              totalHandled++;
            } catch (e) {
              console.log(`⚠️ Failed to click choice: ${e}`);
            }
          }

          return totalHandled;
        });

        console.log(`✅ Made ${choicesHandled} random selections for required options`);

        if (choicesHandled > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for selections to register
        }

        // After handling all options, try to find the "Add to Order" button again
        await new Promise(resolve => setTimeout(resolve, 1000));

        finalButtonClicked = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          console.log(`Checking ${buttons.length} buttons after option selection`);

          const targetTexts = [
            'add 1 to order',
            'add to order',
            'add to cart',
            'add 1 to cart'
          ];

          for (const targetText of targetTexts) {
            const button = buttons.find(btn => {
              const text = btn.textContent?.toLowerCase().trim() || '';
              return text === targetText || text.includes(targetText);
            });

            if (button && button instanceof HTMLElement && !button.disabled) {
              console.log(`Found and clicking final button: "${button.textContent}"`);
              button.click();
              return true;
            }
          }

          // Log all button texts for debugging
          console.log('Available buttons:', buttons.map(b => b.textContent?.trim()).filter(t => t));
          return false;
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        if (finalButtonClicked) {
          console.log(`✅ Successfully added ${itemName} to cart`);
        } else {
          console.log(`⚠️ Modal opened but could not find/click "Add to Order" button for ${itemName}`);
        }
      } else {
        console.log(`⚠️ Could not find or add item: ${itemName}`);
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

  async orderMeal(prompt: string, keepBrowserOpen: boolean = true): Promise<OrderResult> {
    try {
      await this.initialize();

      // Check if cookies provide authentication
      console.log('🔐 Checking authentication status with saved cookies...');
      const isAuthenticated = await this.isLoggedIn();
      if (isAuthenticated) {
        console.log('✅ Successfully authenticated with saved cookies');
      } else {
        console.log('⚠️ Not authenticated - running in guest mode');
        console.log('💡 To enable authentication: log into UberEats manually and save cookies');
      }

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
      // Temporary fix: only add the first item to avoid complexity
      const itemsToAdd = (selectedItems.selected_items || []).slice(0, 1);
      console.log(`Adding ${itemsToAdd.length} item(s) to cart: ${itemsToAdd.join(', ')}`);

      for (const itemName of itemsToAdd) {
        await this.addItemToCart(itemName);
      }

      console.log('🎉 Order prepared successfully!');

      if (keepBrowserOpen) {
        console.log('🌐 Browser kept open for manual checkout');
        console.log('💡 Current URL:', this.page?.url() || 'Unknown');
        console.log('⚠️  Complete your checkout manually in the browser window');
        console.log('📞 Call this.close() when done to close the browser');
      } else {
        console.log('⚠️  Note: Checkout process not automated for safety. Please complete manually.');
      }

      return {
        success: true,
        decision: mealDecision,
        selectedItems: selectedItems,
        message: keepBrowserOpen ?
          `Order prepared in cart. Browser kept open at ${this.page?.url()}. Complete checkout manually.` :
          'Order prepared in cart with AI optimization. Please complete checkout manually.'
      };

    } catch (error) {
      console.error('❌ Error during order process:', error);
      throw error;
    } finally {
      if (!keepBrowserOpen && this.browser) {
        console.log('🔒 Closing browser...');
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