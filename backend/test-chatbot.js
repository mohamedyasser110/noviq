/* Chatbot v2 test suite — run from backend/: node test-chatbot.js */
process.env.NODE_ENV = 'test';
const { reply } = require('./chatbot/engine');
const { search, indexStats } = require('./chatbot/search');

let pass = 0, failCount = 0;
const failures = [];

async function T(name, input, check, sid) {
  const r = await reply(input, sid || 'test-' + Math.random().toString(36).slice(2, 8));
  const okRes = check(r);
  if (okRes === true) { pass++; console.log('PASS  ' + name); }
  else { failCount++; failures.push(name); console.log(`FAIL  ${name} → intent=${r.intent} source=${r.source} reply="${String(r.reply).slice(0, 70)}..." (${okRes})`); }
  return r;
}

(async () => {

console.log('=== Index stats ===');
console.log(JSON.stringify(indexStats()));

console.log('\n=== Layer 3: intents (EN) ===');
await T('greeting en', 'hello there', r => r.intent === 'greeting' || 'wrong intent');
await T('services en', 'what services do you offer', r => r.intent === 'services_overview' || 'wrong intent');
await T('pricing en', 'how much does a website cost', r => ['pricing', 'service_web'].includes(r.intent) || 'wrong intent');
await T('erp en', 'we need an erp system', r => r.intent === 'service_erp' || 'wrong intent');

console.log('\n=== Layer 3: intents (AR) ===');
await T('greeting ar', 'السلام عليكم', r => r.intent === 'greeting' || 'wrong intent');
await T('services ar', 'ايش خدماتكم', r => r.intent === 'services_overview' || 'wrong intent');
await T('pricing ar typo', 'الاسعااار', r => r.intent === 'pricing' || 'wrong intent');
await T('mobile ar', 'ابغى تطبيق جوال', r => r.intent === 'service_mobile' || 'wrong intent');

console.log('\n=== Layer 4: FAQ retrieval (BM25) ===');
await T('nda en', 'will you sign an nda to protect my idea', r => r.source === 'faq' && r.intent.includes('nda') || 'expected faq:nda');
await T('warranty ar', 'هل يوجد ضمان على العمل', r => r.source === 'faq' && r.intent.includes('warranty') || 'expected faq:warranty');
await T('pos ar', 'ابغى نظام نقاط بيع كاشير', r => r.source === 'faq' && r.intent.includes('pos') || 'expected faq:pos');
await T('source code en', 'who owns the source code after delivery', r => r.intent.includes('source_code') || 'expected faq:source_code');
await T('excel ar', 'عندنا ملفات اكسل كثيره ونبي نظام', r => r.intent.includes('migration_excel') || r.intent === 'service_custom' || 'expected excel faq');
await T('booking en', 'i need an appointment booking system for my clinic', r => r.intent.includes('booking') || 'expected faq:booking');

console.log('\n=== Layer 1: search command ===');
await T('search cmd en', 'search: payment gateways', r => r.source === 'search' && r.reply.includes('1.') || 'expected search results');
await T('search cmd ar', 'ابحث عن الضمان', r => r.source === 'search' && r.reply.includes('1.') || 'expected search results');

console.log('\n=== Layer 2: follow-up context ===');
const sid = 'ctx-session-1';
await reply('tell me about erp systems', sid);
await T('followup how much', 'how much?', r => r.intent === 'pricing' && r.source === 'context' || 'expected context pricing', sid);
const sid2 = 'ctx-session-2';
await reply('ابغى نظام erp', sid2);
await T('followup ar كم السعر', 'كم السعر؟', r => r.intent === 'pricing' && r.source === 'context' || 'expected context pricing', sid2);

console.log('\n=== Layers 5+6: fallback + web search ===');
await T('gibberish fallback or web', 'xyzabc qwerty foobar', r => ['fallback', 'web'].includes(r.source) || 'expected fallback/web');
await T('web fallback general knowledge', 'what is the capital of Japan', r => {
  /* Off-topic question: internal knowledge should not answer it.
     Accept web (external found) or fallback (network blocked). */
  if (r.source === 'web') return r.reply.includes('Source:') || 'web answer missing attribution';
  return ['fallback'].includes(r.source) || 'expected web or fallback, got ' + r.source;
});

console.log('\n=== Response shape ===');
await T('related present on faq', 'do you offer maintenance plans', r => Array.isArray(r.related) || 'related missing');
await T('suggestions always', 'hello', r => Array.isArray(r.suggestions) && r.suggestions.length > 0 || 'no suggestions');

console.log('\n=== Regression: mixed-language + stopword bugs ===');
await T('services dev ar (was faq_hours bug)', 'ما هي خدماتكم في تطوير التطبيقات؟',
  r => ['services_overview', 'service_mobile', 'service_web'].includes(r.intent) || 'wrong intent: ' + r.intent);
await T('ar services answer is Arabic', 'خدماتكم',
  r => /[\u0600-\u06FF]/.test(r.reply) && r.reply.includes('الذكاء الاصطناعي') || 'services listed in English');
await T('hours still works ar', 'ما هي ساعات العمل لديكم',
  r => r.intent.includes('hours') || 'wrong intent: ' + r.intent);
await T('hours still works en', 'what are your working hours',
  r => r.intent.includes('hours') || 'wrong intent: ' + r.intent);

console.log('\n=== Direct search() quality ===');
const s1 = search('whatsapp integration', 'en', 3);
console.log('whatsapp →', s1.map(r => r.type + ':' + r.title).join(' | '));
if (s1.length && /whatsapp/i.test(s1[0].title + s1[0].snippet)) { pass++; console.log('PASS  search whatsapp'); } else { failCount++; failures.push('search whatsapp'); console.log('FAIL  search whatsapp'); }
const s2 = search('توصيل سواقين تتبع', 'ar', 3);
console.log('توصيل →', s2.map(r => r.type + ':' + r.title).join(' | '));
if (s2.length && s2[0].title.includes('توصيل')) { pass++; console.log('PASS  search delivery ar'); } else { failCount++; failures.push('search delivery ar'); console.log('FAIL  search delivery ar'); }
const s3 = search('healthcare', 'en', 3);
console.log('healthcare →', s3.map(r => r.type + ':' + r.title).join(' | '));
if (s3.length) { pass++; console.log('PASS  search live content'); } else { failCount++; failures.push('search live content'); console.log('FAIL  search live content'); }

console.log(`\n===== ${pass} passed, ${failCount} failed =====`);
if (failures.length) console.log('Failures: ' + failures.join(', '));
process.exit(failCount ? 1 : 0);

})().catch(e => { console.error('FATAL', e); process.exit(1); });
