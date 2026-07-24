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
    if (url.startsWith('media/') || url.startsWith('images/')) {
        return `${window.R2_BASE_URL}${url}`;
    }
    return `${getRootPrefix()}${url}`;
}

function getLocalizedValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const current = value[window.currentLanguage];
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
    return !item.lang || item.lang === 'all' || item.lang === window.currentLanguage;
}

function resolveGalleryElements(item) {
    if (!item || typeof item !== 'object') return [];

    if (Array.isArray(item.value)) return item.value;
    if (Array.isArray(item.images)) return item.images;

    const localized = item[window.currentLanguage] || item.en || item.ru;
    if (Array.isArray(localized)) return localized;
    if (localized && typeof localized === 'object') {
        if (Array.isArray(localized.value)) return localized.value;
        if (Array.isArray(localized.images)) return localized.images;
    }

    return [];
}

function loadJsonSection(sectionName, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('Content container not found:', containerId);
        return;
    }

    // Reserve a min-height matching the final rendered content to prevent
    // layout shift while JSON is loading. The about page contains a TOC
    // and other content; reserving 600px is a safe default that will be
    // overridden once the content is rendered.
    container.style.minHeight = '600px';

    fetchSiteData()
        .then(data => {
            const sectionData = data[sectionName];
            if (Array.isArray(sectionData) && sectionData.length > 0) {
                renderContentItems(container, sectionData, data);

                initializeGallery();
                initializeSpoilers();
                initializeTOC();

                // THE REAL SOLUTION: Handle scroll restoration after content renders
                if (window.location.hash) {
                    // setTimeout with 0ms pushes the scroll action to the end of the event loop,
                    // guaranteeing the browser has finished painting the new HTML first.
                    setTimeout(() => {
                        const targetElement = document.querySelector(window.location.hash);
                        if (targetElement) {
                            // Use 'auto' here so the initial page load jump is instant,
                            // while clicking TOC links remains smooth.
                            targetElement.scrollIntoView({ behavior: 'auto' });
                        }
                    }, 0);
                }
            } else {
                container.innerHTML = '<p>Content not found.</p>';
                container.style.minHeight = '';
            }
        })
        .catch(error => {
            console.error('Error loading JSON section:', sectionName, error);
            container.innerHTML = '<p>Failed to load content.</p>';
            container.style.minHeight = '';
        });
}

function loadArticleContent() {
    const articleContent = document.getElementById('article-content');
    const articleTypeContainer = document.getElementById('article-type');
    const tagsDiv = document.querySelector('.tags');
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');
    const articleType = urlParams.get('type');
    const rootPrefix = getRootPrefix();

    if (!articleContent || !articleTypeContainer || !tagsDiv) {
        console.warn('Article page containers not found.');
        return;
    }

    fetchSiteData()
        .then(data => {
            const articles = data[articleType];
            const articleData = Array.isArray(articles)
                ? articles.find(item => item.id === articleId && item.visible === 'yes' && isVisibleForCurrentLanguage(item))
                : null;

            if (!articleData) {
                articleContent.innerHTML = '<p>Публикация не найдена. Попробуйте поменять язык в правом верхнем углу, перевод некоторых из них может занять до 2 дней. Все ещё не работает? Сообщите автору: thehaguecouloir@gmail.com.</p><p>Publication not found. Try changing the language in the top right corner; some may take up to 2 days to translate. Still not working? Let the author know: thehaguecouloir@gmail.com.</p>';
                tagsDiv.innerHTML = '';
                return;
            }

            articleTypeContainer.textContent = getLocalizedValue(data.types && data.types[articleType]);
            articleTypeContainer.className = `text-type ${articleType}`;
            articleContent.innerHTML = (articleData.content || [])
                .map(item => buildContentItemHtml(item, data))
                .join('');

            renderArticleTags(tagsDiv, articleData, data, rootPrefix);
            initializeGallery();
            initializeSpoilers();
            initializeTOC();
        })
        .catch(error => {
            console.error('Error loading article content:', error);
            articleContent.innerHTML = '<p>Failed to load publication.</p>';
            tagsDiv.innerHTML = '';
        });
}

