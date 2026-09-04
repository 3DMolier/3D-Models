// build-legal-pages.mjs — генерация /privacy/ и /terms/ на 3dmolierstudio.com.
//
// Шапка, меню и футер берутся из существующей about/index.html, чтобы навигация
// была идентичной и не разъезжалась при будущих правках меню.
//
// Разделение ответственности:
//   * ЛИЦЕНЗИЯ НА МОДЕЛИ живёт на https://3dmolier.com/legal и здесь не дублируется —
//     обе страницы на неё ссылаются. Дублировать юридический текст в двух местах опасно:
//     они разойдутся.
//   * Эти две страницы покрывают только сам сайт-витрину: аналитика, куки, условия
//     использования каталога. Продажи идут на TurboSquid, там свои условия.
//
// Реквизиты компании — из данных основателя. На 3dmolier.com/legal адрес записан как
// «54 East Street», в футере того же сайта — «East 54th Street». Здесь используется
// вариант, который дал основатель.
//
// Запуск:  node scripts/build-legal-pages.mjs

import fs from 'node:fs';
import path from 'node:path';

import { ROOT } from './lib/paths.mjs';
const SITE = 'https://3dmolierstudio.com';
const COMPANY = '3D Molier International Corp.';
const ADDRESS = 'East 54th Street, P.O. Box 0832-0886 W.T.C., Mossfon Building, 2nd Floor, Panama, Republic of Panama';
const EMAIL = '3dmolier@3dmolier.com';
const UPDATED = '2 August 2026';
const UPDATED_ISO = '2026-08-02';
const GA_ID = 'G-GDY5KTLBP1';

// ── шаблон: голова до </head>, шапка, футер ───────────────────────────────────
const shell = fs.readFileSync(path.join(ROOT, 'about', 'index.html'), 'utf8');
const headTail = shell.slice(shell.indexOf('<link rel="stylesheet"'), shell.indexOf('</head>'));
const header = shell.slice(shell.indexOf('<body>') + 6, shell.indexOf('<main'));
const footer = shell.slice(shell.indexOf('</main>') + 7);

