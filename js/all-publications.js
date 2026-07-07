let rootPrefix = '';

function getRootPrefix() {
    const path = window.location.pathname;
    const subpages = ['article', 'about', 'all-publications', 'bias', 'your-data', 'editor'];
    return subpages.some(folder => path.includes(`/${folder}/`) || path.endsWith(`/${folder}`) || path.endsWith(`/${folder}/`)) ? '../' : '';
}

// R2_BASE_URL is declared once in base.js (loaded first on every page) and exposed on window.

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
    console.log('Page loaded, initializing loadAllPublications');

    // Parse URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const initialTypes = urlParams.get('types') ? urlParams.get('types').split(',') : [];
    const initialTags = urlParams.get('tags') ? urlParams.get('tags').split(',') : [];
    const initialSort = urlParams.get('sort') || 'newest';

    console.log(`Initial URL params: types=${initialTypes}, tags=${initialTags}, sort=${initialSort}`);

    rootPrefix = getRootPrefix();
    loadAllPublications(initialTypes, initialTags, initialSort);
});

// Global variables for filter and sort state
let currentTypes = [];
let currentTags = [];
let currentSort = 'newest';
let data; // Global data from JSON

// Function to update URL with current filter and sort state
function updateURL(types, tags, sort) {
    const params = new URLSearchParams();
    if (types.length > 0) {
        params.set('types', types.join(','));
    }
    if (tags.length > 0) {
        params.set('tags', tags.join(','));
    }
    params.set('sort', sort);
    params.set('lang', currentLanguage);
    const newURL = `${window.location.pathname}?${params.toString()}`;
    history.pushState({}, '', newURL);
    console.log(`URL updated: ${newURL}`);
}

