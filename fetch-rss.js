const fs = require('fs');
const Parser = require('rss-parser');

// Добавляем User-Agent, чтобы rss.app не блокировал запрос
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

const FEEDS = {
  news: 'https://rss.app/feeds/MqFQDVEmEcczbBix.xml',
  initiatives: 'https://rss.app/feeds/cPU2ZPrtiDXSpzFx.xml'
};

async function start() {
  for (const [key, url] of Object.entries(FEEDS)) {
    try {
      console.log(`Скачиваем: ${key}...`);
      const feed = await parser.parseURL(url);
      
      const items = feed.items.map(item => ({
        title: item.title || '',
        description: item.contentSnippet || item.content || '',
        pubDate: item.pubDate || item.isoDate || '',
        link: item.link || '#'
      }));

      fs.writeFileSync(`${key}.json`, JSON.stringify(items, null, 2));
      console.log(`✓ ${key}.json успешно сохранен (${items.length} элементов)`);
    } catch (e) {
      console.error(`✗ Ошибка при скачивании ${key}:`, e.message);
      // Если файла нет вообще, создаем пустой массив, чтобы сайт не падал
      if (!fs.existsSync(`${key}.json`)) {
        fs.writeFileSync(`${key}.json`, JSON.stringify([]));
      }
    }
  }
}

start();
