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

const AI_MODEL = 'cohere/command-a'

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
				const errorMessage = ` ${operationName} failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`;
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
		const prompt = `Convert the following shopping request into a concise and effective search query for an e-commerce site: <userPrompt>${userPrompt}</userPrompt>. 
		- Focus on one or two key product attributes (e.g., type, color, gender, brand). 
		- If the request is nonsensical or empty, generate a reasonable random product query instead. 
		- ALWAYS return a valid search query suitable for an e-commerce search bar. 
		- Return only the search query, no additional text.`;

		try {
			return await this.retryWithBackoff(async () => {
				const response = await axios.post(
					'https://openrouter.ai/api/v1/chat/completions',
					{
						model: AI_MODEL,
						messages: [{role: 'user', content: prompt}],
						max_tokens: 10000,
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
			await this.callback.sendMessage(` Failed to generate search query, using original prompt: ${userPrompt}`);
			return userPrompt;
		}
	}

	async navigateToShopApp(): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		// Page should already be on shop.app from loadCookies
		await this.callback.sendMessage("Shop.app has been selected for this query!", ["routed to https://shop.app", "setup agent metadata"])
	}

	async performSearch(searchQuery: string): Promise<void> {
		await this.callback.sendMessage(`Query ready! searching shop.app with \"${searchQuery}\"`, ["configuring encoding", "routing to correct search endpoint"]);
		if (!this.page) throw new Error('Page not initialized');
		
		await this.retryWithBackoff(async () => {
			const queryString = encodeURIComponent(searchQuery);
			await this.page!.goto(`https://shop.app/search/results?query=${queryString}`);
			
			await this.callback.sendMessage("Waiting for search results to load...");
			await this.page!.waitForLoadState('load');
			await this.page!.waitForTimeout(5000);
		}, "Search operation");
	}

	async extractProducts(): Promise<Product[]> {
		await this.callback.sendMessage("Gathering items from shop.app search results", ["parsing search results", "extracting product information"])
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
		await this.callback.sendMessage(`Picking best items from ${products.length} products`, ["ranking products", "selecting best matches from user prompt"]);
		if (products.length === 0) return [];

		const productList = products
			.map(p => `{
				Title: ${p.title}
				Brand: ${p.brand}
				Price: ${p.price}
				Rating: ${p.rating}
				Review Count: ${p.reviewCount}
			}`)
			.join('\n');

			const prompt = `From the following product list, select the 5 best matches for: "${userPrompt}".

			Guidelines:
			- Prioritize relevance to the query as much as possible.  
			- Consider price when ranking the matches.  
			- RETURN EXACTLY 5 ITEMS. FIVE (5) ITEMS.
			- RETURN ONLY THE PRODUCT TITLES, ONE PER LINE, IN ORDER OF PREFERENCE.  
			- DO NOT change or alter the original product titles in any way.
			- DO NOT RETURN ANY NUMBER OR ANYTHING ELSE OTHER THAN THE PRODUCT TITLES.

			Products:
			${productList}
			`;

		try {
			return await this.retryWithBackoff(async () => {
				const response = await axios.post(
					'https://openrouter.ai/api/v1/chat/completions',
					{
						model: AI_MODEL,
						messages: [{role: 'user', content: prompt}],
						max_tokens: 20000,
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

				let selectedProducts: Product[] = [];

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

				if (selectedProducts.length !== 5) {
					// crop it to 5
					selectedProducts = selectedProducts.slice(0, 5);
				}

				return selectedProducts;
			}, "Selecting best products");
		} catch (error) {
			console.error('Error selecting products:', error);
			await this.callback.sendMessage(`Failed to select best products, using first 5 products`);
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
		}, "Clicking buy now button", 1); // Only 1 retry for the main flow
	}

	async retryWithOriginalSelection(originalSelection: {selectedProduct: Product, selectedOption: string, selectedProductIndex: number}): Promise<void> {
		await this.callback.sendMessage("🔄 Buy now failed, going back to search results to try again...");
		
		try {
			// Go back to search results
			await this.page!.goBack();
			await this.page!.waitForLoadState('load');
			await this.page!.waitForTimeout(3000);

			// Use the exact same selection without re-asking the user
			await this.callback.sendMessage(`🔄 Retrying with the same selection: ${originalSelection.selectedProduct.title}`);
			
			// Click the same product directly
			await this.clickProduct(originalSelection.selectedProduct);
			await this.clickBuyNow();
			
		} catch (error) {
			await this.callback.sendMessage(` Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	async takeScreenshot(): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		try {
			const screenshot = await this.page.screenshot({
				type: 'jpeg',
				fullPage: true,
			});

			await this.callback.sendMessage("Checkout reached", ["routing to checkout page", "taking screenshot of checkout page for confirmation"]);
			const base64Image = screenshot.toString('base64');
			this.callback.sendImage(base64Image);
			this.callback.sendMessage("Your order has been set up successfully!")
		} catch (error) {
			console.error('Failed to take screenshot:', error);
		}
	}

	async getSelectedProduct(selectedProducts: Product[], selectedOption: string): Promise<number> {
		const prompt = `Your task is to return exactly one integer from 1 to 5, following the schema strictly. 
		- Always return a single integer between 1 and 5. Never return anything else.  
		- Even if the user input is nonsensical, irrelevant, or ambiguous, still return an integer from 1 to 5.  
		- If the input clearly contains a number (e.g., "1", "2", "3", "4", "5") or words like "first", "second", "third", "fourth", "fifth", map them to the corresponding integer.  
		- If the input is ambiguous, make your best guess by matching the theme of the input to the most relevant option.  
		- If no strong match is found, return a reasonable fallback integer.  
		- DO NOT break the schema under any circumstance.

		The user provided this as what they want to buy: <selectedOption> ${selectedOption} </selectedOption>

		Here are the products:
		${selectedProducts.map((sp, index) => `${index + 1}. ${sp.title}`)}`;


		try {
			return await this.retryWithBackoff(async () => {
				const response = await axios.post(
					'https://openrouter.ai/api/v1/chat/completions',
					{
						model: AI_MODEL,
						messages: [{role: 'user', content: prompt}],
						max_tokens: 10000,
					},
					{
						headers: {
							Authorization: `Bearer ${this.openRouteApiKey}`,
							'Content-Type': 'application/json',
						},
					},
				);

				const data = response.data as OpenRouteResponse;
				const parsed = parseInt(data.choices[0]?.message.content || '0');
				// @ts-ignore
				return parsed;
			}, "Getting selected product");
		} catch (error) {
			console.error('Error getting selected product:', error);
			await this.callback.sendMessage(` Failed to parse product selection, defaulting to first product`);
			return 1;
		}
	}

	async turnSelectedProductsIntoReadableNames(selectedProducts: Product[]): Promise<string[]> {
		const prompt = `From the following product list, generate a simplified, user-friendly name for each product:
		${selectedProducts.map(sp => sp.title).join(', ')}

		Guidelines:
		- Convert long, SEO-optimized titles into short, clear names that are easy for users to understand.  
		- Keep the name close to the original — do not change it so much that it becomes confusing or misleading.  
		- Preserve the core meaning and key product identifiers (e.g., type, brand, or model if important).  
		- Return only the readable names, one per line.  
		- Do not return any additional text or formatting.`;


		return await this.retryWithBackoff(async () => {
			const response = await axios.post(
				'https://openrouter.ai/api/v1/chat/completions',
				{
					model: AI_MODEL,
					messages: [{role: 'user', content: prompt}],
					max_tokens: 10000,
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
			return data.choices[0].message.content.split('\n').map(line => line.trim());
		}, "Turning selected products into readable names");
	}

	async run(userPrompt: string): Promise<void> {
		try {
			await this.initialize();

			const searchQuery = await this.generateSearchQuery(userPrompt);

			await this.navigateToShopApp();

			await this.performSearch(searchQuery);

			const products = await this.extractProducts();

			if (products.length === 0) {
				await this.callback.sendMessage(" No products found. The search might have failed or the page structure changed.");
				return;
			}

			const selectedProducts = await this.selectBestProducts(
				products,
				userPrompt,
			);

			const turnSelectedProductsIntoReadableNames = await this.turnSelectedProductsIntoReadableNames(selectedProducts);

			if (selectedProducts.length > 0) {
				const selectedOption = await this.callback.sendOptions(turnSelectedProductsIntoReadableNames)
				
				const selectedProductIndex = await this.getSelectedProduct(selectedProducts, selectedOption);
				// Find the selected product by title
				let selectedProduct = selectedProducts[selectedProductIndex - 1];

				await this.callback.sendMessage(`User selected a product!`, ["user selected product as best match", "routing to correct product page"]);
				
				// Save the original selection for potential retry
				if (!selectedProduct) {
					selectedProduct = selectedProducts[0];
				}
				if (!selectedProduct) {
					throw new Error("No products available for selection");
				}
				const originalSelection = {
					selectedProduct,
					selectedOption,
					selectedProductIndex
				};
				
				if (selectedProduct) {
					await this.clickProduct(selectedProduct);

					try {
						await this.clickBuyNow();
					} catch (error) {
						// If buy now fails, try going back to search and retrying with original selection
						if (error instanceof Error && error.message.includes("Clicking buy now button failed after")) {
							await this.retryWithOriginalSelection(originalSelection);
						} else {
							throw error;
						}
					}
				} else {
					await this.callback.sendMessage("Selected product not found, using first available product");
					const fallbackProduct = selectedProducts[0];
					if (!fallbackProduct) {
						throw new Error("No products available for fallback");
					}
					const fallbackSelection = {
						selectedProduct: fallbackProduct,
						selectedOption: fallbackProduct.title,
						selectedProductIndex: 1
					};
					
					await this.clickProduct(fallbackProduct);
					try {
						await this.clickBuyNow();
					} catch (error) {
						// If buy now fails, try going back to search and retrying with original selection
						if (error instanceof Error && error.message.includes("Clicking buy now button failed after")) {
							await this.retryWithOriginalSelection(fallbackSelection);
						} else {
							throw error;
						}
					}
				}
			} else {
				await this.callback.sendMessage("No products could be selected for purchase.");
			}
		} catch (error) {
			const errorMessage = `Critical error in agent execution: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
