(function () {
  'use strict';

  // 1. Вставляем шапку в начало body
  const headerHTML = `
  <header class="site-header" id="header">
    <div class="container header-inner">
      <a href="index.html" class="logo">
        <img src="logo.png" alt="Логотип «Участие»" class="logo-img">
        <span class="logo-text">Участие<span>Левое демократическое движение</span></span>
      </a>
      <nav class="nav" id="nav">
        <a href="printsipy.html">Принципы</a>
        <a href="concept.html">Концептуальная основа</a>
        <a href="index.html#news">Новости</a>
        <a href="index.html#initiatives">Инициативы</a>
        <a href="index.html#authors">Авторские материалы</a>
        <a href="https://t.me/Uchastie_join_bot" class="nav-cta">Присоединиться</a>
      </nav>
      <button class="burger" id="burger" aria-label="Открыть меню" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>
  `;

  // 2. Вставляем подвал в конец body
  const footerHTML = `
  <footer class="footer">
    <div class="container">
      <div class="footer-top">
        <div>
          <a href="index.html" class="logo">
            <img src="logo_inv.jpg" alt="Логотип «Участие»" class="logo-img">
            <span class="logo-text">Участие<span>Левое демократическое движение</span></span>
          </a>
          <p class="footer-about">Организация, работающая на основе открытости, ответственности и уважения к каждому гражданину.</p>
          <div class="socials">
            <a href="https://t.me/uchastie_official" aria-label="Telegram">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 19 19.1c-.2 1-.8 1.2-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.6-.2L7.5 13.3 3 11.9c-1-.3-1-1 .2-1.5L20.4 3.4c.8-.3 1.6.2 1.5.9Z"/></svg>
            </a>
            <a href="https://youtube.com/channel/UCxE_W3-qn47tEtIrJo8GdoA?si=vG24kawbLqkXSO-W" aria-label="YouTube">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.8 12 4.8 12 4.8s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 4.8 2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-4.8ZM9.9 15.2V8.8L15.4 12l-5.5 3.2Z"/></svg>
            </a>
          </div>
        </div>
        <div>
          <h5>Движение</h5>
          <ul>
            <li><a href="printsipy.html">Принципы</a></li>
            <li><a href="concept.html">Концептуальная основа</a></li>
          </ul>
        </div>
        <div>
          <h5>Участие</h5>
          <ul>
            <li><a href="https://t.me/Uchastie_join_bot">Вступить в организацию</a></li>
            <li><a href="index.html#news">Новости</a></li>
            <li><a href="index.html#initiatives">Инициативы</a></li>
            <li><a href="index.html#authors">Авторские материалы</a></li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
  `;

  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  document.body.insertAdjacentHTML('beforeend', footerHTML);

  // 3. Инициализация меню (Бургер и "липкая" шапка)
  setTimeout(function() {
    const header = document.getElementById('header');
    const burger = document.getElementById('burger');
    const nav = document.getElementById('nav');
    
    if (header && burger && nav) {
      const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });

      function closeMenu() {
        nav.classList.remove('open');
        burger.classList.remove('open');
        header.classList.remove('menu-open');
        burger.setAttribute('aria-expanded', 'false');
      }

      burger.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        burger.classList.toggle('open', open);
        header.classList.toggle('menu-open', open);
        burger.setAttribute('aria-expanded', String(open));
      });

      nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
      window.addEventListener('resize', () => { if (window.innerWidth > 860) closeMenu(); });
    }
  }, 10);
})();
