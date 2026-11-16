const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Укажите ваши каналы
const NEWS_CHANNEL = 'uchastie_official';
const INIT_CHANNEL = 'luxury_tax_2026';
const AVTOR_CHANNEL = 'uchastie_lite';

const IMAGES_DIR = 'images';

// Функция скачивания картинки с защитой от протокол-относительных ссылок (//...)
async function downloadImage(url, filename) {
  try {
    // Telegram часто отдает ссылки вида //cdn4.telegram-cdn.org/...
    if (url.startsWith('//')) url = 'https:' + url;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
  console.log(`\n--- Скачиваем: ${url} ---`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // 1. ГРУППИРУЕМ ПОСТЫ ПО ID (чтобы альбомы и фото+текст не разрывались)
  const postsMap = new Map();

  $('.tgme_widget_message_wrap').each((i, el) => {
    const $el = $(el);
    const $msg = $el.find('.tgme_widget_message');
    const postId = $msg.attr('data-post'); // например, "uchastie_lite/1234"

    if (!postId) return;

    // Отсеиваем репосты (пересланные сообщения)
    const isForwarded = $el.find('.tgme_widget_message_forwarded_from, .tgme_widget_message_from_author').length > 0;
    // Если в тексте есть "Переслано от" или "Forwarded from", тоже пропускаем
    const forwardText = $el.find('.tgme_widget_message_from_author').text();
    if (isForwarded || forwardText.includes('Переслано от') || forwardText.includes('Forwarded from')) {
      return;
    }

    // Если пост еще нет в карте, создаем для него запись
    if (!postsMap.has(postId)) {
      postsMap.set(postId, {
        id: postId,
        text: '',
        images: [],
        date: '',
        link: ''
      });
    }

    const post = postsMap.get(postId);

    // Извлекаем дату и ссылку (они могут быть в любом из блоков, берем первый попавшийся)
    if (!post.date) post.date = $el.find('time').attr('datetime') || '';
    if (!post.link) {
      const href = $el.find('.tgme_widget_message_date').attr('href') || '';
      post.link = href.startsWith('http') ? href : 'https://t.me/' + href.replace(/^\//, '');
    }

    // Извлекаем текст
    const $textEl = $el.find('.tgme_widget_message_text');
    if ($textEl.length) {
      // Заменяем переносы строк на \n, чтобы сохранить абзацы
      $textEl.find('br').replaceWith('\n');
      const partText = $textEl.text().trim();
      if (partText) {
        post.text += (post.text ? '\n' : '') + partText;
      }
    }

    // Извлекаем ВСЕ возможные медиа (фото, видео, превью ссылок, документы, стикеры)
    const mediaSelectors = [
      '.tgme_widget_message_photo_wrap', 
      '.tgme_widget_message_video_thumb', 
      '.tgme_widget_message_link_preview_thumb', 
      '.tgme_widget_message_document_thumb',
      '.tgme_widget_message_sticker'
    ];

    mediaSelectors.forEach(selector => {
      $el.find(selector).each((j, media) => {
        let imgUrl = '';
        const style = $(media).attr('style') || '';
        const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
        
        if (match) {
          imgUrl = match[1];
        } else if ($(media).is('img')) {
          imgUrl = $(media).attr('src');
        } else if ($(media).is('video')) {
          imgUrl = $(media).attr('src'); // На случай прямых видео
        }

        if (imgUrl && !post.images.includes(imgUrl)) {
          post.images.push(imgUrl);
        }
      });
    });
  });

  // 2. ПРЕВРАЩАЕМ КАРТУ В МАССИВ И ОБРАБАТЫВАЕМ ТЕКСТ
  const items = Array.from(postsMap.values()).map(post => {
    let title = '';
    let description = post.text;

    // Логика разделения на заголовок и описание
    if (post.text) {
      const lines = post.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      if (lines.length > 1 && lines[0].length <= 120) {
        // Если первая строка короткая, берем ее как заголовок
        title = lines[0];
        description = lines.slice(1).join('\n');
      } else {
        // Иначе ищем первое предложение
        const match = post.text.match(/^(.{10,120}?[.!?])(\s|$)/);
        if (match) {
          title = match[1].trim();
          description = post.text.slice(match[0].length).trim();
        } else {
          // Если вообще нет точек, просто режем текст
          title = post.text.slice(0, 110).trim() + '...';
          description = post.text;
        }
      }
    }

    if (!title && post.images.length > 0) title = 'Новый пост';
    if (!title) title = 'Без названия';

    return {
      title: title,
      description: description,
      pubDate: post.date,
      link: post.link,
      imageUrls: post.images, // массив всех картинок поста
      image: '' // сюда запишем локальный путь
    };
  });

  // Ограничиваем количество (берем самые свежие посты)
  // В t.me/s/ посты идут от старых к новым, поэтому делаем reverse
  const result = items.reverse().slice(0, limit);

  // 3. СКАЧИВАЕМ КАРТИНКИ
  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    // Скачиваем только ПЕРВУЮ картинку поста (для превью), чтобы не забивать диск
    if (item.imageUrls && item.imageUrls.length > 0) {
      const filename = `${channel}_${item.link.split('/').pop()}_${i}.jpg`;
      const ok = await downloadImage(item.imageUrls[0], filename);
      if (ok) {
        item.image = IMAGES_DIR + '/' + filename;
      }
    }
    // Удаляем массив ссылок, чтобы не раздувать JSON
    delete item.imageUrls; 
  }

  return result;
}

async function start() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
  } else {
    // Очищаем старые картинки
    fs.readdirSync(IMAGES_DIR).forEach(f => {
      try { fs.unlinkSync(path.join(IMAGES_DIR, f)); } catch(e) {}
    });
  }

  const channels = [
    { name: NEWS_CHANNEL, file: 'news.json', limit: 6, label: 'Новости' },
    { name: INIT_CHANNEL, file: 'initiatives.json', limit: 3, label: 'Инициативы' },
    { name: AVTOR_CHANNEL, file: 'avtory.json', limit: 6, label: 'Авторские материалы' }
  ];

  for (const ch of channels) {
    try {
      console.log(`--- ${ch.label} ---`);
      const items = await fetchTelegram(ch.name, ch.limit);
      fs.writeFileSync(ch.file, JSON.stringify(items, null, 2));
      console.log(`✓ ${ch.file} (${items.length} шт)`);
    } catch (e) {
      console.error(`✗ Ошибка в канале ${ch.name}: ${e.message}`);
    }
  }
}

// Обработка неотловленных ошибок, чтобы скрипт не падал молча
process.on('unhandledRejection', error => {
  console.error('КРИТИЧЕСКАЯ ОШИБКА:', error);
  process.exit(1);
});

start();