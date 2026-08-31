// Helper to identify if the site is running in a local development environment
function isLocalDev() {
    const hn = window.location.hostname;
    const protocol = window.location.protocol;
    return (
        hn === 'localhost' ||
        hn === '127.0.0.1' ||
        protocol === 'file:' ||
        hn.startsWith('192.168.') ||
        hn.startsWith('10.') ||
        hn.endsWith('.local')
    );
}

// Cloudflare R2 public bucket base URL. 
// Evaluates dynamically: uses local relative paths when debugging locally, or the live R2 URL when in production.
const PRODUCTION_R2_URL = 'https://pub-795f9426259d4926a0308a9099f50d25.r2.dev/';
window.R2_BASE_URL = isLocalDev() ? getRootPrefix() : PRODUCTION_R2_URL;
let mobileBannerDismissedForSession = false;

window.currentLanguage = (getCurrentLanguage());

function isMobileLayoutEligiblePage() {
    const path = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
    if (!path || path === '/' || path === '/index.html') {
        return false;
    }

    const eligiblePrefixes = ['/article', '/about', '/bias', '/your-data'];
    return eligiblePrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

function getViewportWidth() {
    if (window.visualViewport && typeof window.visualViewport.width === 'number') {
        return Math.min(window.visualViewport.width, window.innerWidth || window.visualViewport.width);
    }
    return window.innerWidth;
}

function shouldUseMobileLayout() {
    if (localStorage.getItem('mobileFullMode') === 'true') {
        return false;
    }
    return getViewportWidth() < 768 && isMobileLayoutEligiblePage();
}

function updateMobileLayoutState() {
    const useMobileLayout = shouldUseMobileLayout();
    const bannerDismissed = mobileBannerDismissedForSession;

    if (useMobileLayout && window.__mobileExperienceData && !document.querySelector('.mobile-site-header')) {
        setupMobileExperience(window.__mobileExperienceData);
        return;
    }

    document.body.classList.toggle('mobile-layout-active', useMobileLayout);
    document.body.classList.toggle('mobile-banner-closed', bannerDismissed);
    moveNavigationForLayout(useMobileLayout);

    const header = document.querySelector('.mobile-site-header');
    if (header) {
        header.style.display = useMobileLayout ? 'flex' : 'none';
    }

    document.querySelectorAll('.mobile-limited-banner').forEach(item => {
        const shouldHide = !useMobileLayout || (item.id === 'mobileLimitedBannerFixed' && bannerDismissed);
        item.classList.toggle('is-hidden', shouldHide);
        item.style.display = shouldHide ? 'none' : '';
    });

    const overlay = document.getElementById('mobileNavOverlay');
    if (overlay) {
        overlay.classList.toggle('is-open', false);
    }

    const panel = document.getElementById('mobileNavPanel');
    if (panel) {
        panel.classList.toggle('is-open', false);
    }
}

function getCurrentLanguage() {
    let urlParams = new URLSearchParams(window.location.search);
    const hashIndex = window.location.href.indexOf('#');

    // 1. Check URL Search Params first
    if (!urlParams.has('lang') && hashIndex !== -1) {
        const hash = window.location.href.slice(hashIndex + 1);
        const hashParamsIndex = hash.indexOf('?');
        if (hashParamsIndex !== -1) {
            const hashParams = new URLSearchParams(hash.slice(hashParamsIndex + 1));
            if (hashParams.has('lang')) {
                urlParams = hashParams;
            }
        }
    }

    const urlLanguage = urlParams.get('lang');

    // 2. Check Local Storage if URL is empty
    const storedLanguage = localStorage.getItem('preferredLanguage');

    // 3. Priority: URL > LocalStorage > Default ('en')
    const finalLanguage = urlLanguage || storedLanguage || 'en';

    //console.log('Current language determined:', finalLanguage);
    return finalLanguage;
}

const languageLabelFallbacks = {
    en: { full: 'English', short: 'ENG' },
    ru: { full: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', short: '\u0420\u0423\u0421' }
};

function resolveLanguageLabelSet(language, labels = languageLabelFallbacks) {
    const safeLanguage = language && labels[language] ? language : 'en';
    return labels[safeLanguage] || languageLabelFallbacks[safeLanguage] || languageLabelFallbacks.en;
}

async function setLanguageButton() {
    const language = getCurrentLanguage();
    const languageSelector = document.getElementById('languageSelector');
    if (!languageSelector) return;

    try {
        const data = await fetchSiteData();
        const labels = data.languageLabels || languageLabelFallbacks;
        const header = resolveLanguageLabelSet(language, labels);
        const alternateLanguage = language === 'ru' ? 'en' : 'ru';
        const alternateHeader = resolveLanguageLabelSet(alternateLanguage, labels);

        localStorage.setItem('preferredLanguage', language);
        languageSelector.innerHTML = `
            <button class="dropbtn" type="button">
                <img src="${window.R2_BASE_URL}media/language-icon-white.png" class="language-icon" alt="">
                <span class="lang-text-full" data-i18n="languageLabels.${language}.full">${header.full}</span>
                <span class="lang-text-short" data-i18n="languageLabels.${language}.short">${header.short}</span>
            </button>
            <div class="dropdown-menu">
                <a href="#" onclick="changeLanguage('${alternateLanguage}')">
                    <span class="lang-option-full">${alternateHeader.full}</span>
                    <span class="lang-option-short">${alternateHeader.short}</span>
                </a>
            </div>
        `;
        bindMobileLanguageSelector();
    } catch (error) {
        console.warn('Using fallback language labels:', error);
        const header = resolveLanguageLabelSet(language, languageLabelFallbacks);
        const alternateLanguage = language === 'ru' ? 'en' : 'ru';
        const alternateHeader = resolveLanguageLabelSet(alternateLanguage, languageLabelFallbacks);
        languageSelector.innerHTML = `
            <button class="dropbtn" type="button">
                <img src="${window.R2_BASE_URL}media/language-icon-white.png" class="language-icon" alt="">
                <span class="lang-text-full" data-i18n="languageLabels.${language}.full">${header.full}</span>
                <span class="lang-text-short" data-i18n="languageLabels.${language}.short">${header.short}</span>
            </button>
            <div class="dropdown-menu">
                <a href="#" onclick="changeLanguage('${alternateLanguage}')">
                    <span class="lang-option-full">${alternateHeader.full}</span>
                    <span class="lang-option-short">${alternateHeader.short}</span>
                </a>
            </div>
        `;
        bindMobileLanguageSelector();
    }
}

function moveNavigationForLayout(useMobileLayout) {
    const navigation = document.getElementById('navContainer');
    const mobileContainer = document.querySelector('.mobile-nav-content');
    const desktopContainer = document.querySelector('.sidebars-left-grid');
    if (!navigation) return;

    if (useMobileLayout && mobileContainer && navigation.parentElement !== mobileContainer) {
        mobileContainer.appendChild(navigation);
    } else if (!useMobileLayout && desktopContainer && navigation.parentElement !== desktopContainer) {
        desktopContainer.insertBefore(navigation, desktopContainer.firstChild);
    }
}

function bindMobileLanguageSelector() {
    const selector = document.getElementById('languageSelector');
    if (!selector || selector.dataset.mobileLanguageBound === 'true') return;

    selector.dataset.mobileLanguageBound = 'true';
    selector.addEventListener('click', (event) => {
        if (!shouldUseMobileLayout() || !event.target.closest('.dropbtn')) return;

        event.preventDefault();
        event.stopPropagation();
        const isOpen = selector.classList.toggle('is-open');
        selector.querySelector('.dropbtn')?.setAttribute('aria-expanded', String(isOpen));
    });
}

document.addEventListener('DOMContentLoaded', setLanguageButton);

function changeLanguage(language) {
    // 1. Save the selection to Local Storage immediately
    localStorage.setItem('preferredLanguage', language);

    currentLanguage = language;

    // 2. Update the URL and reload
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('lang', language);
    window.location.search = urlParams.toString();
}

function getRootPrefix() {
    const path = window.location.pathname;
    const subpages = ['article', 'about', 'all-publications', 'bias', 'your-data', 'editor'];
    return subpages.some(folder => path.includes(`/${folder}/`) || path.endsWith(`/${folder}`) || path.endsWith(`/${folder}/`)) ? '../' : '';
}

function prefixRootPath(url) {
    if (!url) return url;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('/') || url.startsWith('data:') || url.startsWith('../') || url.startsWith('./')) {
        return url;
    }
    // Route any media/image path to the R2 bucket by default.
    if (url.startsWith('media/') || url.startsWith('images/')) {
        return `${window.R2_BASE_URL}${url}`;
    }
    return `${getRootPrefix()}${url}`;
}

function getLocalizedValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const current = value[currentLanguage];
        if (current !== undefined && current !== '') {
            return current;
        }
        const en = value.en;
        if (en !== undefined && en !== '') {
            return en;
        }
        const ru = value.ru;
        if (ru !== undefined && ru !== '') {
            return ru;
        }
        return '';
    }
    return value || '';
}

