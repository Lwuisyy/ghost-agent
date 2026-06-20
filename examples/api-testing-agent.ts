/**
 * Example: API Testing Agent
 *
 * Demonstrates using GhostAgent for API endpoint testing
 * with multiple sessions simulating different users.
 */

import { GhostAgent } from '../src/index.js';

async function main() {
  const ghost = new GhostAgent({
    rateLimit: {
      minDelay: 500,
      maxDelay: 1500,
      humanJitter: true,
      maxConcurrent: 5,
    },
    log: { level: 'debug' },
  });

  await ghost.init();

  // Simulate 3 different users, each with their own fingerprint
  const users = ['alice', 'bob', 'charlie'];
  const sessions = users.map(name => {
    const session = ghost.createSession({
      ttl: 300_000,
    });
    console.log(`👤 ${name} → session ${session.id} | ${session.fingerprint.platform} | ${session.fingerprint.screenResolution.join('x')}`);
    return { name, session };
  });

  // Each user makes requests with their own identity
  const testEndpoints = [
    { method: 'GET' as const, url: 'https://httpbin.org/get' },
    { method: 'POST' as const, url: 'https://httpbin.org/post', body: { action: 'login', user: 'test' } },
    { method: 'GET' as const, url: 'https://httpbin.org/status/200' },
  ];

  for (const { name, session } of sessions) {
    console.log(`\n--- ${name} making requests ---`);

    for (const endpoint of testEndpoints) {
      try {
        const res = await ghost.fetch({
          ...endpoint,
          sessionId: session.id,
        });

        console.log(
          `  ${endpoint.method} ${endpoint.url} → ${res.status} (${res.timing.total.toFixed(0)}ms)`
        );
      } catch (err) {
        console.error(`  ❌ ${endpoint.method} ${endpoint.url} failed: ${err}`);
      }
    }
  }

  // Verify session isolation — each user should have different fingerprints
  console.log('\n--- Session isolation check ---');
  for (const { name, session } of sessions) {
    const s = ghost.sessionManager?.list().find(s => s.id === session.id);
    if (s) {
      console.log(`  ${name}: ${s.requestCount} requests | UA hash: ${hashStr(s.fingerprint.userAgent)}`);
    }
  }

  // Cleanup
  sessions.forEach(({ session }) => ghost.destroySession(session.id));
  ghost.destroy();
  console.log('\n✅ Done');
}

function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

main().catch(console.error);
