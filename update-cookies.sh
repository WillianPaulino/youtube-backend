#!/bin/bash
set -e

# Caminho para onde o navegador salva os cookies exportados
COOKIES_SOURCE="$HOME/Downloads/cookies.txt"

# Caminho do projeto (ajuste se precisar)
PROJECT_DIR="$HOME/youtube-backend"

# Copiar cookies novos para o projeto
cp "$COOKIES_SOURCE" "$PROJECT_DIR/cookies.txt"

cd "$PROJECT_DIR"

# Commit e push automático
git add cookies.txt
git commit -m "update cookies $(date)"
git push origin main

echo "✅ Cookies atualizados e enviados para o Render!"