// Function to insert navigation container
function buildNavigationMarkup(data, rootPrefix) {
    return `
        <a href="${rootPrefix}" id="logo-link">
            <img src="${prefixRootPath('media/logo.png')}" alt="Logo" class="logo">
        </a>
        <a href="${rootPrefix}" class="navigation-title-text">${getLocalizedValue(data.siteTitle)}</a>
        <ul>
            <li>
                <a href="${rootPrefix}" class="navigation-link">
                    <img src="${R2_BASE_URL}media/home-icon-white.png" class="navigation-icon">
                    <span class="navigation-option-text">${getLocalizedValue(data.navigation[0][Object.keys(data.navigation[0])[0]])}</span>
                </a>
            </li>
            <li>
                <a href="${rootPrefix}#catalogue-anchor" class="navigation-link">
                    <img src="${R2_BASE_URL}media/catalogue-icon-white.png" class="navigation-icon">
                    <span class="navigation-option-text">${getLocalizedValue(data.navigation[1][Object.keys(data.navigation[1])[0]])}</span>
                </a>
            </li>
            <li>
                <a href="${rootPrefix}all-publications/" class="navigation-link">
                    <img src="${R2_BASE_URL}media/search_icon.png" class="navigation-icon">
                    <span class="navigation-option-text">${getLocalizedValue(data.navigation[2][Object.keys(data.navigation[2])[0]])}</span>
                </a>
            </li>
            <li>
                <a href="${rootPrefix}about/" class="navigation-link">
                    <img src="${R2_BASE_URL}media/info-icon-white.png" class="navigation-icon">
                    <span class="navigation-option-text">${getLocalizedValue(data.navigation[3][Object.keys(data.navigation[3])[0]])}</span>
                </a>
            </li>
        </ul>
    `;
}

