import express from "express";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json());

app.post("/api/download", (req, res) => {
  const { url, type, quality } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const output = path.join(__dirname, `download.${type === "audio" ? "mp3" : "mp4"}`);

  // comando yt-dlp
  let cmd = `yt-dlp -f ${quality || "best"} ${type === "audio" ? "--extract-audio --audio-format mp3" : ""} -o "${output}" "${url}"`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(stderr);
      return res.status(500).json({ error: "Download failed" });
    }

    res.download(output, (err) => {
      if (err) console.error(err);
      fs.unlinkSync(output); // apaga o arquivo depois de enviar
    });
  });
});

app.listen(4000, () => console.log("Servidor rodando em http://localhost:4000"));
