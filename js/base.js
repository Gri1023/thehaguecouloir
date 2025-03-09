if (window.innerWidth < 1024) {
    alert("Dear user! It seems that you are using a device with a narrower screen. Unfortunately, this website is not yet fully optimized for smaller screen sizes. As a result, a wider layout was forced, which may require you to scroll both horizontally and vertically to navigate(or just zoom out). Author apologizes for this temporary inconvenience and is working to resolve it as soon as possible.");
  }
window.currentLanguage = (getCurrentLanguage());

// Function to get the current language from URL or localStorage
function getCurrentLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLanguage = urlParams.get('lang');
    
    // If there's a language in the URL, use it
    return urlLanguage || 'en';
}

// Immediately invoked function to set the initial language button
(function setLanguageButton() {
    const language = getCurrentLanguage();

    // Create a button based on the current language
    const languageSelector = document.getElementById('languageSelector');

    if (language === 'ru') {
        languageSelector.innerHTML = `
            <button class="dropbtn"><img src="language-icon-white.png" class="language-icon">Русский</button>
            <div class="dropdown-menu">
          <a href="#" onclick="changeLanguage('en')">English</a>
        </div>
        `;
    } else {
        languageSelector.innerHTML = `
            <button class="dropbtn"><img src="language-icon-white.png" class="language-icon">English</button>
            <div class="dropdown-menu">
          <a href="#" onclick="changeLanguage('ru')">Русский</a>
        </div>
        `;
    }
})();

// Function to change language and reflect it in the URL
function changeLanguage(language) {
    // Save the selected language
    currentLanguage = language;

    // Update the URL with the new language parameter
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('lang', language);

    // Reload the page with the updated language in the URL
    window.location.search = urlParams.toString(); 
}

// Function to set localized text
function setBaseLocalizedText() {
    const language = getCurrentLanguage();  // Get the current language setting
    fetch(`json/${language}.json`)  // Fetch the localized JSON file for the current language
        .then(response => response.json())
        .then(data => {
            // Set the site title
            document.title = data.siteTitle;
            document.querySelector('#navContainer .navigation-title-text').innerHTML = `<a href="index.html" class="navigation-title-text"?lang=${language}">${data.siteTitle}</a>`;

            // Update text for footer grid item 1
            const footerGridItem1 = document.querySelector('#footer-grid-item1 .footer-grid-item-list').children;
            data.footer[0]["footer-grid-item1"].forEach((item, index) => {
                if (footerGridItem1[index]) {
                    footerGridItem1[index].querySelector('a').textContent = item;
                }
            });

            // Update text for footer grid item 2
            const footerGridItem2 = document.querySelector('#footer-grid-item2 .footer-grid-item-list').children;
            data.footer[1]["footer-grid-item2"].forEach((item, index) => {
                if (footerGridItem2[index]) {
                    footerGridItem2[index].querySelector('a').textContent = item;
                }
            });

            // Update text for footer grid item 3
            const footerGridItem3 = document.querySelector('#footer-grid-item3 .footer-grid-item-list').children;
            data.footer[2]["footer-grid-item3"].forEach((item, index) => {
                if (footerGridItem3[index]) {
                    footerGridItem3[index].querySelector('a').textContent = item;
                }
            });

            // Update text for footer grid item 4
            const footerGridItem4 = document.querySelector('#footer-grid-item4 .footer-grid-item-list').children;
            data.footer[3]["footer-grid-item4"].forEach((item, index) => {
                if (footerGridItem4[index]) {
                    footerGridItem4[index].querySelector('a').textContent = item;
                }
            });

            // Set the footer below text
            document.querySelector('.footer-below-text').textContent = data.footer[4]["footer-grid-item-below"][0];
        })
        .catch(error => console.error('Error loading localized text:', error));
}



// Ensure that setLocalizedText is called on page load
document.addEventListener('DOMContentLoaded', () => {
    setBaseLocalizedText(); // Update header and footer text based on the current language
    // Call other initialization functions here if needed
});

//Simply shared functions

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
