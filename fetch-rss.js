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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://t.me/'
      }
    });
    if (!res.ok) return false;
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(buffer));
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchTelegram(channel, limit) {
  const url = `https://t.me/s/${channel}`;
  console.log(`\n--- Скачиваем: ${url} ---`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const postsMap = new Map();

  $('.tgme_widget_message_wrap').each((i, el) => {
    const $el = $(el);
    const $msg = $el.find('.tgme_widget_message');
    if (!$msg.length) return;

    const postId = $msg.attr('data-post') || $el.attr('data-post');
    if (!postId) return;

    // Правильный фильтр репостов (только если есть блок "Переслано от")
    if ($el.find('.tgme_widget_message_forwarded_from').length > 0) {
      return; 
    }

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

    if (!post.date) post.date = $el.find('time').attr('datetime') || '';
    if (!post.link) {
      const href = $el.find('.tgme_widget_message_date').attr('href') || '';
      post.link = href.startsWith('http') ? href : 'https://t.me/' + href.replace(/^\//, '');
    }

    // 1. Извлекаем текст поста
    const $textEl = $el.find('.tgme_widget_message_text');
    if ($textEl.length) {
      $textEl.find('br').replaceWith('\n');
      const partText = $textEl.text().trim();
      if (partText) {
        post.text += (post.text ? '\n\n' : '') + partText;
      }
    }

    // 2. Извлекаем данные ПРЕВЬЮ ССЫЛКИ (исправлены классы!)
    const $linkPreview = $el.find('.tgme_widget_message_link_preview');
    if ($linkPreview.length) {
      const lpTitle = $linkPreview.find('.link_preview_title').text().trim();
      const lpDesc = $linkPreview.find('.link_preview_description').text().trim();
      
      if (lpTitle) post.text += (post.text ? '\n\n' : '') + lpTitle;
      if (lpDesc) post.text += '\n' + lpDesc;

      // Картинка из превью ссылки
      const $thumb = $linkPreview.find('.link_preview_image, .tgme_widget_message_link_preview_thumb');
      if ($thumb.length) {
        let imgUrl = '';
        const style = $thumb.attr('style') || '';
        const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
        if (match) imgUrl = match[1];
        else if ($thumb.is('img')) imgUrl = $thumb.attr('src');
        
        if (imgUrl && !post.images.includes(imgUrl)) post.images.push(imgUrl);
      }
    }

    // 3. Извлекаем опросы (если вдруг попадется)
    const $poll = $el.find('.tgme_widget_message_poll');
    if ($poll.length) {
      const pollQuestion = $poll.find('.tgme_widget_message_poll_question').text().trim();
      if (pollQuestion) post.text += (post.text ? '\n\n' : '') + '📊 ' + pollQuestion;
    }

    // 4. Извлекаем медиафайлы (картинки, видео-превью, стикеры)
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

  const items = Array.from(postsMap.values()).map(post => {
    let finalText = post.text.trim();
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

    // Жесткая гарантия, что заголовок не будет пустым
    if (!title) {
      if (post.images.length > 0) title = 'Медиа-пост';
      else title = 'Новый пост';
    }

    // Отладочный вывод в консоль
    console.log(`[Пост ${post.id}] Заголовок: "${title.substring(0, 25)}...", Текст: ${finalText.length} симв., Картинок: ${post.images.length}`);

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
      const filename = `${channel}_${item.link.split('/').pop()}_${i}.jpg`;
      const ok = await downloadImage(item.imageUrls[0], filename);
      if (ok) item.image = IMAGES_DIR + '/' + filename;
    }
    delete item.imageUrls; 
  }

  return result;
}

async function start() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);
  else fs.readdirSync(IMAGES_DIR).forEach(f => { try { fs.unlinkSync(path.join(IMAGES_DIR, f)); } catch(e) {} });

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