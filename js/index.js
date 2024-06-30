document.addEventListener('DOMContentLoaded', () => {
    filterItems('all'); // Default to showing all items

    // Load content for index.html
    if (document.querySelector('.content-grid')) {
        const language = getCurrentLanguage();
        loadContent(`json/${language}.json`);
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

// Function to change language
function changeLanguage(language) {
    localStorage.setItem('language', language);
    window.location.reload();
}

// Function to get the current language
function getCurrentLanguage() {
    return localStorage.getItem('language') || 'en'; // Default to English if not specified
}

// Function to load content from JSON file
function loadContent(jsonFile) {
    fetch(jsonFile)
        .then(response => response.json())
        .then(data => {
            const contentGrid = document.getElementById('content-grid');
            contentGrid.innerHTML = '';

            ['news', 'article', 'opinion'].forEach(type => {
                data[type].forEach(item => {
                    const articleElement = document.createElement('article');
                    articleElement.classList.add(`${type}-item`);
                    articleElement.setAttribute('data-type', type);

                    // Try loading both jpg and png versions of the image
                    let imageSrc = `images/${item.id}_1.jpg`;
                    let altText = `${type.charAt(0).toUpperCase() + type.slice(1)} Image ${item.id}`;
                    
                    // Check if png version exists, fallback to jpg if not
                    const img = new Image();
                    img.onload = function() {
                        imageSrc = `images/${item.id}_1.png`;
                        articleElement.innerHTML = `
                            <a href="article.html?id=${item.id}&type=${type}">
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
                        articleElement.innerHTML = `
                            <a href="article.html?id=${item.id}&type=${type}">
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
                    img.src = `images/${item.id}_1.png`;  // Try loading png version
                });
            });
        })
        .catch(error => console.error('Error loading content:', error));
}