function page({ slug, title, desc, h1, lead, body }) {
  const url = `${SITE}/${slug}/`;
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: h1, item: url },
    ],
  };
  const webpage = {
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: title, url, description: desc,
    dateModified: UPDATED_ISO, inLanguage: 'en',
    publisher: {
      '@type': 'Organization', name: COMPANY, url: SITE,
      email: EMAIL,
      address: {
        '@type': 'PostalAddress', streetAddress: 'East 54th Street, Mossfon Building, 2nd Floor',
        postOfficeBoxNumber: '0832-0886 W.T.C.', addressLocality: 'Panama',
        addressCountry: 'PA',
      },
    },
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og/3d-molier-og.jpg">
<meta property="og:site_name" content="3D Molier">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${SITE}/assets/og/3d-molier-og.jpg">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<script type="application/ld+json">
${JSON.stringify(breadcrumb)}
</script>
<script type="application/ld+json">
${JSON.stringify(webpage)}
</script>
${headTail}</head>
<body>
${header}<main id="main-content" class="legal-wrap">
  <div class="legal-head">
    <div class="section-label">Legal</div>
    <h1 class="legal-h1">${h1}</h1>
    <p class="legal-lead">${lead}</p>
    <p class="legal-updated">Last updated: <time datetime="${UPDATED_ISO}">${UPDATED}</time></p>
  </div>
  <div class="legal-body">
${body}
  </div>
</main>
${footer}`;
}

// ── Privacy Policy ────────────────────────────────────────────────────────────
const privacyBody = `    <h2>1. Who we are</h2>
    <p>This website, <strong>3dmolierstudio.com</strong>, is operated by <strong>${COMPANY}</strong>,
    registered at ${ADDRESS}. For any question about this policy or about the data we hold,
    write to <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>

    <h2>2. What this site does and does not do</h2>
    <p>This site is a catalogue. It shows the 3D models published by 3D Molier and links to the
    marketplace where each model is sold. <strong>No purchase, payment or account registration
    happens on this site.</strong> We do not ask you to create an account, we do not take payment
    details, and we do not store a customer database here.</p>
    <p>When you follow a link to buy a model, you leave this site and the transaction is handled by
    <a href="https://www.turbosquid.com/?referral=3d_molier-international" target="_blank" rel="noopener">TurboSquid</a>,
    which operates under its own privacy policy and terms.</p>

    <h2>3. Data we collect</h2>
    <h3>Analytics</h3>
    <p>We use Google Analytics 4 (property <code>${GA_ID}</code>) to understand which pages are
    useful and which are not. It records pages viewed, the site or search engine you arrived from,
    approximate location at country and city level, and general device and browser information.
    IP addresses are not stored by Google Analytics 4. We do not use this data to identify
    individual visitors, and we do not attempt to.</p>
    <p>Google acts as our processor for this data. See
    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's privacy policy</a>
    and <a href="https://support.google.com/analytics/answer/6004245" target="_blank" rel="noopener">how Google uses Analytics data</a>.</p>

    <h3>Messages you send us</h3>
    <p>The contact form on this site opens your own email application with the message pre-filled.
    Nothing is submitted to or stored on our servers by the form itself. When you actually send the
    email, we receive whatever you chose to write, together with your email address, and we keep that
    correspondence for as long as needed to answer you and to keep a record of the enquiry.</p>

    <h3>Server logs</h3>
    <p>The site is hosted on GitHub Pages. Like any web host, GitHub records technical request data
    such as IP address and user agent for security and abuse prevention. We do not have access to
    these logs. See the
    <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">GitHub privacy statement</a>.</p>

    <h3>Images loaded from elsewhere</h3>
    <p>Model preview images are served from TurboSquid's content delivery network
    (<code>p.turbosquid.com</code>). Loading them means your browser makes a request to TurboSquid,
    which will see your IP address and browser details as with any external image.</p>

    <h2>4. Cookies</h2>
    <p>The only cookies this site sets are the Google Analytics ones: <code>_ga</code> and
    <code>_ga_${GA_ID.replace('G-', '')}</code>. They distinguish one visitor from another so that a
    returning visit is not counted as a new one. They expire after two years.</p>
    <p>We do not use advertising cookies, retargeting pixels, social media trackers or fingerprinting.</p>
    <p>You can block or delete these cookies through your browser settings, or install the
    <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">Google Analytics opt-out browser add-on</a>.
    Blocking them does not affect how the site works.</p>

    <h2>5. Sharing</h2>
    <p>We do not sell personal data, and we do not share it for advertising. The only third parties
    that receive data are the service providers named above: Google (analytics), GitHub (hosting) and
    TurboSquid (images, and any purchase you choose to make on their site).</p>

    <h2>6. Your rights</h2>
    <p>If you are in the European Economic Area, the United Kingdom, or a jurisdiction with comparable
    law, you have the right to ask what data we hold about you, to have it corrected or deleted, to
    object to processing, and to receive a copy. If you are a California resident, you have the
    equivalent rights under the CCPA, including the right to know and the right to delete; we do not
    sell personal information, so there is nothing to opt out of on that front.</p>
    <p>To exercise any of these, email <a href="mailto:${EMAIL}">${EMAIL}</a>. Because we hold very
    little — essentially aggregate analytics and any correspondence you started — most requests are
    answered quickly.</p>

    <h2>7. Retention</h2>
    <p>Analytics data is retained by Google for 14 months and then deleted automatically. Email
    correspondence is kept while it remains relevant to an enquiry or an order, and removed on request.</p>

    <h2>8. Children</h2>
    <p>This site is aimed at professional 3D artists, studios and businesses. It is not directed at
    children, and we do not knowingly collect data from anyone under 16.</p>

    <h2>9. Governing law</h2>
    <p>This policy is governed by the laws of the State of California, United States, consistent with
    the licence agreement that applies to our 3D models.</p>

    <h2>10. Changes</h2>
    <p>If this policy changes, the revised version appears on this page with a new "last updated"
    date. Material changes will be summarised at the top of the page.</p>

    <h2>Related</h2>
    <ul>
      <li><a href="/terms/">Terms of Use</a> — the rules for using this website.</li>
      <li><a href="https://3dmolier.com/legal" target="_blank" rel="noopener">Licence Agreement &amp; Refund Policy</a> — the terms that apply to the 3D models themselves.</li>
    </ul>`;

// ── Terms of Use ──────────────────────────────────────────────────────────────
const termsBody = `    <h2>1. Who operates this site</h2>
    <p>3dmolierstudio.com is operated by <strong>${COMPANY}</strong>, registered at ${ADDRESS}.
    By using the site you accept these terms. If you do not accept them, please do not use the site.</p>

    <h2>2. What this site is</h2>
    <p>This site is a <strong>catalogue and showcase</strong> of the 3D models published by 3D Molier.
    It is not a shop. You cannot buy, download or licence a model here.</p>
    <p>Every model page links through to the marketplace listing where the model is actually sold —
    in almost all cases <a href="https://www.turbosquid.com/?referral=3d_molier-international" target="_blank" rel="noopener">TurboSquid</a>.
    Purchase, payment, delivery and support for a purchased model are handled there, under
    TurboSquid's terms.</p>

    <h2>3. The licence for the models</h2>
    <p>These terms cover the website. They do <strong>not</strong> cover what you may do with a model
    after you buy it. That is set out separately in our
    <a href="https://3dmolier.com/legal" target="_blank" rel="noopener">Licence Agreement</a>, which also
    contains the refund policy. If anything on this site appears to contradict the Licence Agreement,
    the Licence Agreement prevails.</p>

    <h2>4. Prices and availability</h2>
    <p>Prices, certification badges and availability shown on this site are taken from the marketplace
    listings and are shown for information. They can change at any time, and the marketplace listing is
    always the authoritative source. We make no commitment that a model shown here is currently
    available at the price displayed.</p>

    <h2>5. Content on this site</h2>
    <p>The renders, preview images, model names, descriptions and page text on this site are the
    property of ${COMPANY} or are used under licence. You may link to any page here, and you may quote
    short passages with attribution.</p>
    <p>You may not copy the catalogue wholesale, scrape it in bulk, republish the preview images as your
    own, or use the content to train a model or build a competing catalogue, without written permission.
    Automated access that degrades the service for others is not permitted.</p>

    <h2>6. Acceptable use</h2>
    <p>Do not attempt to interfere with the site, probe it for vulnerabilities without permission, or
    use it to distribute malware. Security researchers acting in good faith are welcome to report
    findings to <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>

    <h2>7. External links</h2>
    <p>This site links to marketplaces, social platforms and other external services. We do not control
    those sites and are not responsible for their content, their availability or their handling of your
    data. Following an external link takes you outside the scope of these terms.</p>

    <h2>8. Availability and accuracy</h2>
    <p>The site is provided as it is. We try to keep the catalogue accurate and current across a very
    large number of listings, but we do not warrant that every page is free of errors, that the site
    will always be available, or that it will be free of interruption.</p>

    <h2>9. Limitation of liability</h2>
    <p>To the extent permitted by law, ${COMPANY} is not liable for indirect or consequential loss
    arising from use of this website, including lost profits, lost data or business interruption.
    Nothing here limits liability that cannot be limited by law. Liability relating to a purchased
    model is governed by the
    <a href="https://3dmolier.com/legal" target="_blank" rel="noopener">Licence Agreement</a>.</p>

    <h2>10. Governing law</h2>
    <p>These terms are governed by the laws of the State of California, United States, and the courts
    of California have exclusive jurisdiction, consistent with our Licence Agreement.</p>

    <h2>11. Changes</h2>
    <p>We may update these terms. The current version is always the one on this page, with the date
    shown above.</p>

    <h2>12. Contact</h2>
    <p>${COMPANY}<br>
    ${ADDRESS}<br>
    <a href="mailto:${EMAIL}">${EMAIL}</a></p>

    <h2>Related</h2>
    <ul>
      <li><a href="/privacy/">Privacy Policy</a> — what data this site collects.</li>
      <li><a href="https://3dmolier.com/legal" target="_blank" rel="noopener">Licence Agreement &amp; Refund Policy</a> — the terms that apply to the 3D models.</li>
    </ul>`;

const pages = [
  {
    slug: 'privacy',
    title: 'Privacy Policy — 3D Molier',
    desc: 'What data 3dmolierstudio.com collects: analytics only, no accounts, no payments on this site. Cookies, retention, and how to exercise your rights.',
    h1: 'Privacy Policy',
    lead: 'This site is a catalogue, not a shop. It collects analytics and nothing else — no accounts, no payment details, no customer database.',
    body: privacyBody,
  },
  {
    slug: 'terms',
    title: 'Terms of Use — 3D Molier',
    desc: 'Terms for using the 3dmolierstudio.com catalogue. Purchases and model licensing are handled separately on TurboSquid and in our Licence Agreement.',
    h1: 'Terms of Use',
    lead: 'These terms cover this website. The licence for a model you buy is a separate document, linked below.',
    body: termsBody,
  },
];

for (const p of pages) {
  const dir = path.join(ROOT, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  const html = page(p);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  const words = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
  console.log('/' + p.slug + '/  создана, ' + words + ' слов');
}
console.log('\nГотово. Не забыть: ссылки в футер, sitemap, llms.txt.');
