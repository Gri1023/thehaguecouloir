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
    return value || '';
}

function isVisibleForCurrentLanguage(item) {
    return !item.lang || item.lang === 'all' || item.lang === currentLanguage;
}

document.addEventListener('DOMContentLoaded', () => {
    loadArticleContent();
});

function loadArticleContent() {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');
    const articleType = urlParams.get('type');
    const rootPrefix = getRootPrefix();

    fetchSiteData().then(data => {
        const articleData = data[articleType].find(item => item.id === articleId && item.visible === 'yes' && isVisibleForCurrentLanguage(item));
        if (articleData) {
            const articleContent = document.getElementById('article-content');
            const articleTypeContainer = document.getElementById('article-type');

            const formatLinks = (text, className) => {
                return `${text}`.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) =>
                    `<a href="${prefixRootPath(url)}" target="_blank" class="${className}">${label}</a>`
                );
            };

            articleTypeContainer.innerHTML = getLocalizedValue(data.types[articleType]);
            articleTypeContainer.className = `text-type ${articleType}`;

            // Content handling for all publication types
            articleData.content.forEach(item => {
                const localizedItemValue = getLocalizedValue(item.value || '');
                if (item.type === 'gallery') {
                    createGallery(articleContent, item.images);
                } else if (item.type === 'heading-text') {
                    const headingTextWithLinks = formatLinks(localizedItemValue, 'heading-text-with-link');
                    articleContent.innerHTML += `<h1 class="heading-text">${headingTextWithLinks}</h1>`;
                } else if (item.type === 'subheading-text') {
                    articleContent.innerHTML += `<h2 class="subheading-text">${localizedItemValue}</h2>`;
                } else if (item.type === 'sub-subheading-text') {
                    articleContent.innerHTML += `<h3 class="sub-subheading-text">${localizedItemValue}</h3>`;
                } else if (item.type === 'info-text') {
                    const infoTextWithLinks = formatLinks(localizedItemValue, 'info-text-with-link');
                    articleContent.innerHTML += `<p class="info-text">${infoTextWithLinks}</p>`;
                } else if (item.type === 'text') {
                    const textFormatted = formatLinks(localizedItemValue, 'text-with-link')
                        .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler-text">$1</span>');
                    articleContent.innerHTML += `<p>${textFormatted}</p>`;
                } else if (item.type === 'main-image') {
                    if (item.visible !== 'no') {
                        articleContent.innerHTML += `<img src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}" alt="" class="main-image">`;
                    }
                } else if (item.type === 'main-video') {
                    articleContent.innerHTML += `<div class="main-video-container"><video class="main-video" controls src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}"></video></div>`;
                } else if (item.type === 'image') {
                    articleContent.innerHTML += `<img src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}" alt="" class="image">`;
                } else if (item.type === 'caption-text') {
                    const captionTextWithLinks = formatLinks(localizedItemValue, 'caption-text-with-link');
                    articleContent.innerHTML += `<p class="caption-text">${captionTextWithLinks}</p>`;
                } else if (item.type === 'quote') {
                    const quoteTextWithLinks = formatLinks(localizedItemValue, 'quote-text-with-link');
                    articleContent.innerHTML += `<div class="quote">${quoteTextWithLinks}</div>`;
                } else if (item.type === 'information') {
                    const informationTextWithLinks = formatLinks(localizedItemValue, 'information-text-with-link');
                    articleContent.innerHTML += `<div class="information">${informationTextWithLinks}</div>`;
                } else if (item.type === 'warning') {
                    articleContent.innerHTML += `<div class="warning">${localizedItemValue}</div>`;
                } else if (item.type === 'error') {
                    articleContent.innerHTML += `<div class="error">${localizedItemValue}</div>`;
                } else if (item.type === 'video') {
                    articleContent.innerHTML += `<div class="video-container"><video controls src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}"></video></div>`;
                } else if (item.type === 'pdf') {
                    // Extract the localized path string from the value object
                    const localizedPath = getLocalizedValue(item.value);

                    articleContent.innerHTML += `
        <div class="pdf-container">
            <div class="pdf-toolbar">
                <a href="${prefixRootPath(localizedPath)}" target="_blank" rel="noopener" class="pdf-open">${getLocalizedValue(data.openPdf)}</a>
                </div>
            <iframe src="${prefixRootPath(localizedPath)}" class="pdf-frame" loading="lazy"></iframe>
        </div>`;
                }
            });

            // --- Add Related Topics (Tags) Section ---
            const tagsDiv = document.querySelector('.tags');
            tagsDiv.innerHTML = ''; // Clear previous tags if any

            console.log('Loaded tags from JSON:', data.tags);
            console.log('Article tags:', articleData.tags);

            if (articleData.tags && Array.isArray(articleData.tags) && articleData.tags.length > 0) {
                const tagsSection = document.createElement('div');
                tagsSection.className = 'tags-section';
                tagsSection.innerHTML = `<div class="related-topics-tags"></div>`;
                const tagsContainer = tagsSection.querySelector('.related-topics-tags');

                articleData.tags.forEach(tagKey => {
                    if (data.tags.hasOwnProperty(tagKey)) {
                        const translatedTag = getLocalizedValue(data.tags[tagKey]);
                        const tagLink = document.createElement('a');
                        tagLink.className = 'related-topic-tag';
                        tagLink.href = `${rootPrefix}all-publications/?tags=${encodeURIComponent(tagKey)}&lang=${currentLanguage}`;
                        tagLink.textContent = `#${translatedTag}`;
                        tagsContainer.appendChild(tagLink);
                    } else {
                        console.warn(`Tag key "${tagKey}" not found in data.tags`);
                    }
                });

                tagsDiv.appendChild(tagsSection);
                console.log('Tags section appended to .tags div');
            } else {
                console.log('No tags found for this article or tags array is invalid.');
            }

            initializeGallery();
            initializeSpoilers();
        } else {
            document.getElementById('article-content').innerHTML = '<p>Публикация не найдена. Попробуйте поменять язык в правом верхнем углу, перевод некоторых из них может занять до 2 дней. Все ещё не работает? Сообщите автору: thehaguecouloir@gmail.com. </p> <p> Publication not found. Try changing the language in the top right corner, some may take up to 2 days to translate. Still not working? Let the author know: thehaguecouloir@gmail.com.</p>';
        }
    })
        .catch(error => console.error('Error loading article content:', error));
}

// Shared gallery and spoiler helpers are now defined in content-utils.js
