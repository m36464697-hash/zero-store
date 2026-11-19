import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT) || 3000;
const distDir = path.resolve(import.meta.dirname, 'dist');
const indexFile = path.join(distDir, 'index.html');

app.disable('x-powered-by');

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use((req, res, next) => {
  if (
    req.path === '/sw.js' ||
    req.path === '/manifest.webmanifest' ||
    req.path === '/index.html' ||
    /^\/workbox-.*\.js$/.test(req.path)
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  next();
});

if (fs.existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      maxAge: '1y',
      immutable: true,
      index: false,
      setHeaders: (res, filePath) => {
        const base = path.basename(filePath);
        if (
          base === 'index.html' ||
          base === 'sw.js' ||
          base === 'manifest.webmanifest' ||
          /^workbox-.*\.js$/.test(base)
        ) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
      },
    })
  );
}

app.get('*', (_req, res) => {
  if (!fs.existsSync(indexFile)) {
    res.status(503).send('Build output not found. Run "npm run build" first.');
    return;
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(indexFile);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Zero Store production server listening on http://0.0.0.0:${port}`);
});
