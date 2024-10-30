    document.addEventListener('DOMContentLoaded', () => {
        filterItems('all'); // Default to showing all items

        // Load content for index.html
        if (document.querySelector('.content-grid')) {
            loadContent(`/json/${currentLanguage}.json`);
        }
    });


function pluralizeRu(number, one, few, many) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) {
        return one;
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return few;
    } else {
        return many;
    }
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

    // Function to load content from JSON file and update the highlighted article
function loadContent(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const contentGrid = document.getElementById('content-grid');
            const highlightedArticle = document.getElementById('highlighted-article');
            contentGrid.innerHTML = '';

            const highlightedArticleId = data.highlightedArticleId;
            let featuredItem;

            ['news', 'article', 'opinion'].forEach(type => {
                const item = data[type].find(article => article.id == highlightedArticleId);
                if (item) {
                    featuredItem = { ...item, type };
                }
            });

            if (featuredItem) {
                const articleTypeClass = featuredItem.type;
                const articleLink = `article.html?id=${featuredItem.id}&type=${featuredItem.type}&lang=${currentLanguage}`;

                const mediaContent = featuredItem.content.find(contentItem => 
                    contentItem.type === 'main-image' || contentItem.type === 'main-video'
                );

                // Check if highlighted article is a video or an image
                if (mediaContent.type === 'main-image') {
                    highlightedArticle.style.backgroundImage = `url('${mediaContent.value}')`;
                } else if (mediaContent.type === 'main-video') {
                    highlightedArticle.innerHTML += `
                        <video class="video-preview" src="${mediaContent.value}" muted autoplay loop></video>
                        <div class="video-indicator">
                            <span class="dot"></span> ${data.videoText[currentLanguage]}
                        </div>
                    `;
                }

                highlightedArticle.querySelector('.highlighted-title').innerHTML = `<a href="${articleLink}">${featuredItem.title}</a>`;

                const highlightedTypeElement = highlightedArticle.querySelector('.highlighted-type');
                highlightedTypeElement.textContent = data.types[featuredItem.type];
                highlightedTypeElement.className = `highlighted-type ${articleTypeClass}`;
                
                // Convert and display time ago
                highlightedArticle.querySelector('.highlighted-date').textContent = timeAgo(featuredItem.date);

                const highlightedButton = highlightedArticle.querySelector('.highlighted-button');
                highlightedButton.innerHTML = `<a href="${articleLink}" class="highlighted-button-link">${data.readMoreButton}</a>`;

                const moreInfoElement = document.querySelector('.more-info p');
                moreInfoElement.textContent = data.moreInfoText;
            } else {
                console.error('Highlighted article not found');
            }

            const allPublicationsElement = document.querySelector('.all-publications p');
            allPublicationsElement.textContent = data.allPublications;

            const filterElement = document.querySelector('.sort-button');
            filterElement.innerHTML = `
                <span>${data.filterBy}</span>
                <button class="sort-option active" onclick="filterItems('all')">${data.types.all}</button>
                <button class="sort-option" data-type="news" onclick="filterItems('news')">${data.types.news}</button>
                <button class="sort-option" data-type="article" onclick="filterItems('article')">${data.types.article}</button>
                <button class="sort-option" data-type="opinion" onclick="filterItems('opinion')">${data.types.opinion}</button>
            `;

            const allItems = ['news', 'article', 'opinion']
                .flatMap(type => data[type]
                    .filter(item => item.visible === "yes")
                    .map(item => ({ ...item, type })))
                .sort((a, b) => new Date(b.date) - new Date(a.date));

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

                articleElement.innerHTML = `
                    <a href="article.html?id=${item.id}&type=${item.type}&lang=${currentLanguage}">
                        ${mediaHTML}
                        <div class="content">
                            <p class="${item.type}">${data.types[item.type]}</p>
                            <p class="date">${timeAgo(item.date)}</p>
                            <h3>${item.title}</h3>
                        </div>
                    </a>
                `;
                contentGrid.appendChild(articleElement);
            });
        })
        .catch(error => console.error('Error loading content:', error));
}