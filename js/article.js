document.addEventListener('DOMContentLoaded', () => {
    setLocalizedText();
    loadArticleContent();
});

function setLocalizedText() {
    const language = getCurrentLanguage();
    fetch(`json/${language}.json`)
        .then(response => response.json())
        .then(data => {
            document.title = data.siteTitle;
            document.querySelector('header .logo h1').textContent = data.siteTitle;
            document.querySelector('footer p').textContent = data.footerText;
        })
        .catch(error => console.error('Error loading localized text:', error));
}

function getCurrentLanguage() {
    return localStorage.getItem('language') || 'en';
}

function loadArticleContent() {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');
    const articleType = urlParams.get('type');
    const language = getCurrentLanguage();

    fetch(`json/${language}.json`)
        .then(response => response.json())
        .then(data => {
            const articleData = data[articleType].find(item => item.id === articleId);
            if (articleData) {
                const articleContent = document.getElementById('article-content');
                const articleTypeContainer = document.getElementById('article-type');

                // Set the article type with innerHTML
                articleTypeContainer.innerHTML = data.types[articleType];
                articleTypeContainer.className = `text-type ${articleType}`;

                // Iterate through content
                articleData.content.forEach(item => {
                    if (item.type === 'heading-text') {
                        articleContent.innerHTML += `<h1 class="heading-text">${item.value}</h1>`;
                    } else if (item.type === 'subheading-text') {
                        articleContent.innerHTML += `<h2 class="subheading-text">${item.value}</h2>`;
                    } else if (item.type === 'info-text') {
                        articleContent.innerHTML += `<p class="info-text">${item.value}</p>`;
                    } else if (item.type === 'text') {
                        const textWithLinks = item.value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
                        articleContent.innerHTML += `<p>${textWithLinks}</p>`;
                    } else if (item.type === 'main-image') {
                        articleContent.innerHTML += `<img src="${item.value}" alt="Article Image" class="main-image">`;
                    } else if (item.type === 'image') {
                        articleContent.innerHTML += `<img src="${item.value}" alt="Article Image" class="image">`;
                    } else if (item.type === 'caption-text') {
                        articleContent.innerHTML += `<p class="caption-text">${item.value}</p>`;
                    } else if (item.type === 'quote') {
                        articleContent.innerHTML += `<div class="quote">${item.value}</div>`;
                    } else if (item.type === 'warning') {
                        articleContent.innerHTML += `<div class="warning">${item.value}</div>`;
                    }
                });
            } else {
                document.getElementById('article-content').innerHTML = '<p>Article not found.</p>';
            }
        })
        .catch(error => console.error('Error loading article content:', error));
}
