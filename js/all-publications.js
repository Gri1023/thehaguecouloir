document.addEventListener('DOMContentLoaded', () => {
    filterItems('all'); // Default to showing all items

    loadAllPublications(`json/${currentLanguage}.json`);
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
    const buttons = document.querySelectorAll('.filter-option');
    buttons.forEach(button => {
        if (button.getAttribute('data-type') === type) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
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


function loadAllPublications(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const allPublicationsElement = document.querySelector('.all-publications-text p');
            allPublicationsElement.textContent = data.allPublications;

            const filterElement = document.querySelector('.filter-button');
            filterElement.innerHTML = `
                <span>${data.filterBy}</span>
                <button class="filter-option active" data-type="all" onclick="filterItems('all')">${data.types.all}</button>
                <button class="filter-option" data-type="news" onclick="filterItems('news')">${data.types.news}</button>
                <button class="filter-option" data-type="article" onclick="filterItems('article')">${data.types.article}</button>
                <button class="filter-option" data-type="opinion" onclick="filterItems('opinion')">${data.types.opinion}</button>
            `;

            const sortElement = document.querySelector('.sort-button');
            sortElement.innerHTML = `
            <span>${data.sortBy}</span>
                <button class="sort-option active" data-sort="newest" onclick="sortItems('newest')">${data.newest}</button>
                <button class="sort-option" data-sort="oldest" onclick="sortItems('oldest')">${data.oldest}</button>
            `;

            const renderArticles = (type = 'all', sortOrder = 'newest') => {
                const contentGrid = document.querySelector('.content-grid');
                contentGrid.innerHTML = ''; // Clear existing content

                const allItems = ['news', 'article', 'opinion']
                    .flatMap(itemType => data[itemType]
                        .filter(item => item.visible === "yes")
                        .map(item => ({ ...item, type: itemType })))
                    .filter(item => type === 'all' || item.type === type)
                    .sort((a, b) => {
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
                    });

                allItems.forEach(item => {
                    const articleElement = document.createElement('article');
                    articleElement.classList.add(`${item.type}-item`);
                    articleElement.setAttribute('data-type', item.type);

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
            };

            // Default render with "all" filter and "newest" sort order
            let currentFilter = 'all';
            let currentSort = 'newest';
            renderArticles(currentFilter, currentSort);

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

            // Filter items
            window.filterItems = (type) => {
                currentFilter = type;
                updateButtonState('.filter-option', type);
                renderArticles(currentFilter, currentSort);
            };

            // Sort items
            window.sortItems = (sortOrder) => {
                currentSort = sortOrder;
                updateButtonState('.sort-option', sortOrder);
                renderArticles(currentFilter, currentSort);
            };
        });
}
