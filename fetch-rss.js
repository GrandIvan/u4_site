const fs = require('fs');

const FEEDS = {
  news: 'https://rss.app/feeds/MqFQDVEmEcczbBix.xml',
  initiatives: 'https://rss.app/feeds/cPU2ZPrtiDXSpzFx.xml'
};

async function parseFeed(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const text = await response.text();
  
  // Минимальный серверный регулярный парсер XML без использования DOMParser браузера
  const items = [];
  const regex = /<item>([\s\(\S\)]*?)<\/item>/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const itemContent = match[1];
    
    const getTag = (tag) => {
      const tRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`);
      const m = itemContent.match(tRegex);
      if (!m) return '';
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '\$1').trim();
    };

    const linkMatch = itemContent.match(/<link[^>]*>([\s\(\S\)]*?)<\/link>/) || itemContent.match(/<guid[^>]*>([\s\(\S\)]*?)<\/guid>/);
    const link = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '\$1').trim() : '#';

    items.push({
      title: getTag('title'),
      description: getTag('description') || getTag('summary'),
      pubDate: getTag('pubDate') || getTag('published'),
      link: link
    });
  }
  return items;
}

async function start() {
  for (const [key, url] of Object.entries(FEEDS)) {
    try {
      console.log(`Скачиваем поток для: ${key}...`);
      const data = await parseFeed(url);
      fs.writeFileSync(`${key}.json`, JSON.stringify(data, null, 2));
      console.log(`✓ Файл ${key}.json успешно сохранен. Найдено элементов: ${data.length}`);
    } catch (e) {
      console.error(`Ошибка при обработке ${key}:`, e.message);
      // Если это первый запуск и файлов нет, создаем пустые массивы, чтобы фронтенд не падал
      if (!fs.existsSync(`${key}.json`)) {
        fs.writeFileSync(`${key}.json`, JSON.stringify([]));
      }
    }
  }
}

start();
