const fs = require('fs');
const cheerio = require('cheerio');

const NEWS_CHANNEL = 'uchastie_official';
const INIT_CHANNEL = 'uchastie_official';

async function fetchTelegram(channel, limit) {
  const url = `https://t.me/s/${channel}`;
  console.log(`Скачиваем: ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];

  $('.tgme_widget_message_wrap').each((i, el) => {
    const textEl = $(el).find('.tgme_widget_message_text');
    textEl.find('br').replaceWith('\n');

    // --- НОВОЕ: Вытаскиваем фирменные эмодзи ---
    textEl.find('i.emoji').each((_, emojiEl) => {
      const style = $(emojiEl).attr('style') || '';
      const match = style.match(/background-image:url\(['"]?(https?:\/\/[^'"]+)['"]?\)/);
      if (match) {
        // Заменяем тег эмодзи на картинку
        $(emojiEl).replaceWith(`<img src="${match[1]}" class="tg-emoji" style="width:1.2em;height:1.2em;vertical-align:-0.2em;display:inline-block;margin:0 2px;">`);
      }
    });

    // Очищаем от всех тегов, кроме <img> и <br>
    let cleanHtml = textEl.html() || '';
    cleanHtml = cleanHtml.replace(/<(?!\/?(br|img)\b)[^>]+>/gi, '');
    const text = cleanHtml.trim();

    const link = $(el).find('.tgme_widget_message_date').attr('href') || '';
    const date = $(el).find('time').attr('datetime') || '';

    // Картинка поста
    let image = '';
    const photoWrap = $(el).find('.tgme_widget_message_photo_wrap');
    if (photoWrap.length) {
      const style = photoWrap.attr('style') || '';
      const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
      if (match) image = match[1];
    }

    // Разбиваем текст на заголовок и описание
    let title = '';
    let description = '';

    if (text) {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 1) {
        title = lines[0];
        description = lines.slice(1).join(' ');
      } else {
        title = text;
        description = '';
      }
    }

    if (!title && image) title = 'Новый пост';

    if (text.length > 3 || image) {
      items.push({
        title: title,
        description: description,
        pubDate: date,
        link: link.startsWith('http') ? link : 'https://t.me/' + link.replace(/^\//, ''),
        image: image
      });
    }
  });

  return items.reverse().slice(0, limit);
}

async function start() {
  try {
    console.log(`--- Новости ---`);
    const news = await fetchTelegram(NEWS_CHANNEL, 9);
    fs.writeFileSync('news.json', JSON.stringify(news, null, 2));
    console.log(`✓ news.json (${news.length} шт)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }

  try {
    console.log(`--- Инициативы ---`);
    const inits = await fetchTelegram(INIT_CHANNEL, 6);
    fs.writeFileSync('initiatives.json', JSON.stringify(inits, null, 2));
    console.log(`✓ initiatives.json (${inits.length} шт)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

start();
