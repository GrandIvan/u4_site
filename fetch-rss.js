const fs = require('fs');
const cheerio = require('cheerio');

const NEWS_CHANNEL = 'uchastie_official';
const INIT_CHANNEL = 'luxury_tax_2026';

async function fetchPage(channel, before = null) {
  let url = `https://t.me/s/${channel}`;
  if (before) url += `?before=${before}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return cheerio.load(html);
}

function parsePage($) {
  const items = [];

  $('.tgme_widget_message_wrap').each((i, el) => {
    // Пропускаем репосты
    if ($(el).find('.tgme_widget_message_forwarded_from').length > 0) return;

    const textEl = $(el).find('.tgme_widget_message_text');
    textEl.find('br').replaceWith('\n');
    const text = textEl.text().trim();

    const link = $(el).find('.tgme_widget_message_date').attr('href') || '';
    const date = $(el).find('time').attr('datetime') || '';

    let image = '';
    const photoWrap = $(el).find('.tgme_widget_message_photo_wrap');
    if (photoWrap.length) {
      const style = photoWrap.attr('style') || '';
      const match = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
      if (match) image = match[1];
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

    if (!title && image) title = 'Новый пост';
    if (!description) description = '';

    // Получаем ID поста (нужен для листания)
    const dataPost = $(el).find('.tgme_widget_message').attr('data-post') || '';
    const postId = dataPost.split('/').pop();

    if (text.length > 3 || image) {
      items.push({
        title: title,
        description: description,
        pubDate: date,
        link: link.startsWith('http') ? link : 'https://t.me/' + link.replace(/^\//, ''),
        image: image,
        _id: postId
      });
    }
  });

  return items;
}

async function fetchTelegram(channel, limit) {
  console.log(`Скачиваем: ${channel}`);
  let allItems = [];
  let before = null;

  // Делаем до 5 запросов (всего до 100 постов), пока не наберем нужное количество
  for (let page = 0; page < 5; page++) {
    const $ = await fetchPage(channel, before);
    const items = parsePage($);

    if (items.length === 0) break;

    allItems = items.concat(allItems); // новые посты добавляем в начало

    if (allItems.length >= limit) break;

    // Берем ID самого старого поста на странице для следующего запроса
    const oldestId = items[0]._id;
    if (!oldestId) break;
    before = oldestId;
  }

  // Убираем служебное поле _id и обрезаем до нужного количества
  return allItems.slice(-limit).map(({ _id, ...rest }) => rest);
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
