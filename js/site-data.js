// site-data.js
// Single source of truth for fetching the site-data JSON.
//
// On Cloudflare Pages production, this directly queries the Pages Function at /api/site-content.
//
// During local development (localhost, 127.0.0.1, or file://), it transparently checks the 
// local json/site-data.json file first to make local editing fast and resource-efficient.
//
// The result is cached in-memory for the lifetime of the page so multiple
// callers share one network request.

(function () {
    const cache = { promise: null, data: null };

    function getRootPrefix() {
        const path = window.location.pathname;
        const subpages = ['article', 'about', 'all-publications', 'bias', 'your-data', 'editor'];
        return subpages.some(folder =>
            path.includes(`/${folder}/`) ||
            path.endsWith(`/${folder}`) ||
            path.endsWith(`/${folder}/`)
        ) ? '../' : '';
    }

    function apiUrl() {
        return `${window.location.origin}/api/site-content`;
    }

    function localFallbackUrl() {
        return `${getRootPrefix()}json/site-data.json`;
    }

    // Identifies if the environment is a local development instance
    function isLocalDev() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        return hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'file:';
    }

    async function fetchSiteData() {
        if (cache.data) return cache.data;
        if (cache.promise) return cache.promise;

        cache.promise = (async () => {
            // 1. LOCAL DEVELOPMENT PATH
            if (isLocalDev()) {
                try {
                    // Try the local JSON first during development
                    const res = await fetch(localFallbackUrl(), { cache: 'no-store' });
                    if (!res.ok) throw new Error(`Local JSON responded ${res.status}`);
                    cache.data = await res.json();
                    return cache.data;
                } catch (err) {
                    console.warn('Local JSON missing or failed, falling back to API:', err);
                    // Fall back to the online endpoint if local JSON isn't generated yet
                    const res = await fetch(apiUrl(), { cache: 'no-store' });
                    if (!res.ok) throw new Error(`API responded ${res.status}`);
                    cache.data = await res.json();
                    return cache.data;
                }
            }

            // 2. PRODUCTION PATH
            // Bypasses the local JSON entirely. Zero extra network footprint on the live site.
            const res = await fetch(apiUrl(), { cache: 'no-store' });
            if (!res.ok) throw new Error(`API responded ${res.status}`);
            cache.data = await res.json();
            return cache.data;

        })().catch(err => {
            cache.promise = null;
            throw err;
        });

        return cache.promise;
    }

    window.fetchSiteData = fetchSiteData;
})();