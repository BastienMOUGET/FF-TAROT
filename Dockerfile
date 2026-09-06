# =====================================================
# PABB90 — Image binaire Amalgame + front statique
# =====================================================
# IMPORTANT : le binaire back AM (`./server`) doit être buildé sur l'hôte
# (ou en CI) AVANT `docker build` :
#
#     ./build.sh            # produit ./server (linké à libmariadb)
#     docker build -t pabb90 .
#
# On bâtit ici sur debian:12-slim pour une ABI glibc/libmariadb compatible
# avec un binaire produit sur Debian 12. (Construire l'AM dans Docker
# nécessiterait la toolchain amc + libmariadb-dev ; on préfère copier le
# binaire pré-buildé, plus simple et déterministe.)

# ---------- Étape 1 : build du front Angular ----------
FROM node:20-alpine AS front-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY frontend/ ./
RUN npm run build

# ---------- Étape 2 : image finale (runtime AM) ----------
FROM debian:12-slim

# Libs runtime du binaire AM : libmariadb (DB), libgc (bdwgc), openssl,
# zlib. mariadb-client : appliquer les migrations au boot (migrate.sh).
RUN apt-get update && apt-get install -y --no-install-recommends \
        libmariadb3 libgc1 libssl3 zlib1g mariadb-client ca-certificates bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Binaire back AM pré-buildé (./build.sh) + migrations SQL.
# migrate.sh n'applique que les migrations manquantes : un volume de données
# existant survit donc à une montée de version de l'image.
COPY server ./server
COPY migrate.sh seed.sql ./
COPY migrations/ ./migrations/

# Front buildé depuis l'étape précédente
COPY --from=front-builder /app/frontend/dist /app/frontend/dist

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /app/server /app/migrate.sh

# 3000 = API + front ; 3001 = Socket.IO (classement live)
EXPOSE 3000 3001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/app/server"]
