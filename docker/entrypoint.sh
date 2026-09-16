#!/bin/sh
# Entrypoint do container de produção.
#
# Migrations rodam antes do servidor subir: se falharem, o container morre e o
# EasyPanel mantém a versão anterior no ar em vez de servir um app com o
# esquema errado.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL não definida. Configure as variáveis do serviço." >&2
  exit 1
fi

# O config em JavaScript (migrator/prisma.config.mjs) evita precisar de um
# transpilador de TypeScript na imagem de produção.
echo "Aplicando migrations..."
node migrator/node_modules/prisma/build/index.js migrate deploy \
  --config migrator/prisma.config.mjs

echo "Iniciando servidor na porta ${PORT:-3000}..."
exec node server.js
