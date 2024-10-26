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
            <button class="dropbtn" onclick="changeLanguage('en')">In English</button>
        `;
    } else {
        languageSelector.innerHTML = `
            <button class="dropbtn" onclick="changeLanguage('ru')">На русском</button>
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
    const language = getCurrentLanguage();
    fetch(`json/${language}.json`)
        .then(response => response.json())
        .then(data => {
            document.title = data.siteTitle;
            document.querySelector('header .site-title h1').innerHTML = `<a href="index.html?lang=${currentLanguage}">${data.siteTitle}</a>`;
            document.querySelector('footer p').textContent = data.footerText;
        })
        .catch(error => console.error('Error loading localized text:', error));
}

// Ensure that setLocalizedText is called on page load
document.addEventListener('DOMContentLoaded', () => {
    setBaseLocalizedText(); // Update header and footer text based on the current language
    // Call other initialization functions here if needed
});
