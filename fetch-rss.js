const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const NEWS_CHANNEL = 'uchastie_official';
const INIT_CHANNEL = 'luxury_tax_2026';
const AVTOR_CHANNEL = 'uchastie_lite';

const IMAGES_DIR = 'images';

async function downloadImage(url, filename) {
  try {
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

  const postsMap = new Map();

  $('.tgme_widget_message_wrap').each((i, el) => {
    const $el = $(el);
    const $msg = $el.find('.tgme_widget_message');
    const postId = $msg.attr('data-post');

    if (!postId) return;

    // === 1. ЖЕСТКИЙ ФИЛЬТР РЕПОСТОВ ===
    // Ищем блок с пересылкой или текст "сделал репост"
    const $forwardBlock = $el.find('.tgme_widget_message_forwarded_from, .tgme_widget_message_from_author');
    const forwardText = $forwardBlock.text().toLowerCase();
    
    if ($forwardBlock.length > 0 || forwardText.includes('репост') || forwardText.includes('forwarded')) {
      return; // Пропускаем этот пост
    }

    if (!postsMap.has(postId)) {
      postsMap.set(postId, {
        id: postId,
        text: '',
        linkTitle: '',
        linkDesc: '',
        images: [],
        date: '',
        link: ''
      });
    }

    const post = postsMap.get(postId);

    if (!post.date) post.date = $el.find('time').attr('datetime') || '';
    if (!post.link) {
      const href = $el.find('.tgme_widget_message_date').attr('href') || '';
      post.link = href.startsWith('http') ? href : 'https://t.me/' + href.replace(/^\//, '');
    }

    // === 2. ИЗВЛЕКАЕМ ТЕКСТ ПОСТА ===
    const $textEl = $el.find('.tgme_widget_message_text');
    if ($textEl.length) {
      $textEl.find('br').replaceWith('\n');
      const partText = $textEl.text().trim();
      if (partText) {
        post.text += (post.text ? '\n' : '') + partText;
      }
    }

    // === 3. ИЗВЛЕКАЕМ ДАННЫЕ ПРЕВЬЮ ССЫЛКИ (если пост состоит только из ссылки) ===
    const $linkPreview = $el.find('.tgme_widget_message_link_preview');
    if ($linkPreview.length) {
      // Берем заголовок и описание ссылки
      if (!post.linkTitle) post.linkTitle = $linkPreview.find('.tgme_widget_message_link_preview_title').text().trim();
      if (!post.linkDesc) post.linkDesc = $linkPreview.find('.tgme_widget_message_link_preview_description').text().trim();
      
      // Берем картинку из превью ссылки
      const $thumb = $linkPreview.find('.tgme_widget_message_link_preview_thumb');
      if ($thumb.length) {
        const style = $thumb.attr('style') || '';
        const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
        if (match && !post.images.includes(match[1])) {
          post.images.push(match[1]);
        }
      }
    }

    // === 4. ИЗВЛЕКАЕМ КАРТИНКИ/ВИДЕО ===
    const mediaSelectors = [
      '.tgme_widget_message_photo_wrap', 
      '.tgme_widget_message_video_thumb', 
      '.tgme_widget_message_document_thumb',
      '.tgme_widget_message_sticker'
    ];

    mediaSelectors.forEach(selector => {
      $el.find(selector).each((j, media) => {
        let imgUrl = '';
        const style = $(media).attr('style') || '';
        const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
        
        if (match) imgUrl = match[1];
        else if ($(media).is('img')) imgUrl = $(media).attr('src');
        else if ($(media).is('video')) imgUrl = $(media).attr('src');

        if (imgUrl && !post.images.includes(imgUrl)) {
          post.images.push(imgUrl);
        }
      });
    });
  });

  // === 5. ФОРМИРУЕМ ЧИСТЫЕ ДАННЫЕ ===
  const items = Array.from(postsMap.values()).map(post => {
    let finalText = post.text;
    
    // Если в самом сообщении нет текста, но есть превью ссылки — используем его
    if (!finalText && (post.linkTitle || post.linkDesc)) {
      finalText = (post.linkTitle ? post.linkTitle + '\n' : '') + post.linkDesc;
    }

    let title = '';
    let description = finalText;

    if (finalText) {
      const lines = finalText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      if (lines.length > 1 && lines[0].length <= 120) {
        title = lines[0];
        description = lines.slice(1).join('\n');
      } else {
        const match = finalText.match(/^(.{10,120}?[.!?])(\s|$)/);
        if (match) {
          title = match[1].trim();
          description = finalText.slice(match[0].length).trim();
        } else {
          title = finalText.slice(0, 110).trim() + (finalText.length > 110 ? '...' : '');
          description = finalText;
        }
      }
    }

    // Если совсем нет текста, но есть картинка
    if (!title && post.images.length > 0) title = 'Медиа';
    if (!title) title = 'Новый пост';

    return {
      title: title,
      description: description,
      pubDate: post.date,
      link: post.link,
      imageUrls: post.images,
      image: ''
    };
  });

  const result = items.reverse().slice(0, limit);

  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    if (item.imageUrls && item.imageUrls.length > 0) {
      // Имя файла на основе ID поста (чтобы не перезаписывались)
      const filename = `${channel}_${item.link.split('/').pop()}_${i}.jpg`;
      const ok = await downloadImage(item.imageUrls[0], filename);
      if (ok) {
        item.image = IMAGES_DIR + '/' + filename;
      }
    }
    delete item.imageUrls; 
  }

  return result;
}

async function start() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR);
  } else {
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

process.on('unhandledRejection', error => {
  console.error('КРИТИЧЕСКАЯ ОШИБКА:', error);
  process.exit(1);
});

start();