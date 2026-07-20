// R2_BASE_URL is declared once in base.js (loaded first on every page) and exposed on window.

function getRootPrefix() {
    const path = window.location.pathname;
    const subpages = ['article', 'about', 'all-publications', 'bias', 'your-data', 'editor'];
    return subpages.some(folder => path.includes(`/${folder}/`) || path.endsWith(`/${folder}`) || path.endsWith(`/${folder}/`)) ? '../' : '';
}

function prefixRootPath(url) {
    if (!url) return url;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('/') || url.startsWith('data:') || url.startsWith('../') || url.startsWith('./')) {
        return url;
    }
    // Route any media/image path to the R2 bucket by default.
    if (url.startsWith('media/') || url.startsWith('images/')) {
        return `${window.R2_BASE_URL}${url}`;
    }
    return `${getRootPrefix()}${url}`;
}

function getLocalizedValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const current = value[currentLanguage];
        if (current !== undefined && current !== '') {
            return current;
        }
        const en = value.en;
        if (en !== undefined && en !== '') {
            return en;
        }
        const ru = value.ru;
        if (ru !== undefined && ru !== '') {
            return ru;
        }
        return '';
    }
    return value;
}

function isVisibleForCurrentLanguage(item) {
    return !item.lang || item.lang === 'all' || item.lang === currentLanguage;
}

const rootPrefix = getRootPrefix();

document.addEventListener('DOMContentLoaded', () => {
    filterItems('all'); // Default to showing all items

    // Load content for index/
    if (document.querySelector('.content-grid')) {
        loadContent();
    }
});

