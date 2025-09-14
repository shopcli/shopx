import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { fileURLToPath } from 'node:url';
import * as path from 'path';
import { dirname } from 'path';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import type { CallbackMessage, Message } from '../../cli/source/config/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

interface Product {
	title: string;
	brand: string;
	price: string;
	rating: number;
	reviewCount: number;
	href: string;
}

interface OpenRouteResponse {
	choices: Array<{
		message: {
			content: string;
		};
	}>;
}

class ShopAppAgent {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private openRouteApiKey: string;
	private callback: CallbackMessage;
	private maxRetries: number = 3;
	private retryDelay: number = 1000; // 1 second base delay

	constructor(callback: CallbackMessage) {
		this.callback = callback;
		// @ts-ignore
		this.openRouteApiKey = process.env.OPENROUTER_API_KEY || '';
		if (!this.openRouteApiKey) {
			throw new Error('OPENROUTER_API_KEY environment variable is required');
		}
	}

	private async retryWithBackoff<T>(
		operation: () => Promise<T>,
		operationName: string,
		maxRetries: number = this.maxRetries
	): Promise<T> {
		let lastError: Error | null = null;
		
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error as Error;
				const errorMessage = `❌ ${operationName} failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`;
				await this.callback.sendMessage(errorMessage);
				
				if (attempt < maxRetries) {
					const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
					await this.callback.sendMessage(`⏳ Retrying in ${delay}ms...`);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}
		}
		