function insertNav(data) {
    const rootPrefix = getRootPrefix();
    const grid = document.querySelector('.sidebars-left-grid');
    if (!grid) return;

    const navDiv = document.createElement('div');
    navDiv.className = 'sidebars-left-item';
    navDiv.id = 'navContainer';
    navDiv.innerHTML = buildNavigationMarkup(data, rootPrefix);

    // Insert as first child
    grid.insertBefore(navDiv, grid.firstChild);
}

function setupMobileExperience(data) {
    if (!shouldUseMobileLayout()) {
        updateMobileLayoutState();
        return;
    }

    if (window.__mobileExperienceData && document.querySelector('.mobile-site-header')) {
        updateMobileLayoutState();
        return;
    }

    window.__mobileExperienceData = data;

    const rootPrefix = getRootPrefix();
    const title = getLocalizedValue(data.siteTitle);
    const limitedModeText = getLocalizedValue(data.mobileLimitedBanner) || (currentLanguage === 'ru'
        ? '\u041e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u043d\u044b\u0439 \u0440\u0435\u0436\u0438\u043c \u0434\u043b\u044f \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u043e\u0432. \u0427\u0442\u043e\u0431\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f \u043a\u043e \u0432\u0441\u0435\u043c \u0444\u0443\u043d\u043a\u0446\u0438\u044f\u043c \u0441\u0430\u0439\u0442\u0430, \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u043f\u043e\u043b\u043d\u044b\u0439 \u0440\u0435\u0436\u0438\u043c.'
        : 'Limited mode for phones. To access all website features, open full mode');

    if (!document.querySelector('.mobile-site-header')) {
        const header = document.createElement('header');
        header.className = 'mobile-site-header';
        header.innerHTML = `
            <button class="mobile-menu-toggle" id="mobileMenuToggle" type="button" aria-label="Open navigation menu">
                <span></span><span></span><span></span>
            </button>
            <a href="${rootPrefix}" class="mobile-site-brand">
                <img src="${prefixRootPath('media/logo.png')}" alt="Logo" class="mobile-site-brand-logo">
                <span>${title}</span>
            </a>
        `;

        const pageLanguageSelector = document.getElementById('languageSelector');
        if (pageLanguageSelector) {
            header.appendChild(pageLanguageSelector);
        }

        document.body.insertBefore(header, document.body.firstChild);
    }

    if (!document.getElementById('mobileNavOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'mobileNavOverlay';
        document.body.appendChild(overlay);
    }

    let panel = document.getElementById('mobileNavPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'mobileNavPanel';
        panel.className = 'mobile-nav-panel';
        panel.innerHTML = `
            <div class="mobile-nav-panel-inner">
                <div class="mobile-nav-panel-header">
                    <button class="mobile-nav-panel-close" type="button" aria-label="Close navigation">✕</button>
                </div>
                <div class="mobile-nav-content"></div>
            </div>
        `;
        document.body.appendChild(panel);
    }

    moveNavigationForLayout(true);

    const banner = document.getElementById('mobileLimitedBannerFixed');
    if (!banner) {
        const fixedBanner = document.createElement('div');
        fixedBanner.id = 'mobileLimitedBannerFixed';
        fixedBanner.className = 'mobile-limited-banner mobile-limited-banner-fixed';
        fixedBanner.innerHTML = `
            <div class="mobile-limited-banner-copy">
                <p>${limitedModeText}</p>
            </div>
            <!--
            <div class="mobile-limited-banner-actions">
                <button class="mobile-limited-banner-button" type="button">Open full mode</button>
                -->
                <button class="mobile-limited-banner-close" type="button" aria-label="Close limited mode banner">✕</button>
            </div>
        `;
        document.body.appendChild(fixedBanner);
    }

    const drawerBanner = document.getElementById('mobileLimitedBannerDrawer');
    if (!drawerBanner) {
        const panelBanner = document.createElement('div');
        panelBanner.id = 'mobileLimitedBannerDrawer';
        panelBanner.className = 'mobile-limited-banner mobile-limited-banner-drawer';
        panelBanner.innerHTML = `
            <div class="mobile-limited-banner-copy">
                <p>${limitedModeText}</p>
            </div>
            <div class="mobile-limited-banner-actions">
                <button class="mobile-limited-banner-button" type="button">Open full mode</button>
                <button class="mobile-limited-banner-close" type="button" aria-label="Close limited mode banner">✕</button>
            </div>
        `;
        panel.querySelector('.mobile-nav-panel-inner').appendChild(panelBanner);
    }

    const toggleButton = document.getElementById('mobileMenuToggle');
    const closeButton = panel.querySelector('.mobile-nav-panel-close');
    const overlay = document.getElementById('mobileNavOverlay');

    const openPanel = () => {
        if (!shouldUseMobileLayout()) return;
        overlay.classList.add('is-open');
        panel.classList.add('is-open');
        document.body.classList.add('mobile-nav-open');
    };

    const closePanel = () => {
        overlay.classList.remove('is-open');
        panel.classList.remove('is-open');
        document.body.classList.remove('mobile-nav-open');
    };

    if (toggleButton) {
        toggleButton.onclick = openPanel;
    }
    if (closeButton) {
        closeButton.onclick = closePanel;
    }
    if (overlay) {
        overlay.onclick = closePanel;
    }

    bindMobileLanguageSelector();

    document.addEventListener('click', (event) => {
        const selector = document.querySelector('.mobile-site-header .language-selector');
        const menu = selector?.querySelector('.dropdown-menu');
        if (!selector || !menu) return;
        if (!selector.contains(event.target)) {
            selector.classList.remove('is-open');
            selector.querySelector('.dropbtn')?.setAttribute('aria-expanded', 'false');
        }
    });

    const bannerButtons = document.querySelectorAll('.mobile-limited-banner-button');
    bannerButtons.forEach(button => {
        button.onclick = () => {
            localStorage.setItem('mobileFullMode', 'true');
            window.location.reload();
        };
    });

    const closeBannerButtons = document.querySelectorAll('.mobile-limited-banner-close');
    closeBannerButtons.forEach(button => {
        button.onclick = (event) => {
            event.stopPropagation();
            mobileBannerDismissedForSession = true;
            document.body.classList.add('mobile-banner-closed');
            document.getElementById('mobileLimitedBannerFixed')?.classList.add('is-hidden');
        };
    });

    updateMobileLayoutState();
    window.addEventListener('resize', updateMobileLayoutState);
}

// Function to populate sidebars dynamically
function populateSidebar(side, data) {
    const rootPrefix = getRootPrefix();
    const grid = document.querySelector(`.sidebars-${side}-grid`);
    if (grid && data.sidebars && data.sidebars[side]) {
        data.sidebars[side].forEach((item, index) => {
            // Skip empty items
            if (!item || !item.type) return;

            const itemDiv = document.createElement('div');
            itemDiv.className = `sidebars-${side}-item`;
            itemDiv.id = `sidebars-${side}-item${index + 1}`;

            if (item.type === 'bias') {
                const biasData = data.biasCard || {};
                const titleText = getLocalizedValue(biasData.title) || 'Bias is always there.';
                const descriptionText = getLocalizedValue(biasData.description) || 'Every article is shaped by perspective. Awareness is the first step to clarity.';
                const buttonText = getLocalizedValue(biasData.button) || 'Learn more about bias';
                const biasLink = `${rootPrefix}bias/?lang=${currentLanguage}`;
                const imageOffSrc = item.imageOff ? `${prefixRootPath(getLocalizedValue(item.imageOff) || item.imageOff || '')}` : '';
                const imageOnSrc = item.imageOn ? `${prefixRootPath(getLocalizedValue(item.imageOn) || item.imageOn || '')}` : '';
                const switchOffSrc = `${prefixRootPath('media/light-switch-off.png')}`;
                const switchOnSrc = `${prefixRootPath('media/light-switch-on.png')}`;
                const storedValue = localStorage.getItem('biasVisibility');
                const isVisible = storedValue === '1' || storedValue === 'true';
                const buttonClass = isVisible ? 'bias-card-button bias-card-button-active' : 'bias-card-button bias-card-button-inactive';
                const imageWrapperClass = isVisible ? 'bias-image-wrapper bias-image-active' : 'bias-image-wrapper';

                itemDiv.innerHTML = `
                    <div class="bias-card">
                        <div class="${imageWrapperClass}">
                            <div class="bias-image-frame">
                                ${imageOffSrc ? `<img class="bias-image bias-image-off" src="${imageOffSrc}" alt="Bias illustration off">` : ''}
                                ${imageOnSrc ? `<img class="bias-image bias-image-on" src="${imageOnSrc}" alt="Bias illustration on">` : ''}
                                <div class="bias-image-placeholder"></div>
                            </div>
                        </div>
                        <div class="bias-card-heading">
                            <h3>${titleText}</h3>
                            <p>${descriptionText}</p>
                        </div>
                        <a href="${biasLink}" class="${buttonClass}">${buttonText}</a>
                        <div class="bias-visibility-panel">
                            <div class="bias-visibility-control">
                                <span class="bias-visibility-count bias-off">OFF</span>
                                <label class="bias-switch">
                                    <input type="checkbox" id="biasVisibilityToggle" ${isVisible ? 'checked' : ''}>
                                    <img class="bias-switch-image" src="${isVisible ? switchOnSrc : switchOffSrc}" alt="Bias switch">
                                </label>
                                <span class="bias-visibility-count bias-on">ON</span>
                            </div>
                        </div>
                    </div>
                `;

                const toggle = itemDiv.querySelector('#biasVisibilityToggle');
                const button = itemDiv.querySelector('.bias-card-button');
                const imageWrapper = itemDiv.querySelector('.bias-image-wrapper');
                const imageOff = itemDiv.querySelector('.bias-image-off');
                const imageOn = itemDiv.querySelector('.bias-image-on');
                const switchImage = itemDiv.querySelector('.bias-switch-image');

                if (toggle) {
                    toggle.addEventListener('change', () => {
                        const active = toggle.checked;
                        localStorage.setItem('biasVisibility', active ? '1' : '0');
                        button.classList.toggle('bias-card-button-active', active);
                        button.classList.toggle('bias-card-button-inactive', !active);
                        imageWrapper.classList.toggle('bias-image-active', active);
                        if (imageOff) imageOff.style.display = active ? 'none' : 'block';
                        if (imageOn) imageOn.style.display = active ? 'block' : 'none';
                        if (switchImage) switchImage.src = active ? switchOnSrc : switchOffSrc;
                    });
                    // Initialize display on load
                    if (imageOff) imageOff.style.display = isVisible ? 'none' : 'block';
                    if (imageOn) imageOn.style.display = isVisible ? 'block' : 'none';
                    if (switchImage) switchImage.src = isVisible ? switchOnSrc : switchOffSrc;
                }

                //console.log('Adding bias sidebar item', { side });
                grid.appendChild(itemDiv);
            }

            if (item.type === 'telegram') {
                itemDiv.innerHTML = `
                <img src="${R2_BASE_URL}media/Telegram_Logo_old.png" class="telegram-3d-icon" alt="Telegram Icon">
                <a href="${item.link}">
                    ${getLocalizedValue(item.text)}
                </a>
                <div class="join-telegram-button">
                    <a href="${item.link}"></a>
                    <a href="${item.link}">${getLocalizedValue(item.button)}</a>
                </div>
                `;
                //console.log(`Adding sidebar item: ${getLocalizedValue(item.text)}`, { side });
                grid.appendChild(itemDiv);
            }

            if (item.type === 'live-note') {
                // Fetch and display live-notes
                if (data['live-note'] && data['live-note'].length > 0) {
                    // Get only visible live-notes, sorted by date (newest first), and limit to 4
                    const liveNotes = data['live-note']
                        .filter(note => note.visible === 'yes')
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice(0, 4);

                    itemDiv.classList.add('live-notes-container');

                    // Localized standalone helper function to process markdown links safely
                    const getLinks = (text, className) => {
                        return `${text}`.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) =>
                            `<a href="${prefixRootPath(url)}" target="_blank" class="${className}">${label}</a>`
                        );
                    };

                    let html = `
            <div class="live-notes-wallpaper" style="background-image: url('${R2_BASE_URL}media/telegram-default-wallpaper.png');"></div>
            <div class="live-notes-header">
                <span class="online-indicator"><img src="${R2_BASE_URL}media/live-notes-icon.png" alt=""></span>
                <h3 class="live-notes-title">${getLocalizedValue(data.liveNotesTitle)}</h3>
            </div>
            <div class="live-notes-list">
        `;

                    liveNotes.forEach(note => {
                        const noteLink = `${rootPrefix}article/?id=${note.id}&type=live-note&lang=${currentLanguage}`;
                        const textContent = note.content.find(item => item.type === 'text');

                        // Process text content precisely, converting links and spoilers inline
                        const rawText = textContent ? getLocalizedValue(textContent.value || '') : '';
                        const noteText = rawText ? getLinks(rawText, 'text-with-link').replace(/\|\|(.+?)\|\|/g, '<span class="spoiler-text">$1</span>') : '';

                        // Count attachments
                        const videoCount = note.content.filter(item => item.type === 'video' || item.type === 'main-video').length;
                        const photoCount = note.content.filter(item => item.type === 'image' || item.type === 'main-image').length;

                        // Build attachment notification with preview
                        let attachmentNotif = '';
                        if (videoCount > 0 || photoCount > 0) {
                            const attachments = [];
                            let previewHTML = '<div class="attachment-preview"><div class="preview-thumbnails">';

                            if (videoCount > 0) {
                                const videoLabel = videoCount === 1 ? getLocalizedValue(data.attachments.video) : getLocalizedValue(data.attachments.videos);
                                attachments.push(`${videoCount} ${videoLabel}`);
                                note.content.forEach(item => {
                                    if (item.type === 'video' || item.type === 'main-video') {
                                        const videoValue = getLocalizedValue(item.value) || item.value || '';
                                        previewHTML += `<video class="preview-video-thumbnail" src="${prefixRootPath(videoValue)}" muted autoplay loop></video>`;
                                    }
                                });
                            }
                            if (photoCount > 0) {
                                const photoLabel = photoCount === 1 ? getLocalizedValue(data.attachments.photo) : getLocalizedValue(data.attachments.photos);
                                attachments.push(`${photoCount} ${photoLabel}`);
                                note.content.forEach(item => {
                                    if (item.type === 'image' || item.type === 'main-image') {
                                        const imageValue = getLocalizedValue(item.value) || item.value || '';
                                        previewHTML += `<img class="preview-image-thumbnail" src="${prefixRootPath(imageValue)}" alt="">`;
                                    }
                                });
                            }
                            previewHTML += '</div></div>';
                            attachmentNotif = `<span class="live-note-attachments-wrapper"><span class="live-note-attachments">↪ ${attachments.join(', ')}</span>${previewHTML}</span>`;
                        }

                        // Note: The whole bubble link target is now flat inside the container to avoid nested anchor errors
                        html += `
                <div class="live-note-item">
                    <a href="${noteLink}" class="live-note-bubble-target"></a>
                    ${attachmentNotif}
                    <p class="live-note-text">${noteText}</p>
                    <span class="live-note-time">${timeAgo(note.date)}</span>
                </div>
            `;
                    });

                    html += `
            </div>
<a href="${rootPrefix}all-publications/?lang=${currentLanguage}" class="live-notes-show-all">
                ${getLocalizedValue(data.showAllLiveNotes)}
            </a>
        `;

                    itemDiv.innerHTML = html;
                    //console.log(`Adding live-notes sidebar item with ${liveNotes.length} notes`, { side });
                    grid.appendChild(itemDiv);
                }
            }
        });
    }
}

