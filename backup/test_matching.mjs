// Run with: node _backup/test_matching.mjs (matching.js lives at the project root, which is the shipped extension package)
import assert from 'node:assert/strict';
import { matches, matchesAny, isExcepted, hostMatches, escapeRegex } from '../matching.js';

// substring
assert.ok(matches({ text: 'secret', mode: 'substring' }, 'My Secret Page', 'https://a.com'));
assert.ok(matches({ text: 'secret', mode: 'substring' }, '', 'https://a.com/secret/x'));
assert.ok(!matches({ text: 'secret', mode: 'substring' }, 'Public', 'https://a.com'));

// word: whole-word only
assert.ok(matches({ text: 'art', mode: 'word' }, 'Modern Art Museum', 'https://a.com'));
assert.ok(!matches({ text: 'art', mode: 'word' }, 'Smartphone deals', 'https://smartphone.com'));

// domain: exact host or subdomain, not substring
assert.ok(matches({ text: 'bank.com', mode: 'domain' }, '', 'https://bank.com/login'));
assert.ok(matches({ text: 'bank.com', mode: 'domain' }, '', 'https://www.bank.com/x'));
assert.ok(!matches({ text: 'bank.com', mode: 'domain' }, '', 'https://notbank.com/x'));
assert.ok(!matches({ text: 'bank.com', mode: 'domain' }, '', 'https://evil.com/bank.com'));
assert.ok(!hostMatches('not a url', 'bank.com'));

// regex, including invalid patterns
assert.ok(matches({ text: 'sec.et', mode: 'regex' }, 'secret stuff', ''));
assert.ok(!matches({ text: '[invalid(', mode: 'regex' }, '[invalid(', '')); // invalid regex never matches

// regex metacharacters in word mode are escaped, not interpreted
assert.ok(matches({ text: 'a.b', mode: 'word' }, 'file a.b here', ''));
assert.equal(escapeRegex('a.b*'), 'a\\.b\\*');

// exceptions win over keywords
const kws = [{ text: 'bank', mode: 'substring' }];
assert.ok(matchesAny(kws, [], 'My Bank', 'https://somebank.com'));
assert.ok(!matchesAny(kws, ['mybank.com'], 'My Bank', 'https://mybank.com/account'));
assert.ok(isExcepted(['mybank.com'], '', 'https://MYBANK.com/x'));

console.log('All matching tests passed.');
