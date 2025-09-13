import { UberEatsAgent } from './agents/uberEatsAgent';

async function saveCookiesHelper() {
  console.log('🍪 UberEats Cookie Saver');
  console.log('========================\n');
  console.log('This script will help you save your UberEats login cookies for future use.\n');

  const agent = new UberEatsAgent({
    headless: false,
    timeout: 60000,
    useSavedCookies: false // Don't load existing cookies
  });

  try {
    console.log('🚀 Opening browser...');
    await agent['initialize']();

    console.log('🌐 Navigating to UberEats...');
    await agent['page']!.goto('https://www.ubereats.com/', { waitUntil: 'networkidle2' });

    console.log('\n📋 Instructions:');
    console.log('1. Click on Sign In or Log In on the UberEats page');
    console.log('2. Complete the login process');
    console.log('3. Return to UberEats main page after logging in');
    console.log('4. Wait here - we\'ll automatically save your cookies');

    // Wait for manual login with simpler approach
    console.log('\n⏳ Waiting 90 seconds for you to complete login...');

    let loginDetected = false;
    const maxAttempts = 18; // Check every 5 seconds for 90 seconds

    for (let i = 0; i < maxAttempts && !loginDetected; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      console.log(`🔍 Checking login status (attempt ${i + 1}/${maxAttempts})...`);

      try {
        // Simple check: look for cookies and current URL
        const currentUrl = await agent['page']!.url();
        const cookies = await agent['page']!.cookies();
        const uberCookies = cookies.filter(c => c.domain.includes('uber'));

        console.log(`   Current URL: ${currentUrl}`);
        console.log(`   Found ${uberCookies.length} Uber-related cookies`);

        // Only save cookies if we're back on ubereats.com (not auth.uber.com) AND have many cookies
        if (currentUrl.includes('ubereats.com') && !currentUrl.includes('auth.uber.com') && uberCookies.length > 8) {
          console.log('✅ Login detected! Back on UberEats with authentication cookies');
          await agent.saveCookiesFromBrowser();
          console.log('🎉 Cookies saved successfully!');
          console.log('💡 You can now use the agent without manual login');
          loginDetected = true;
        } else if (currentUrl.includes('auth.uber.com')) {
          console.log('   On authentication page, waiting for login completion...');
        } else if (uberCookies.length > 3) {
          console.log('   Some cookies detected, but waiting for return to UberEats...');
        } else {
          console.log('   Waiting for login...');
        }

      } catch (error) {
        console.log(`   Error during check: ${(error as Error).message}`);
      }
    }

    if (!loginDetected) {
      console.log('⚠️ No login detected after 90 seconds');
      console.log('💡 You can manually complete login and the cookies will be saved for the next run');
    }

    console.log('\n🔒 Closing browser...');
    await agent.close();

  } catch (error) {
    console.error('❌ Error:', error);
    await agent.close();
    process.exit(1);
  }
}

saveCookiesHelper().catch(console.error);