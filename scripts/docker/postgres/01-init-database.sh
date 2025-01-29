#!/bin/bash

set -e
echo "Altering password for user: $POSTGRES_USER"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';
EOSQL
echo "Creating database: $POSTGRES_DB"

export PGPASSWORD=$POSTGRES_PASSWORD

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE $POSTGRES_DB;
    CREATE DATABASE test;
    GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;
EOSQL

echo "Set PT_BR language"
