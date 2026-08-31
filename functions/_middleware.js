/**
 * Cloudflare Pages Middleware
 * Runs on every page request to inject localized SEO metadata dynamically.
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const pathname = url.pathname.toLowerCase().replace(/\/$/, '') || '/';

    // Skip static assets (.js, .css, images, fonts, manifests, sitemaps, robots)
    if (pathname.match(/\.(js|css|pcss|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|json|webmanifest|xml|txt|map)$/)) {
        return context.next();
    }

    const id = url.searchParams.get('id');
    const type = url.searchParams.get('type');
    const lang = url.searchParams.get('lang');

    try {
        // Fetch site-data.json dynamically to read global site properties
        const dataUrl = `${url.origin}/json/site-data.json`;
        const dataResponse = context.env?.ASSETS
            ? await context.env.ASSETS.fetch(new Request(dataUrl))
            : await fetch(dataUrl);

        if (!dataResponse.ok) {
            return nextWithDebug(context, `Bypassed - site-data.json fetch failed (${dataResponse.status})`);
        }

        const data = await dataResponse.json();

        // Localization helper
        const getLocalizedValue = (value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const current = value[lang];
                if (current !== undefined && current !== '') return current;
                if (value.en !== undefined && value.en !== '') return value.en;
                if (value.ru !== undefined && value.ru !== '') return value.ru;
                return '';
            }
            return value || '';
        };

        const cleanText = (str) => {
            if (!str) return '';
            return str
                .replace(/^(?:\[([^\]]+)\]\(\/about\/\)|([^,]+)),\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i, '')
                .replace(/<[^>]*>/g, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/[*_~`#|]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        };

        const siteBrand = getLocalizedValue(data.siteTitle) || 'The Hague Couloir';
        const defaultSiteDescription = getLocalizedValue(data.siteDescription) ||
            'Independent analysis and investigative reports on international law and global affairs.';

        // Bypass browser cache for real-time HTML transformation
        const requestHeaders = new Headers(context.request.headers);
        requestHeaders.delete('if-none-match');
        requestHeaders.delete('if-modified-since');

        const response = await context.next(new Request(context.request, { headers: requestHeaders }));

        // --- SECTION A: ARTICLE PAGES (/article) ---
        if (pathname.startsWith('/article') && id) {
            const contentTypes = ['news', 'article', 'opinion', 'academic', 'live-note', 'publications'];
            let item = null;

            for (const contentType of contentTypes) {
                if (data[contentType] && Array.isArray(data[contentType])) {
                    item = data[contentType].find(p => String(p.id).trim() === String(id).trim());
                    if (item) break;
                }
            }

            if (!item) {
                for (const key of Object.keys(data)) {
                    if (Array.isArray(data[key])) {
                        item = data[key].find(p => p && p.id && String(p.id).trim() === String(id).trim());
                        if (item) break;
                    }
                }
            }

            if (item) {
                // 1. Title Fallback Cascade: item.title -> heading-text -> subheading-text -> text/info-text
                let rawTitle = getLocalizedValue(item.title);

                if (!rawTitle && item.content && Array.isArray(item.content)) {
                    const headingBlock = item.content.find(b => b.type === 'heading-text' && getLocalizedValue(b.value));
                    const subheadingBlock = item.content.find(b => b.type === 'subheading-text' && getLocalizedValue(b.value));
                    const textBlock = item.content.find(b => ['text', 'info-text'].includes(b.type) && getLocalizedValue(b.value));

                    const targetBlock = headingBlock || subheadingBlock || textBlock;
                    if (targetBlock) {
                        rawTitle = cleanText(getLocalizedValue(targetBlock.value));
                    }
                }

                if (!rawTitle) rawTitle = siteBrand;
                const fullHeadline = rawTitle;

                // 2. Format Page Title (60-char limit, brand suffix guaranteed)
                const brandCheck = rawTitle.includes(siteBrand) ||
                    rawTitle.includes('The Hague Couloir') ||
                    rawTitle.includes('Гаагский кулуар');

                let pageTitle = '';
                if (brandCheck) {
                    pageTitle = rawTitle.length > 60 ? rawTitle.substring(0, 57) + '...' : rawTitle;
                } else {
                    const suffix = ` | ${siteBrand}`;
                    const maxRawLength = 60 - suffix.length;
                    const truncatedRawTitle = rawTitle.length > maxRawLength
                        ? rawTitle.substring(0, maxRawLength - 3).trim() + '...'
                        : rawTitle;
                    pageTitle = `${truncatedRawTitle}${suffix}`;
                }

                // 3. Resolve Description (First text block only for fallback)
                let rawDescription = '';
                if (item.summary) {
                    rawDescription = getLocalizedValue(item.summary);
                } else if (item.content && Array.isArray(item.content)) {
                    const firstTextBlock = item.content.find(block => block.type === 'text');
                    if (firstTextBlock) {
                        rawDescription = getLocalizedValue(firstTextBlock.value);
                    }
                }

                const cleanDescription = cleanText(rawDescription);
                const fullDescription = cleanDescription || fullHeadline;

                let finalDescription = fullDescription;
                if (finalDescription.length > 120) {
                    finalDescription = finalDescription.substring(0, 117) + '...';
                }

                // 4. Resolve Image (Strict Priority: main-image > preview-image > raw-image > image)
                const R2_BASE_URL = 'https://pub-795f9426259d4926a0308a9099f50d25.r2.dev/';
                const getImgFromContent = (targetTypes) => {
                    if (!item.content || !Array.isArray(item.content)) return null;
                    const block = item.content.find(b => targetTypes.includes(b.type) && b.visible !== 'no');
                    return block ? (getLocalizedValue(block.value) || block.value || null) : null;
                };

                const rawImageUrl =
                    getLocalizedValue(item['main-image']) ||
                    getLocalizedValue(item.mainImage) ||
                    getImgFromContent(['main-image']) ||
                    getLocalizedValue(item.previewImage) ||
                    getLocalizedValue(item['preview-image']) ||
                    getImgFromContent(['preview-image']) ||
                    getLocalizedValue(item.rawImage) ||
                    getLocalizedValue(item['raw-image']) ||
                    getImgFromContent(['raw-image', 'raw-main-image']) ||
                    getLocalizedValue(item.image) ||
                    getImgFromContent(['image']) ||
                    '';

                let imageUrl = '';
                if (!rawImageUrl) {
                    imageUrl = 'https://thehaguecouloir.com/favicon/web-app-manifest-512x512.png';
                } else if (rawImageUrl.startsWith('http://') || rawImageUrl.startsWith('https://')) {
                    imageUrl = rawImageUrl;
                } else {
                    const cleanPath = rawImageUrl.startsWith('/') ? rawImageUrl.substring(1) : rawImageUrl;
                    if (cleanPath.startsWith('media/') || cleanPath.startsWith('images/')) {
                        imageUrl = `${R2_BASE_URL}${cleanPath}`;
                    } else {
                        imageUrl = `https://thehaguecouloir.com/${cleanPath}`;
                    }
                }

                // 5. Author Resolution
                let authorName = getLocalizedValue(item.author);
                if (!authorName && item.content && Array.isArray(item.content)) {
                    const firstTextBlock = item.content.find(block => block.type === 'text' || block.type === 'info-text');
                    if (firstTextBlock) {
                        const textContent = getLocalizedValue(firstTextBlock.value);
                        const authorMatch = textContent.match(/^\[([^\]]+)\]\(\/about\/?\)/);
                        if (authorMatch && authorMatch[1]) authorName = authorMatch[1];
                    }
                }
                if (!authorName) authorName = siteBrand;

                const canonicalUrl = `https://thehaguecouloir.com/article/?id=${id}&type=${type || ''}&lang=${lang || 'all'}`;
                const typeMap = { 'news': 'NewsArticle', 'article': 'Article', 'opinion': 'Article', 'academic': 'Article', 'live-note': 'Article' };
                const schemaType = typeMap[type] || 'NewsArticle';

                const jsonLdObject = {
                    "@context": "https://schema.org",
                    "@type": schemaType,
                    "headline": fullHeadline,
                    "description": fullDescription,
                    "image": [imageUrl],
                    "datePublished": item.date || '',
                    "dateModified": item.updatedDate || item.date || '',
                    "author": [{ "@type": "Person", "name": authorName }],
                    "publisher": {
                        "@type": "Organization",
                        "name": siteBrand,
                        "logo": {
                            "@type": "ImageObject",
                            "url": "https://thehaguecouloir.com/favicon/web-app-manifest-512x512.png"
                        }
                    },
                    "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl }
                };

                const articleMetaHtml = `
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeHtml(finalDescription)}">
<meta property="og:site_name" content="${escapeHtml(siteBrand)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(pageTitle)}">
<meta property="og:description" content="${escapeHtml(finalDescription)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(pageTitle)}">
<meta name="twitter:description" content="${escapeHtml(finalDescription)}">
<meta name="twitter:image" content="${escapeHtml(imageUrl)}">
<script type="application/ld+json">${JSON.stringify(jsonLdObject)}</script>`;

                return injectMetadataResponse(response, articleMetaHtml, `Hit - Article: ${id}`);
            }
        }

        // --- SECTION B: STATIC PAGES & HOME ---
        const staticRoutes = {
            '/about': {
                title: { en: 'About', ru: 'О сайте' },
                description: {
                    en: 'Learn about The Hague Couloir, our editorial standards, independent analysis, and mission.',
                    ru: 'Узнайте о Гаагском кулуаре, наших редакционных стандартах, независимом анализе и миссии.'
                }
            },
            '/your-data': {
                title: { en: 'Your Data & Privacy', ru: 'Ваши данные' },
                description: {
                    en: 'Read our privacy policy regarding local storage, analytics, and data protection.',
                    ru: 'Ознакомьтесь с нашей политикой конфиденциальности в отношении локального хранилища, аналитики и защиты данных.'
                }
            },
            '/all-publications': {
                title: { en: 'All Publications', ru: 'Все публикации' },
                description: {
                    en: 'Browse all investigative reports, opinions, news updates, and academic publications.',
                    ru: 'Просмотрите все расследования, мнения, новости и академические публикации.'
                }
            }
        };

        let staticTitle = siteBrand;
        let staticDescription = defaultSiteDescription;

        if (staticRoutes[pathname]) {
            const pageLabel = getLocalizedValue(staticRoutes[pathname].title);
            staticTitle = pageLabel ? `${pageLabel} | ${siteBrand}` : siteBrand;
            staticDescription = getLocalizedValue(staticRoutes[pathname].description) || defaultSiteDescription;
        }

        const staticJsonLd = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": siteBrand,
            "url": "https://thehaguecouloir.com/",
            "description": staticDescription
        };

        const staticMetaHtml = `
<title>${escapeHtml(staticTitle)}</title>
<meta name="description" content="${escapeHtml(staticDescription)}">
<meta property="og:site_name" content="${escapeHtml(siteBrand)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(staticTitle)}">
<meta property="og:description" content="${escapeHtml(staticDescription)}">
<meta property="og:image" content="https://thehaguecouloir.com/favicon/web-app-manifest-512x512.png">
<meta property="og:url" content="${escapeHtml(url.href)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(staticTitle)}">
<meta name="twitter:description" content="${escapeHtml(staticDescription)}">
<meta name="twitter:image" content="https://thehaguecouloir.com/favicon/web-app-manifest-512x512.png">
<script type="application/ld+json">${JSON.stringify(staticJsonLd)}</script>`;

        return injectMetadataResponse(response, staticMetaHtml, `Hit - Page: ${pathname}`);

    } catch (error) {
        console.error('[SEO Middleware] Uncaught Error:', error);
        return nextWithDebug(context, `Error - ${error.message}`);
    }
}

function injectMetadataResponse(response, metaTagsHtml, statusMessage) {
    const transformedResponse = new HTMLRewriter()
        .on('title', { element(el) { el.remove(); } })
        .on('meta[name="description"]', { element(el) { el.remove(); } })
        .on('meta[property^="og:"]', { element(el) { el.remove(); } })
        .on('meta[name^="twitter:"]', { element(el) { el.remove(); } })
        .on('script[type="application/ld+json"]', { element(el) { el.remove(); } })
        .on('head', {
            element(el) {
                el.append(metaTagsHtml, { html: true });
            }
        })
        .transform(response);

    const headers = new Headers(transformedResponse.headers);
    headers.set('X-SEO-Middleware', statusMessage);
    headers.set('Content-Type', 'text/html; charset=utf-8');

    return new Response(transformedResponse.body, {
        status: transformedResponse.status,
        statusText: transformedResponse.statusText,
        headers
    });
}

async function nextWithDebug(context, statusMessage) {
    const res = await context.next();
    const headers = new Headers(res.headers);
    headers.set('X-SEO-Middleware', statusMessage);
    return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}