// Function to set localized text
function setBaseLocalizedText() {
    const language = getCurrentLanguage();
    const rootPrefix = getRootPrefix();

    fetchSiteData().then(data => {
        // Only set generic site title on non-article pages
        // const isArticlePage = window.location.pathname.includes('/article');
        // if (!isArticlePage) {
        //     document.title = getLocalizedValue(data.siteTitle);
        // }

        // Insert navigation
        insertNav(data);
        setupMobileExperience(data);
        // ... rest of your existing function code ...

        // Update text for footer grid item 1
        const footerGridItem1 = document.querySelector('#footer-grid-item1 .footer-grid-item-list').children;
        data.footer[0]["footer-grid-item1"].forEach((item, index) => {
            if (footerGridItem1[index]) {
                footerGridItem1[index].querySelector('a').textContent = getLocalizedValue(item);
            }
        });

        // Update text for footer grid item 2
        const footerGridItem2 = document.querySelector('#footer-grid-item2 .footer-grid-item-list').children;
        data.footer[1]["footer-grid-item2"].forEach((item, index) => {
            if (footerGridItem2[index]) {
                footerGridItem2[index].querySelector('a').textContent = getLocalizedValue(item);
            }
        });

        // Update text for footer grid item 3
        const footerGridItem3 = document.querySelector('#footer-grid-item3 .footer-grid-item-list').children;
        data.footer[2]["footer-grid-item3"].forEach((item, index) => {
            if (footerGridItem3[index]) {
                footerGridItem3[index].querySelector('a').textContent = getLocalizedValue(item);
            }
        });

        // Update text for footer grid item 4
        const footerGridItem4 = document.querySelector('#footer-grid-item4 .footer-grid-item-list').children;
        data.footer[3]["footer-grid-item4"].forEach((item, index) => {
            if (footerGridItem4[index]) {
                footerGridItem4[index].querySelector('a').textContent = getLocalizedValue(item);
            }
        });

        // Set the footer below text
        // Change .textContent to .innerHTML
        const footerElement = document.querySelector('.footer-below-text');
        if (footerElement) {
            footerElement.innerHTML = getLocalizedValue(data.footer[4]["footer-grid-item-below"][0]);
        }
        footerElement.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
                link.setAttribute('href', prefixRootPath(href));
            }
        });

        // Populate sidebars
        populateSidebar('left', data);
        populateSidebar('right', data);
    })
        .catch(error => console.error('Error loading localized text:', error));
}

