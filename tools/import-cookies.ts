import * as fs from 'fs';
import * as path from 'path';

async function importCookiesFromClipboard() {
  console.log('📋 Manual Cookie Import Helper');
  console.log('==============================\n');

  console.log('🍪 This helper will guide you through importing cookies manually.');
  console.log('\n📋 Steps to import cookies:');
  console.log('1. Log into UberEats in your browser');
  console.log('2. Open Developer Tools (F12)');
  console.log('3. Go to Application → Cookies → https://www.ubereats.com');
  console.log('4. Select all cookies (Ctrl+A) and copy them');
  console.log('5. Paste the data below and format as JSON');

  console.log('\n📁 Cookie file locations:');
  console.log(`   Primary: ${path.join(process.cwd(), 'cookies', 'ubereats-cookies.json')}`);
  console.log(`   Manual:  ${path.join(process.cwd(), 'cookies', 'manual-cookies.json')}`);

  console.log('\n🔧 Manual JSON format example:');
  console.log(`{
  "cookies": [
    {
      "name": "cookie_name",
      "value": "cookie_value",
      "domain": ".ubereats.com",
      "path": "/",
      "expires": 1234567890,
      "httpOnly": false,
      "secure": true,
      "sameSite": "None"
    }
  ],
  "domain": "ubereats.com",
  "lastUpdated": "${new Date().toISOString()}"
}`);

  console.log('\n📱 Alternative: Use the browser console script');
  console.log('   Run the cookie export script I provided earlier in your browser console');

  console.log('\n🧪 After importing, test with:');
  console.log('   npm run debug-auth');

  // Check current state
  const cookiesDir = path.join(process.cwd(), 'cookies');
  if (!fs.existsSync(cookiesDir)) {
    fs.mkdirSync(cookiesDir, { recursive: true });
    console.log('\n📁 Created cookies directory');
  }

  const primaryCookies = path.join(cookiesDir, 'ubereats-cookies.json');
  const manualCookies = path.join(cookiesDir, 'manual-cookies.json');

  console.log('\n📊 Current cookie files:');
  console.log(`   ubereats-cookies.json: ${fs.existsSync(primaryCookies) ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`   manual-cookies.json:   ${fs.existsSync(manualCookies) ? '✅ EXISTS' : '❌ MISSING'}`);

  if (fs.existsSync(primaryCookies)) {
    try {
      const data = JSON.parse(fs.readFileSync(primaryCookies, 'utf8'));
      console.log(`   Primary file contains: ${data.cookies?.length || 0} cookies`);
      console.log(`   Last updated: ${data.lastUpdated || 'Unknown'}`);
    } catch (error) {
      console.log('   ⚠️ Primary file appears corrupted');
    }
  }

  if (fs.existsSync(manualCookies)) {
    try {
      const data = JSON.parse(fs.readFileSync(manualCookies, 'utf8'));
      console.log(`   Manual file contains: ${Array.isArray(data) ? data.length : 'Invalid format'} cookies`);
    } catch (error) {
      console.log('   ⚠️ Manual file appears corrupted');
    }
  }
}

importCookiesFromClipboard().catch(console.error);