const fs = require('fs');
const cheerio = require('cheerio');


const NEWS_CHANNEL = 'uchastie_official';
const INIT_CHANNEL = 'luxury_tax_2026'; 

async function fetchTelegram(channel, limit) {
  const url = `https://t.me/s/${channel}`;
  console.log(`Скачиваем HTML: ${url}`);
  
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
    
    // Пропускаем пустые посты (только фото без текста)
    if (text && text.length > 5) {
      items.push({
        title: text.split('\n')[0].substring(0, 80) + (text.length > 80 ? '...' : ''),
        description: text,
        pubDate: date,
        link: link.startsWith('http') ? link : 'https://t.me/' + link.replace(/^\//, '')
      });
    }
  });

  // Переворачиваем массив, чтобы свежие посты были первыми
  return items.reverse().slice(0, limit);
}

async function start() {
  try {
    // Новости (9 штук)
    console.log(`--- Скачиваем новости из @${NEWS_CHANNEL} ---`);
    const news = await fetchTelegram(NEWS_CHANNEL, 9);
    fs.writeFileSync('news.json', JSON.stringify(news, null, 2));
    console.log(`✓ news.json сохранен (${news.length} шт)`);
  } catch (e) {
    console.error(`✗ Ошибка с новостями:`, e.message);
    if (!fs.existsSync('news.json')) fs.writeFileSync('news.json', '[]');
  }

  try {
    // Инициативы (6 штук)
    console.log(`--- Скачиваем инициативы из @${INIT_CHANNEL} ---`);
    const inits = await fetchTelegram(INIT_CHANNEL, 6);
    fs.writeFileSync('initiatives.json', JSON.stringify(inits, null, 2));
    console.log(`✓ initiatives.json сохранен (${inits.length} шт)`);
  } catch (e) {
    console.error(`✗ Ошибка с инициативами:`, e.message);
    if (!fs.existsSync('initiatives.json')) fs.writeFileSync('initiatives.json', '[]');
  }
}

start();
