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
    const text = textEl.text().trim();
    const link = $(el).find('.tgme_widget_message_date').attr('href') || '';
    const date = $(el).find('time').attr('datetime') || '';
    
    // Улучшенный поиск картинки
    let image = '';
    const photoWrap = $(el).find('.tgme_widget_message_photo_wrap');
    if (photoWrap.length) {
      const style = photoWrap.attr('style') || '';
      // Регулярка теперь ищет и одинарные, и двойные кавычки, и пробелы
      const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
      if (match) image = match[1];
    }

    if (text.length > 5 || image) {
      items.push({
        title: text ? text.split('\n')[0].substring(0, 80) + (text.length > 80 ? '...' : '') : 'Фото',
        description: text || 'Пост с изображением',
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
    console.log(`--- Скачиваем новости ---`);
    const news = await fetchTelegram(NEWS_CHANNEL, 9);
    fs.writeFileSync('news.json', JSON.stringify(news, null, 2));
    console.log(`✓ news.json (${news.length} шт)`);
  } catch (e) {
    console.error(`✗ Ошибка с новостями:`, e.message);
  }

  try {
    console.log(`--- Скачиваем инициативы ---`);
    const inits = await fetchTelegram(INIT_CHANNEL, 6);
    fs.writeFileSync('initiatives.json', JSON.stringify(inits, null, 2));
    console.log(`✓ initiatives.json (${inits.length} шт)`);
  } catch (e) {
    console.error(`✗ Ошибка с инициативами:`, e.message);
  }
}

start();