// Function to update the navigation links with the current language
function updateNavigationLinks() {
    const lang = getCurrentLanguage(); // Get current language (from URL or default)
    const links = document.querySelectorAll('.navigation-link');

    links.forEach(link => {
        let href = link.getAttribute('href');

        // Check if the link already contains a lang parameter
        if (href.includes('?lang=') || href.includes('&lang=')) {
            return; // Skip links that already have a language parameter
        }

        // If the link does not contain a language parameter, add it
        if (href.includes('?')) {
            link.setAttribute('href', href + '&lang=' + lang);
        } else {
            link.setAttribute('href', href + '?lang=' + lang);
        }
    });

    // Also update logo and navigation title links
    const logoLink = document.getElementById('logo-link');
    if (logoLink) {
        let href = logoLink.getAttribute('href');
        if (!href.includes('lang=')) {
            if (href.includes('?')) {
                logoLink.setAttribute('href', href + '&lang=' + lang);
            } else {
                logoLink.setAttribute('href', href + '?lang=' + lang);
            }
        }
    }
    const navTitle = document.getElementById('navigation-title-text');
    if (navTitle) {
        let href = navTitle.getAttribute('href');
        if (!href.includes('lang=')) {
            if (href.includes('?')) {
                navTitle.setAttribute('href', href + '&lang=' + lang);
            } else {
                navTitle.setAttribute('href', href + '?lang=' + lang);
            }
        }
    }

    // Update footer links
    const footerLinks = document.querySelectorAll('footer a.footer-text');
    footerLinks.forEach(link => {
        let href = link.getAttribute('href');
        if (href && !href.includes('lang=') && !href.startsWith('http') && !href.startsWith('#')) {
            if (href.includes('?')) {
                link.setAttribute('href', href + '&lang=' + lang);
            } else {
                link.setAttribute('href', href + '?lang=' + lang);
            }
        }
    });
}

