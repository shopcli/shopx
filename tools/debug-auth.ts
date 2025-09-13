import { UberEatsAgent } from './agents/uberEatsAgent';
import * as fs from 'fs';

async function debugAuthentication() {
  console.log('🔍 UberEats Authentication Debug');
  console.log('=================================\n');

  const agent = new UberEatsAgent({
    headless: false,
    timeout: 30000,
    useSavedCookies: true
  });

  try {
    console.log('1. 🚀 Initializing agent...');
    await agent['initialize']();

    console.log('2. 📋 Checking for saved cookies...');
    const cookiesPath = 'C:\\Users\\ericl\\WebstormProjects\\shopx\\tools\\cookies\\ubereats-cookies.json';

    if (fs.existsSync(cookiesPath)) {
      const cookieData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      console.log(`   ✅ Found cookie file with ${cookieData.cookies?.length || 0} cookies`);
      console.log(`   📅 Last updated: ${cookieData.lastUpdated}`);
      console.log('   🍪 Sample cookies:');

      if (cookieData.cookies) {
        cookieData.cookies.slice(0, 5).forEach((cookie: any, i: number) => {
          console.log(`      ${i + 1}. ${cookie.name} = ${cookie.value.substring(0, 20)}...`);
        });
      }
    } else {
      console.log('   ❌ No cookie file found');
      return;
    }

    console.log('\n3. 🌐 Navigating to UberEats...');
    await agent['navigateToUberEats']();

    console.log('4. ⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('5. 🔍 Checking current page state...');
    const currentUrl = await agent['page']!.url();
    console.log(`   Current URL: ${currentUrl}`);

    console.log('6. 🍪 Checking current cookies...');
    const currentCookies = await agent['page']!.cookies();
    const uberCookies = currentCookies.filter(c =>
      c.domain.includes('uber') || c.name.toLowerCase().includes('uber')
    );
    console.log(`   Found ${uberCookies.length} Uber-related cookies in browser`);

    console.log('7. 🔐 Testing authentication detection...');
    const isAuthenticated = await agent['page']!.evaluate(() => {
      console.log('Looking for authentication indicators...');

      // Look for sign-in buttons (if present, user is NOT logged in)
      const signInButtons = Array.from(document.querySelectorAll('button, a')).filter(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return text.includes('sign in') || text.includes('log in') || text.includes('sign up');
      });

      console.log(`Found ${signInButtons.length} sign-in buttons:`,
        signInButtons.map(btn => btn.textContent?.trim()).slice(0, 3));

      // Look for account indicators
      const accountElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent?.toLowerCase() || '';
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
        return text.includes('account') ||
               text.includes('profile') ||
               ariaLabel.includes('account') ||
               ariaLabel.includes('profile') ||
               el.getAttribute('data-testid')?.includes('account');
      });

      console.log(`Found ${accountElements.length} account indicators:`,
        accountElements.map(el => el.textContent?.trim() || el.getAttribute('aria-label')).slice(0, 3));

      // Check for user name or email in page
      const userInfo = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent?.trim() || '';
        return text.match(/^[a-zA-Z\s]{2,30}$/) && // Looks like a name
               el.tagName !== 'BUTTON' &&
               el.children.length === 0 && // Leaf node
               text.length > 2;
      });

      console.log(`Found ${userInfo.length} potential user info elements`);

      return {
        hasSignInButtons: signInButtons.length > 0,
        hasAccountElements: accountElements.length > 0,
        hasUserInfo: userInfo.length > 0,
        pageTitle: document.title,
        bodyClasses: document.body?.className || ''
      };
    });

    console.log('\n📊 Authentication Analysis:');
    console.log(`   Sign-in buttons found: ${isAuthenticated.hasSignInButtons}`);
    console.log(`   Account elements found: ${isAuthenticated.hasAccountElements}`);
    console.log(`   User info found: ${isAuthenticated.hasUserInfo}`);
    console.log(`   Page title: ${isAuthenticated.pageTitle}`);

    const likelyAuthenticated = !isAuthenticated.hasSignInButtons &&
                                (isAuthenticated.hasAccountElements || isAuthenticated.hasUserInfo);

    console.log(`\n🎯 Assessment: ${likelyAuthenticated ? '✅ LIKELY AUTHENTICATED' : '❌ NOT AUTHENTICATED'}`);

    console.log('\n🌐 Browser window will stay open for 30 seconds for manual inspection');
    console.log('💡 Check the browser window to verify the authentication state manually');

    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    console.log('\n🔒 Closing browser...');
    await agent.close();
  }
}

debugAuthentication().catch(console.error);