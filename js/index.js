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

    // Function to load content from JSON file and update the highlighted article
function loadContent(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const contentGrid = document.getElementById('content-grid');
            const highlightedArticle = document.getElementById('highlighted-article');

            contentGrid.innerHTML = '';

            // Find the highlighted article by its ID
            const highlightedArticleId = data.highlightedArticleId;
            let featuredItem;

            // Look for the article in all types (news, article, opinion)
            ['news', 'article', 'opinion'].forEach(type => {
                const item = data[type].find(article => article.id == highlightedArticleId);
                if (item) {
                    featuredItem = { ...item, type }; // Store both article data and its type
                }
            });

            if (featuredItem) {
                // Load the highlighted article
                const articleTypeClass = featuredItem.type; // Example: 'news', 'article', etc.
                const articleLink = `article.html?id=${featuredItem.id}&type=${featuredItem.type}&lang=${currentLanguage}`;

                highlightedArticle.style.backgroundImage = `url('${featuredItem.content.find(contentItem => contentItem.type === 'raw-main-image').value}')`;
                highlightedArticle.querySelector('.highlighted-title').innerHTML = `<a href="${articleLink}">${featuredItem.title}</a>`;
                
                const highlightedTypeElement = highlightedArticle.querySelector('.highlighted-type');
                highlightedTypeElement.textContent = data.types[featuredItem.type];
                highlightedTypeElement.className = `highlighted-type ${articleTypeClass}`; // Add the type class dynamically
                
                highlightedArticle.querySelector('.highlighted-date').textContent = featuredItem.date;

                // Add the button to the lower-right corner
                const highlightedButton = highlightedArticle.querySelector('.highlighted-button');
                highlightedButton.innerHTML = `<a href="${articleLink}" class="highlighted-button-link">${data.readMoreButton}</a>`;

                //More info section
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

            // Load the rest of the articles into the content grid
            ['news', 'article', 'opinion'].forEach(type => {
                data[type].forEach(item => {
                    if (item.visible === "yes") {  // Exclude the highlighted article and hidden articles from the grid
                        const articleElement = document.createElement('article');
                        articleElement.classList.add(`${type}-item`);
                        articleElement.setAttribute('data-type', type);

                        let imageSrc = item.content.find(contentItem => contentItem.type === 'main-image').value;
                        let altText = `${type.charAt(0).toUpperCase() + type.slice(1)} Image ${item.id}`;

                        const img = new Image();
                        img.onload = function() {
                            articleElement.innerHTML = `
                                <a href="article.html?id=${item.id}&type=${type}&lang=${currentLanguage}">
                                    <img src="${imageSrc}" alt="${altText}">
                                    <div class="content">
                                        <p class="${type}">${data.types[type]}</p>
                                        <p class="date">${item.date}</p>
                                        <h3>${item.title}</h3>
                                    </div>
                                </a>
                            `;
                            contentGrid.appendChild(articleElement);
                        };
                        img.onerror = function() {
                            const fallbackImageSrc = imageSrc.replace(/\.png$/, '.jpg').replace(/\.jpg$/, '.png');
                            articleElement.innerHTML = `
                                <a href="article.html?id=${item.id}&type=${type}">
                                    <img src="${fallbackImageSrc}" alt="${altText}">
                                    <div class="content">
                                        <p class="${type}">${data.types[type]}</p>
                                        <p class="date">${item.date}</p>
                                        <h3>${item.title}</h3>
                                    </div>
                                </a>
                            `;
                            contentGrid.appendChild(articleElement);
                        };
                        img.src = imageSrc;
                    }
                });
            });
        })
        .catch(error => console.error('Error loading content:', error));
}



