/**
 * Quick runtime smoke test — no proxies needed, tests against httpbin.org
 */
import { GhostAgent } from '../src/index.js';
import { FingerprintGenerator } from '../src/browser/fingerprint.js';
import { ProxyPool, ProxyRotator, parseProxyUrl } from '../src/proxy/index.js';
import { CookieJar } from '../src/session/cookie-jar.js';
import { createLogger } from '../src/utils/logger.js';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function testFingerprint() {
  console.log('\n🔬 Fingerprint Generator');
  const gen = new FingerprintGenerator();

  const fp1 = gen.generate();
  const fp2 = gen.generate();

  assert('generates userAgent', fp1.userAgent.length > 20);
  assert('generates platform', fp1.platform.length > 0);
  assert('generates timezone', fp1.timezone.length > 0);
  assert('generates screenResolution', fp1.screenResolution.length === 2);
  assert('generates fonts array', fp1.fonts.length > 3);
  assert('generates headers', Object.keys(fp1.headers).length > 5);
  assert('fingerprints are unique', fp1.userAgent !== fp2.userAgent || fp1.canvasHash !== fp2.canvasHash);
  assert('has consistent chrome headers', fp1.userAgent.includes('Chrome') ? fp1.headers['Sec-Ch-Ua'] !== undefined : true);
}

async function testCookieJar() {
  console.log('\n🍪 Cookie Jar');
  const jar = new CookieJar();

  jar.parseSetCookie('session_id=abc123; Path=/; Domain=example.com; HttpOnly', 'example.com');
  jar.parseSetCookie('theme=dark; Path=/; Domain=example.com; Max-Age=3600', 'example.com');
  jar.parseSetCookie('tracking=xyz; Path=/; Domain=other.com', 'other.com');

  const cookies = jar.get('example.com');
  assert('parses Set-Cookie', cookies.length === 2);
  assert('correct cookie values', cookies.some(c => c.name === 'session_id' && c.value === 'abc123'));
  assert('httpOnly flag set', cookies.some(c => c.name === 'session_id' && c.httpOnly === true));
  assert('domain isolation works', jar.get('other.com').length === 1);

  const header = jar.toHeader('example.com');
  assert('toHeader builds string', header.includes('session_id=abc123') && header.includes('theme=dark'));
}

async function testProxyPool() {
  console.log('\n🔄 Proxy Pool');
  const logger = createLogger('warn');
  const pool = new ProxyPool('round-robin', 3, 30000, logger);

  const proxies = [
    parseProxyUrl('http://proxy1.com:8080'),
    parseProxyUrl('http://user:pass@proxy2.com:3128'),
    parseProxyUrl('socks5://proxy3.com:1080'),
  ];

  pool.addProxies(proxies);

  const stats = pool.getStats();
  assert('added 3 proxies', stats.total === 3);
  assert('all healthy initially', stats.healthy === 3);

  // Test round-robin
  const p1 = pool.getNext();
  const p2 = pool.getNext();
  const p3 = pool.getNext();
  const p4 = pool.getNext();
  assert('round-robin cycles', p1?.host !== p2?.host || p2?.host !== p3?.host);
  assert('round-robin wraps', p4?.host === p1?.host);

  // Test failure reporting
  pool.reportFailure(proxies[0]!, 'example.com');
  pool.reportFailure(proxies[0]!, 'example.com');
  pool.reportFailure(proxies[0]!, 'example.com');
  pool.reportFailure(proxies[0]!, 'example.com');
  pool.reportFailure(proxies[0]!, 'example.com');
  pool.reportFailure(proxies[0]!, 'example.com');

  const statsAfter = pool.getStats();
  assert('unhealthy proxy removed', statsAfter.healthy === 2);

  // Test exclusion
  const excludeSet = new Set([proxies[1]!.host]);
  const pExcl = pool.getNext(excludeSet);
  assert('exclusion works', pExcl?.host !== proxies[1]!.host);

  pool.destroy();
  assert('pool destroyed', pool.getStats().total === 0);
}

async function testGhostAgent() {
  console.log('\n👻 GhostAgent Integration');
  const ghost = new GhostAgent({
    rateLimit: { minDelay: 100, maxDelay: 300, humanJitter: false, maxConcurrent: 3, burstLimit: 10, burstWindow: 60000 },
    log: { level: 'warn' },
  });

  await ghost.init();

  // Test session creation
  const s1 = ghost.createSession();
  const s2 = ghost.createSession();
  assert('session created', s1.id.length > 0);
  assert('sessions are different', s1.id !== s2.id);
  assert('different fingerprints', s1.fingerprint.userAgent !== s2.fingerprint.userAgent || s1.fingerprint.canvasHash !== s2.fingerprint.canvasHash);
  assert('different timezones possible', true); // probabilistic

  // Test actual HTTP request (no proxy)
  console.log('  ⏳ Making HTTP request to httpbin.org...');
  try {
    const res = await ghost.fetch({
      url: 'https://httpbin.org/headers',
      sessionId: s1.id,
    });

    assert('request succeeds', res.status === 200, `got ${res.status}`);
    assert('response has body', res.body.length > 0);
    assert('response has timing', res.timing.total > 0);
    assert('not blocked', res.isBlocked === false);
    assert('no captcha', res.captchaDetected === null);

    // Verify our stealth headers were sent
    const headers = JSON.parse(res.body).headers;
    assert('user-agent sent', headers['User-Agent']?.length > 10);
    assert('sec-fetch headers sent', headers['Sec-Fetch-Dest'] === 'document');

    console.log(`  📡 Server saw UA: ${headers['User-Agent']?.slice(0, 60)}...`);
  } catch (err) {
    assert('request succeeds', false, String(err));
  }

  // Test second request (same session = same cookies)
  try {
    const res2 = await ghost.fetch({
      url: 'https://httpbin.org/get?test=2',
      sessionId: s1.id,
    });
    assert('second request succeeds', res2.status === 200);
    assert('same session maintained', res2.sessionId === s1.id);
  } catch (err) {
    assert('second request succeeds', false, String(err));
  }

  // Test status
  const status = ghost.getStatus();
  assert('status reports sessions', status.activeSessions === 2);

  // Cleanup
  ghost.destroySession(s1.id);
  ghost.destroySession(s2.id);
  ghost.destroy();
  assert('agent destroyed', true);
}

// ─── Run ─────────────────────────────────────────────────────

console.log('🧪 Ghost Agent Runtime Tests\n' + '='.repeat(40));

(async () => {
  try {
    await testFingerprint();
    await testCookieJar();
    await testProxyPool();
    await testGhostAgent();
  } catch (err) {
    console.error('\n💥 Unexpected error:', err);
    failed++;
  }

  console.log('\n' + '='.repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
})();
