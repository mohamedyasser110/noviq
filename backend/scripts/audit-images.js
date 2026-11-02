/* Crawl every page of the deployed site and check that EVERY image it
   references actually resolves. This is the check that catches the two
   failure modes that look identical in the browser:

     · a CMS image whose file was never uploaded (the record points at
       images/uploads/x.jpg but only exists on the developer's laptop)
     · an image that 404s because the site-relative path is not proxied
       to the API

   Usage: node scripts/audit-images.js <web-origin> */
const WEB = process.argv[2];
const PAGES = [
  '/en', '/ar', '/en/about', '/en/services', '/en/industries', '/en/solutions',
  '/en/portfolio', '/en/pricing', '/en/team', '/en/resources', '/en/faq',
  '/en/careers', '/en/contact', '/en/why', '/en/toolkit', '/en/clients',
  '/ar/about', '/ar/services', '/ar/portfolio', '/ar/team', '/ar/pricing',
];

(async () => {
  const seen = new Map();
  let pageFails = 0;

  for (const p of PAGES) {
    let html;
    try {
      const res = await fetch(`${WEB}${p}`);
      if (!res.ok) { console.log(`  PAGE ${p} -> HTTP ${res.status}`); pageFails++; continue; }
      html = await res.text();
    } catch (e) {
      console.log(`  PAGE ${p} -> ERROR ${e.message}`);
      pageFails++;
      continue;
    }

    const srcs = new Set(
      [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:png|jpe?g|webp|gif|svg|avif|ico))"/gi)]
        .map((m) => m[1])
    );
    for (const s of srcs) if (!seen.has(s)) seen.set(s, p);
  }

  console.log(`\npages crawled: ${PAGES.length} (failures: ${pageFails})`);
  console.log(`unique images referenced: ${seen.size}\n`);

  const broken = [];
  for (const [src, page] of seen) {
    const res = await fetch(`${WEB}${src}`, { method: 'HEAD' }).catch(() => null);
    if (!res || !res.ok) broken.push({ src, page, status: res ? res.status : 'ERR' });
  }

  if (!broken.length) {
    console.log(`ALL ${seen.size} IMAGES OK (HTTP 200)`);
  } else {
    console.log(`BROKEN: ${broken.length} of ${seen.size}\n`);
    for (const b of broken) console.log(`  ${b.status}  ${b.src}   (first seen on ${b.page})`);
    process.exitCode = 1;
  }
})();
