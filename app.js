(function () {
  'use strict';

  // 1. Словарь замен эмодзи на картинки
  const EMOJI_MAP = {
    '💢': 'emoji/fist.webp',
    '🏦': 'emoji/building.webp',
    '📉': 'emoji/down.webp',
    '🔈': 'emoji/megaphone.webp',
    '🔁': 'emoji/link.webp',
    '⏩': 'emoji/arrows-circle.webp',
    '⭐': 'emoji/idea.webp', 
    '🌈': 'emoji/leaves.webp', 
    '📋': 'emoji/list.webp',
    '📎': 'emoji/clip.webp',
    '📶': 'emoji/wifi.webp',
    '✉️': 'emoji/chat.webp', 
    '📨': 'emoji/chat.webp',
    '🔧': 'emoji/wrench.webp',
    '🏠': 'emoji/home.webp',
    '🏢': 'emoji/building.webp',
    '💰': 'emoji/money.webp',
    '👥': 'emoji/crowd.webp',
    '🔆': 'emoji/idea.webp',
    '🔤': 'emoji/typewriter.webp',
    '🧠': 'emoji/brain.webp',
    '❗': 'emoji/alert.webp',
    '📢': 'emoji/megaphone.webp',
    '❓': 'emoji/question.webp',
    '🔄': 'emoji/arrows-circle.webp',
    '❌': 'emoji/crowd.webp',
    '💯': 'emoji/hundred.webp',
    '✨': 'emoji/idea.webp',
    '✅': 'emoji/checkbox.webp',
    '💬': 'emoji/chat.webp',
    '🤝': 'emoji/handshake.webp',
    '📓': 'emoji/typewriter.webp',
    '💿': 'emoji/dot.webp',
    '🏴‍☠️': 'emoji/flag.webp',
    '🔴': 'emoji/dot.webp',
    '✍️': 'emoji/hand-pen.webp',
    '❤️': 'emoji/fire.webp', 
    '🧱': 'emoji/building.webp',
    '🪜': 'emoji/list.webp',
    '🌱': 'emoji/leaves.webp',
    '👉': 'emoji/arrows.webp',
    '🖌️': 'emoji/feather.webp',
    '✏️': 'emoji/feather.webp',
    '⭕': 'emoji/dot.webp',
    '👁️': 'emoji/search.webp',
    '🚌': 'emoji/bus.webp',
    '🚩': 'emoji/flag.webp',
    '🕒': 'emoji/clock.webp',
    '🪧': 'emoji/list.webp',
    '🚫': 'emoji/alert.webp',
    '⚪': 'emoji/dot.webp',
    '⬆️': 'emoji/arrows.webp',
    '↗️': 'emoji/arrows.webp',
    '↩️': 'emoji/arrows.webp',
    '🪝': 'emoji/trident.webp',
    '♀️': 'emoji/feminist.webp',
    '☑️': 'emoji/checkbox.webp',
    '🪶': 'emoji/feather.webp',
    '🔑': 'emoji/key.webp',
    '💡': 'emoji/idea.webp',
    '⛓️': 'emoji/chain.webp',
    '🪢': 'emoji/chain.webp',
    '♨️': 'emoji/fire.webp',
    '✊': 'emoji/fist.webp',
    '🕊️': 'emoji/dove.webp',
    '🏳️': 'emoji/dove.webp',
    '🎤': 'emoji/microphone.webp',
    '📖': 'emoji/book.webp',
    '🍃': 'emoji/leaves.webp',
    '🚀': 'emoji/rocket.webp',
    '🌐': 'emoji/globe.webp',
    '🔍': 'emoji/search.webp',
    '⚙️': 'emoji/gear.webp',
    '📍': 'emoji/location.webp',
    '📅': 'emoji/calendar.webp',
    '🏛️': 'emoji/building.webp'
  };

  // 2. Функция замены эмодзи (учитывает невидимые символы)
  function replaceEmojis(text) {
    if (!text) return '';
    let result = text;
    for (const [emoji, path] of Object.entries(EMOJI_MAP)) {
      const cleanEmoji = emoji.replace(/\uFE0F/g, '');
      const imgTag = '<img src="' + path + '" class="tg-emoji" alt="">';
      result = result.split(emoji).join(imgTag).split(cleanEmoji).join(imgTag);
    }
    return result;
  }

  // 3. Форматирование даты
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const months = ['января','февраля','марта','апреля','мая','июня',
                    'июля','августа','сентября','октября','ноября','декабря'];
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  // 4. Очистка текста от опасных тегов (оставляет картинки, если они есть)
  function cleanText(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('script, style, iframe').forEach(el => el.remove());
    return tmp.innerHTML.trim();
  }

  // 5. Отрисовка карточек
  function renderCards(grid, loading, items, cfg) {
    if (!grid) return;
    grid.innerHTML = '';

    if (!items || !items.length) {
      if (loading) loading.textContent = 'Нет доступных данных.';
      return;
    }

    items.slice(0, cfg.count).forEach(function (item, i) {
      const rawTitle = replaceEmojis(cleanText(item.title)) || 'Без названия';
      const rawDesc = replaceEmojis(cleanText(item.description));
      const desc = rawDesc || 'Подробнее по ссылке.';

      const date  = formatDate(item.pubDate);
      const link  = item.link || '#';

      const imgSrc = item.image ? item.image : cfg.favicon;
      const imgClass = item.image ? '' : 'is-full';

      const card = document.createElement('article');
      card.className = 'news-card reveal';
      card.style.transitionDelay = (i * 80) + 'ms';

      card.innerHTML =
        '<div class="news-thumb">' +
          '<img src="' + imgSrc + '" class="' + imgClass + '" alt="" loading="lazy" referrerpolicy="no-referrer" ' +
          'onerror="this.onerror=null;this.src=\'' + cfg.favicon + '\';this.className=\'is-full\';">' +
        '</div>' +
        '<div class="news-body">' +
          '<div class="news-meta">' +
            '<span>' + cfg.label + '</span>' +
            '<span class="dot"></span>' +
            '<span class="date">' + date + '</span>' +
          '</div>' +
          '<h3>' + rawTitle + '</h3>' +
          '<p>' + desc + '</p>' +
          '<a class="news-link" href="' + link + '" target="_blank" rel="noopener">' +
            cfg.linkText +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
            'stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
          '</a>' +
        '</div>';

      grid.appendChild(card);
    });

    if (loading) loading.remove();

    setTimeout(function () {
      grid.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('in');
      });
    }, 50);
  }

  // 6. Загрузка данных из JSON
  async function loadBlock(jsonPath, gridId, loadingId, cfg) {
    const grid = document.getElementById(gridId);
    const loading = document.getElementById(loadingId);

    try {
      const res = await fetch('./' + jsonPath + '?t=' + Date.now());
      if (!res.ok) throw new Error('Файл не найден (404)');
      const items = await res.json();
      renderCards(grid, loading, items, cfg);
    } catch (err) {
      console.error('[Load Error] ' + jsonPath, err);
      if (loading) {
        loading.textContent = 'Не удалось загрузить данные.';
        loading.style.color = '#DC2626';
      }
    }
  }

  // 7. Запуск загрузки для всех блоков
  loadBlock('news.json', 'newsGrid', 'newsLoading', {
    count: 6,
    favicon: 'android-chrome-512x512.png',
    label: 'Новость',
    linkText: 'Читать в Telegram'
  });

  loadBlock('initiatives.json', 'initiativesGrid', 'initiativesLoading', {
    count: 3,
    favicon: 'nolog_logo.png',
    label: 'Инициатива',
    linkText: 'Читать в Telegram'
  });

  loadBlock('avtory.json', 'authorsGrid', 'authorsLoading', {
    count: 6,
    favicon: 'nolog_logo.png',
    label: 'Авторское',
    linkText: 'Читать в Telegram'
  });

  // 8. Анимация появления блоков при скролле
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = Math.min(i * 70, 280);
          setTimeout(() => el.classList.add('in'), delay);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

})();
