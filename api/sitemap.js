const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  const filePath = join(process.cwd(), 'sitemap.xml');
  const xml = readFileSync(filePath, 'utf8');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
};