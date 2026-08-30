export async function onRequest(context) {
    try {
        // Dynamically derive 'http://localhost:8788' or 'https://thehaguecouloir.com'
        const origin = new URL(context.request.url).origin;

        // Fetch data using the absolute origin
        const dataResponse = await fetch(`${origin}/json/site-data.json`);

        if (!dataResponse.ok) {
            throw new Error(`Failed to load data: ${dataResponse.status}`);
        }

        const data = await dataResponse.json();

        // Collect all content types: news, article, opinion, academic, live-note
        const contentTypes = ['news', 'article', 'opinion', 'academic', 'live-note'];
        const allItems = [];

        contentTypes.forEach(type => {
            if (data[type] && Array.isArray(data[type])) {
                data[type].forEach(item => {
                    // Add type to item for URL generation
                    allItems.push({ ...item, type });
                });
            }
        });

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        // Static pages
        xml += `  <url><loc>${origin}/</loc><priority>1.0</priority><changefreq>daily</changefreq></url>\n`;
        xml += `  <url><loc>${origin}/all-publications/</loc><priority>0.8</priority><changefreq>daily</changefreq></url>\n`;
        xml += `  <url><loc>${origin}/about/</loc><priority>0.5</priority><changefreq>monthly</changefreq></url>\n`;
        xml += `  <url><loc>${origin}/your-data/</loc><priority>0.5</priority><changefreq>monthly</changefreq></url>\n`;
        xml += `  <url><loc>${origin}/bias/</loc><priority>0.5</priority><changefreq>monthly</changefreq></url>\n`;

        // Dynamic pages
        allItems.forEach(item => {
            if (item.visible !== "no") {
                xml += `  <url>\n`;
                // Generate URL with id, type, and lang parameters (escaping & to &amp;)
                xml += `    <loc>${origin}/article/?id=${item.id}&amp;type=${item.type}&amp;lang=${item.lang || 'all'}</loc>\n`;
                if (item.date) {
                    // Format date for lastmod (YYYY-MM-DD)
                    const date = new Date(item.date);
                    xml += `    <lastmod>${date.toISOString().split('T')[0]}</lastmod>\n`;
                }
                xml += `    <priority>0.7</priority>\n`;
                xml += `  </url>\n`;
            }
        });

        xml += `</urlset>`;

        return new Response(xml, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=86400'
            }
        });
    } catch (error) {
        // Emergency fallback so the function doesn't crash with 500
        return new Response(`<!-- Error generating sitemap: ${error.message} -->`, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
}