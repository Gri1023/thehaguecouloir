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

// Function to set localized text
function setLocalizedText() {
    const language = getCurrentLanguage();
    fetch(`json/${language}.json`)
        .then(response => response.json())
        .then(data => {
            document.title = data.siteTitle;
            document.querySelector('header .site-title h1').textContent = data.siteTitle;
            document.querySelector('footer p').textContent = data.footerText;
        })
        .catch(error => console.error('Error loading localized text:', error));
}

function getCurrentLanguage() {
    return localStorage.getItem('language') || 'en';
}

// Function to change language
function changeLanguage(language) {
    localStorage.setItem('language', language);
    window.location.reload(); // Reload the page to apply the new language settings
}

// Ensure that setLocalizedText is called on page load
document.addEventListener('DOMContentLoaded', () => {
    setLocalizedText(); // Update header and footer text based on the current language
    // Call other initialization functions here if needed
});