function renderArticleTags(tagsDiv, articleData, data, rootPrefix) {
    tagsDiv.innerHTML = '';
    if (!Array.isArray(articleData.tags) || articleData.tags.length === 0) return;

    const tags = data.tags || {};
    const links = articleData.tags
        .filter(tagKey => Object.prototype.hasOwnProperty.call(tags, tagKey))
        .map(tagKey => {
            const label = getLocalizedValue(tags[tagKey]);
            const href = `${rootPrefix}all-publications/?tags=${encodeURIComponent(tagKey)}&lang=${window.currentLanguage}`;
            return `<a class="related-topic-tag" href="${href}">#${label}</a>`;
        })
        .join('');

    if (links) {
        tagsDiv.innerHTML = `<div class="tags-section"><div class="related-topics-tags">${links}</div></div>`;
    }
}

function renderContentItems(container, items, data = {}) {
    // Build the HTML into a single string to avoid re-parsing siblings
    // (innerHTML += inside a loop detaches previously appended media
    // and cancels in-flight network requests).
    container.innerHTML = items.map(item => buildContentItemHtml(item, data)).join('');
}

function buildContentItemHtml(item, data = {}) {
    if (!item || !item.type) return '';

    const value = getLocalizedValue(item.value || '');
    const escaped = value;
    const getLinks = (text, className) => {
        return `${text}`.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) =>
            `<a href="${prefixRootPath(url)}" target="_blank" class="${className}">${label}</a>`
        );
    };

    // Check if the scale property exists and build the inline style
    const scaleStyle = item.scale ? ` style="max-width: ${item.scale}; margin: 0 auto; display: block;"` : '';

    switch (item.type) {
        case 'gallery':
            return buildGalleryHtml(resolveGalleryElements(item));
        case 'heading-text':
            const headingId = item.anchor ? ` id="${item.anchor.replace('#', '')}"` : '';
            return `<h1 class="heading-text"${headingId}>${getLinks(escaped, 'heading-text-with-link')}</h1>`;
        case 'subheading-text':
            const subheadingId = item.anchor ? ` id="${item.anchor.replace('#', '')}"` : '';
            return `<h2 class="subheading-text"${subheadingId}>${getLinks(escaped, 'subheading-text-with-link')}</h2>`;
        case 'sub-subheading-text':
            const subsubheadingId = item.anchor ? ` id="${item.anchor.replace('#', '')}"` : '';
            return `<h3 class="sub-subheading-text"${subsubheadingId}>${getLinks(escaped, 'sub-subheading-text-with-link')}</h3>`;
        case 'info-text':
            return `<p class="info-text">${getLinks(escaped, 'info-text-with-link')}</p>`;
        case 'text':
            return `<p>${getLinks(escaped, 'text-with-link').replace(/\|\|(.+?)\|\|/g, '<span class="spoiler-text">$1</span>')}</p>`;
        case 'main-image':
            if (item.visible !== 'no') {
                return `<img src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}" alt="" class="main-image"${scaleStyle}>`;
            }
            return '';
        case 'raw-main-image':
            return `<img src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}" alt="" class="main-image"${scaleStyle}>`;
        case 'main-video':
            return `<div class="main-video-container"${scaleStyle}><video class="main-video" controls preload="metadata" src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}"></video></div>`;
        case 'image':
            return `<img src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}" alt="" class="image"${scaleStyle}>`;
        case 'caption-text':
            return `<p class="caption-text">${getLinks(escaped, 'caption-text-with-link')}</p>`;
        case 'caption':
            return `<p class="caption-text">${getLinks(escaped, 'caption-text-with-link')}</p>`;
        case 'quote':
            return `<div class="quote">${getLinks(escaped, 'quote-text-with-link')}</div>`;
        case 'information':
            return `<div class="information">${getLinks(escaped, 'information-text-with-link')}</div>`;
        case 'warning':
            return `<div class="warning">${escaped}</div>`;
        case 'error':
            return `<div class="error">${escaped}</div>`;
        case 'video':
            const videoPath = getLocalizedValue(item.value);
            return `<div class="video-container"${scaleStyle}><video controls preload="metadata" src="${prefixRootPath(videoPath)}"></video></div>`;
        case 'pdf':
            const pdfPath = getLocalizedValue(item.value);
            return `
        <div class="pdf-container">
            <div class="pdf-toolbar">
                <a href="${prefixRootPath(pdfPath)}" target="_blank" rel="noopener" class="pdf-open">${getLocalizedValue(data.openPdf) || 'Open PDF separately'}</a>
            </div>
            <iframe src="${prefixRootPath(pdfPath)}" class="pdf-frame" loading="lazy"></iframe>
        </div>`;
        case 'table-of-contents':
            const tocTitle = getLocalizedValue(item.title || '');
            let tocHtml = `
            <div class="table-of-contents">
                <div class="toc-header">
                    <h2 class="toc-title">${tocTitle}</h2>
                    <svg class="toc-toggle-icon" viewBox="0 0 24 24" width="24" height="24" stroke="#334155" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="toc-collapsible">
                    <div class="toc-collapsible-inner">
            `;
            if (Array.isArray(item.value)) {
                tocHtml += '<ol class="toc-list">';
                item.value.forEach((entry) => {
                    const entryName = getLocalizedValue(entry.name || '');
                    let entryAnchor = entry.anchor || '';
                    if (typeof entryAnchor === 'object') {
                        entryAnchor = getLocalizedValue(entryAnchor);
                    }
                    if (entryName && entryAnchor) {
                        tocHtml += `<li><a href="${entryAnchor}" class="toc-link">${entryName}</a></li>`;
                    }
                });
                tocHtml += '</ol>';
            }
            tocHtml += '</div></div></div>';
            return tocHtml;
        default:
            return '';
    }
}

