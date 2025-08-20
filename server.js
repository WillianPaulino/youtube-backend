require('dotenv').config();
const express = require('express');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
const PORT = process.env.PORT || 10000;

// 🔹 Configuração de CORS
app.use(cors({
  origin: "*", // 👉 troque pelo domínio do frontend em produção
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// Diretório de downloads
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}
app.use('/downloads', express.static(downloadsDir));

// 🔹 Proxy helper
function getRandomProxy() {
  if (!process.env.PROXIES) return null;
  const proxies = process.env.PROXIES.split(',');
  return proxies[Math.floor(Math.random() * proxies.length)].trim();
}

app.get('/api/download', async (req, res) => {
  const { url, type, quality } = req.query;

  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).send('URL do YouTube inválida.');
  }

  // 🔹 SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sendProgress = (data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    sendProgress({ statusText: 'Obtendo informações do vídeo...' });

    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[<>:"/\\|?*]+/g, '').trim();

    const fileExtension = type === 'audio' ? 'mp3' : 'mp4';
    const filename = `${title || 'video'}.${fileExtension}`;
    const filePath = path.join(downloadsDir, filename);

    // 🔹 Headers + Proxy
    let requestOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } };
    const proxy = getRandomProxy();
    if (proxy) {
      try {
        requestOptions.agent = new HttpsProxyAgent(proxy);
        console.log("🛰️ Usando proxy:", proxy);
      } catch (err) {
        console.warn("⚠️ Proxy inválido, ignorando:", proxy);
      }
    }

    const options = {
      quality: type === 'video'
        ? (quality === 'Low' ? 'lowest' : quality === 'Medium' ? '18' : 'highest')
        : 'highestaudio',
      filter: type === 'video' ? 'videoandaudio' : 'audioonly',
    };

    const stream = ytdl(url, { ...options, requestOptions });
    let downloaded = 0;
    let totalSize = 0;

    stream.on('response', (response) => {
      totalSize = parseInt(response.headers['content-length'], 10);
      sendProgress({ statusText: 'Iniciando download...', progress: 0 });
    });

    stream.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalSize > 0) {
        const progress = Math.min(100, (downloaded / totalSize) * 100);
        sendProgress({
          statusText: `Baixando... ${Math.round(progress)}%`,
          progress: progress,
        });
      }
    });

    stream.on('end', () => {
      sendProgress({
        statusText: 'Download completo!',
        progress: 100,
        downloadUrl: `${req.protocol}://${req.get('host')}/downloads/${encodeURIComponent(filename)}`, // 🔗 sem URL fixa
        filename: filename,
      });
      res.end();
    });

    stream.on('error', (err) => {
      console.error("❌ ERRO NO STREAM:", err);
      sendProgress({ error: `Falha ao baixar o vídeo: ${err.message}` });
      res.end();
    });

    stream.pipe(fs.createWriteStream(filePath));

    req.on('close', () => {
      stream.destroy();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.end();
    });

  } catch (error) {
    console.error("❌ ERRO DETALHADO NO BACKEND:", error);
    sendProgress({ error: `Erro no servidor: ${error.message}` });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de backend rodando na porta ${PORT}`);
});
