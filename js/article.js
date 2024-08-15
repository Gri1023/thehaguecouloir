document.addEventListener('DOMContentLoaded', () => {
    setLocalizedText();
    loadArticleContent();
});

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

                articleTypeContainer.innerHTML = data.types[articleType];
                articleTypeContainer.className = `text-type ${articleType}`;

                articleData.content.forEach(item => {
                    if (item.type === 'gallery') {
                        createGallery(articleContent, item.images);
                    } else if (item.type === 'heading-text') {
                        articleContent.innerHTML += `<h1 class="heading-text">${item.value}</h1>`;
                    } else if (item.type === 'subheading-text') {
                        articleContent.innerHTML += `<h2 class="subheading-text">${item.value}</h2>`;
                    } else if (item.type === 'sub-subheading-text') {
                        articleContent.innerHTML += `<h3 class="sub-subheading-text">${item.value}</h3>`;
                    } else if (item.type === 'info-text') {
                        articleContent.innerHTML += `<p class="info-text">${item.value}</p>`;
                    } else if (item.type === 'text') {
                        const textWithLinks = item.value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
                        articleContent.innerHTML += `<p>${textWithLinks}</p>`;
                    } else if (item.type === 'main-image') {
                        articleContent.innerHTML += `<img src="${item.value}" alt="" class="main-image">`;
                    } else if (item.type === 'image') {
                        articleContent.innerHTML += `<img src="${item.value}" alt="" class="image">`;
                    } else if (item.type === 'caption-text') {
                        articleContent.innerHTML += `<p class="caption-text">${item.value}</p>`;
                    } else if (item.type === 'quote') {
                        articleContent.innerHTML += `<div class="quote">${item.value}</div>`;
                    } else if (item.type === 'warning') {
                        articleContent.innerHTML += `<div class="warning">${item.value}</div>`;
                    } else if (item.type === 'video') {
                        articleContent.innerHTML += `<div class="video-container"><video controls src="${item.value}"></video></div>`;
                    }
                });

                initializeGallery();
            } else {
                document.getElementById('article-content').innerHTML = '<p>Article not found.</p>';
            }
        })
        .catch(error => console.error('Error loading article content:', error));
}


function createGallery(container, images) {
    let galleryHtml = `
        <div class="gallery-container">
            <img src="${images[0]}" alt="Gallery Image" class="gallery-main-image">
            <button class="gallery-nav-button left">&lt;</button>
            <button class="gallery-nav-button right">&gt;</button>
            <div class="gallery-thumbnails">
    `;
    
    images.forEach((image, index) => {
        galleryHtml += `<img src="${image}" alt="Thumbnail" class="gallery-thumbnail${index === 0 ? ' active' : ''}" data-index="${index}">`;
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
        const newIndex = (currentIndex > 0) ? currentIndex - 1 : thumbnails.length - 1;
        updateMainImage(newIndex);
    });

    rightButton.addEventListener('click', () => {
        const newIndex = (currentIndex < thumbnails.length - 1) ? currentIndex + 1 : 0;
        updateMainImage(newIndex);
    });
    
    mainImage.addEventListener('click', () => {
        zoomOverlay.classList.add('active');
    });

    zoomOverlay.addEventListener('click', () => {
        zoomOverlay.classList.remove('active');
    });
}
