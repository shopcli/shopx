import * as fs from 'fs';
import * as path from 'path';
import { Browser, chromium, Page } from 'playwright';

class CookieCapture {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  async captureCookies(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Opening shop.app for manual login...');
    await this.page.goto('https://shop.app');
    await this.page.waitForLoadState('load');

    console.log('\n🔐 Please login to shop.app in the browser window that opened');
    console.log('Press Enter in this terminal when you have successfully logged in...');
    
    // Wait for user to press Enter
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => {
        resolve();
      });
    });

    console.log('Capturing cookies...');
    
    try {
      const cookies = await this.page.context().cookies();
      
      const cookiesData = {
        cookies: cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite
        })),
        domain: 'shop.app',
        lastUpdated: new Date().toISOString()
      };

      const cookiesPath = path.join(__dirname, 'cookies.json');
      fs.writeFileSync(cookiesPath, JSON.stringify(cookiesData, null, 2));
      
      console.log(`✅ Successfully saved ${cookies.length} cookies to cookies.json`);
      console.log('Cookies captured:');
      cookies.forEach(cookie => {
        console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
      });
      
    } catch (error) {
      console.error('❌ Failed to capture cookies:', error);
    }
  }

  async run(): Promise<void> {
    try {
      await this.initialize();
      await this.captureCookies();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      if (this.browser) {
        console.log('\nClosing browser...');
        await this.browser.close();
      }
    }
  }
}

// Run the cookie capture
if (require.main === module) {
  const capture = new CookieCapture();
  capture.run().catch(console.error);
}

export default CookieCapture;