// Ensure that setLocalizedText is called on page load
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('resize', updateMobileLayoutState);
    insertFooter();
    setBaseLocalizedText(); // Update header and footer text based on the current language
    updateNavigationLinks(); // Update navigation links based on the current language
    // setFavicon(); // Set the site favicon
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

function insertFooter() {
    const rootPrefix = getRootPrefix();
    const footerHTML = `
<footer>
    <div class="footer-grid">
        <div class="footer-grid-item" id="footer-grid-item1">
            <ul class="footer-grid-item-list">
                <li><a class="footer-bold-text">Socials</a></li>
                <li><a href="https://t.me/grycko_the_hague_couloir" class="footer-text">Footer text</a></li>
                <li><a href="https://www.linkedin.com/in/hryhorii-bavykin/" class="footer-text">Footer text</a></li>
            </ul>
        </div>
        <div class="footer-grid-item" id="footer-grid-item2">
            <ul class="footer-grid-item-list">
                <li><a class="footer-bold-text">Footer text</a></li>
                <li><a href="${rootPrefix}" class="footer-text">Footer text</a></li>
                <li><a href="${rootPrefix}all-publications/" class="footer-text">Footer text</a></li>
                <li><a href="${rootPrefix}about/" class="footer-text">Footer text</a></li>
            </ul>
        </div>
        <div class="footer-grid-item" id="footer-grid-item3">
            <ul class="footer-grid-item-list">
                <li><a class="footer-bold-text">Footer text</a></li>
                <li><a href="${rootPrefix}about/#name" class="footer-text">Footer text</a></li>
                <li><a href="${rootPrefix}about/#author" class="footer-text">Footer text</a></li>
                <li><a href="${rootPrefix}about/#contact" class="footer-text">Footer text</a></li>
            </ul>
        </div>
        <div class="footer-grid-item" id="footer-grid-item4">
            <ul class="footer-grid-item-list">
                <li><a class="footer-bold-text">Footer text</a></li>
                <li><a href="#" onclick="changeLanguage('en')" class="footer-text">Footer text</a></li>
                <li><a href="#" onclick="changeLanguage('ru')" class="footer-text">Footer text</a></li>
            </ul>
        </div>
    </div>
    <p class="footer-below-text">Something</p>
</footer>
    `;
    document.body.insertAdjacentHTML('beforeend', footerHTML);
}
