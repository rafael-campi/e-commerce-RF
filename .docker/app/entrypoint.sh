#!/bin/sh
set -e

# Chaves do PSP gravadas pelo serviço de setup do docker-compose (api-gateway)
if [ -n "$PSP_ENV_FILE" ] && [ -f "$PSP_ENV_FILE" ]; then
  set -a
  . "$PSP_ENV_FILE"
  set +a
fi

# Ainda não há migrations versionadas (README): cria o schema a partir das
# entidades e semeia a Loja Prateleira (o seed não duplica nada).
node node_modules/typeorm/cli.js schema:sync -d dist/database/data-source.js
node dist/database/seeds/seed.js

exec node dist/main
