document.addEventListener('DOMContentLoaded', () => {
    filterItems('all'); // Default to showing all items

    // Load content for index.html
    if (document.querySelector('.content-grid')) {
        loadContent(`json/${currentLanguage}.json`);
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
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
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
                    console.log('Rotation paused');
                }
                pauseHoverCount += 1;
            }

            function resumeRotation() {
                pauseHoverCount = Math.max(0, pauseHoverCount - 1);
                if (pauseHoverCount === 0 && !rotationInterval) {
                    rotationInterval = setInterval(() => {
                        updateHighlightedArticle();
                    }, 5000);
                    console.log('Rotation resumed');
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
                        heading.textContent = data.sectionHeadings ? data.sectionHeadings[type] : data.types[type];
                    } else {
                        console.warn(`Heading not found for section: ${id}`);
                    }
                    if (subheading) {
                        subheading.textContent = data.sectionSubheadings[type];
                    } else {
                        console.warn(`Subheading not found for section: ${id}`);
                    }
                    if (button) {
                        button.querySelector('.publication-section-button').textContent = data.exploreAllPublications;
                        // Ensure lang parameter in the link
                        button.setAttribute('href', `all-publications.html?lang=${currentLanguage}`);
                    } else {
                        console.warn(`Button not found for section: ${id}`);
                    }
                } else {
                    console.warn(`Section not found: ${id}`);
                }
            });

            const highlightedArticle = document.getElementById('highlighted-article');

            const highlightedArticleIds = [
                data.highlightedArticle1Id,
                data.highlightedArticle2Id,
                data.highlightedArticle3Id,
                data.highlightedArticle4Id
            ];

            highlightedArticleIds.forEach(id => {
                ['news', 'article', 'opinion', 'academic'].some(type => {
                    const item = data[type].find(article => article.id == id);
                    if (item) {
                        featuredItems.push({ ...item, type });
                        return true; // Stop further iteration over types once a match is found
                    }
                    return false; // Continue to the next type
                });
            });

            function updateHighlightedArticle(index) {
                console.log('updateHighlightedArticle called with index:', index);
                const targetIndex = index !== undefined ? index : currentIndex;
                if (index !== undefined && targetIndex === displayedIndex) {
                    return; // No need to re-render the same highlighted article
                }
                const featuredItem = featuredItems[targetIndex];
                const articleTypeClass = featuredItem.type;
                const articleLink = `article.html?id=${featuredItem.id}&type=${featuredItem.type}&lang=${currentLanguage}`;

                const mediaContent = featuredItem.content.find(contentItem =>
                    contentItem.type === 'main-image' || contentItem.type === 'main-video'
                );

                // Fade out elements
                const image = highlightedArticle.querySelector('.highlighted-image');
                const typeEl = highlightedArticle.querySelector('.highlighted-type');
                const titleEl = highlightedArticle.querySelector('.highlighted-title');
                const dateEl = highlightedArticle.querySelector('.highlighted-date');

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

                pendingUpdateTimeout = setTimeout(() => {
                    // Update content
                    if (mediaContent.type === 'main-image') {
                        image.src = mediaContent.value;
                    } else if (mediaContent.type === 'main-video') {
                        image.src = featuredItem.previewImage;
                    }

                    highlightedArticle.querySelector('.highlighted-title').innerHTML = `<a href="${articleLink}" class="highlighted-title-link">${featuredItem.title}</a>` +
                        (mediaContent.type === 'main-video'
                            ? `<span class="video-indicator"><span class="dot"></span> ${data.videoText}</span>`
                            : '');

                    typeEl.textContent = data.types[featuredItem.type];
                    typeEl.className = `highlighted-type ${articleTypeClass}`;
                    dateEl.textContent = timeAgo(featuredItem.date);

                    const highlightedButton = highlightedArticle.querySelector('.highlighted-button');
                    const button = highlightedButton.querySelector('.highlighted-button-link');
                    if (button) {
                        button.href = articleLink;
                        button.textContent = data.readMoreButton;
                    } else {
                        highlightedButton.innerHTML = `<a href="${articleLink}" class="highlighted-button-link">${data.readMoreButton}</a>`;
                    }

                    // Highlight grid item
                    const gridItems = document.querySelectorAll('#highlighted-articles-grid .grid-item');
                    gridItems.forEach(item => {
                        if (item.querySelector('h3').textContent === featuredItem.title) {
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
                    .filter(item => item.visible === "yes")
                    .map(item => ({ ...item, type })))
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            const maxItemsPerSection = getMaxItemsPerSection();
            console.log("maxItemsPerSection = " + maxItemsPerSection);

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
                    if (mediaContent.type === 'main-image') {
                        mediaHTML = `<img src="${mediaContent.value}" alt="${item.title}">`;
                    } else if (mediaContent.type === 'main-video') {
                        mediaHTML = `<img src="${item.previewImage}" alt="${item.title}">`;
                    }

                    // Add the link to the articleElement itself
                    articleElement.setAttribute(
                        'onclick',
                        `location.href='article.html?id=${item.id}&type=${item.type}&lang=${currentLanguage}'`
                    );

                    // Populate the article's inner HTML
                    articleElement.innerHTML = `
                    <a>
                        ${mediaHTML}
                        <div class="content">
                            <p class="${item.type}">${data.types[item.type]}</p>
                            <h3 class="title">${item.title}</h3>
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
                const articleLink = `article.html?id=${item.id}&type=${item.type}&lang=${currentLanguage}`;

                gridItem.innerHTML = `
                        <a href="${articleLink}" class="grid-item-link">
                            <h3>${item.title}</h3>
                            <div class="type-date">
                                <span class="${item.type}">${data.types[item.type]}</span>
                                <span>|</span>
                                <span class="date">${timeAgo(item.date)}</span>
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
                console.log('Setting initial interval');
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