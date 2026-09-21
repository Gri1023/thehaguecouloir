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

function stripInlineFormatting(text) {
    return `${text}`.replace(/<\/?(?:b|strong|i|em|u|mark|small|sub|sup)\b[^>]*>/gi, '');
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing loadAllPublications');

    // Parse URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const initialTypes = urlParams.get('types') ? urlParams.get('types').split(',') : [];
    const initialTags = urlParams.get('tags') ? urlParams.get('tags').split(',') : [];
    const initialSort = urlParams.get('sort') || 'newest';
    const initialSearch = urlParams.get('search') || '';

    console.log(`Initial URL params: types=${initialTypes}, tags=${initialTags}, sort=${initialSort}, search=${initialSearch}`);

    rootPrefix = getRootPrefix();
    loadAllPublications(initialTypes, initialTags, initialSort, 'newest', initialSearch);
});

// Global variables for filter and sort state
let currentTypes = [];
let currentTags = [];
let currentSort = 'newest';
let currentSearch = '';
let searchDebounceTimer;
let currentTagUsageCounts = {};
let currentTagLookup = {};
let currentTagCategories = {};
let activeSuggestionIndex = -1;
let data; // Global data from JSON

// Function to update URL with current filter and sort state
function updateURL(types, tags, sort, search = currentSearch) {
    const params = new URLSearchParams();
    if (types.length > 0) {
        params.set('types', types.join(','));
    }
    if (tags.length > 0) {
        params.set('tags', tags.join(','));
    }
    params.set('sort', sort);
    if (search.trim()) {
        params.set('search', search.trim());
    }
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

    // Update button styles for tag filters (no reordering needed as they're grouped by category)
    const tagButtons = Array.from(document.querySelectorAll('.tag-option'));
    tagButtons.forEach(button => {
        if (currentTags.includes(button.getAttribute('data-tag'))) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
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

function buildTagLookupMaps(tagCategories = {}) {
    const tagLookup = {};
    const normalizedCategories = {};

    Object.entries(tagCategories).forEach(([categoryKey, category]) => {
        const categoryTags = category && category.tags && typeof category.tags === 'object'
            ? category.tags
            : {};
        normalizedCategories[categoryKey] = { ...category, tags: categoryTags };
        Object.assign(tagLookup, categoryTags);
    });

    return { tagLookup, tagCategories: normalizedCategories };
}

function getActiveTypeFilters() {
    return Array.from(document.querySelectorAll('.type-buttons .filter-option.active'))
        .map(button => button.dataset.type)
        .filter(Boolean);
}

function getActiveTagFilters() {
    return Array.from(document.querySelectorAll('.tag-option.active'))
        .map(button => button.dataset.tag)
        .filter(Boolean);
}

function hideTagSuggestions() {
    const suggestions = document.querySelector('.tag-suggestions');
    if (!suggestions) return;
    suggestions.hidden = true;
    suggestions.innerHTML = '';
    activeSuggestionIndex = -1;
}

function showTagSuggestions(query) {
    const suggestions = document.querySelector('.tag-suggestions');
    if (!suggestions || !data || query.trim().length < 2) {
        hideTagSuggestions();
        return;
    }

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = Object.keys(currentTagLookup)
        .filter(tagKey => {
            const tagLabel = getLocalizedValue(currentTagLookup[tagKey]);
            return (currentTagUsageCounts[tagKey] || 0) > 0 && `${tagKey} ${tagLabel}`.toLocaleLowerCase().includes(normalizedQuery);
        })
        .sort((a, b) => (currentTagUsageCounts[b] || 0) - (currentTagUsageCounts[a] || 0))
        .slice(0, 8);

    if (matches.length === 0) {
        hideTagSuggestions();
        return;
    }

    suggestions.innerHTML = `<div class="tag-suggestions-header">${currentLanguage === 'ru' ? 'Рекомендуемые теги' : 'Suggested tags'}</div>`;
    matches.forEach((tagKey, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tag-suggestion';
        button.dataset.tag = tagKey;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', index === activeSuggestionIndex ? 'true' : 'false');
        button.innerHTML = `<span>#${getLocalizedValue(currentTagLookup[tagKey])}</span><span class="tag-suggestion-count">(${currentTagUsageCounts[tagKey] || 0})</span>`;
        button.addEventListener('click', () => applySuggestedTag(tagKey));
        suggestions.appendChild(button);
    });

    suggestions.hidden = false;
    updateSuggestionHighlight();
}

function updateSuggestionHighlight() {
    document.querySelectorAll('.tag-suggestion').forEach((button, index) => {
        const isActive = index === activeSuggestionIndex;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
}

function applySuggestedTag(tagKey) {
    const searchInput = document.querySelector('.publication-search-input');
    if (searchInput) {
        currentSearch = searchInput.value;
    }
    currentTags = Array.from(new Set([...currentTags, tagKey]));
    updateFilterButtons();
    renderArticles(currentTypes, currentTags, currentSort, currentSearch);
    updateURL(currentTypes, currentTags, currentSort, currentSearch);
    hideTagSuggestions();
}

function applyFiltersFromUI() {
    currentTypes = getActiveTypeFilters();
    currentTags = getActiveTagFilters();
    console.log(`Applying filters from UI: types=${currentTypes}, selectedTags=${currentTags}`);

    updateFilterButtons();
    renderArticles(currentTypes, currentTags, currentSort, currentSearch);
    updateURL(currentTypes, currentTags, currentSort, currentSearch);
}

function filterItems(selectedTypes, selectedTags) {
    currentTypes = normalizeArray(selectedTypes);
    currentTags = normalizeArray(selectedTags);
    console.log(`Filtering items: types=${currentTypes}, selectedTags=${currentTags}`);

    updateFilterButtons();
    renderArticles(currentTypes, currentTags, currentSort, currentSearch);
    updateURL(currentTypes, currentTags, currentSort, currentSearch);
}

function collectSearchableStrings(value, strings = []) {
    if (typeof value === 'string') {
        strings.push(value);
    } else if (Array.isArray(value)) {
        value.forEach(item => collectSearchableStrings(item, strings));
    } else if (value && typeof value === 'object') {
        Object.values(value).forEach(item => collectSearchableStrings(item, strings));
    }
    return strings;
}

function getPublicationSearchText(item) {
    const strings = collectSearchableStrings(item.title);
    normalizeArray(item.tags).forEach(tagKey => {
        strings.push(tagKey);
        if (currentTagLookup[tagKey]) {
            strings.push(...collectSearchableStrings(currentTagLookup[tagKey]));
        }
    });
    strings.push(...collectSearchableStrings(item.content));
    return strings.join(' ').toLocaleLowerCase();
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

function renderArticles(types = [], tags = [], sortOrder = 'newest', searchQuery = '') {
    if (!data) {
        console.warn('Data not loaded yet');
        return;
    }
    types = normalizeArray(types);
    if (!Array.isArray(tags)) {
        console.warn('renderArticles: tags is not an array before normalization', tags, typeof tags);
    }
    tags = normalizeArray(tags);
    const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
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
        const matchesSearch = !normalizedSearchQuery || getPublicationSearchText(item).includes(normalizedSearchQuery);
        return matchesType && matchesTags && matchesSearch;
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

        // 1. First, look for the designated 'main' media items
        let mediaContent = item.content ? item.content.find(contentItem =>
            contentItem.type === 'main-image' || contentItem.type === 'main-video'
        ) : undefined;

        // 2. Fallback: If no main media is found, find the first standard image or video
        if (!mediaContent && item.content) {
            mediaContent = item.content.find(contentItem =>
                contentItem.type === 'image' || contentItem.type === 'video'
            );
        }

        // 3. Generate HTML based on what type of asset was found
        let mediaHTML = '';
        if (mediaContent) {
            if (mediaContent.type === 'main-image' || mediaContent.type === 'image') {
                mediaHTML = `<img src="${prefixRootPath(getLocalizedValue(mediaContent.value) || mediaContent.value || '')}" alt="${getLocalizedValue(item.title)}">`;
            } else if (mediaContent.type === 'main-video' || mediaContent.type === 'video') {
                mediaHTML = `<img src="${prefixRootPath(getLocalizedValue(item.previewImage) || item.previewImage || '')}" alt="${getLocalizedValue(item.title)}">`;
            }
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
                let textValue = stripInlineFormatting(getLocalizedValue(textItem.value || ''));

                // 1. Strip Markdown links: converts "[Text](URL)" into plain "Text"
                textValue = textValue.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

                // 2. Clean up spoiler tags if they exist: converts "||hidden||" into "hidden"
                textValue = textValue.replace(/\|\|(.+?)\|\|/g, '$1');

                // 3. Truncate now that the raw formatting syntax is gone
                displayTitle = textValue.length > 100 ? textValue.slice(0, 97) + '...' : textValue;
            }
        }

        const displayTitleText = stripInlineFormatting(displayTitle || '');

        articleElement.innerHTML = `
            <a>
                ${mediaHTML}
                <div class="content">
                    <p class="${item.type}">${getLocalizedValue(data.types[item.type])}</p>
                    <h3 class="title">${displayTitleText}</h3>
                    <p class="date">${timeAgo(item.date)}</p>
                </div>
            </a>
        `;
        contentGrid.appendChild(articleElement);
    });
}

function loadAllPublications(firstArg = [], secondArg = [], thirdArg = [], fourthArg = 'newest', fifthArg = '') {
    // Support both old-style and new-style argument orders:
    //  old: loadAllPublications(jsonFile, initialTypes, initialTags, initialSort)
    //  new: loadAllPublications(initialTypes, initialTags, initialSort)
    let jsonFile = firstArg;
    let initialTypes = secondArg;
    let initialTags = thirdArg;
    let initialSort = fourthArg;
    let initialSearch = fifthArg;

    const isNewStyle = Array.isArray(firstArg) && Array.isArray(secondArg) && (typeof thirdArg === 'string' || thirdArg === undefined);
    if (isNewStyle) {
        initialTypes = firstArg;
        initialTags = secondArg;
        initialSort = typeof thirdArg === 'string' ? thirdArg : fourthArg;
        initialSearch = fifthArg;
        jsonFile = undefined;
    }

    // jsonFile is kept for backwards compatibility but ignored when fetchSiteData is available.
    const dataPromise = (typeof window.fetchSiteData === 'function')
        ? window.fetchSiteData()
        : fetch(jsonFile).then(r => r.json());

    dataPromise.then(fetchedData => {
        data = fetchedData;

        const tagMaps = buildTagLookupMaps(data.tagCategories);
        currentTagLookup = tagMaps.tagLookup;
        currentTagCategories = tagMaps.tagCategories;

        const declaredTagKeys = new Set(Object.keys(currentTagLookup));
        const usedTagKeys = new Set();
        const missingTagKeys = new Set();

        // Calculate tag usage counts for visible articles
        const tagUsageCounts = {};
        ['news', 'article', 'opinion', 'academic', 'live-note'].forEach(itemType => {
            const items = Array.isArray(data[itemType]) ? data[itemType] : [];
            items.forEach(item => {
                if (item.visible === 'yes' && isVisibleForCurrentLanguage(item)) {
                    normalizeArray(item.tags).forEach(tagKey => {
                        if (tagKey) {
                            usedTagKeys.add(tagKey);
                            if (!declaredTagKeys.has(tagKey)) {
                                missingTagKeys.add(tagKey);
                            }
                            tagUsageCounts[tagKey] = (tagUsageCounts[tagKey] || 0) + 1;
                        }
                    });
                }
            });
        });
        if (missingTagKeys.size > 0) {
            console.warn(
                `Undeclared tags found in data: ${Array.from(missingTagKeys).join(', ')}`
            );
        }

        currentTagUsageCounts = tagUsageCounts;

        // Create new structure with containers
        const filterElement = document.querySelector('.filter-button');

        // First container: Title + Filter by tags (with categories)
        const tagsContainerHTML = createTagsContainerHTML(data, tagUsageCounts, initialTags);

        // Second container: Filter by type + Sort by (side by side) - in its own container
        const typeSortContainerHTML = createTypeSortContainerHTML(data, initialTypes, initialSort);

        filterElement.innerHTML = tagsContainerHTML + typeSortContainerHTML;

        const searchInput = document.querySelector('.publication-search-input');
        searchInput.addEventListener('input', () => {
            showTagSuggestions(searchInput.value);
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                currentSearch = searchInput.value;
                renderArticles(currentTypes, currentTags, currentSort, currentSearch);
                updateURL(currentTypes, currentTags, currentSort, currentSearch);
            }, 180);
        });
        searchInput.addEventListener('keydown', event => {
            const suggestionButtons = Array.from(document.querySelectorAll('.tag-suggestion'));
            if (event.key === 'Escape') {
                hideTagSuggestions();
                return;
            }
            if (suggestionButtons.length === 0) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                activeSuggestionIndex = (activeSuggestionIndex + direction + suggestionButtons.length) % suggestionButtons.length;
                updateSuggestionHighlight();
            } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
                event.preventDefault();
                applySuggestedTag(suggestionButtons[activeSuggestionIndex].dataset.tag);
            }
        });
        document.addEventListener('click', event => {
            if (!event.target.closest('.publication-search-container')) {
                hideTagSuggestions();
            }
        });

        // Attach event listeners to dynamically created tag buttons
        document.querySelectorAll('.tag-option').forEach(button => {
            button.addEventListener('click', () => {
                button.classList.toggle('active');
                console.log(`Tag toggled: ${button.dataset.tag}, active=${button.classList.contains('active')}`);
                applyFiltersFromUI();
            });
        });

        const advancedFilters = document.querySelector('.advanced-filters');
        const advancedFiltersArrow = advancedFilters.querySelector('.advanced-filters-arrow');
        advancedFilters.addEventListener('toggle', () => {
            advancedFilters.classList.toggle('open', advancedFilters.open);
            advancedFiltersArrow.classList.toggle('open', advancedFilters.open);
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

        // Initialize with URL params
        currentTypes = normalizeArray(initialTypes);
        currentTags = normalizeArray(initialTags);
        currentSort = initialSort;
        currentSearch = initialSearch;
        searchInput.value = currentSearch;
        renderArticles(currentTypes, currentTags, currentSort, currentSearch);
        updateFilterButtons(); // Apply initial button states without re-rendering
        // Ensure UI state and filter state are in sync after initial load.
        applyFiltersFromUI();
    });

    // Helper function to create tags container HTML with categories
    function createTagsContainerHTML(data, tagUsageCounts, initialTags) {
        const tagCategories = currentTagCategories;
        let html = `
        <div class="publications-header-container">
            <div class="all-publications-text">
                <p>${getLocalizedValue(data.allPublications)}</p>
            </div>
            <div class="publication-search-container">
                <div class="publication-search-line">
                    <svg class="publication-search-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="6.5"></circle>
                        <path d="m16 16 5 5"></path>
                    </svg>
                    <input class="publication-search-input" type="search" placeholder="Search by title or tags..." aria-label="Search publications" autocomplete="off" aria-controls="tag-suggestions">
                </div>
                <div class="tag-suggestions" id="tag-suggestions" role="listbox" aria-label="${currentLanguage === 'ru' ? 'Рекомендуемые теги' : 'Suggested tags'}" hidden></div>
            </div>
            <details class="advanced-filters">
                <summary><span class="advanced-filters-arrow" aria-hidden="true">►</span>${getLocalizedValue(data.filterByTags) || 'Advanced Filters'}</summary>
                <div class="advanced-filters-panel" id="filterMenu">
                    <div class="advanced-filters-panel-inner">
                        <div class="tag-filter-container-with-categories">
                            <div class="tag-categories">
    `;

        // Order of categories
        const categoryOrder = ['regions', 'countries', 'people', 'topics'];

        categoryOrder.forEach(catKey => {
            const category = tagCategories[catKey];
            if (!category) return;

            const categoryTags = Object.keys(category.tags)
                .filter(tagKey => tagUsageCounts[tagKey] > 0);
            if (categoryTags.length === 0) return;

            // Sort tags by usage count (descending)
            const sortedTags = categoryTags
                .map(tagKey => ({
                    tagKey,
                    count: tagUsageCounts[tagKey] || 0
                }))
                .sort((a, b) => b.count - a.count)
                .map(item => item.tagKey);

            html += `
            <div class="tag-category">
                <span class="tag-category-title">${getLocalizedValue(category)}</span>
                <div class="tag-category-tags">
        `;

            sortedTags.forEach(tagKey => {
                const tagButton = createTagButtonHTML(tagKey, category.tags[tagKey], tagUsageCounts[tagKey], initialTags.includes(tagKey));
                html += tagButton;
            });

            html += `
                </div>
            </div>
        `;
        });

        html += `
                            </div>
                        </div>
                    </div>
                </div>
            </details>
            </div>
        </div>
    `;

        return html;
    }

    // Helper function to create individual tag button HTML
    function createTagButtonHTML(tagKey, tagLabel, tagCount, isActive) {
        const tagName = getLocalizedValue(tagLabel);
        const activeClass = isActive ? ' active' : '';
        return `
        <button class="tag-option${activeClass}" data-tag="${tagKey}">
            #${tagName}  ${tagCount}
        </button>
    `;
    }

    // Helper function to create type filter + sort container HTML
    function createTypeSortContainerHTML(data, initialTypes, initialSort) {
        return `
        <div class="type-sort-container-wrapper">
            <div class="type-sort-container">
                <div class="type-filter-container">
                    <span class="filter-label">${getLocalizedValue(data.filterByType)}</span>
                    <div class="type-buttons"></div>
                </div>
                <div class="sort-container">
                    <span class="filter-label">${getLocalizedValue(data.sortBy)}</span>
                    <div class="sort-buttons">
                        <button class="sort-option${initialSort === 'newest' ? ' active' : ''}" data-sort="newest" onclick="sortItems('newest')">${getLocalizedValue(data.newest)}</button>
                        <button class="sort-option${initialSort === 'oldest' ? ' active' : ''}" data-sort="oldest" onclick="sortItems('oldest')">${getLocalizedValue(data.oldest)}</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    }
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