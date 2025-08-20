require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');

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

app.get('/api/download', async (req, res) => {
  const { url, type, quality } = req.query;

  if (!url) {
    return res.status(400).send('URL do YouTube inválida.');
  }

  // 🔹 SSE headers (mantive igual ao seu código)
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

    // Definir formato
    const format = type === 'audio' ? 'bestaudio' : 'bestvideo+bestaudio';
    const outputTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');

    // Montar comando yt-dlp
    const cmd = `yt-dlp -f ${format} -o "${outputTemplate}" "${url}"`;

    console.log("▶️ Executando:", cmd);

    const process = exec(cmd);

    process.stdout.on('data', (data) => {
      console.log(data.toString());
      // Se yt-dlp imprimir progresso, envia pro cliente
      sendProgress({ statusText: data.toString().trim() });
    });

    process.stderr.on('data', (data) => {
      console.error("⚠️ yt-dlp stderr:", data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        sendProgress({
          statusText: 'Download completo!',
          progress: 100,
        });
      } else {
        sendProgress({ error: `yt-dlp falhou com código ${code}` });
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