// Function to update filter buttons (type and tags) styles and reorder
function updateFilterButtons() {
    // Update button styles for type filters and reorder
    const typeButtonsContainer = document.querySelector('.type-buttons');
    if (typeButtonsContainer) {
        const typeButtons = Array.from(document.querySelectorAll('.filter-option'));
        typeButtons.forEach(button => {
            if (currentTypes.includes(button.getAttribute('data-type'))) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        // Reorder type buttons: active first
        const sortedTypeButtons = typeButtons.sort((a, b) => {
            const aActive = currentTypes.includes(a.getAttribute('data-type')) ? -1 : 1;
            const bActive = currentTypes.includes(b.getAttribute('data-type')) ? -1 : 1;
            return aActive - bActive;
        });
        typeButtonsContainer.innerHTML = '';
        sortedTypeButtons.forEach(button => typeButtonsContainer.appendChild(button));
    } else {
        console.warn('typeButtonsContainer not found');
    }

    // Update button styles for tag filters and reorder
    const tagButtonsContainer = document.querySelector('.tag-buttons');
    if (tagButtonsContainer) {
        const tagButtons = Array.from(document.querySelectorAll('.tag-option'));
        tagButtons.forEach(button => {
            if (currentTags.includes(button.getAttribute('data-tag'))) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        // Reorder tag buttons: active first
        const sortedTagButtons = tagButtons.sort((a, b) => {
            const aActive = currentTags.includes(a.getAttribute('data-tag')) ? -1 : 1;
            const bActive = currentTags.includes(b.getAttribute('data-tag')) ? -1 : 1;
            return aActive - bActive;
        });
        tagButtonsContainer.innerHTML = '';
        sortedTagButtons.forEach(button => tagButtonsContainer.appendChild(button));
    } else {
        console.warn('tagButtonsContainer not found');
    }
}

// Function to filter items by types and tags
function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (!value) {
        return [];
    }
    if (typeof value === 'string') {
        return value.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [value];
}

function getActiveTypeFilters() {
    return Array.from(document.querySelectorAll('.type-buttons .filter-option.active'))
        .map(button => button.dataset.type)
        .filter(Boolean);
}

function getActiveTagFilters() {
    return Array.from(document.querySelectorAll('.tag-buttons .tag-option.active'))
        .map(button => button.dataset.tag)
        .filter(Boolean);
}

function applyFiltersFromUI() {
    currentTypes = getActiveTypeFilters();
    currentTags = getActiveTagFilters();
    console.log(`Applying filters from UI: types=${currentTypes}, selectedTags=${currentTags}`);

    updateFilterButtons();
    renderArticles(currentTypes, currentTags, currentSort);
    updateURL(currentTypes, currentTags, currentSort);
}

function filterItems(selectedTypes, selectedTags) {
    currentTypes = normalizeArray(selectedTypes);
    currentTags = normalizeArray(selectedTags);
    console.log(`Filtering items: types=${currentTypes}, selectedTags=${currentTags}`);

    updateFilterButtons();
    renderArticles(currentTypes, currentTags, currentSort);
    updateURL(currentTypes, currentTags, currentSort);
}

function timeAgo(dateString) {
    const articleDate = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - articleDate) / 1000);

    const intervals = [
        { labelEn: 'year', labelRu: ['год', 'года', 'лет'], seconds: 31536000 },
        { labelEn: 'month', labelRu: ['месяц', 'месяца', 'месяцев'], seconds: 2592000 },
        { labelEn: 'day', labelRu: ['день', 'дня', 'дней'], seconds: 86400 },
        { labelEn: 'hour', labelRu: ['час', 'часа', 'часов'], seconds: 3600 },
        { labelEn: 'minute', labelRu: ['минута', 'минуты', 'минут'], seconds: 60 },
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            if (currentLanguage === 'ru') {
                const labelRu = pluralizeRu(count, ...interval.labelRu);
                return `${count} ${labelRu} назад`;
            } else {
                const labelEn = interval.labelEn + (count !== 1 ? 's' : '');
                return `${count} ${labelEn} ago`;
            }
        }
    }
    return currentLanguage === 'ru' ? 'только что' : 'just now';
}

function renderArticles(types = [], tags = [], sortOrder = 'newest') {
    if (!data) {
        console.warn('Data not loaded yet');
        return;
    }
    types = normalizeArray(types);
    if (!Array.isArray(tags)) {
        console.warn('renderArticles: tags is not an array before normalization', tags, typeof tags);
    }
    tags = normalizeArray(tags);
    if (!Array.isArray(tags)) {
        console.error('renderArticles: tags is still not an array after normalization', tags);
    }
    console.log(`Rendering articles: types=${types}, tags=${tags}, sortOrder=${sortOrder}`);
    const contentGrid = document.querySelector('.content-grid');
    contentGrid.innerHTML = ''; // Clear existing content

    const sectionCounts = ['news', 'article', 'opinion', 'academic', 'live-note'].map(itemType => ({
        itemType,
        count: Array.isArray(data[itemType]) ? data[itemType].length : 0,
        type: Array.isArray(data[itemType]) ? 'array' : typeof data[itemType]
    }));
    console.log('all-publications data section counts:', sectionCounts);

    const allItems = ['news', 'article', 'opinion', 'academic', 'live-note']
        .flatMap(itemType => (Array.isArray(data[itemType]) ? data[itemType] : [])
            .filter(item => item.visible === 'yes' && isVisibleForCurrentLanguage(item))
            .map(item => ({ ...item, type: itemType })));

    console.log('all-publications visible items count before tag/type filter:', allItems.length);

    const filteredItems = allItems.filter(item => {
        const matchesType = types.length === 0 || types.includes(item.type);
        const itemTags = Array.isArray(item.tags) ? item.tags : [];
        const matchesTags = tags.length === 0 || tags.every(tag => itemTags.includes(tag));
        return matchesType && matchesTags;
    });

    console.log('all-publications filtered items count:', filteredItems.length);

    const sortedItems = filteredItems.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    sortedItems.forEach(item => {
        const articleElement = document.createElement('article');
        articleElement.classList.add(`${item.type}-item`);
        articleElement.setAttribute('data-type', item.type);
        articleElement.setAttribute('data-tags', item.tags ? item.tags.join(',') : '');

        const mediaContent = item.content ? item.content.find(contentItem =>
            contentItem.type === 'main-image' || contentItem.type === 'main-video'
        ) : undefined;

        let mediaHTML = '';
        if (mediaContent && mediaContent.type === 'main-image') {
            mediaHTML = `<img src="${prefixRootPath(getLocalizedValue(mediaContent.value) || mediaContent.value || '')}" alt="${getLocalizedValue(item.title)}">`;
        } else if (mediaContent && mediaContent.type === 'main-video') {
            mediaHTML = `<img src="${prefixRootPath(getLocalizedValue(item.previewImage) || item.previewImage || '')}" alt="${getLocalizedValue(item.title)}">`;
        }

        articleElement.setAttribute(
            'onclick',
            `location.href='${rootPrefix}article/?id=${item.id}&type=${item.type}&lang=${currentLanguage}'`
        );

        // choose title or generate from live-note text
        let displayTitle = getLocalizedValue(item.title);
        if (!displayTitle && item.type === 'live-note' && item.content) {
            const textItem = item.content.find(c => c.type === 'text');
            if (textItem) {
                const textValue = getLocalizedValue(textItem.value || '');
                displayTitle = textValue.length > 100 ? textValue.slice(0, 97) + '...' : textValue;
            }
        }

        articleElement.innerHTML = `
            <a>
                ${mediaHTML}
                <div class="content">
                    <p class="${item.type}">${getLocalizedValue(data.types[item.type])}</p>
                    <h3 class="title">${displayTitle || ''}</h3>
                    <p class="date">${timeAgo(item.date)}</p>
                </div>
            </a>
        `;
        contentGrid.appendChild(articleElement);
    });
}

function loadAllPublications(firstArg = [], secondArg = [], thirdArg = [], fourthArg = 'newest') {
    // Support both old-style and new-style argument orders:
    //  old: loadAllPublications(jsonFile, initialTypes, initialTags, initialSort)
    //  new: loadAllPublications(initialTypes, initialTags, initialSort)
    let jsonFile = firstArg;
    let initialTypes = secondArg;
    let initialTags = thirdArg;
    let initialSort = fourthArg;

    const isNewStyle = Array.isArray(firstArg) && Array.isArray(secondArg) && (typeof thirdArg === 'string' || thirdArg === undefined);
    if (isNewStyle) {
        initialTypes = firstArg;
        initialTags = secondArg;
        initialSort = typeof thirdArg === 'string' ? thirdArg : fourthArg;
        jsonFile = undefined;
    }

    // jsonFile is kept for backwards compatibility but ignored when fetchSiteData is available.
    const dataPromise = (typeof window.fetchSiteData === 'function')
        ? window.fetchSiteData()
        : fetch(jsonFile).then(r => r.json());

    dataPromise.then(fetchedData => {
        data = fetchedData;

        const declaredTagKeys = new Set(Object.keys(data.tags || {}));
        const usedTagKeys = new Set();
        const missingTagKeys = new Set();
        ['news', 'article', 'opinion', 'academic', 'live-note'].forEach(itemType => {
            const items = Array.isArray(data[itemType]) ? data[itemType] : [];
            items.forEach(item => {
                normalizeArray(item.tags).forEach(tagKey => {
                    if (tagKey) {
                        usedTagKeys.add(tagKey);
                        if (!declaredTagKeys.has(tagKey)) {
                            missingTagKeys.add(tagKey);
                        }
                    }
                });
            });
        });
        if (missingTagKeys.size > 0) {
            console.warn(
                `Undeclared tags found in data: ${Array.from(missingTagKeys).join(', ')}`
            );
        }

        const allPublicationsElement = document.querySelector('.all-publications-text p');
        allPublicationsElement.textContent = getLocalizedValue(data.allPublications);

        const filterElement = document.querySelector('.filter-button');
        filterElement.innerHTML = `
                <div class="tag-filter-container">
                    <span>${getLocalizedValue(data.filterByTags)}</span>
                    <div class="tag-buttons"></div>
                </div>
                <div class="type-filter-container">
                    <span>${getLocalizedValue(data.filterByType)}</span>
                    <div class="type-buttons"></div>
                </div>
            `;

        // Load tags
        const tagButtonsContainer = document.querySelector('.tag-buttons');
        Object.keys(data.tags).forEach(tagKey => {
            const tagButton = document.createElement('button');
            tagButton.className = `tag-option${initialTags.includes(tagKey) ? ' active' : ''}`;
            tagButton.setAttribute('data-tag', tagKey);
            tagButton.textContent = `#${getLocalizedValue(data.tags[tagKey])}`;
            tagButton.addEventListener('click', () => {
                tagButton.classList.toggle('active');
                console.log(`Tag toggled: ${tagKey}, active=${tagButton.classList.contains('active')}`);
                applyFiltersFromUI();
            });
            tagButtonsContainer.appendChild(tagButton);
        });

        // Load types dynamically (excluding 'all')
        const typeButtonsContainer = document.querySelector('.type-buttons');
        ['news', 'article', 'opinion', 'academic', 'live-note'].forEach(typeKey => {
            const typeButton = document.createElement('button');
            typeButton.className = `filter-option filter-option-${typeKey}${initialTypes.includes(typeKey) ? ' active' : ''}`;
            typeButton.setAttribute('data-type', typeKey);
            typeButton.textContent = getLocalizedValue(data.types[typeKey]);
            typeButton.addEventListener('click', () => {
                typeButton.classList.toggle('active');
                console.log(`Type toggled: ${typeKey}, active=${typeButton.classList.contains('active')}`);
                applyFiltersFromUI();
            });
            typeButtonsContainer.appendChild(typeButton);
        });

        const sortElement = document.querySelector('.sort-button');
        sortElement.innerHTML = `
                <span>${getLocalizedValue(data.sortBy)}</span>
                <button class="sort-option${initialSort === 'newest' ? ' active' : ''}" data-sort="newest" onclick="sortItems('newest')">${getLocalizedValue(data.newest)}</button>
                <button class="sort-option${initialSort === 'oldest' ? ' active' : ''}" data-sort="oldest" onclick="sortItems('oldest')">${getLocalizedValue(data.oldest)}</button>
            `;

        // Initialize with URL params
        currentTypes = normalizeArray(initialTypes);
        currentTags = normalizeArray(initialTags);
        currentSort = initialSort;
        renderArticles(currentTypes, currentTags, currentSort);
        updateFilterButtons(); // Apply initial button states without re-rendering
        // Ensure UI state and filter state are in sync after initial load.
        applyFiltersFromUI();
    });
}

// Update filter and sort buttons' state
const updateButtonState = (selector, activeValue) => {
    const buttons = document.querySelectorAll(selector);
    buttons.forEach(button => {
        if (button.dataset.type === activeValue || button.dataset.sort === activeValue) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
};

// Sort items
window.sortItems = (sortOrder) => {
    currentSort = sortOrder;
    updateButtonState('.sort-option', sortOrder);
    applyFiltersFromUI();
    updateURL(currentTypes, currentTags, currentSort);
};