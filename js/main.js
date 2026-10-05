/**
 * main.js - Core UI interactions (Navigation, Mobile Drawer, Language Switch)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Drawer Toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const mobileDrawer = document.querySelector('.mobile-drawer');
  const mobileClose = document.querySelector('.mobile-drawer-close');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.add('open');
      document.body.style.overflow = 'hidden';
    });

    const closeDrawer = () => {
      mobileDrawer.classList.remove('open');
      document.body.style.overflow = '';
    };

    if (mobileClose) mobileClose.addEventListener('click', closeDrawer);
    mobileNavLinks.forEach(link => link.addEventListener('click', closeDrawer));
  }

  // 2. Header Scroll Effect (for Solid Header transitions if desired)
  const header = document.querySelector('.site-header');
  if (header && header.classList.contains('hero-header')) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // 3. Initialize Language Switcher
  initLanguageSwitcher();
});

/**
 * Language Switcher logic
 */
function initLanguageSwitcher() {
  const langBtns = document.querySelectorAll('.lang-btn');
  const currentLang = localStorage.getItem('nh_lang') || 'en';
  applyLanguage(currentLang);

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const activeLang = document.documentElement.getAttribute('lang') || 'en';
      const nextLang = activeLang === 'en' ? 'kn' : 'en';
      applyLanguage(nextLang);
      localStorage.setItem('nh_lang', nextLang);
    });
  });
}

function applyLanguage(lang) {
  document.documentElement.setAttribute('lang', lang);

  // Update button label
  const langBtns = document.querySelectorAll('.lang-btn');
  langBtns.forEach(btn => {
    btn.textContent = lang === 'en' ? 'ಕನ್ನಡ' : 'English';
    btn.setAttribute('aria-label', lang === 'en' ? 'Switch to Kannada' : 'Switch to English');
  });

  // Toggle bilingual elements if present
  document.querySelectorAll('[data-en][data-kn]').forEach(el => {
    const text = el.getAttribute(`data-${lang}`);
    if (text) {
      el.textContent = text;
    }
  });
}
