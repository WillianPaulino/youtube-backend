require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const ytdlp = require('yt-dlp-exec'); // 👉 substitui o exec

const app = express();
const PORT = process.env.PORT || 10000;

// 🔹 Configuração de CORS
app.use(cors({
  origin: "*", // 👉 depois troque pelo domínio do frontend em produção
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// Diretório de downloads
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}
app.use('/downloads', express.static(downloadsDir));

app.get('/api/download', async (req, res) => {
  const { url, type } = req.query;

  if (!url) {
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

    const format = type === 'audio' ? 'bestaudio' : 'bestvideo+bestaudio';
    const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');

    console.log("▶️ Executando yt-dlp-exec...");

    // 👉 Agora usando a lib ao invés de exec()
    const process = ytdlp(url, {
      f: format,
      o: outputTemplate,
      progress: true,
      dumpSingleJson: true
    });

    process.then(() => {
      sendProgress({ statusText: 'Download completo!', progress: 100 });
      res.end();
    }).catch(err => {
      console.error("⚠️ yt-dlp erro:", err);
      sendProgress({ error: "Falha ao baixar o vídeo." });
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
