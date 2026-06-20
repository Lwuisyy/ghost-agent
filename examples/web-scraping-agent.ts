/**
 * Example: Web Scraping Agent
 *
 * Demonstrates how to use GhostAgent to scrape multiple pages
 * with automatic proxy rotation, session isolation, and block handling.
 */

import { GhostAgent } from '../src/index.js';

async function main() {
  // Initialize the agent
  const ghost = new GhostAgent({
    proxy: {
      list: (process.env.PROXY_LIST ?? '').split(',').filter(Boolean),
      strategy: 'round-robin',
      maxRetries: 3,
    },
    rateLimit: {
      minDelay: 2000,
      maxDelay: 5000,
      humanJitter: true,
      maxConcurrent: 2,
    },
    log: { level: 'info' },
  });

  await ghost.init();

  // Listen for events
  ghost.on('block-detected', (url, session) => {
    console.log(`🚫 Block detected on ${url} (session: ${session})`);
  });

  ghost.on('captcha-detected', (task, session) => {
    console.log(`🔒 CAPTCHA detected: ${task.type} on session ${session}`);
  });

  ghost.on('proxy-fail', (proxy, error) => {
    console.log(`❌ Proxy failed: ${proxy.host}:${proxy.port} — ${error.message}`);
  });

  // Create a persistent session for this scraping job
  const session = ghost.createSession({ ttl: 600_000 }); // 10 minutes
  console.log(`📌 Session created: ${session.id}`);
  console.log(`🌐 User-Agent: ${session.fingerprint.userAgent}`);

  // URLs to scrape
  const urls = [
    'https://httpbin.org/headers',   // Shows what headers the server sees
    'https://httpbin.org/ip',         // Shows the IP the server sees
    'https://httpbin.org/user-agent', // Shows the user-agent
    'https://httpbin.org/cookies',    // Shows cookies sent
  ];

  // Scrape sequentially (same session = same fingerprint + cookies)
  for (const url of urls) {
    try {
      const res = await ghost.fetch({
        url,
        sessionId: session.id,
        retryOnBlock: true,
        retryOnCaptcha: true,
      });

      console.log(`\n✅ ${url}`);
      console.log(`   Status: ${res.status}`);
      console.log(`   Proxy: ${res.proxy ? `${res.proxy.host}:${res.proxy.port}` : 'direct'}`);
      console.log(`   Timing: ${res.timing.total.toFixed(0)}ms`);
      console.log(`   Body: ${res.body.slice(0, 200)}`);

      if (res.isBlocked) {
        console.log('   ⚠️  Response was flagged as blocked!');
      }
    } catch (err) {
      console.error(`❌ Failed: ${url} — ${err}`);
    }
  }

  // Batch scrape with concurrency
  console.log('\n\n--- Batch scrape ---');
  const batchUrls = Array.from({ length: 5 }, (_, i) => ({
    url: `https://httpbin.org/get?batch=${i}`,
    sessionId: session.id,
  }));

  const results = await ghost.fetchBatch(batchUrls, 3);
  console.log(`Batch complete: ${results.length} responses`);

  // Show final status
  const status = ghost.getStatus();
  console.log('\n📊 Final status:', JSON.stringify(status, null, 2));

  // Cleanup
  ghost.destroySession(session.id);
  ghost.destroy();
}

main().catch(console.error);
