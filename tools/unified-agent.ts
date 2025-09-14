import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Browser, chromium, Page } from 'playwright';

dotenv.config();

interface Product {
  title: string;
  brand: string;
  price: string;
  rating: number;
  reviewCount: number;
  href: string;
}

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

class UnifiedAgent {
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
  }

  async detectPlatform(userPrompt: string): Promise<'shop' | 'food'> {
    const lowerPrompt = userPrompt.toLowerCase();
    
    // Food-related keywords
    const foodKeywords = [
      'pizza', 'burger', 'chinese', 'sushi', 'thai', 'indian', 'korean', 
      'mexican', 'italian', 'food', 'restaurant', 'delivery', 'eat', 
      'lunch', 'dinner', 'breakfast', 'meal', 'hungry', 'order food'
    ];
    
    // Shopping-related keywords
    const shopKeywords = [
      'shirt', 'tee', 't-shirt', 'clothes', 'clothing', 'shoes', 'hat', 
      'jacket', 'pants', 'dress', 'buy', 'purchase', 'shop', 'shopping',
      'white', 'black', 'red', 'blue', 'green', 'yellow', 'color'
    ];
    
    const foodScore = foodKeywords.filter(keyword => lowerPrompt.includes(keyword)).length;
    const shopScore = shopKeywords.filter(keyword => lowerPrompt.includes(keyword)).length;
    
    console.log(`Food keywords found: ${foodScore}, Shop keywords found: ${shopScore}`);
    
    if (foodScore > shopScore) {
      return 'food';
    } else if (shopScore > foodScore) {
      return 'shop';
    } else {
      // Default to food if unclear
      return 'food';
    }
  }

  async generateSearchQuery(userPrompt: string, platform: 'shop' | 'food'): Promise<string> {
    if (platform === 'food') {
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
        return userPrompt;
      }
    } else {
      // Shopping search query
      const lowerPrompt = userPrompt.toLowerCase();
      
      if (lowerPrompt.includes('white') && lowerPrompt.includes('shirt')) {
        return 'white t shirt';
      } else if (lowerPrompt.includes('black') && lowerPrompt.includes('shirt')) {
        return 'black t shirt';
      } else if (lowerPrompt.includes('shirt') || lowerPrompt.includes('tee')) {
        return 't shirt';
      } else {
        return userPrompt;
      }
    }
  }

  async closePopups(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Checking for pop-ups to close...');
    
    // Try pressing Escape key multiple times immediately
    try {
      await this.page.keyboard.press('Escape');
      await this.page.keyboard.press('Escape');
      await this.page.keyboard.press('Escape');
      console.log('Pressed Escape multiple times to close pop-ups');
    } catch (e) {
      // Continue
    }
    
    // Try to close the specific Fantuan popup first
    try {
      const fantuanPopup = await this.page.$('#fantuan-popup');
      if (fantuanPopup) {
        console.log('Found Fantuan popup, trying to close it...');
        // Try to find close button within the popup
        const closeButton = await fantuanPopup.$('button[class*="close"], .close, button:has-text("×"), button:has-text("✕")');
        if (closeButton) {
          await closeButton.click();
          console.log('Closed Fantuan popup successfully');
          return;
        }
        // If no close button found, force remove the popup
        await this.page.evaluate(() => {
          const popup = (globalThis as any).document?.getElementById('fantuan-popup');
          if (popup) {
            popup.style.display = 'none';
            popup.remove();
            console.log('Force removed Fantuan popup');
          }
        });
        console.log('Force removed Fantuan popup');
        return;
      }
    } catch (e) {
      // Continue
    }
    
    // Try to close various types of pop-ups with ultra-fast timeout
    const popupCloseSelectors = [
      'button[class*="close"]',
      '.close-button',
      '[data-testid="close"]',
      'button:has-text("×")',
      'button:has-text("✕")',
      'button:has-text("Close")',
      'button[class*="x"]',
      '.x-button',
      '.modal-close',
      '[class*="modal"] button[class*="close"]',
      '.overlay-close',
      '[class*="overlay"] button[class*="close"]',
      '[id*="popup"] button[class*="close"]',
      '[id*="popup"] .close',
      '[id*="popup"] button:has-text("×")',
      '[class*="popup"] button[class*="close"]',
      '[class*="popup"] .close',
      '[class*="popup"] button:has-text("×")',
      'button[aria-label="Close"]',
      'button[aria-label="close"]',
      '[role="button"][aria-label="Close"]',
      '[role="button"][aria-label="close"]'
    ];

    for (const selector of popupCloseSelectors) {
      try {
        const closeButton = await this.page.waitForSelector(selector, { timeout: 10 });
        if (closeButton) {
          console.log(`Found pop-up close button with selector: ${selector}`);
          await closeButton.click();
          console.log('Pop-up closed successfully');
          return;
        }
      } catch (e) {
        continue;
      }
    }
  }

  async closeModals(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Checking for modals to close...');
    
    // Wait a moment for modals to load
    await this.page.waitForTimeout(2000);
    
    // Try to close various types of modals
    const modalCloseSelectors = [
      // Ant Design modals
      '.ant-modal-close',
      '.ant-modal-close-x',
      'button[class*="ant-modal-close"]',
      // Generic modal close buttons
      'button[class*="close"]',
      '.close-button',
      '[data-testid="close"]',
      'button:has-text("×")',
      'button:has-text("✕")',
      'button:has-text("Close")',
      'button:has-text("Cancel")',
      'button:has-text("OK")',
      'button:has-text("Got it")',
      'button:has-text("Continue")',
      // Modal overlays
      '.modal-close',
      '[class*="modal"] button[class*="close"]',
      '.overlay-close',
      '[class*="overlay"] button[class*="close"]'
    ];

    for (const selector of modalCloseSelectors) {
      try {
        const closeButton = await this.page.waitForSelector(selector, { timeout: 2000 });
        if (closeButton) {
          console.log(`Found modal close button with selector: ${selector}`);
          await closeButton.click();
          await this.page.waitForTimeout(1000);
          console.log('Modal closed successfully');
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
      console.log('Pressed Escape to close modals');
    } catch (e) {
      console.log('No modals found to close');
    }
  }

  async runShopApp(userPrompt: string): Promise<void> {
    console.log('🛍️  Shopping Mode - Navigating to shop.app');
    
    // Navigate to shop.app
    await this.page!.goto('https://shop.app');
    await this.page!.waitForLoadState('load');
    await this.closePopups();

    // Generate search query
    const searchQuery = await this.generateSearchQuery(userPrompt, 'shop');
    console.log(`Search query: ${searchQuery}`);

    // Perform search
    await this.performShopSearch(searchQuery);

    // Extract and select products
    const products = await this.extractProducts();
    console.log(`Found ${products.length} products`);

    if (products.length > 0) {
      const selectedProduct = products[0];
      console.log(`Selected first product: ${selectedProduct.title}`);
      await this.clickProduct(selectedProduct);
      await this.clickBuyNow();
    }
  }

  async runFoodApp(userPrompt: string): Promise<void> {
    console.log('🍔 Food Mode - Navigating to Fantuan');
    
    // Navigate to Fantuan
    await this.page!.goto('https://www.fantuanorder.com/');
    await this.page!.waitForLoadState('load');
    
    // Force close popup immediately after page load
    await this.page!.evaluate(() => {
      const popup = (globalThis as any).document?.getElementById('fantuan-popup');
      if (popup) {
        popup.style.display = 'none';
        popup.remove();
        console.log('Force removed Fantuan popup on page load');
      }
    });
    
    // Close popups immediately after page load
    await this.closePopups();
    
    // Force close popup again after a moment
    await this.page!.waitForTimeout(100);
    await this.page!.evaluate(() => {
      const popup = (globalThis as any).document?.getElementById('fantuan-popup');
      if (popup) {
        popup.style.display = 'none';
        popup.remove();
        console.log('Force removed Fantuan popup again');
      }
    });

    // Generate search query
    const searchQuery = await this.generateSearchQuery(userPrompt, 'food');
    console.log(`Search query: ${searchQuery}`);

    // Force close popup before search
    await this.page!.evaluate(() => {
      const popup = (globalThis as any).document?.getElementById('fantuan-popup');
      if (popup) {
        popup.style.display = 'none';
        popup.remove();
        console.log('Force removed Fantuan popup before search');
      }
    });
    
    // Perform search
    await this.performFoodSearch(searchQuery);

    // Extract and select restaurants
    const restaurants = await this.extractRestaurants();
    console.log(`Found ${restaurants.length} restaurants`);

    if (restaurants.length > 0) {
      const selectedRestaurant = restaurants[0];
      console.log(`Selected first restaurant: ${selectedRestaurant.name}`);
      await this.clickRestaurant(selectedRestaurant);
      await this.selectPizzaAndToppings();
    }
  }

  async performShopSearch(searchQuery: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    const searchSelectors = [
      'input[name="search"]',
      'input[data-testid="search-input"]',
      'input[role="searchbox"]',
      'input[type="search"]'
    ];

    let searchInput = null;
    for (const selector of searchSelectors) {
      try {
        searchInput = await this.page.waitForSelector(selector, { timeout: 5000 });
        if (searchInput) break;
      } catch (e) {
        continue;
      }
    }

    if (!searchInput) {
      throw new Error('Could not find search input on shop.app');
    }

    await searchInput.click();
    await searchInput.fill(searchQuery);
    await searchInput.press('Enter');
    await this.page.waitForLoadState('load');
    await this.page.waitForTimeout(5000);
  }

  async performFoodSearch(searchQuery: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Waiting for page to load...');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(200); // Brief wait for elements to load
    
    // Force close popup before searching
    await this.page.evaluate(() => {
      const popup = (globalThis as any).document?.getElementById('fantuan-popup');
      if (popup) {
        popup.style.display = 'none';
        popup.remove();
        console.log('Force removed Fantuan popup in search');
      }
    });

    // Logging removed for speed

    // Screenshot removed for speed

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
      'input[class*="Search"]',
      'input[class*="search-input"]',
      'input[class*="searchInput"]',
      // More generic selectors
      'input',
      'input[type="text"]'
    ];

    console.log('Looking for search input...');
    let searchInput = null;
    for (const selector of searchSelectors) {
      try {
        console.log(`Trying selector: ${selector}`);
                searchInput = await this.page.waitForSelector(selector, { timeout: 10 });
        if (searchInput) {
          console.log(`✅ Found search input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Selector ${selector} not found`);
        continue;
      }
    }

    if (!searchInput) {
      console.log('❌ No search input found. Available inputs on page:');
      const allInputs = await this.page.$$('input');
      for (let i = 0; i < allInputs.length; i++) {
        try {
          const input = allInputs[i];
          const placeholder = await input.getAttribute('placeholder');
          const type = await input.getAttribute('type');
          const className = await input.getAttribute('class');
          const id = await input.getAttribute('id');
          console.log(`Input ${i}: placeholder="${placeholder}", type="${type}", class="${className}", id="${id}"`);
        } catch (e) {
          console.log(`Input ${i}: Could not get attributes`);
        }
      }
      throw new Error('Could not find search input on Fantuan');
    }

    console.log('Clicking search input...');
    await searchInput.click();
    console.log('Filling search query...');
    await searchInput.fill(searchQuery);
    console.log('Pressing Enter...');
    await searchInput.press('Enter');
    console.log('Waiting for search results...');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(300); // Brief wait for search results
    console.log('Search completed');
  }

  async extractProducts(): Promise<Product[]> {
    if (!this.page) throw new Error('Page not initialized');

    const products: Product[] = [];
    
    const productCards = await this.page.$$('[data-testid="product-card"]');
    
    for (const card of productCards) {
      try {
        const titleElement = await card.$('[data-testid="product-title"]');
        const brandElement = await card.$('p[aria-label]');
        const priceElement = await card.$('[data-testid="regularPrice"]');
        const linkElement = await card.$('a[data-testid="product-link-test-id"]');
        const ratingElement = await card.$('[data-testid="review-stars"] p');

        const title = titleElement ? await titleElement.textContent() : '';
        const brand = brandElement ? await brandElement.textContent() : '';
        const price = priceElement ? await priceElement.textContent() : '';
        const href = linkElement ? await linkElement.getAttribute('href') : '';
        
        const ratingText = ratingElement ? await ratingElement.textContent() : '';
        const ratingMatch = ratingText?.match(/(\d+)/);
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;

        if (title && href) {
          products.push({
            title: title.trim(),
            brand: brand?.trim() || '',
            price: price?.trim() || '',
            rating,
            reviewCount: 0,
            href: href.startsWith('http') ? href : `https://shop.app${href}`
          });
        }
      } catch (error) {
        console.warn('Error extracting product data:', error);
      }
    }

    return products;
  }

  async extractRestaurants(): Promise<Restaurant[]> {
    if (!this.page) throw new Error('Page not initialized');

    const restaurants: Restaurant[] = [];
    
    console.log('Waiting for restaurants to load...');
    await this.page.waitForTimeout(200); // Brief wait for restaurants to load
    
    // Logging removed for speed
    
    // Screenshot removed for speed
    
    const restaurantSelectors = [
      // Fantuan specific selectors - look for actual restaurant containers, not images
      '[class*="store-card"]:not([class*="photo"]):not([class*="image"])',
      '[class*="restaurant-card"]:not([class*="photo"]):not([class*="image"])',
      '[class*="merchant-card"]:not([class*="photo"]):not([class*="image"])',
      '[class*="store-item"]:not([class*="photo"]):not([class*="image"])',
      '[class*="restaurant-item"]:not([class*="photo"]):not([class*="image"])',
      // Look for containers that have restaurant info but not images
      'div[class*="restaurant"]:not([class*="photo"]):not([class*="image"]):not([class*="thumbnail"])',
      'div[class*="store"]:not([class*="photo"]):not([class*="image"]):not([class*="thumbnail"])',
      // Generic selectors
      '[data-testid="store-card"]',
      '.restaurant-card',
      '[data-testid="restaurant-card"]',
      '.store-card',
      '.restaurant-item',
      '.merchant-card',
      // Search results specific
      '.search-result',
      '.result-item',
      '[class*="result"]',
      // Very generic - but exclude images
      'div[class*="card"]:not([class*="photo"]):not([class*="image"])',
      'div[class*="item"]:not([class*="photo"]):not([class*="image"])',
      // Look for clickable containers
      'a[class*="restaurant"]',
      'a[class*="store"]',
      'div[role="button"][class*="restaurant"]',
      'div[role="button"][class*="store"]'
    ];

    console.log('Looking for restaurant cards...');
    let restaurantCards: any[] = [];
    for (const selector of restaurantSelectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        restaurantCards = await this.page.$$(selector);
        if (restaurantCards.length > 0) {
          console.log(`✅ Found ${restaurantCards.length} restaurant cards with selector: ${selector}`);
          break;
        } else {
          console.log(`❌ No cards found with selector: ${selector}`);
        }
      } catch (e) {
        console.log(`❌ Error with selector ${selector}:`, e);
        continue;
      }
    }
    
    if (restaurantCards.length === 0) {
      console.log('❌ No restaurant cards found. Let me check what elements are available...');
      
      // Check for any divs that might contain restaurant info
      const allDivs = await this.page.$$('div');
      console.log(`Found ${allDivs.length} div elements on page`);
      
      // Look for divs with text content that might be restaurant names
      for (let i = 0; i < Math.min(allDivs.length, 20); i++) {
        try {
          const div = allDivs[i];
          const text = await div.textContent();
          const className = await div.getAttribute('class');
          if (text && text.length > 0 && text.length < 100) {
            console.log(`Div ${i}: class="${className}", text="${text.trim()}"`);
          }
        } catch (e) {
          // Skip errors
        }
      }
      
      // Fallback: try to find any clickable elements that might be restaurants
      console.log('Trying fallback: looking for clickable elements...');
      const clickableElements = await this.page.$$('a, button, [role="button"], [onclick]');
      console.log(`Found ${clickableElements.length} clickable elements`);
      
      if (clickableElements.length > 0) {
        console.log('Using first clickable element as restaurant...');
        // Create a fake restaurant object
        restaurants.push({
          name: 'First Restaurant (Fallback)',
          rating: '',
          deliveryTime: '',
          cuisine: '',
          price: '',
          href: ''
        });
        return restaurants;
      }
      
      return restaurants;
    }
    
    console.log(`Processing ${restaurantCards.length} restaurant cards...`);
    
    for (let i = 0; i < Math.min(restaurantCards.length, 5); i++) {
      const card = restaurantCards[i];
      try {
        console.log(`\n--- Processing card ${i + 1} ---`);
        
        // First, let's see what's actually in this card
        const cardHTML = await card.innerHTML();
        console.log(`Card ${i + 1} HTML (first 200 chars):`, cardHTML.substring(0, 200));
        
        const cardText = await card.textContent();
        console.log(`Card ${i + 1} text content:`, cardText?.substring(0, 100));
        
        const cardClass = await card.getAttribute('class');
        console.log(`Card ${i + 1} class:`, cardClass);
        
        // Try to find any text that looks like a restaurant name
        const allTextElements = await card.$$('*');
        console.log(`Card ${i + 1} has ${allTextElements.length} child elements`);
        
        let name = '';
        let rating = '';
        let deliveryTime = '';
        let cuisine = '';
        let price = '';
        let href = '';
        
        // Look for text that might be restaurant names (usually the largest text)
        const textContents = [];
        for (const element of allTextElements) {
          try {
            const text = await element.textContent();
            if (text && text.trim().length > 0 && text.trim().length < 50) {
              textContents.push(text.trim());
            }
          } catch (e) {
            // Skip errors
          }
        }
        
        console.log(`Card ${i + 1} text contents:`, textContents.slice(0, 10));
        
        // Use the first meaningful text as the name
        if (textContents.length > 0) {
          name = textContents[0];
        }
        
        // Try to find links
        const links = await card.$$('a');
        if (links.length > 0) {
          href = await links[0].getAttribute('href') || '';
        }
        
        console.log(`Card ${i + 1} extracted - name: "${name}", href: "${href}"`);
        
        if (name.trim()) {
          restaurants.push({
            name: name.trim(),
            rating: rating.trim(),
            deliveryTime: deliveryTime.trim(),
            cuisine: cuisine.trim(),
            price: price.trim(),
            href: href.trim()
          });
          console.log(`✅ Added restaurant: ${name.trim()}`);
        } else {
          console.log(`❌ No name found for card ${i + 1}`);
        }
        
      } catch (error) {
        console.warn(`Error processing card ${i + 1}:`, error);
      }
    }
    
    console.log(`\nTotal restaurants extracted: ${restaurants.length}`);

    return restaurants;
  }

  async clickProduct(product: Product): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    const productCards = await this.page.$$('[data-testid="product-card"]');
    
    for (const card of productCards) {
      try {
        const titleElement = await card.$('[data-testid="product-title"]');
        if (titleElement) {
          const title = await titleElement.textContent();
          if (title && title.trim() === product.title) {
            const linkElement = await card.$('a[data-testid="product-link-test-id"]');
            if (linkElement) {
              await linkElement.click();
              await this.page.waitForLoadState('load');
              await this.page.waitForTimeout(5000);
              console.log(`Clicked on product: ${product.title}`);
              return;
            }
          }
        }
      } catch (error) {
        console.warn('Error checking product card:', error);
      }
    }

    throw new Error(`Could not find product: ${product.title}`);
  }

  async clickRestaurant(restaurant: Restaurant): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`Looking for restaurant: ${restaurant.name}`);
    
    await this.page.waitForTimeout(3000);
    
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
    
    // Try to find the specific restaurant by name first
    console.log(`Looking for specific restaurant: ${restaurant.name}`);
    for (let i = 0; i < restaurantCards.length; i++) {
      try {
        const card = restaurantCards[i];
        const cardText = await card.textContent();
        console.log(`Card ${i + 1} text: ${cardText?.substring(0, 100)}`);
        
        if (cardText && cardText.includes(restaurant.name)) {
          console.log(`✅ Found matching restaurant at index ${i}: ${restaurant.name}`);
          await card.click();
          // No wait - process immediately after click
          console.log(`Successfully clicked on ${restaurant.name}!`);
          return;
        }
      } catch (error) {
        console.warn(`Error checking card ${i + 1}:`, error);
      }
    }
    
    // Fallback: click the first restaurant card if specific match not found
    console.log('Specific restaurant not found, clicking first restaurant card...');
    try {
      await restaurantCards[0].click();
      // No wait - process immediately after click
      console.log('Successfully clicked on first restaurant!');
      return;
    } catch (error) {
      console.error('Error clicking first restaurant:', error);
    }
  }

  async selectPizzaAndToppings(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Looking for pizza items on restaurant page...');

    // First, close any modals that might be blocking
    await this.closeModals();

    // No wait - process immediately

    // Check if we're already on a restaurant page with menu items
    const currentUrl = this.page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('/store/') || currentUrl.includes('/restaurant/')) {
      console.log('✅ Already on restaurant page, looking for menu items...');
      
      // Look for menu items directly
      const menuSelectors = [
        '.menu-item',
        '.food-item',
        '.item',
        '[class*="menu"]',
        '[class*="food"]',
        '[class*="pizza"]',
        'div:has-text("pizza")',
        'div:has-text("Pizza")'
      ];
      
      let menuItems: any[] = [];
      for (const selector of menuSelectors) {
        try {
          menuItems = await this.page.$$(selector);
          if (menuItems.length > 0) {
            console.log(`Found ${menuItems.length} menu items with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (menuItems.length === 0) {
        console.log('No menu items found, trying to find any clickable food items...');
        // Look for any clickable elements that might be food items
        const clickableItems = await this.page.$$('a, button, [role="button"]');
        menuItems = clickableItems.filter(async (item) => {
          try {
            const text = await item.textContent();
            return text && (text.toLowerCase().includes('pizza') || text.toLowerCase().includes('food') || text.toLowerCase().includes('$'));
          } catch (e) {
            return false;
          }
        });
      }

      if (menuItems.length > 0) {
        console.log(`Found ${menuItems.length} potential menu items`);
        
        // Click on the first menu item
        console.log('Clicking on first menu item...');
        try {
          await menuItems[0].scrollIntoViewIfNeeded();
          // No wait time
          await menuItems[0].click();
          // No wait time
          console.log('✅ Successfully clicked on menu item!');
        } catch (error) {
          console.log('Could not click menu item, trying alternative approach...');
          
          // Try clicking on any clickable element within the menu item
          const clickableElements = await menuItems[0].$$('a, button, [role="button"], [onclick]');
          if (clickableElements.length > 0) {
            console.log(`Found ${clickableElements.length} clickable elements within menu item`);
            await clickableElements[0].click();
            // No wait time
            console.log('✅ Successfully clicked on clickable element within menu item!');
          }
        }

        // Add random toppings
        await this.addRandomToppings();

        // Add to cart
        await this.addToCart();

        // Proceed to checkout
        await this.proceedToCheckout();
        return;
      }
    }

    // Fallback: if we're not on restaurant page or no menu items found
    console.log('No menu items found on current page');
    throw new Error('No pizza or menu items found on restaurant page');
  }

  async addRandomToppings(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Adding random toppings...');

    // Common pizza toppings
    const toppings = [
      'Pepperoni', 'Mushrooms', 'Onions', 'Green Peppers', 'Black Olives',
      'Sausage', 'Bacon', 'Extra Cheese', 'Pineapple', 'Jalapeños',
      'Tomatoes', 'Spinach', 'Chicken', 'Ham', 'Anchovies'
    ];

    // Look for topping options
    const toppingSelectors = [
      'input[type="checkbox"]',
      'input[type="radio"]',
      'button[class*="topping"]',
      'button[class*="add"]',
      '[class*="topping"]',
      '[class*="option"]',
      'label[class*="topping"]',
      'div[class*="topping"]'
    ];

    let selectedToppings = 0;
    const maxToppings = Math.floor(Math.random() * 3) + 1; // 1-3 random toppings

    for (const selector of toppingSelectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} potential topping elements with selector: ${selector}`);
          
          // Randomly select some toppings
          const shuffled = elements.sort(() => 0.5 - Math.random());
          const toSelect = shuffled.slice(0, Math.min(maxToppings, elements.length));
          
          for (const element of toSelect) {
            try {
              const text = await element.textContent();
              if (text && toppings.some(topping => text.toLowerCase().includes(topping.toLowerCase()))) {
                await element.click();
                // No wait time
                selectedToppings++;
                console.log(`Added topping: ${text.trim()}`);
                
                if (selectedToppings >= maxToppings) break;
              }
            } catch (e) {
              // Skip if can't click
              continue;
            }
          }
          
          if (selectedToppings > 0) break;
        }
      } catch (e) {
        continue;
      }
    }

    console.log(`Added ${selectedToppings} random toppings`);
  }

  async addToCart(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Adding pizza to cart...');

    // Check if pizza is already in cart (from the screenshot, it looks like it might be)
    const cartIndicators = await this.page.$$('[class*="cart"], [class*="quantity"], [class*="badge"]');
    for (const indicator of cartIndicators) {
      try {
        const text = await indicator.textContent();
        if (text && (text.includes('1') || text.includes('cart'))) {
          console.log('✅ Pizza already appears to be in cart!');
          return;
        }
      } catch (e) {
        continue;
      }
    }

    const addToCartSelectors = [
      'button:has-text("Add to Cart")',
      'button:has-text("Add")',
      'button:has-text("Order")',
      'button:has-text("Buy")',
      'button:has-text("Add to Order")',
      'button:has-text("Add Item")',
      '[class*="add"]',
      '[class*="cart"]',
      '[class*="order"]',
      '[data-testid*="add"]',
      '[data-testid*="cart"]'
    ];

    for (const selector of addToCartSelectors) {
      try {
        const button = await this.page.waitForSelector(selector, { timeout: 10 }); // Ultra-fast timeout
        if (button) {
          console.log(`Found add to cart button with selector: ${selector}`);
          await button.click();
          // No wait time
          console.log('✅ Added pizza to cart!');
          return;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('No add to cart button found, trying to find any button...');
    
    // Fallback: try to find any button that might add to cart
    const allButtons = await this.page.$$('button');
    for (const button of allButtons) {
      try {
        const text = await button.textContent();
        if (text && (text.toLowerCase().includes('add') || text.toLowerCase().includes('order') || text.toLowerCase().includes('cart'))) {
          console.log(`Trying button: ${text.trim()}`);
          await button.click();
          // No wait time
          console.log('✅ Clicked potential add to cart button!');
          return;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('Could not find add to cart button');
  }

  async proceedToCheckout(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Looking for checkout button on the right side...');
    
    // Close any modals first
    await this.closeModals();
    
    // Look for checkout/cart buttons that are typically on the right side
    const checkoutSelectors = [
      'button:has-text("Check Out")',  // Most common on Fantuan
      'button:has-text("Checkout")',
      'button:has-text("View Cart")',
      'button:has-text("Cart")',
      'button:has-text("Go to Cart")',
      'button:has-text("Place Order")',
      'button:has-text("Order Now")',
      'button:has-text("Proceed to Checkout")',
      'button:has-text("Continue to Checkout")',
      // Look for buttons in the right sidebar/cart area
      '[class*="checkout"]',
      '[class*="cart"]',
      '[class*="sidebar"] button',
      '[class*="right"] button',
      '[class*="floating"] button',
      '[class*="fixed"] button',
      '[data-testid*="checkout"]',
      '[data-testid*="cart"]',
      'a:has-text("Checkout")',
      'a:has-text("Cart")',
      'a[href*="checkout"]',
      'a[href*="cart"]'
    ];

    for (const selector of checkoutSelectors) {
      try {
        console.log(`Trying checkout selector: ${selector}`);
        const checkoutButton = await this.page.waitForSelector(selector, { timeout: 50 }); // Slightly longer timeout
        if (checkoutButton) {
          console.log(`✅ Found checkout button with selector: ${selector}`);
          await checkoutButton.click();
          await this.page.waitForTimeout(100); // Brief wait for navigation
          console.log('Successfully clicked checkout button!');
          
          console.log('🎉 Successfully navigated to checkout page!');
          console.log('💳 You can now complete your order in the browser');
          return;
        }
      } catch (e) {
        console.log(`❌ Checkout selector ${selector} not found`);
        continue;
      }
    }

    // Fallback: look for any button that might lead to checkout (prioritize right side)
    console.log('No specific checkout button found, looking for any relevant buttons...');
    const allButtons = await this.page.$$('button');
    for (const button of allButtons) {
      try {
        const text = await button.textContent();
        if (text && (text.toLowerCase().includes('checkout') || text.toLowerCase().includes('cart') || text.toLowerCase().includes('order'))) {
          console.log(`Trying potential checkout button: ${text.trim()}`);
          await button.click();
          await this.page.waitForTimeout(100); // Brief wait for navigation
          console.log('✅ Clicked potential checkout button!');
          return;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('No checkout button found, but pizza was added to cart');
    console.log('💡 Please manually navigate to checkout in the browser');
  }

  async clickBuyNow(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    const buyNowButton = await this.page.waitForSelector('[data-testid="buy-now-btn"]', { timeout: 10000 });
    if (buyNowButton) {
      await buyNowButton.click();
      await this.page.waitForLoadState('load');
      await this.page.waitForTimeout(5000);
      console.log('Buy now button clicked!');
    } else {
      throw new Error('Buy now button not found');
    }
  }

  async run(userPrompt: string): Promise<void> {
    try {
      console.log('Initializing agent...');
      await this.initialize();

      // Detect platform based on user input
      const platform = await this.detectPlatform(userPrompt);
      console.log(`Detected platform: ${platform}`);

      if (platform === 'shop') {
        await this.runShopApp(userPrompt);
      } else {
        await this.runFoodApp(userPrompt);
      }

      console.log('✨ Process completed! Browser left open for manual checkout.');
      console.log('💡 Complete your order in the browser, then return here.');

    } catch (error) {
      console.error('Error in agent execution:', error);
    } finally {
      console.log('🌐 Browser will stay open for you to complete checkout');
      console.log('💡 Press Ctrl+C in this terminal when done with your order');
    }
  }
}

export default UnifiedAgent;

// CLI usage
if (require.main === module) {
  const userPrompt = process.argv[2];
  if (!userPrompt) {
    
    // Read input from user
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('', (input: string) => {
      rl.close();
      if (!input.trim()) {
        console.log('No request provided. Exiting...');
        process.exit(1);
      }
      
      const agent = new UnifiedAgent();
      agent.run(input.trim()).catch(console.error);
    });
  } else {
    const agent = new UnifiedAgent();
    agent.run(userPrompt).catch(console.error);
  }
}
