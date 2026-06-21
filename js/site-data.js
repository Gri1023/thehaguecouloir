// site-data.js
// Single source of truth for fetching the site-data JSON.
//
// On Cloudflare Pages this reads from the Pages Function at /api/site-content,
// which in turn reads from the SITE_CONTENT KV namespace (key: "site-data").
//
// When the API endpoint is unreachable (e.g. local file:// or python -m
// http.server previews) it transparently falls back to the local
// json/site-data.json file.
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

    async function fetchSiteData() {
        if (cache.data) return cache.data;
        if (cache.promise) return cache.promise;

        cache.promise = (async () => {
            try {
                const res = await fetch(apiUrl(), { cache: 'no-store' });
                if (!res.ok) throw new Error(`API responded ${res.status}`);
                cache.data = await res.json();
                return cache.data;
            } catch (err) {
                console.warn('site-data API unreachable, using local fallback:', err);
                const res = await fetch(localFallbackUrl(), { cache: 'no-store' });
                if (!res.ok) throw new Error(`Local JSON responded ${res.status}`);
                cache.data = await res.json();
                return cache.data;
            }
        })().catch(err => {
            cache.promise = null;
            throw err;
        });

        return cache.promise;
    }

    window.fetchSiteData = fetchSiteData;
})();
