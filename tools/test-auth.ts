import { UberEatsAgent } from './agents/uberEatsAgent';
import * as dotenv from 'dotenv';

dotenv.config();

async function testCookieAuthentication() {
  console.log('🧪 Testing UberEats Cookie-Based Authentication');
  console.log('===============================================\n');

  const agent = new UberEatsAgent({
    headless: false,
    timeout: 60000,
    useSavedCookies: true
  });

  try {
    console.log('🚀 Initializing agent with cookie loading...');
    await agent['initialize'](); // Access private method for testing

    console.log('🔐 Checking authentication status...');
    const isLoggedIn = await agent['isLoggedIn'](); // Access private method for testing

    if (isLoggedIn) {
      console.log('✅ Successfully authenticated with saved cookies!');
      console.log('🎉 You can now place orders using your saved account');
    } else {
      console.log('⚠️ Not authenticated with cookies');
      console.log('💡 To set up cookie authentication:');
      console.log('   1. Log into UberEats manually in this browser window');
      console.log('   2. Once logged in, call agent.saveCookiesFromBrowser()');
      console.log('   3. Or manually export cookies to cookies/manual-cookies.json');
    }

    console.log('\n📋 Cookie authentication setup options:');
    console.log('   • Manual login: Log in now and we\'ll save your session');
    console.log('   • Export cookies: Use browser dev tools to export cookies');
    console.log('   • Browser extension: Use a cookie export extension');

    console.log('\n🌐 Browser will remain open for you to log in manually if needed');
    console.log('⏰ Waiting 60 seconds for manual login...');

    await new Promise(resolve => setTimeout(resolve, 60000));

    // Check again after potential manual login
    const isLoggedInAfterWait = await agent['isLoggedIn']();
    if (isLoggedInAfterWait) {
      console.log('✅ Detected successful manual login!');
      await agent.saveCookiesFromBrowser();
      console.log('💾 Cookies saved for future use');
    }

  } catch (error) {
    console.error('❌ Error during cookie authentication test:', error);
  } finally {
    console.log('🔒 Closing browser...');
    await agent.close();
  }
}

// Run the test
testCookieAuthentication().catch(console.error);