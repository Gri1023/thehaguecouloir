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

function loadContent(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const highlightedArticle = document.getElementById('highlighted-article');

            const highlightedArticleIds = [
                data.highlightedArticle1Id,
                data.highlightedArticle2Id,
                data.highlightedArticle3Id,
                data.highlightedArticle4Id
            ];
            let featuredItems = [];

            highlightedArticleIds.forEach(id => {
                ['news', 'article', 'opinion'].some(type => {
                    const item = data[type].find(article => article.id == id);
                    if (item) {
                        featuredItems.push({ ...item, type });
                        return true; // Stop further iteration over types once a match is found
                    }
                    return false; // Continue to the next type
                });
            });




            // Set the publication count dynamically
            // const allPublicationsElement = document.querySelector('.all-publications p');
            // allPublicationsElement.textContent = data.allPublications;

            //             // Update filter buttons dynamically
            //             const filterElement = document.querySelector('.sort-button');
            //             filterElement.innerHTML = `
            //     <span>${data.filterBy}</span>
            //     <button class="sort-option active" onclick="filterItems('all')">${data.types.all}</button>
            //     <button class="sort-option" data-type="news" onclick="filterItems('news')">${data.types.news}</button>
            //     <button class="sort-option" data-type="article" onclick="filterItems('article')">${data.types.article}</button>
            //     <button class="sort-option" data-type="opinion" onclick="filterItems('opinion')">${data.types.opinion}</button>
            // `;

            // Separate the items by type and add them to the respective grids
            const allItems = ['news', 'article', 'opinion']
                .flatMap(type => data[type]
                    .filter(item => item.visible === "yes")
                    .map(item => ({ ...item, type })))
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            // Limit to 3 publications per section
            const maxItemsPerSection = 3;

            ['news', 'article', 'opinion'].forEach(type => {
                // Get items of the current type and limit to 3
                const items = allItems.filter(item => item.type === type).slice(0, maxItemsPerSection);

                const gridId = `${type}-grid`;
                const gridElement = document.getElementById(gridId);

                items.forEach(item => {
                    // Create the article element
                    const articleElement = document.createElement('article');
                    articleElement.classList.add(`${item.type}-item`);
                    articleElement.setAttribute('data-type', item.type);

                    // Find and handle media content
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

                    // Populate the article's inner HTML
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

                    // Append to the correct grid
                    gridElement.appendChild(articleElement);
                });
            });


            // Highlighted articles section

            const highlightedArticlesGrid = document.querySelector('#highlighted-articles-grid .grid-container');

            // Get and sort the highlighted articles based on the order in highlightedArticleIds
            const highlightedArticles = highlightedArticleIds
                .map(id => allItems.find(item => item.id === id)) // Map IDs to corresponding items
                .filter(Boolean); // Remove any undefined items (if an ID is missing in allItems)

            highlightedArticles.forEach((item, index) => {
                const gridItem = document.createElement('div');
                gridItem.classList.add('grid-item');
                const articleLink = `article.html?id=${item.id}&type=${item.type}&lang=${currentLanguage}`;

                gridItem.innerHTML = `
                        <a href="${articleLink}" class="grid-item-link">
                            <h3>${item.title}</h3>
                            <div class="type-date">
                                <span class="${item.type}">${data.types[item.type]}</span>
                                <span>|</span>
                                <span class="date">${timeAgo(item.date)}</span>
                            </div>
                        </a>
                    `;

                // Add event listeners for hover and click
                gridItem.addEventListener('mouseover', () => {
                    updateHighlightedArticle(index);
                });

                highlightedArticlesGrid.appendChild(gridItem);
            });
            if (featuredItems.length > 0) {
                let currentIndex = 0;

                function updateHighlightedArticle(index) {
                    if (index !== undefined) {
                        currentIndex = index;
                    }
                    const featuredItem = featuredItems[currentIndex];
                    const articleTypeClass = featuredItem.type;
                    const articleLink = `article.html?id=${featuredItem.id}&type=${featuredItem.type}&lang=${currentLanguage}`;

                    const mediaContent = featuredItem.content.find(contentItem =>
                        contentItem.type === 'main-image' || contentItem.type === 'main-video'
                    );

                    // Update media content
                    if (mediaContent.type === 'main-image') {
                        const highlightedImage = document.querySelector('.highlighted-image');

                        // Remove the fade-in class to reset the state
                        highlightedImage.classList.remove('fade-in');

                        // Ensure the image source changes
                        highlightedImage.src = mediaContent.value;

                        // Force a reflow to ensure the transition restarts
                        void highlightedImage.offsetWidth; // This ensures the browser registers the change

                        // Re-add the fade-in class to trigger the effect
                        highlightedImage.classList.add('fade-in');
                    } else if (mediaContent.type === 'main-video') {
                        highlightedArticle.innerHTML = `
                            <video class="video-preview" src="${mediaContent.value}" muted autoplay loop></video>
                            <div class="video-indicator">
                                <span class="dot"></span> ${data.videoText[currentLanguage]}
                            </div>
                        `;
                    }

                    // Update the highlighted article details
                    highlightedArticle.querySelector('.highlighted-title').innerHTML = `<a href="${articleLink}">${featuredItem.title}</a>`;
                    const highlightedTypeElement = highlightedArticle.querySelector('.highlighted-type');
                    highlightedTypeElement.textContent = data.types[featuredItem.type];
                    highlightedTypeElement.className = `highlighted-type ${articleTypeClass}`;
                    highlightedArticle.querySelector('.highlighted-date').textContent = timeAgo(featuredItem.date);
                    const highlightedButton = highlightedArticle.querySelector('.highlighted-button');
                    highlightedButton.innerHTML = `<a href="${articleLink}" class="highlighted-button-link">${data.readMoreButton}</a>`;

                    // Update grid-item h3 styling and highlight current item
                    const gridItems = document.querySelectorAll('#highlighted-articles-grid .grid-item');
                    gridItems.forEach(item => {
                        if (item.querySelector('h3').textContent === featuredItem.title) {
                            item.classList.add('active'); // Highlight current item
                        } else {
                            item.classList.remove('active'); // Remove highlight
                        }
                    });

                    currentIndex = (currentIndex + 1) % featuredItems.length;
                }


                // Initial setup to highlight the first article correctly
                updateHighlightedArticle(0);

                // Start rotating after the initial setup
                setInterval(() => updateHighlightedArticle(), 5000);
            } else {
                console.error('Highlighted articles not found');
            }
        }
        )
}
