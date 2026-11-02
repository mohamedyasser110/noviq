/* ============================================================
   NOVIQ — social handle normalisation
   ------------------------------------------------------------
   Exercises the REAL lib/social.ts, compiled to CommonJS first by
   tests/tsconfig.socialtest.json (run via `npm run test:social`),
   so there is no hand-rolled transform between the source and the
   assertions — same arrangement as nav-admin.test.cjs.

   THE BUG THIS LOCKS DOWN
   ----------------------
   The CMS stores the WhatsApp number the way the business writes
   it — "01062339274". Both the contact section and the footer used
   to do `value.replace(/[^\d]/g, '')` and hand the result to wa.me,
   producing https://wa.me/01062339274 — a dead link. wa.me wants
   the full international number with the trunk zero REMOVED
   (Egypt +20, so 01062339274 -> 201062339274). The same helpers
   also have to survive an admin pasting "@handle" or "mailto:x".

   Every helper is TOTAL: any input returns a usable absolute URL
   or ''. '' is the signal a caller renders nothing, so an unset or
   half-typed field can never produce a link that goes nowhere.
   ============================================================ */

const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');

/* tsc emits the `@/...` alias verbatim, so map it onto the compiled tree. */
const OUT = path.resolve(__dirname, '..', '.navtest-out');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    for (const ext of ['.js', '/index.js']) {
      const p = path.join(OUT, rel + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  return origResolve.call(this, request, ...rest);
};

const { waMeUrl, profileUrl, mailtoUrl } = require(path.join(OUT, 'lib', 'social.js'));

let pass = 0;
let fail = 0;
function eq(got, want, name) {
  if (got === want) {
    pass++;
    console.log('PASS  ' + name);
  } else {
    fail++;
    console.log('FAIL  ' + name + '\n        got:  ' + JSON.stringify(got) + '\n        want: ' + JSON.stringify(want));
  }
}

/* ---- WhatsApp: the case that was actually broken ---- */
eq(waMeUrl('01062339274'), 'https://wa.me/201062339274', 'EG local 01062339274 -> international, zero dropped');
eq(waMeUrl('+201062339274'), 'https://wa.me/201062339274', 'already international +20...');
eq(waMeUrl('0020 106 233 9274'), 'https://wa.me/201062339274', '00 international prefix + spaces');
eq(waMeUrl('20 106 233 9274'), 'https://wa.me/201062339274', 'country code, spaced, no plus');
eq(waMeUrl('201062339274'), 'https://wa.me/201062339274', 'bare international, untouched');
eq(waMeUrl('  01062339274  '), 'https://wa.me/201062339274', 'surrounding whitespace tolerated');
eq(waMeUrl('01062339274', 'EG'), 'https://wa.me/201062339274', 'explicit region EG agrees with the inference');
eq(waMeUrl('+20 01062339274'), 'https://wa.me/201062339274', 'plus + a national number that keeps its zero');
eq(waMeUrl('0155551234'), 'https://wa.me/20155551234', 'a different Egyptian mobile normalises the same way');

/* Other markets: a US number must NOT be handed an Egyptian code. */
eq(waMeUrl('+1 415 555 0182'), 'https://wa.me/14155550182', 'US number keeps +1');
eq(waMeUrl('14155550182'), 'https://wa.me/14155550182', 'bare US number left alone (no zero, nothing to add)');
eq(waMeUrl('0123456789', 'SA'), 'https://wa.me/966123456789', 'explicit region SA wins over the EG guess');

/* A pasted link is respected verbatim. */
eq(waMeUrl('https://wa.me/201062339274'), 'https://wa.me/201062339274', 'a full wa.me URL is passed through');
eq(waMeUrl('https://chat.whatsapp.com/ABC'), 'https://chat.whatsapp.com/ABC', 'any other https URL is passed through');

/* Nothing to link -> '' so the caller renders no icon. */
eq(waMeUrl(''), '', 'empty string');
eq(waMeUrl(undefined), '', 'undefined');
eq(waMeUrl(null), '', 'null');
eq(waMeUrl('   '), '', 'whitespace only');
eq(waMeUrl('+'), '', 'a lone plus has no number');
eq(waMeUrl('0'), '', 'a lone zero has no number');
eq(waMeUrl('mailto:x@y.com'), '', 'a non-numeric string yields no link, and does not throw');
eq(waMeUrl('0'.repeat(5)), '', 'zeros with nothing after them yield no link');

/* ---- Facebook / Instagram handles ---- */
eq(profileUrl('noviqsolutions', 'https://facebook.com'), 'https://facebook.com/noviqsolutions', 'bare handle');
eq(profileUrl('@noviqsolutions', 'https://facebook.com'), 'https://facebook.com/noviqsolutions', 'leading @ is not part of the path');
eq(profileUrl('https://facebook.com/noviqsolutions', 'https://facebook.com'), 'https://facebook.com/noviqsolutions', 'full URL passed through');
eq(profileUrl('/noviqsolutions', 'https://instagram.com'), 'https://instagram.com/noviqsolutions', 'leading slash trimmed');
eq(profileUrl('noviqsolutions/', 'https://instagram.com'), 'https://instagram.com/noviqsolutions', 'trailing slash trimmed');
eq(profileUrl('https://facebook.com/noviqsolutions/', 'https://facebook.com'), 'https://facebook.com/noviqsolutions/', 'a pasted full URL is respected verbatim, trailing slash and all');
eq(profileUrl('https://facebook.com/x', 'https://facebook.com/'), 'https://facebook.com/x', 'base with a trailing slash does not double up');
eq(profileUrl('', 'https://facebook.com'), '', 'empty handle');
eq(profileUrl('@', 'https://facebook.com'), '', 'a lone @ is not a handle');
eq(profileUrl('   ', 'https://instagram.com'), '', 'whitespace handle');
eq(profileUrl(undefined, 'https://facebook.com'), '', 'undefined handle');
eq(profileUrl(null, 'https://facebook.com'), '', 'null handle');

/* ---- mailto ---- */
eq(mailtoUrl('hello@noviqsolutions.com'), 'mailto:hello@noviqsolutions.com', 'plain address');
eq(mailtoUrl('mailto:hello@noviqsolutions.com'), 'mailto:hello@noviqsolutions.com', 'mailto: is not doubled');
eq(mailtoUrl('<hello@noviqsolutions.com>'), 'mailto:hello@noviqsolutions.com', 'angle brackets stripped');
eq(mailtoUrl('  a@b.com  '), 'mailto:a@b.com', 'whitespace trimmed');
eq(mailtoUrl(''), '', 'empty address');
eq(mailtoUrl('mailto:'), '', 'mailto: with no address');
eq(mailtoUrl(undefined), '', 'undefined address');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
