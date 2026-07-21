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

    fetchSiteData()
        .then(data => {
            const sectionData = data[sectionName];
            if (Array.isArray(sectionData) && sectionData.length > 0) {
                renderContentItems(container, sectionData, data);
                initializeGallery();
                initializeSpoilers();
            } else {
                container.innerHTML = '<p>Content not found.</p>';
            }
        })
        .catch(error => {
            console.error('Error loading JSON section:', sectionName, error);
            container.innerHTML = '<p>Failed to load content.</p>';
        });
}

function renderContentItems(container, items, data = {}) {
    items.forEach(item => renderContentItem(container, item, data));
}

function renderContentItem(container, item, data = {}) {
    if (!item || !item.type) return;

    // GLOBAL ITEM TRACKER
    console.log(`Processing item type: "${item.type}"`, item);

    const value = getLocalizedValue(item.value || '');
    const escaped = value;
    const getLinks = (text, className) => {
        return `${text}`.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) =>
            `<a href="${prefixRootPath(url)}" target="_blank" class="${className}">${label}</a>`
        );
    };

    switch (item.type) {
        case 'gallery':
            console.log('-> Gallery case raw item object:', item);
            createGallery(container, resolveGalleryElements(item));
            break;
        case 'heading-text':
            container.innerHTML += `<h1 class="heading-text">${getLinks(escaped, 'heading-text-with-link')}</h1>`;
            break;
        case 'subheading-text':
            container.innerHTML += `<h2 class="subheading-text">${getLinks(escaped, 'subheading-text-with-link')}</h2>`;
            break;
        case 'sub-subheading-text':
            container.innerHTML += `<h3 class="sub-subheading-text">${getLinks(escaped, 'sub-subheading-text-with-link')}</h3>`;
            break;
        case 'info-text':
            container.innerHTML += `<p class="info-text">${getLinks(escaped, 'info-text-with-link')}</p>`;
            break;
        case 'text':
            container.innerHTML += `<p>${getLinks(escaped, 'text-with-link').replace(/\|\|(.+?)\|\|/g, '<span class="spoiler-text">$1</span>')}</p>`;
            break;
        case 'main-image':
            if (item.visible !== 'no') {
                container.innerHTML += `<img src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}" alt="" class="main-image">`;
            }
            break;
        case 'main-video':
            container.innerHTML += `<div class="main-video-container"><video class="main-video" controls src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}"></video></div>`;
            break;
        case 'image':
            container.innerHTML += `<img src="${prefixRootPath(getLocalizedValue(item.value) || item.value || '')}" alt="" class="image">`;
            break;
        case 'caption-text':
            container.innerHTML += `<p class="caption-text">${getLinks(escaped, 'caption-text-with-link')}</p>`;
            break;
        case 'quote':
            container.innerHTML += `<div class="quote">${getLinks(escaped, 'quote-text-with-link')}</div>`;
            break;
        case 'information':
            container.innerHTML += `<div class="information">${getLinks(escaped, 'information-text-with-link')}</div>`;
            break;
        case 'warning':
            container.innerHTML += `<div class="warning">${escaped}</div>`;
            break;
        case 'error':
            container.innerHTML += `<div class="error">${escaped}</div>`;
            break;
        case 'video':
            const videoPath = getLocalizedValue(item.value);
            container.innerHTML += `<div class="video-container"><video controls src="${prefixRootPath(videoPath)}"></video></div>`;
            break;
        case 'pdf':
            const pdfPath = getLocalizedValue(item.value);
            container.innerHTML += `
        <div class="pdf-container">
            <div class="pdf-toolbar">
                <a href="${prefixRootPath(pdfPath)}" target="_blank" rel="noopener" class="pdf-open">${getLocalizedValue(data.openPdf) || 'Open PDF separately'}</a>
            </div>
            <iframe src="${prefixRootPath(pdfPath)}" class="pdf-frame" loading="lazy"></iframe>
        </div>`;
            break;
        default:
            console.warn('Unsupported content item type:', item.type);
    }
}

function initializeSpoilers() {
    document.querySelectorAll('.spoiler-text').forEach(elem => {
        elem.addEventListener('click', () => {
            elem.classList.toggle('revealed');
        });
    });
}

let galleryInstanceCount = 0;

function createGallery(container, elements) {
    console.log('createGallery received elements:', elements);
    if (!Array.isArray(elements) || elements.length === 0) {
        console.warn('createGallery aborted: "elements" is empty or not an array.', elements);
        return;
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
        return;
    }

    const galleryId = `gallery-${galleryInstanceCount++}`;
    const firstItem = resolvedItems[0];
    const isFirstVideo = firstItem.type === 'video';

    let galleryHtml = `
        <div class="gallery-wrapper" data-gallery-id="${galleryId}">
            <div class="gallery-container">
                <img ${!isFirstVideo ? `src="${firstItem.url}"` : ''} alt="Gallery Image" class="gallery-main-image" style="display: ${!isFirstVideo ? 'block' : 'none'};">
                <video ${isFirstVideo ? `src="${firstItem.url}"` : ''} controls class="gallery-main-video" style="display: ${isFirstVideo ? 'block' : 'none'};"></video>
                
                <button class="gallery-nav-button left">&lt;</button>
                <button class="gallery-nav-button right">&gt;</button>
                
                <div class="gallery-thumbnails">
    `;

    resolvedItems.forEach((item, index) => {
        if (item.type === 'video') {
            galleryHtml += `<video src="${item.url}" class="gallery-thumbnail${index === 0 ? ' active' : ''}" data-index="${index}" data-type="video" muted></video>`;
        } else {
            galleryHtml += `<img src="${item.url}" alt="Thumbnail" class="gallery-thumbnail${index === 0 ? ' active' : ''}" data-index="${index}" data-type="image">`;
        }
    });

    galleryHtml += `
                </div>
            </div>
            <div class="gallery-zoom-overlay" data-gallery-id="${galleryId}">
                <img ${!isFirstVideo ? `src="${firstItem.url}"` : ''} alt="Zoom Image" class="gallery-zoom-image" style="display: ${!isFirstVideo ? 'block' : 'none'};">
                <video ${isFirstVideo ? `src="${firstItem.url}"` : ''} controls class="gallery-zoom-video" style="display: ${isFirstVideo ? 'block' : 'none'};"></video>
            </div>
        </div>
    `;

    container.innerHTML += galleryHtml;
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

        mainImage.addEventListener('click', openZoom);
        mainVideo.addEventListener('click', openZoom);

        zoomOverlay.addEventListener('click', (e) => {
            if (e.target === zoomVideo) return;
            zoomOverlay.classList.remove('active');
            zoomVideo.pause();
        });
    });
}
