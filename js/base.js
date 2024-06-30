// Immediately invoked function to set the initial language button
(function setLanguageButton() {
    const language = localStorage.getItem('language') || 'en'; // Default language is English

    // Create a button based on the current language
    const languageSelector = document.getElementById('languageSelector');

    if (language === 'ru') {
        languageSelector.innerHTML = `
            <button class="dropbtn" onclick="changeLanguage('en')">In English</button>
        `;
    } else {
        languageSelector.innerHTML = `
            <button class="dropbtn" onclick="changeLanguage('ru')">На русском</button>
        `;
    }
})();
