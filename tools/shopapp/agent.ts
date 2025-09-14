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

	constructor(callback: CallbackMessage) {
		this.callback = callback;
		// @ts-ignore
		this.openRouteApiKey = process.env.OPENROUTER_API_KEY || '';
		if (!this.openRouteApiKey) {
			throw new Error('OPENROUTER_API_KEY environment variable is required');
		}
	}

	async initialize(): Promise<void> {
		this.browser = await chromium.launch({
			headless: true,
			args: [
				'--no-sandbox', 
				'--disable-setuid-sandbox',
				'--enable-javascript',
				'--disable-web-security',
				'--disable-features=VizDisplayCompositor',
				'--disable-dev-shm-usage',
				'--disable-gpu',
				'--disable-extensions',
				'--disable-plugins',
				'--disable-images',
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
		
		// Block unnecessary resources to speed up loading
		await this.page.route('**/*', (route) => {
			const resourceType = route.request().resourceType();
			if (['image', 'media', 'font'].includes(resourceType)) {
				route.abort();
			} else {
				route.continue();
			}
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
		} catch (error) {
			console.error('Error generating search query:', error);
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
		
		const queryString = encodeURIComponent(searchQuery);

		await this.page.goto(`https://shop.app/search?q=${queryString}`);
		
		await this.callback.sendMessage("Waiting for search results")
		await this.page.waitForLoadState('load');
		await this.page.waitForTimeout(5000);
	}

	async extractProducts(): Promise<Product[]> {
		await this.callback.sendMessage("Gathering items")
		if (!this.page) throw new Error('Page not initialized');

		const products: Product[] = [];

		const productCards = await this.page.$$('[data-testid="product-card"]');

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

		return products;
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
		} catch (error) {
			console.error('Error selecting products:', error);
			return products.slice(0, 5);
		}
	}

	async clickProduct(product: Product): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		// Find the product by its title since the stored element reference is stale
		const productCards = await this.page.$$('[data-testid="product-card"]');

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
							await linkElement.click();
							await this.page.waitForLoadState('load');
							await this.page.waitForTimeout(5000);
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

	async clickBuyNow(): Promise<void> {
		await this.callback.sendMessage("Heading to checkout")
		if (!this.page) throw new Error('Page not initialized');

		const buyNowButton = await this.page.waitForSelector(
			'[data-testid="buy-now-btn"]',
			{timeout: 10000},
		);
		if (buyNowButton) {
			await buyNowButton.click();
			await this.page.waitForLoadState('load');
			await this.page.waitForTimeout(5000);

			// Take screenshot and encode as base64
			await this.takeScreenshot();
		} else {
			throw new Error('Buy now button not found');
		}
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
		} catch (error) {
			console.error('Error getting selected product:', error);
			return 0;
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
					// @ts-ignore
					await this.clickProduct(selectedProducts[0]);
					await this.clickBuyNow();
				}
			}
		} catch (error) {
			console.error('Error in agent execution:', error);
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
