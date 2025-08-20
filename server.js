require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec'); // usando yt-dlp

const app = express();
const PORT = process.env.PORT || 10000;

// Configuração de CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// Diretório de downloads
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}
app.use('/downloads', express.static(downloadsDir));

// Rota de download
app.get('/api/download', async (req, res) => {
  const { url, type } = req.query;

  if (!url) {
    return res.status(400).send('URL do YouTube inválida.');
  }

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

    const format = type === 'audio' ? 'bestaudio' : 'bestvideo+bestaudio';
    const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');

    console.log("▶️ Executando youtube-dl-exec com cookies...");

    const process = youtubedl.exec(
      url,
      {
        format,
        output: outputTemplate,
        progress: true,
        dumpSingleJson: true,
        cookies: path.join(__dirname, 'cookies.txt') // 👈 usa cookies.txt
      },
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    process.stderr.on('data', (data) => {
      const str = data.toString();
      const match = str.match(/(\d+\.\d+)%/);
      if (match) {
        const progress = parseFloat(match[1]);
        sendProgress({ statusText: 'Baixando...', progress });
      }
    });

    process.on('close', (code) => {
      if (code === 0) {
        sendProgress({ statusText: 'Download completo!', progress: 100 });
      } else {
        sendProgress({ error: 'Falha no download.' });
      }
      res.end();
    });

  } catch (error) {
    console.error("❌ ERRO DETALHADO:", error);
    sendProgress({ error: `Erro no servidor: ${error.message}` });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