		throw new Error(`${operationName} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
	}

	async initialize(): Promise<void> {
		this.browser = await chromium.launch({
			headless: true,
			args: [
				'--enable-javascript',
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-web-security',
				'--disable-features=VizDisplayCompositor',
				'--disable-dev-shm-usage',
				'--disable-gpu',
				'--disable-extensions',
				'--disable-plugins',
				'--disable-background-timer-throttling',
				'--disable-backgrounding-occluded-windows',
				'--disable-renderer-backgrounding',
				'--disable-field-trial-config',
				'--disable-ipc-flooding-protection',
				'--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			],
		});
		this.page = await this.browser.newPage();
		await this.page.setViewportSize({width: 1280, height: 720});
		
		// Additional headless mode configurations
		await this.page.setExtraHTTPHeaders({
			'Accept-Language': 'en-US,en;q=0.9'
		});
		

		// Load cookies if they exist
		await this.loadCookies();
	}

	async loadCookies(): Promise<void> {
		if (!this.page) return;

		const cookiesPath = path.join(__dirname, 'cookies.json');

		try {
			if (fs.existsSync(cookiesPath)) {
				const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));

				if (cookiesData.cookies && Array.isArray(cookiesData.cookies)) {
					// Add cookies before navigating
					const cookiesToAdd = cookiesData.cookies.map((cookie: any) => ({
						name: cookie.name,
						value: cookie.value,
						domain: cookie.domain,
						path: cookie.path,
						secure: cookie.secure,
						httpOnly: cookie.httpOnly,
						sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None',
					}));

					await this.page.context().addCookies(cookiesToAdd);

					// Now navigate to the site with cookies loaded
					await this.page.goto('https://shop.app');
					await this.page.waitForLoadState('load');

					// Check if we're logged in by looking for user-specific elements
					try {
						const userElement = await this.page.waitForSelector(
							'[data-testid*="user"], [data-testid*="account"], .user-menu, .account-menu',
							{timeout: 3000},
						);
						if (userElement) {
						}
					} catch (e) {
					}
				}
			} else {
				await this.page.goto('https://shop.app');
				await this.page.waitForLoadState('load');
			}
		} catch (error) {
			console.warn('Failed to load cookies:', error);
			await this.page.goto('https://shop.app');
			await this.page.waitForLoadState('load');
		}
	}

	async generateSearchQuery(userPrompt: string): Promise<string> {
		const prompt = `Convert this shopping request into an effective search query for an e-commerce site: "${userPrompt}". 
    Return only the search query, no additional text. Focus on key product attributes like type, color, gender, brand, etc.`;

		try {
			return await this.retryWithBackoff(async () => {
				const response = await axios.post(
					'https://openrouter.ai/api/v1/chat/completions',
					{
						model: 'openai/gpt-oss-120b',
						messages: [{role: 'user', content: prompt}],
						max_tokens: 500,
					},
					{
						headers: {
							Authorization: `Bearer ${this.openRouteApiKey}`,
							'Content-Type': 'application/json',
						},
					},
				);

				const data = response.data as OpenRouteResponse;
				// @ts-ignore
				return data.choices[0].message.content.trim();
			}, "Generating search query");
		} catch (error) {
			console.error('Error generating search query:', error);
			await this.callback.sendMessage(`⚠️ Failed to generate search query, using original prompt: ${userPrompt}`);
			return userPrompt;
		}
	}

	async navigateToShopApp(): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		// Page should already be on shop.app from loadCookies
		await this.callback.sendMessage("Navigating to Shopapp...")
	}

	async performSearch(searchQuery: string): Promise<void> {
		await this.callback.sendMessage(`Searching Shopapp with ${searchQuery}`);
		if (!this.page) throw new Error('Page not initialized');
		
		await this.retryWithBackoff(async () => {
			const queryString = encodeURIComponent(searchQuery);
			await this.page!.goto(`https://shop.app/search/results?query=${queryString}`);
			
			await this.callback.sendMessage("Waiting for search results");
			await this.page!.waitForLoadState('load');
			await this.page!.waitForTimeout(5000);
		}, "Search operation");
	}

	async extractProducts(): Promise<Product[]> {
		await this.callback.sendMessage("Gathering items")
		if (!this.page) throw new Error('Page not initialized');

		return await this.retryWithBackoff(async () => {
			const products: Product[] = [];

			const productCards = await this.page!.$$('[data-testid="product-card"]');

			if (productCards.length === 0) {
				throw new Error('No product cards found on the page');
			}

			for (const card of productCards) {
				try {
					const titleElement = await card.$('[data-testid="product-title"]');
					const brandElement = await card.$('p[aria-label]');
					const priceElement = await card.$('[data-testid="regularPrice"]');
					const linkElement = await card.$(
						'a[data-testid="product-link-test-id"]',
					);
					const ratingElement = await card.$('[data-testid="review-stars"] p');

					const title = titleElement ? await titleElement.textContent() : '';
					const brand = brandElement ? await brandElement.textContent() : '';
					const price = priceElement ? await priceElement.textContent() : '';
					const href = linkElement ? await linkElement.getAttribute('href') : '';

					const ratingText = ratingElement
						? await ratingElement.textContent()
						: '';
					const ratingMatch = ratingText?.match(/(\d+)/);
					// @ts-ignore
					const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;

					if (title && href) {
						products.push({
							title: title.trim(),
							brand: brand?.trim() || '',
							price: price?.trim() || '',
							rating,
							reviewCount: 0,
							href: href.startsWith('http') ? href : `https://shop.app${href}`,
						});
					}
				} catch (error) {
					console.warn('Error extracting product data:', error);
				}
			}

			if (products.length === 0) {
				throw new Error('No products could be extracted from the page');
			}

			return products;
		}, "Product extraction");
	}

	async selectBestProducts(
		products: Product[],
		userPrompt: string,
	): Promise<Product[]> {
		await this.callback.sendMessage(`Picking best items from ${products.length} products`);
		if (products.length === 0) return [];

		const productList = products
			.map(p => `${p.title} - ${p.brand} - ${p.price}`)
			.join('\n');

		const prompt = `From these products, select the 5 best matches for: "${userPrompt}"
    
Products:
${productList}

Consider the price when making your selection. Return only the product titles, one per line, in order of preference. Do not change the original text of the product titles.`;

		try {
			return await this.retryWithBackoff(async () => {
				const response = await axios.post(
					'https://openrouter.ai/api/v1/chat/completions',
					{
						model: 'openai/gpt-oss-120b',
						messages: [{role: 'user', content: prompt}],
						max_tokens: 5000,
					},
					{
						headers: {
							Authorization: `Bearer ${this.openRouteApiKey}`,
							'Content-Type': 'application/json',
						},
					},
				);

				const data = response.data as OpenRouteResponse;
				// @ts-ignore
				const selectedTitles = data.choices[0].message.content
					.split('\n')
					.map(line => line.trim())
					.filter(line => line.length > 0);

				const selectedProducts: Product[] = [];

				for (const title of selectedTitles) {
					const product = products.find(
						p =>
							p.title.toLowerCase().includes(title.toLowerCase()) ||
							title.toLowerCase().includes(p.title.toLowerCase()),
					);
					if (product && selectedProducts.length < 5) {
						selectedProducts.push(product);
					}
				}

				return selectedProducts;
			}, "Selecting best products");
		} catch (error) {
			console.error('Error selecting products:', error);
			await this.callback.sendMessage(`⚠️ Failed to select best products, using first 5 products`);
			return products.slice(0, 5);
		}
	}

	async clickProduct(product: Product): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		await this.retryWithBackoff(async () => {
			// Find the product by its title since the stored element reference is stale
			const productCards = await this.page!.$$('[data-testid="product-card"]');

			for (const card of productCards) {
				try {
					const titleElement = await card.$('[data-testid="product-title"]');
					if (titleElement) {
						const title = await titleElement.textContent();
						if (title && title.trim() === product.title) {
							const linkElement = await card.$(
								'a[data-testid="product-link-test-id"]',
							);
							if (linkElement) {
								try {
									// Small delay to let the page stabilize
									await this.page!.waitForTimeout(1000);
									// Wait for element to be stable before clicking
									await linkElement.waitForElementState('stable', { timeout: 10000 });
									// Scroll element into view to ensure it's clickable
									await linkElement.scrollIntoViewIfNeeded();
									// Click with force to bypass stability checks if needed
									await linkElement.click({ force: true, timeout: 15000 });
								} catch (clickError) {
									// Fallback: try clicking via JavaScript if normal click fails
									console.warn('Normal click failed, trying JavaScript click:', clickError);
									await linkElement.evaluate((el: HTMLAnchorElement) => el.click());
								}
								await this.page!.waitForLoadState('load');
								await this.page!.waitForTimeout(5000);
								return;
							}
						}
					}
				} catch (error) {
					console.warn('Error checking product card:', error);
				}
			}

			throw new Error(`Could not find product: ${product.title}`);
		}, `Clicking product: ${product.title}`);
	}

	async clickBuyNow(): Promise<void> {
		await this.callback.sendMessage("Heading to checkout")
		if (!this.page) throw new Error('Page not initialized');

		await this.retryWithBackoff(async () => {
			// Check if we're on a product page before looking for buy now button
			const currentUrl = this.page!.url();
			
			if (!currentUrl.startsWith('https://shop.app/products/')) {
				throw new Error(`Not on a product page. Current URL: ${currentUrl}. Buy now button only available on product pages.`);
			}
			

			// Wait longer for the page to fully load in headless mode
			await this.page!.waitForTimeout(5000);


			// Try the original selector first
			let buyNowButton = null;
			try {
				buyNowButton = await this.page!.waitForSelector(
					'[data-testid="buy-now-btn"]',
					{timeout: 10000},
				);
			} catch (e) {
				
				// Try looking for buttons with spans containing "Buy now"
				try {
					buyNowButton = await this.page!.waitForSelector(
						'button:has(span:has-text("Buy now"))',
						{timeout: 10000},
					);
				} catch (e2) {
					
					// Try other variations
					const alternativeSelectors = [
						'button:has-text("Buy now")',
						'button:has-text("Buy Now")',
						'[data-testid*="buy"]',
						'button[data-testid*="buy"]'
					];
					
					for (const selector of alternativeSelectors) {
						try {
							buyNowButton = await this.page!.waitForSelector(selector, { timeout: 5000 });
							break;
						} catch (e3) {
						}
					}
				}
			}

			if (buyNowButton) {
				await buyNowButton.click();
				await this.page!.waitForLoadState('load');
				await this.page!.waitForTimeout(7500);

				// Take screenshot and encode as base64
				await this.takeScreenshot();
			} else {
				throw new Error('Buy now button not found with any selector');
			}
		}, "Clicking buy now button");
	}

	async takeScreenshot(): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		try {
			const screenshot = await this.page.screenshot({
				type: 'png',
				fullPage: true,
			});

			await this.callback.sendMessage("Checkout reached")
			const base64Image = screenshot.toString('base64');
			this.callback.sendImage(base64Image);
		} catch (error) {
			console.error('Failed to take screenshot:', error);
		}
	}

	async getSelectedProduct(selectedProducts: Product[], selectedOption: string): Promise<number> {
		const prompt = `Always return an integer from 1 to 5. Even when the user input makes no sense,
                return an integer from 1 to 5. Even if the user input is not a number, return an integer from 1 to 5.
								Be sure to look for numbers like 1, 2, 3, 4, 5. and also work with words like first, second, third, fourth, fifth.
								The user put this as what they wanted to buy: <selectedOption> ${selectedOption} </selectedOption>
                Here are the products:
${selectedProducts.map((sp,index) => `${index + 1}. ${sp.title}`)}`

		try {
			return await this.retryWithBackoff(async () => {
				const response = await axios.post(
					'https://openrouter.ai/api/v1/chat/completions',
					{
						model: 'openai/gpt-oss-120b',
						messages: [{role: 'user', content: prompt}],
						max_tokens: 1500,
					},
					{
						headers: {
							Authorization: `Bearer ${this.openRouteApiKey}`,
							'Content-Type': 'application/json',
						},
					},
				);

				const data = response.data as OpenRouteResponse;
				// @ts-ignore
				return parseInt(data.choices[0].message.content);
			}, "Getting selected product");
		} catch (error) {
			console.error('Error getting selected product:', error);
			await this.callback.sendMessage(`⚠️ Failed to parse product selection, defaulting to first product`);
			return 1;
		}
	}

	async run(userPrompt: string): Promise<void> {
		try {
			await this.initialize();

			const searchQuery = await this.generateSearchQuery(userPrompt);
			await this.callback.sendMessage(`Search query: ${searchQuery}`);

			await this.navigateToShopApp();

			await this.performSearch(searchQuery);

			const products = await this.extractProducts();

			if (products.length === 0) {
				await this.callback.sendMessage("❌ No products found. The search might have failed or the page structure changed.");
				return;
			}

			const selectedProducts = await this.selectBestProducts(
				products,
				userPrompt,
			);

			if (selectedProducts.length > 0) {
				const selectedOption = await this.callback.sendOptions(selectedProducts.map(sp => sp.title))

				const selectedProductIndex = await this.getSelectedProduct(selectedProducts, selectedOption);
				// Find the selected product by title
				const selectedProduct = selectedProducts[selectedProductIndex - 1];
				if (selectedProduct) {
					await this.clickProduct(selectedProduct);

					await this.clickBuyNow();
				} else {
					await this.callback.sendMessage("⚠️ Selected product not found, using first available product");
					// @ts-ignore
					await this.clickProduct(selectedProducts[0]);
					await this.clickBuyNow();
				}
			} else {
				await this.callback.sendMessage("❌ No products could be selected for purchase.");
			}
		} catch (error) {
			const errorMessage = `❌ Critical error in agent execution: ${error instanceof Error ? error.message : 'Unknown error'}`;
			console.error('Error in agent execution:', error);
			await this.callback.sendMessage(errorMessage);
		} finally {
			if (this.browser) {
				await this.browser.close();
			}
		}
	}
}

export default ShopAppAgent;

// CLI usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const userPrompt = process.argv[2];
	if (!userPrompt) {
		process.exit(1);
	}

	// const agent = new ShopAppAgent();
	// agent.run(userPrompt).catch(console.error);
}

export async function callShopapp(
	userMessage: Message,
	// @ts-ignore
	app: CallbackMessage
) {
	const agent = new ShopAppAgent(app);
	return agent.run(userMessage.content)
}
