const express = require('express');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors()); // Necessário para Vercel consumir o Render
const PORT = process.env.PORT || 3001;

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

app.use('/downloads', express.static(downloadsDir));

app.get('/api/download', async (req, res) => {
  const { url, type, quality } = req.query;

  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).send('URL do YouTube inválida.');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
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

    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    };

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
        downloadUrl: `/downloads/${encodeURIComponent(filename)}`,
        filename: filename,
      });
      res.end();
    });

    stream.on('error', (err) => {
      console.error("ERRO NO STREAM:", err);
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
    console.error("ERRO DETALHADO NO BACKEND:", error);
    sendProgress({ error: `Erro no servidor: ${error.message}` });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de backend rodando na porta ${PORT}`);
});