// Function to filter items
function filterItems(type) {
    const items = document.querySelectorAll('.content-grid article');
    items.forEach(item => {
        if (type === 'all' || item.getAttribute('data-type') === type) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
    // Update button styles
    const buttons = document.querySelectorAll('.sort-option');
    buttons.forEach(button => {
        if (button.getAttribute('data-type') === type) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

function loadContent(jsonFile) {
    // jsonFile argument is kept for backwards compatibility but ignored —
    // data now comes from the shared site-data loader (Cloudflare KV via
    // /api/site-content, with a local fallback to json/site-data.json).
    const dataPromise = (typeof window.fetchSiteData === 'function')
        ? window.fetchSiteData()
        : fetch(jsonFile).then(r => r.json());

    dataPromise.then(data => {
        let currentIndex = 0;
        let displayedIndex = -1;
        let featuredItems = [];
        let rotationInterval;
        let pauseHoverCount = 0;
        let pendingUpdateTimeout = null;
        let pendingImageLoadListener = null;

        function pauseRotation() {
            if (pauseHoverCount === 0) {
                clearInterval(rotationInterval);
                rotationInterval = null;
                //console.log('Rotation paused');
            }
            pauseHoverCount += 1;
        }

        function resumeRotation() {
            pauseHoverCount = Math.max(0, pauseHoverCount - 1);
            if (pauseHoverCount === 0 && !rotationInterval) {
                rotationInterval = setInterval(() => {
                    updateHighlightedArticle();
                }, 5000);
                //console.log('Rotation resumed');
            }
        }
        // Translate section headings, subheadings, and buttons
        const sections = [
            { id: 'news-section', type: 'news' },
            { id: 'articles-section', type: 'article' },
            { id: 'opinions-section', type: 'opinion' },
            { id: 'academic-section', type: 'academic' }
        ];
        sections.forEach(({ id, type }) => {
            const sectionElement = document.getElementById(id);
            if (sectionElement) {
                const heading = sectionElement.querySelector('.publication-section-heading');
                const subheading = sectionElement.querySelector('.publication-section-subheading');
                const button = sectionElement.querySelector('.publication-section-button-text');
                if (heading) {
                    // Use sectionHeadings if available, fallback to types
                    heading.textContent = getLocalizedValue(data.sectionHeadings ? data.sectionHeadings[type] : data.types[type]);
                } else {
                    console.warn(`Heading not found for section: ${id}`);
                }
                if (subheading) {
                    subheading.textContent = getLocalizedValue(data.sectionSubheadings[type]);
                } else {
                    console.warn(`Subheading not found for section: ${id}`);
                }
                if (button) {
                    button.querySelector('.publication-section-button').textContent = getLocalizedValue(data.exploreAllPublications);
                    // Ensure lang parameter in the link
                    button.setAttribute('href', `all-publications/?lang=${currentLanguage}`);
                } else {
                    console.warn(`Button not found for section: ${id}`);
                }
            } else {
                console.warn(`Section not found: ${id}`);
            }
        });

        const highlightedArticle = document.getElementById('highlighted-article');

        const highlightedArticleIds = [
            getLocalizedValue(data.highlightedArticle1Id),
            getLocalizedValue(data.highlightedArticle2Id),
            getLocalizedValue(data.highlightedArticle3Id),
            getLocalizedValue(data.highlightedArticle4Id)
        ];

        highlightedArticleIds.forEach(id => {
            ['news', 'article', 'opinion', 'academic'].some(type => {
                const item = data[type].find(article => article.id == id && article.visible === 'yes' && isVisibleForCurrentLanguage(article));
                if (item) {
                    featuredItems.push({ ...item, type });
                    return true; // Stop further iteration over types once a match is found
                }
                return false; // Continue to the next type
            });
        });

        function updateHighlightedArticle(index) {
            // console.log('updateHighlightedArticle called with index:', index);
            const targetIndex = index !== undefined ? index : currentIndex;
            if (index !== undefined && targetIndex === displayedIndex) {
                return; // No need to re-render the same highlighted article
            }
            const featuredItem = featuredItems[targetIndex];
            const articleTypeClass = featuredItem.type;
            const articleLink = `${rootPrefix}article/?id=${featuredItem.id}&type=${featuredItem.type}&lang=${currentLanguage}`;

            const mediaContent = featuredItem.content.find(contentItem =>
                contentItem.type === 'main-image' || contentItem.type === 'main-video'
            );

            // Fade out elements
            const image = highlightedArticle.querySelector('.highlighted-image');
            const typeEl = highlightedArticle.querySelector('.highlighted-type');
            const titleEl = highlightedArticle.querySelector('.highlighted-title');
            const dateEl = highlightedArticle.querySelector('.highlighted-date');

            // Inserts the source node structurally as the first child of the text container
            let sourceEl = highlightedArticle.querySelector('.highlighted-source');
            if (!sourceEl) {
                sourceEl = document.createElement('div');
                sourceEl.className = 'highlighted-source';
                typeEl.parentNode.insertBefore(sourceEl, typeEl);
            }

            if (pendingUpdateTimeout) {
                clearTimeout(pendingUpdateTimeout);
                pendingUpdateTimeout = null;
            }
            if (pendingImageLoadListener) {
                image.removeEventListener('load', pendingImageLoadListener);
                pendingImageLoadListener = null;
            }

            image.style.opacity = '0';
            typeEl.style.opacity = '0';
            typeEl.style.transform = 'translateY(10px)';
            titleEl.style.opacity = '0';
            titleEl.style.transform = 'translateY(10px)';
            dateEl.style.opacity = '0';
            dateEl.style.transform = 'translateY(10px)';
            sourceEl.style.opacity = '0';
            sourceEl.style.transform = 'translateY(10px)';

            pendingUpdateTimeout = setTimeout(() => {
                // Update content
                if (mediaContent.type === 'main-image') {
                    image.src = prefixRootPath(getLocalizedValue(mediaContent.value) || mediaContent.value || '');
                } else if (mediaContent.type === 'main-video') {
                    image.src = prefixRootPath(getLocalizedValue(featuredItem.previewImage) || featuredItem.previewImage || '');
                }

                // Handle text data parsing safely
                if (mediaContent && mediaContent.source) {
                    const rawSourceText = getLocalizedValue(mediaContent.source);
                    if (rawSourceText) {
                        sourceEl.innerHTML = rawSourceText.replace(
                            /\[([^\]]+)\]\(([^)]+)\)/g,
                            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
                        );
                    } else {
                        sourceEl.innerHTML = '';
                    }
                } else {
                    sourceEl.innerHTML = '';
                }

                highlightedArticle.querySelector('.highlighted-title').innerHTML = `<a href="${articleLink}" class="highlighted-title-link">${getLocalizedValue(featuredItem.title)}</a>` +
                    (mediaContent.type === 'main-video'
                        ? `<span class="video-indicator"><span class="dot"></span> ${getLocalizedValue(data.videoText)}</span>`
                        : '');

                typeEl.textContent = getLocalizedValue(data.types[featuredItem.type]);
                typeEl.className = `highlighted-type ${articleTypeClass}`;
                dateEl.textContent = timeAgo(featuredItem.date);

                const highlightedButton = highlightedArticle.querySelector('.highlighted-button');
                const button = highlightedButton.querySelector('.highlighted-button-link');
                if (button) {
                    button.href = articleLink;
                    button.textContent = getLocalizedValue(data.readMoreButton);
                } else {
                    highlightedButton.innerHTML = `<a href="${articleLink}" class="highlighted-button-link">${getLocalizedValue(data.readMoreButton)}</a>`;
                }

                // Highlight grid item
                const gridItems = document.querySelectorAll('#highlighted-articles-grid .grid-item');
                gridItems.forEach(item => {
                    if (item.dataset.articleId === featuredItem.id) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });

                const fadeInElements = () => {
                    image.style.opacity = '1';
                    typeEl.style.opacity = '1';
                    typeEl.style.transform = 'translateY(0)';
                    titleEl.style.opacity = '1';
                    titleEl.style.transform = 'translateY(0)';
                    dateEl.style.opacity = '1';
                    dateEl.style.transform = 'translateY(0)';

                    // Sync animation slide up state cleanly alongside header groups
                    if (mediaContent && mediaContent.source && getLocalizedValue(mediaContent.source)) {
                        sourceEl.style.opacity = '1';
                        sourceEl.style.transform = 'translateY(0)';
                    }
                };

                if (image.complete && image.naturalWidth !== 0) {
                    fadeInElements();
                } else {
                    const onLoad = () => {
                        image.removeEventListener('load', onLoad);
                        fadeInElements();
                        pendingImageLoadListener = null;
                    };
                    image.addEventListener('load', onLoad);
                    pendingImageLoadListener = onLoad;
                }

                displayedIndex = targetIndex;
                currentIndex = (targetIndex + 1) % featuredItems.length;
                pendingUpdateTimeout = null;
            }, 300);
        }

        // Separate the items by type and add them to the respective grids
        const allItems = ['news', 'article', 'opinion', 'academic']
            .flatMap(type => data[type]
                .filter(item => item.visible === "yes" && isVisibleForCurrentLanguage(item))
                .map(item => ({ ...item, type })))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        const maxItemsPerSection = getMaxItemsPerSection();
        //console.log("maxItemsPerSection = " + maxItemsPerSection);

        ['news', 'article', 'opinion', 'academic'].forEach(type => {
            // Get items of the current type and limit to maxItemsPerSection
            const items = allItems.filter(item => item.type === type).slice(0, maxItemsPerSection);

            const gridId = `${type}-grid`;
            const gridElement = document.getElementById(gridId);

            items.forEach(item => {
                // Create the article element
                const articleElement = document.createElement('article');
                articleElement.classList.add(`${item.type}-item`);
                articleElement.setAttribute('data-type', item.type);

                // Find and handle media content
                const mediaContent = item.content.find(contentItem =>
                    contentItem.type === 'main-image' || contentItem.type === 'main-video'
                );

                let mediaHTML = '';
                const localizedTitle = getLocalizedValue(item.title);
                if (mediaContent.type === 'main-image') {
                    mediaHTML = `<img src="${prefixRootPath(getLocalizedValue(mediaContent.value) || mediaContent.value || '')}" alt="${localizedTitle}">`;
                } else if (mediaContent.type === 'main-video') {
                    mediaHTML = `<img src="${prefixRootPath(getLocalizedValue(item.previewImage) || item.previewImage || '')}" alt="${localizedTitle}">`;
                }

                // Add the link to the articleElement itself
                articleElement.setAttribute(
                    'onclick',
                    `location.href='${rootPrefix}article/?id=${item.id}&type=${item.type}&lang=${currentLanguage}'`
                );

                // Populate the article's inner HTML
                const articleTitle = getLocalizedValue(item.title) || getLocalizedValue(item.heading) || '';
                articleElement.innerHTML = `
                    <a>
                        ${mediaHTML}
                        <div class="content">
                            <p class="${item.type}">${getLocalizedValue(data.types[item.type])}</p>
                            <h3 class="title">${articleTitle}</h3>
                            <p class="date">${timeAgo(item.date)}</p>
                        </div>
                    </a>
                    `;

                // Append to the correct grid
                gridElement.appendChild(articleElement);
            });
        });

        // Highlighted articles section
        const highlightedArticlesGrid = document.querySelector('#highlighted-articles-grid .grid-container');

        // Get and sort the highlighted articles based on the order in highlightedArticleIds
        const highlightedArticles = highlightedArticleIds
            .map(id => allItems.find(item => item.id === id)) // Map IDs to corresponding items
            .filter(Boolean); // Remove any undefined items (if an ID is missing in allItems)

        highlightedArticles.forEach((item, index) => {
            const gridItem = document.createElement('div');
            gridItem.classList.add('grid-item');
            gridItem.dataset.articleId = item.id;
            const articleLink = `${rootPrefix}article/?id=${item.id}&type=${item.type}&lang=${currentLanguage}`;
            const highlightedTitle = getLocalizedValue(item.title) || getLocalizedValue(item.heading) || '';

            gridItem.innerHTML = `
                        <a href="${articleLink}" class="grid-item-link">
                            <h3><span>${highlightedTitle}</span></h3>
                            <div class="type-date">
                                <span class="${item.type}">${getLocalizedValue(data.types[item.type])}</span>
                            </div>
                        </a>
                    `;

            // Add event listeners for hover and click
            gridItem.addEventListener('mouseenter', () => {
                updateHighlightedArticle(index);
            });

            highlightedArticlesGrid.appendChild(gridItem);
        });

        if (featuredItems.length > 0) {
            // Initial setup to highlight the first article correctly
            updateHighlightedArticle(0);

            // Add event listeners to pause/resume rotation while hovering the highlighted article area
            if (highlightedArticle) {
                highlightedArticle.addEventListener('mouseenter', pauseRotation);
                highlightedArticle.addEventListener('mouseleave', resumeRotation);
            }

            // Start rotating after the initial setup
            //console.log('Setting initial interval');
            // uncomment below
            rotationInterval = setInterval(() => {
                console.log('Interval firing, updating article');
                updateHighlightedArticle();
            }, 5000);
        } else {
            console.error('Highlighted articles not found');
        }
    });
}

function getMaxItemsPerSection() {
    if (window.innerWidth >= 1024) {
        return 3; // 3 per row (Desktop)
    } else if (window.innerWidth >= 640) {
        return 4; // 2 per row (Tablet, so 4 in total)
    } else {
        return 3; // Default for small screens (Mobile)
    }
}