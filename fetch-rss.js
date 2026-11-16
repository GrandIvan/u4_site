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
  
  // СОХРАНЯЕМ HTML ДЛЯ ОТЛАДКИ
  fs.writeFileSync(`debug_${channel}.html`, html);
  
  if (html.length < 5000) {
    console.log(`⚠️ ВНИМАНИЕ: Получен слишком короткий HTML (${html.length} байт). Возможно, Telegram выдал капчу.`);
  }

  const $ = cheerio.load(html);
  const postsMap = new Map();

  $('.tgme_widget_message_wrap').each((i, el) => {
    const $el = $(el);
    const $msg = $el.find('.tgme_widget_message');
    if (!$msg.length) return;

    const postId = $msg.attr('data-post');
    if (!postId) return;

    // Фильтр репостов
    if ($el.find('.tgme_widget_message_forwarded_from').length > 0) {
      return; 
    }

    // Ищем "пузырь" сообщения (там где лежит контент)
    const $bubble = $el.find('.tgme_widget_message_bubble');
    if (!$bubble.length) return;

    // Клонируем пузырь, чтобы удалить лишнее и не сломать оригинал
    const $clone = $bubble.clone();

    // УДАЛЯЕМ СЛУЖЕБНЫЙ МУСОР ИЗ КЛОНА:
    // (имя канала, время, кнопки "Присоединиться", ответы, просмотры и т.д.)
    $clone.find('.tgme_widget_message_user, .tgme_widget_message_footer, .tgme_widget_message_meta, .tgme_widget_message_views, .tgme_widget_message_author, .tgme_widget_message_reply, .tgme_widget_message_inline_keyboard, .tgme_widget_message_link_preview, .tgme_widget_message_forwarded_from').remove();

    // Заменяем переносы строк
    $clone.find('br').replaceWith('\n');
    
    // Собираем оставшийся текст
    let text = $clone.text().trim();

    // Если внутри пузыря остались какие-то ссылки-превью, аккуратно достаем их
    const $linkPreview = $el.find('.tgme_widget_message_link_preview');
    if ($linkPreview.length) {
      const lpTitle = $linkPreview.find('.link_preview_title').text().trim();
      const lpDesc = $linkPreview.find('.link_preview_description').text().trim();
      if (lpTitle) text += (text ? '\n' : '') + lpTitle;
      if (lpDesc) text += '\n' + lpDesc;
    }

    // Ищем ВСЕ картинки внутри поста (по стилям background-image)
    let images = [];
    $el.find('a.tgme_widget_message_photo_wrap, a.tgme_widget_message_video_thumb, .tgme_widget_message_link_preview_thumb, .tgme_widget_message_document_thumb').each((j, media) => {
      const style = $(media).attr('style') || '';
      const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
      if (match && !images.includes(match[1])) {
        images.push(match[1]);
      }
    });

    // Если нашли хоть какой-то текст или картинку — сохраняем
    if (text || images.length > 0) {
      postsMap.set(postId, {
        id: postId,
        text: text,
        images: images,
        date: $el.find('time').attr('datetime') || '',
        link: 'https://t.me/' + postId
      });
    } else {
      console.log(`[!] Пост ${postId} оказался абсолютно пустым (нет ни текста, ни картинок).`);
    }
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

    if (!title) {
      title = post.images.length > 0 ? 'Медиа-пост' : 'Новый пост';
      if (!description) description = 'Без описания';
    }

    console.log(`[✓ Пост ${post.id}] Заголовок: "${title.substring(0, 30)}...", Текст: ${finalText.length} симв., Картинок: ${post.images.length}`);

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