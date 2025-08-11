document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing loadAllPublications');

    // Parse URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const initialTypes = urlParams.get('types') ? urlParams.get('types').split(',') : [];
    const initialTags = urlParams.get('tags') ? urlParams.get('tags').split(',') : [];
    const initialSort = urlParams.get('sort') || 'newest';

    console.log(`Initial URL params: types=${initialTypes}, tags=${initialTags}, sort=${initialSort}`);

    loadAllPublications(`json/${currentLanguage}.json`, initialTypes, initialTags, initialSort);
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
function filterItems(selectedTypes, selectedTags) {
    currentTypes = selectedTypes;
    currentTags = selectedTags;
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
    console.log(`Rendering articles: types=${types}, tags=${tags}, sortOrder=${sortOrder}`);
    const contentGrid = document.querySelector('.content-grid');
    contentGrid.innerHTML = ''; // Clear existing content

    const allItems = ['news', 'article', 'opinion']
        .flatMap(itemType => data[itemType]
            .filter(item => item.visible === "yes")
            .map(item => ({ ...item, type: itemType })))
        .filter(item => {
            const matchesType = types.length === 0 || types.includes(item.type);
            const itemTags = item.tags || [];
            const matchesTags = tags.length === 0 || tags.every(tag => itemTags.includes(tag));
            return matchesType && matchesTags;
        })
        .sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
        });

    allItems.forEach(item => {
        const articleElement = document.createElement('article');
        articleElement.classList.add(`${item.type}-item`);
        articleElement.setAttribute('data-type', item.type);
        articleElement.setAttribute('data-tags', item.tags ? item.tags.join(',') : '');

        const mediaContent = item.content.find(contentItem =>
            contentItem.type === 'main-image' || contentItem.type === 'main-video'
        );

        let mediaHTML = '';
        if (mediaContent.type === 'main-image') {
            mediaHTML = `<img src="${mediaContent.value}" alt="${item.title}">`;
        } else if (mediaContent.type === 'main-video') {
            mediaHTML = `<img src="${item.previewImage}" alt="${item.title}">`;
        }

        articleElement.setAttribute(
            'onclick',
            `location.href='article.html?id=${item.id}&type=${item.type}&lang=${currentLanguage}'`
        );

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
        contentGrid.appendChild(articleElement);
    });
}

function loadAllPublications(jsonFile, initialTypes = [], initialTags = [], initialSort = 'newest') {
    fetch(jsonFile)
        .then(response => response.json())
        .then(fetchedData => {
            data = fetchedData;
            const allPublicationsElement = document.querySelector('.all-publications-text p');
            allPublicationsElement.textContent = data.allPublications;

            const filterElement = document.querySelector('.filter-button');
            filterElement.innerHTML = `
                <div class="tag-filter-container">
                    <span>${data.filterByTags}</span>
                    <div class="tag-buttons"></div>
                </div>
                <div class="type-filter-container">
                    <span>${data.filterByType}</span>
                    <div class="type-buttons"></div>
                </div>
            `;

            // Load tags
            const tagButtonsContainer = document.querySelector('.tag-buttons');
            Object.keys(data.tags).forEach(tagKey => {
                const tagButton = document.createElement('button');
                tagButton.className = `tag-option${initialTags.includes(tagKey) ? ' active' : ''}`;
                tagButton.setAttribute('data-tag', tagKey);
                tagButton.textContent = `#${data.tags[tagKey]}`;
                tagButton.addEventListener('click', () => {
                    const index = currentTags.indexOf(tagKey);
                    if (index === -1) {
                        currentTags.push(tagKey);
                        console.log(`Tag selected: ${tagKey}`);
                    } else {
                        currentTags.splice(index, 1);
                        console.log(`Tag deselected: ${tagKey}`);
                    }
                    filterItems(currentTypes, currentTags);
                });
                tagButtonsContainer.appendChild(tagButton);
            });

            // Load types dynamically (excluding 'all')
            const typeButtonsContainer = document.querySelector('.type-buttons');
            ['news', 'article', 'opinion'].forEach(typeKey => {
                const typeButton = document.createElement('button');
                typeButton.className = `filter-option filter-option-${typeKey}${initialTypes.includes(typeKey) ? ' active' : ''}`;
                typeButton.setAttribute('data-type', typeKey);
                typeButton.textContent = data.types[typeKey];
                typeButton.addEventListener('click', () => {
                    const index = currentTypes.indexOf(typeKey);
                    if (index === -1) {
                        currentTypes.push(typeKey);
                        console.log(`Type selected: ${typeKey}`);
                    } else {
                        currentTypes.splice(index, 1);
                        console.log(`Type deselected: ${typeKey}`);
                    }
                    filterItems(currentTypes, currentTags);
                });
                typeButtonsContainer.appendChild(typeButton);
            });

            const sortElement = document.querySelector('.sort-button');
            sortElement.innerHTML = `
                <span>${data.sortBy}</span>
                <button class="sort-option${initialSort === 'newest' ? ' active' : ''}" data-sort="newest" onclick="sortItems('newest')">${data.newest}</button>
                <button class="sort-option${initialSort === 'oldest' ? ' active' : ''}" data-sort="oldest" onclick="sortItems('oldest')">${data.oldest}</button>
            `;

            // Initialize with URL params
            currentTypes = initialTypes;
            currentTags = initialTags;
            currentSort = initialSort;
            renderArticles(currentTypes, currentTags, currentSort);
            updateFilterButtons(); // Apply initial button states without re-rendering
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
    renderArticles(currentTypes, currentTags, currentSort);
    updateURL(currentTypes, currentTags, currentSort);
};