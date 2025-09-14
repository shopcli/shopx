import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {chromium} from 'playwright';
import type {Browser, Page} from 'playwright';
import type {CallbackMessage, Message} from '../../cli/source/config/types.js';
import {fileURLToPath} from 'node:url';
import {dirname} from 'path';

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

	constructor() {
		this.openRouteApiKey = process.env.OPENROUTER_API_KEY || '';
		if (!this.openRouteApiKey) {
			throw new Error('OPENROUTER_API_KEY environment variable is required');
		}
	}

	async initialize(): Promise<void> {
		this.browser = await chromium.launch({
			headless: false,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		});
		this.page = await this.browser.newPage();
		await this.page.setViewportSize({width: 1280, height: 720});

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
					console.log(`Loaded ${cookiesData.cookies.length} cookies`);

					// Now navigate to the site with cookies loaded
					await this.page.goto('https://shop.app');
					await this.page.waitForLoadState('load');

					// Verify cookies are loaded
					const currentCookies = await this.page.context().cookies();
					console.log(`Current cookies after load: ${currentCookies.length}`);

					// Check if we're logged in by looking for user-specific elements
					try {
						const userElement = await this.page.waitForSelector(
							'[data-testid*="user"], [data-testid*="account"], .user-menu, .account-menu',
							{timeout: 3000},
						);
						if (userElement) {
							console.log('Successfully authenticated - user elements found');
						}
					} catch (e) {
						console.log('No user elements found - may not be logged in');
					}
				}
			} else {
				console.log('No cookies file found, proceeding without authentication');
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
					model: 'openai/gpt-3.5-turbo',
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
			return data.choices[0].message.content.trim();
		} catch (error) {
			console.error('Error generating search query:', error);
			return userPrompt;
		}
	}

	async navigateToShopApp(): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		// Page should already be on shop.app from loadCookies
		console.log('Already on shop.app, ready to search');
	}

	async performSearch(searchQuery: string): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		const searchSelectors = [
			'input[name="search"]',
			'input[data-testid="search-input"]',
			'input[role="searchbox"]',
			'input[type="search"]',
		];

		let searchInput = null;
		for (const selector of searchSelectors) {
			try {
				searchInput = await this.page.waitForSelector(selector, {
					timeout: 5000,
				});
				if (searchInput) break;
			} catch (e) {
				continue;
			}
		}

		if (!searchInput) {
			throw new Error('Could not find search input');
		}

		await searchInput.click();
		await searchInput.fill(searchQuery);
		await searchInput.press('Enter');
		await this.page.waitForLoadState('load');
		await this.page.waitForTimeout(5000);
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
					console.log(`Title: ${title}`);
					console.log(`Product title: ${product.title}`);
					if (title && title.trim() === product.title) {
						console.log(`Found product: ${title}`);
						const linkElement = await card.$(
							'a[data-testid="product-link-test-id"]',
						);
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

	async clickBuyNow(): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		const buyNowButton = await this.page.waitForSelector(
			'[data-testid="buy-now-btn"]',
			{timeout: 10000},
		);
		if (buyNowButton) {
			await buyNowButton.click();
			await this.page.waitForLoadState('load');
			await this.page.waitForTimeout(5000);
			console.log('Buy now button clicked!');

			// Take screenshot and encode as base64
			await this.takeScreenshot();
		} else {
			throw new Error('Buy now button not found');
		}
	}

	async takeScreenshot(): Promise<void> {
		if (!this.page) throw new Error('Page not initialized');

		try {
			console.log('Taking screenshot...');
			const screenshot = await this.page.screenshot({
				type: 'png',
				fullPage: true,
			});

			const base64Image = screenshot.toString('base64');
			console.log('Screenshot captured (base64):');
			console.log(`data:image/png;base64,${base64Image}`);

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

			console.log('Navigating to shop.app...');
			await this.navigateToShopApp();

			console.log('Performing search...');
			await this.performSearch(searchQuery);

			console.log('Extracting products...');
			const products = await this.extractProducts();
			console.log(`Found ${products.length} products`);

			if (products.length === 0) {
				console.log('No products found');
				return;
			}

			console.log('Selecting best products...');
			console.log(products.map(p => `${p.title} - ${p.price}`));
			const selectedProducts = await this.selectBestProducts(
				products,
				userPrompt,
			);
			console.log(`Selected ${selectedProducts.length} products`);

			if (selectedProducts.length > 0) {
				console.log('Clicking on first product...');
				console.log(selectedProducts[0]);
				await this.clickProduct(selectedProducts[0]);

				console.log('Clicking buy now...');
				await this.clickBuyNow();
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
		console.log('Usage: npm run dev "I want a plain white t shirt for a man"');
		process.exit(1);
	}

	const agent = new ShopAppAgent();
	agent.run(userPrompt).catch(console.error);
}

export async function callShopapp(
	userMessage: Message,
	app: CallbackMessage
) {
	const agent = new ShopAppAgent();
	return agent.run(userMessage.content)
}
