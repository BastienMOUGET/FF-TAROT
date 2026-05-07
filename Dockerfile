# =====================================================
# FF-TAROT — Image Node back + front statique
# =====================================================
# Build multi-stage : on compile le front Angular dans une image jetable,
# puis on monte l'image finale Node Alpine avec le bundle.

# ---------- Étape 1 : build du front Angular ----------
FROM node:20-alpine AS front-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-fund --no-audit

COPY frontend/ ./
RUN npm run build

# ---------- Étape 2 : image finale ----------
FROM node:20-alpine

# mariadb-client : utilisé au boot pour appliquer db.sql/seed.sql
# (entrypoint script). Si la DB est déjà schémée, c'est instantané.
RUN apk add --no-cache mariadb-client bash

WORKDIR /app

# Dépendances back uniquement
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit

# Code back
COPY src/ ./src/
COPY db.sql seed.sql ./

# Front buildé depuis l'étape précédente
COPY --from=front-builder /app/frontend/dist /app/frontend/dist

# Entrypoint qui attend la DB et applique le schéma au premier démarrage
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