function initializeSpoilers() {
    document.querySelectorAll('.spoiler-text').forEach(elem => {
        elem.addEventListener('click', () => {
            elem.classList.toggle('revealed');
        });
    });
}

function initializeTOC() {
    document.querySelectorAll('.toc-header').forEach(header => {
        // Prevent multiple bindings if re-rendered
        if (header.dataset.tocInitialized) return;
        header.dataset.tocInitialized = 'true';

        header.addEventListener('click', () => {
            const tocContainer = header.closest('.table-of-contents');
            tocContainer.classList.toggle('collapsed');
        });
    });
}

let galleryInstanceCount = 0;

function buildGalleryHtml(elements) {
    console.log('createGallery received elements:', elements);
    if (!Array.isArray(elements) || elements.length === 0) {
        console.warn('createGallery aborted: "elements" is empty or not an array.', elements);
        return '';
    }

    const resolvedItems = elements
        .map(item => {
            const localizedPath = getLocalizedValue(item.src);
            return localizedPath ? { type: item.mediaType || 'image', url: prefixRootPath(localizedPath) } : null;
        })
        .filter(item => item !== null);

    console.log('createGallery resolved items:', resolvedItems);

    if (resolvedItems.length === 0) {
        console.warn('createGallery aborted: No valid item URLs could be resolved.', elements);
        return '';
    }

    const galleryId = `gallery-${galleryInstanceCount++}`;
    const firstItem = resolvedItems[0];
    const isFirstVideo = firstItem.type === 'video';

    let galleryHtml = `
        <div class="gallery-wrapper" data-gallery-id="${galleryId}">
            <div class="gallery-container">
                <div class="gallery-stage">
                    <img ${!isFirstVideo ? `src="${firstItem.url}"` : ''} alt="Gallery Image" class="gallery-main-image" style="display: ${!isFirstVideo ? 'block' : 'none'};">
                    <video ${isFirstVideo ? `src="${firstItem.url}"` : ''} preload="metadata" controls class="gallery-main-video" style="display: ${isFirstVideo ? 'block' : 'none'};"></video>
                </div>

                <button class="gallery-nav-button left" aria-label="Previous">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <path d="M15 6 L9 12 L15 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="gallery-nav-button right" aria-label="Next">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <path d="M9 6 L15 12 L9 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>

                <div class="gallery-thumbnails">
    `;

    resolvedItems.forEach((item, index) => {
        if (item.type === 'video') {
            galleryHtml += `<video src="${item.url}" preload="metadata" class="gallery-thumbnail${index === 0 ? ' active' : ''}" data-index="${index}" data-type="video" muted></video>`;
        } else {
            galleryHtml += `<img src="${item.url}" alt="Thumbnail" class="gallery-thumbnail${index === 0 ? ' active' : ''}" data-index="${index}" data-type="image">`;
        }
    });

    galleryHtml += `
                </div>
            </div>
            <div class="gallery-zoom-overlay" data-gallery-id="${galleryId}">
                <button class="gallery-zoom-close" aria-label="Close">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </button>
                <img ${!isFirstVideo ? `src="${firstItem.url}"` : ''} alt="Zoom Image" class="gallery-zoom-image" style="display: ${!isFirstVideo ? 'block' : 'none'};">
                <video ${isFirstVideo ? `src="${firstItem.url}"` : ''} preload="metadata" controls class="gallery-zoom-video" style="display: ${isFirstVideo ? 'block' : 'none'};"></video>
            </div>
        </div>
    `;

    return galleryHtml;
}

