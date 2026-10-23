const fs = require('fs');
const Parser = require('rss-parser');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

const FEEDS = {
  news: 'https://rss.app/feeds/MqFQDVEmEcczbBix.xml',
  initiatives: 'https://rss.app/feeds/cPU2ZPrtiDXSpzFx.xml'
};

// Способы скачивания: напрямую и через прокси
const GET_METHODS = [
  (url) => url, // 1. Напрямую
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, // 2. Через allorigins
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` // 3. Через codetabs
];

async function fetchWithFallback(url) {
  for (let i = 0; i < GET_METHODS.length; i++) {
    const fetchUrl = GET_METHODS[i](url);
    try {
      console.log(`Пробуем способ ${i + 1}...`);
      const feed = await parser.parseURL(fetchUrl);
      if (feed && feed.items && feed.items.length > 0) {
        return feed; // Если данные есть — возвращаем
      }
    } catch (e) {
      console.log(`Способ ${i + 1} не сработал: ${e.message}`);
    }
  }
  throw new Error('Все способы скачивания не удались');
}

async function start() {
  for (const [key, url] of Object.entries(FEEDS)) {
    try {
      console.log(`--- Скачиваем: ${key} ---`);
      const feed = await fetchWithFallback(url);
      
      const items = feed.items.map(item => ({
        title: item.title || '',
        description: item.contentSnippet || item.content || '',
        pubDate: item.pubDate || item.isoDate || '',
        link: item.link || '#'
      }));

      fs.writeFileSync(`${key}.json`, JSON.stringify(items, null, 2));
      console.log(`✓ Успех! ${key}.json сохранен (${items.length} новостей)`);
    } catch (e) {
      console.error(`✗ Ошибка при скачивании ${key}:`, e.message);
      // Если файлов нет вообще, создаем пустые, чтобы сайт не падал
      if (!fs.existsSync(`${key}.json`)) {
        fs.writeFileSync(`${key}.json`, JSON.stringify([]));
      }
    }
  }
}

start();
