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

// Shared loader lives in js/site-data.js and is exposed as window.fetchSiteData.
// Defined here as a thin wrapper so legacy callers keep working unchanged.
function fetchSiteData() {
    if (typeof window.fetchSiteData === 'function') {
        return window.fetchSiteData();
    }
    // Defensive fallback if site-data.js failed to load.
    return fetch(`${getRootPrefix()}json/site-data.json`).then(r => r.json());
}

function loadJsonSection(sectionName, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('Content container not found:', containerId);
        return;
    }

    const rootPrefix = getRootPrefix();
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

    const value = getLocalizedValue(item.value || '');
    const escaped = value;
    const getLinks = (text, className) => {
        return `${text}`.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) =>
            `<a href="${prefixRootPath(url)}" target="_blank" class="${className}">${label}</a>`
        );
    };

    switch (item.type) {
        case 'gallery':
            createGallery(container, item.images || []);
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
            container.innerHTML += `<div class="video-container"><video controls src="${prefixRootPath(item.value)}"></video></div>`;
            break;
        case 'pdf':
            container.innerHTML += `
                <div class="pdf-container">
                    <div class="pdf-toolbar">
                        <a href="${prefixRootPath(item.value)}" target="_blank" rel="noopener" class="pdf-open">${getLocalizedValue(data.openPdf) || 'Open PDF separately'}</a>
                    </div>
                    <iframe src="${prefixRootPath(item.value)}" class="pdf-frame" loading="lazy"></iframe>
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

function createGallery(container, images) {
    if (!Array.isArray(images) || images.length === 0) return;

    let galleryHtml = `
        <div class="gallery-container">
            <img src="${prefixRootPath(images[0])}" alt="Gallery Image" class="gallery-main-image">
            <button class="gallery-nav-button left">&lt;</button>
            <button class="gallery-nav-button right">&gt;</button>
            <div class="gallery-thumbnails">
    `;

    images.forEach((image, index) => {
        galleryHtml += `<img src="${prefixRootPath(image)}" alt="Thumbnail" class="gallery-thumbnail${index === 0 ? ' active' : ''}" data-index="${index}">`;
    });

    galleryHtml += `
            </div>
        </div>
        <div class="gallery-zoom-overlay">
            <img src="" alt="Zoom Image" class="gallery-zoom-image">
        </div>
    `;

    container.innerHTML += galleryHtml;
}

function initializeGallery() {
    const mainImage = document.querySelector('.gallery-main-image');
    const thumbnails = document.querySelectorAll('.gallery-thumbnail');
    const leftButton = document.querySelector('.gallery-nav-button.left');
    const rightButton = document.querySelector('.gallery-nav-button.right');
    const zoomOverlay = document.querySelector('.gallery-zoom-overlay');
    const zoomImage = document.querySelector('.gallery-zoom-image');

    if (!mainImage || !leftButton || !rightButton || !zoomOverlay || !zoomImage || thumbnails.length === 0) {
        return;
    }

    let currentIndex = 0;

    function updateMainImage(index) {
        const newSrc = thumbnails[index].src;
        mainImage.src = newSrc;
        zoomImage.src = newSrc;
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        thumbnails[index].classList.add('active');
        currentIndex = index;
    }

    thumbnails.forEach((thumb, index) => {
        thumb.addEventListener('click', () => updateMainImage(index));
    });

    leftButton.addEventListener('click', () => {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : thumbnails.length - 1;
        updateMainImage(newIndex);
    });

    rightButton.addEventListener('click', () => {
        const newIndex = currentIndex < thumbnails.length - 1 ? currentIndex + 1 : 0;
        updateMainImage(newIndex);
    });

    mainImage.addEventListener('click', () => {
        zoomOverlay.classList.add('active');
    });

    zoomOverlay.addEventListener('click', () => {
        zoomOverlay.classList.remove('active');
    });
}