function createGallery(container, elements) {
    const html = buildGalleryHtml(elements);
    if (!html) return;
    // Use insertAdjacentHTML instead of innerHTML += so the browser doesn't
    // re-parse existing children (which would abort in-flight <video> loads).
    container.insertAdjacentHTML('beforeend', html);
}

function initializeGallery() {
    document.querySelectorAll('.gallery-wrapper').forEach(galleryWrapper => {
        const galleryId = galleryWrapper.dataset.galleryId;
        const mainImage = galleryWrapper.querySelector('.gallery-main-image');
        const mainVideo = galleryWrapper.querySelector('.gallery-main-video');
        const thumbnails = galleryWrapper.querySelectorAll('.gallery-thumbnail');
        const leftButton = galleryWrapper.querySelector('.gallery-nav-button.left');
        const rightButton = galleryWrapper.querySelector('.gallery-nav-button.right');
        const zoomOverlay = galleryWrapper.querySelector(`.gallery-zoom-overlay[data-gallery-id="${galleryId}"]`);
        const zoomImage = zoomOverlay ? zoomOverlay.querySelector('.gallery-zoom-image') : null;
        const zoomVideo = zoomOverlay ? zoomOverlay.querySelector('.gallery-zoom-video') : null;
        const zoomClose = zoomOverlay ? zoomOverlay.querySelector('.gallery-zoom-close') : null;

        if (!mainImage || !mainVideo || !leftButton || !rightButton || !zoomOverlay || !zoomImage || !zoomVideo || thumbnails.length === 0) {
            return;
        }

        let currentIndex = 0;

        function updateMainMedia(index) {
            const thumb = thumbnails[index];
            const newSrc = thumb.src || thumb.getAttribute('src');
            const type = thumb.getAttribute('data-type');

            thumbnails.forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
            currentIndex = index;

            if (type === 'video') {
                mainImage.style.display = 'none';
                mainVideo.src = newSrc;
                mainVideo.style.display = 'block';

                zoomImage.style.display = 'none';
                zoomVideo.src = newSrc;
            } else {
                mainVideo.style.display = 'none';
                mainVideo.pause();
                mainImage.src = newSrc;
                mainImage.style.display = 'block';

                zoomVideo.style.display = 'none';
                zoomVideo.pause();
                zoomImage.src = newSrc;
            }
        }

        updateMainMedia(0);

        thumbnails.forEach((thumb, index) => {
            thumb.addEventListener('click', () => updateMainMedia(index));
        });

        leftButton.addEventListener('click', () => {
            const newIndex = currentIndex > 0 ? currentIndex - 1 : thumbnails.length - 1;
            updateMainMedia(newIndex);
        });

        rightButton.addEventListener('click', () => {
            const newIndex = currentIndex < thumbnails.length - 1 ? currentIndex + 1 : 0;
            updateMainMedia(newIndex);
        });

        const openZoom = () => {
            const type = thumbnails[currentIndex].getAttribute('data-type');
            if (type === 'video') {
                zoomVideo.style.display = 'block';
            } else {
                zoomImage.style.display = 'block';
            }
            zoomOverlay.classList.add('active');
        };

        const closeZoom = () => {
            zoomOverlay.classList.remove('active');
            if (zoomVideo) zoomVideo.pause();
        };

        mainImage.addEventListener('click', openZoom);
        mainVideo.addEventListener('click', openZoom);

        // Click on the dark backdrop (but not on media or the close button) closes.
        zoomOverlay.addEventListener('click', (e) => {
            if (e.target === zoomVideo || e.target === zoomImage) return;
            if (zoomClose && (e.target === zoomClose || zoomClose.contains(e.target))) {
                closeZoom();
                return;
            }
            closeZoom();
        });
    });
}
