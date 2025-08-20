# Caminho do projeto
$projectPath = "C:\Users\williian\Downloads\youtube-downloader-pwa\youtube-backend"
$cookiesFile = Join-Path $projectPath "cookies.txt"

# Abre cookies.txt para você colar os cookies exportados
notepad $cookiesFile
Read-Host "👉 Pressione ENTER depois de salvar o cookies.txt"

# Faz commit e push
cd $projectPath
git add cookies.txt
git commit -m "update cookies.txt"
git push origin main

Write-Host "✅ Cookies enviados pro GitHub com sucesso!"
