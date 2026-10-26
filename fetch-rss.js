const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const NEWS_CHANNEL = 'uchastie_official';
const INIT_CHANNEL = 'luxury_tax_2026';
const AVTOR_CHANNEL = 'uchastie_lite'; // ← ВПИШИТЕ ИМЯ КАНАЛА

const IMAGES_DIR = 'images';

// Функция скачивания картинки
async function downloadImage(url, filename) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://t.me/'
      }
    });
    if (!res.ok) return false;
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(buffer));
    return true;
  } catch (e) {
    console.log(`Ошибка скачивания ${url}: ${e.message}`);
    return false;
  }
}

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
    const isForwarded = $(el).find('.tgme_widget_message_forwarded_from').length > 0;
    if (isForwarded) return;

    const textEl = $(el).find('.tgme_widget_message_text');
    textEl.find('br').replaceWith('\n');
    const text = textEl.text().trim();

    const link = $(el).find('.tgme_widget_message_date').attr('href') || '';
    const date = $(el).find('time').attr('datetime') || '';

    let imageUrl = '';

    // Фото
    const photoWrap = $(el).find('.tgme_widget_message_photo_wrap');
    if (photoWrap.length) {
      const style = photoWrap.attr('style') || '';
      const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
      if (match) imageUrl = match[1];
    }

    // Видео
    if (!imageUrl) {
      const videoThumb = $(el).find('.tgme_widget_message_video_thumb');
      if (videoThumb.length) {
        const style = videoThumb.attr('style') || '';
        const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
        if (match) imageUrl = match[1];
      }
    }

    // Ссылка
    if (!imageUrl) {
      const linkThumb = $(el).find('.tgme_widget_message_link_preview_thumb');
      if (linkThumb.length) {
        const style = linkThumb.attr('style') || '';
        const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
        if (match) imageUrl = match[1];
      }
    }

    let title = '';
    let description = '';

    if (text) {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 1 && lines[0].length <= 100) {
        title = lines[0];
        description = lines.slice(1).join(' ');
      } else {
        const match = text.match(/^(.{10,120}?[.!?])(\s|$)/);
        if (match) {
          title = match[1].trim();
          description = text.slice(match[0].length).trim();
        } else {
          title = text.slice(0, 110).trim();
          description = text.slice(110).trim();
        }
      }
    }

    if (!title && imageUrl) title = 'Новый пост';

    if (text.length > 3 || imageUrl) {
      items.push({
        title: title,
        description: description,
        pubDate: date,
        link: link.startsWith('http') ? link : 'https://t.me/' + link.replace(/^\//, ''),
        imageUrl: imageUrl,  // временно
        image: ''            // сюда запишем локальный путь
      });
    }
  });

  // Ограничиваем количество
  const result = items.reverse().slice(0, limit);

  // Скачиваем картинки
  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    if (item.imageUrl) {
      const filename = `${channel}_${Date.now()}_${i}.jpg`;
      const ok = await downloadImage(item.imageUrl, filename);
      if (ok) {
        item.image = IMAGES_DIR + '/' + filename;
      }
    }
    delete item.imageUrl;
  }

  return result;
}

async function start() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
  } else {
    // Очищаем старые картинки, чтобы не забивать репозиторий
    fs.readdirSync(IMAGES_DIR).forEach(f => fs.unlinkSync(path.join(IMAGES_DIR, f)));
  }

  try {
    console.log(`--- Новости ---`);
    const news = await fetchTelegram(NEWS_CHANNEL, 6);
    fs.writeFileSync('news.json', JSON.stringify(news, null, 2));
    console.log(`✓ news.json (${news.length} шт)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }

  try {
    console.log(`--- Инициативы ---`);
    const inits = await fetchTelegram(INIT_CHANNEL, 3);
    fs.writeFileSync('initiatives.json', JSON.stringify(inits, null, 2));
    console.log(`✓ initiatives.json (${inits.length} шт)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }

  try {
    console.log(`--- Авторские материалы ---`);
    const avtory = await fetchTelegram(AVTOR_CHANNEL, 6);
    fs.writeFileSync('avtory.json', JSON.stringify(avtory, null, 2));
    console.log(`✓ avtory.json (${avtory.length} шт)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

start();
