# Packaging News

Application web qui agrège quotidiennement des actualités issues de sites
spécialisés en packaging, recyclage, réglementation et fournisseurs.

- **Front-end** : Next.js 15 (App Router) + Tailwind
- **Back-end** : Routes API Next.js
- **Base de données** : SQLite via Prisma (passage à Postgres trivial : `provider = "postgresql"` dans `prisma/schema.prisma`)
- **Worker** : script TypeScript orchestré par cron système

## 1. Installation locale

Prérequis : **Node.js 20 LTS** (`node --version` doit afficher 20.x ou plus récent).

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier d'environnement
cp .env.example .env.local
#   ↳ éditer .env.local pour mettre un vrai ADMIN_PASSWORD et un SESSION_SECRET
#     de 32 caractères minimum (par ex. `openssl rand -hex 32`)

# 2b. Créer aussi un .env minimal (Prisma CLI le lit en priorité)
echo 'DATABASE_URL="file:./dev.db"' > .env

# 3. Créer la base SQLite et appliquer les migrations
npm run db:migrate -- --name init

# 4. Seeder les 87 sources et les mots-clés initiaux
npm run db:seed

# 5. (Optionnel mais recommandé) Backfill des 30 derniers jours
npm run batch:backfill

# 6. Lancer l'app
npm run dev
```

L'app est ensuite disponible sur <http://localhost:3000>. L'admin se trouve
sur <http://localhost:3000/admin>.

## 2. Architecture

```
src/
├── app/
│   ├── page.tsx                 # liste publique des news + filtres + pagination
│   ├── admin/                   # dashboard, sources, keywords, batches
│   └── api/
│       ├── news/                # GET news publiques (avec filtres)
│       ├── facets/              # GET listes pour les filtres
│       └── admin/               # login, logout, CRUD sources/keywords, batches
├── components/                  # composants UI (publics + admin)
└── lib/
    ├── prisma.ts                # client Prisma singleton
    ├── auth.ts                  # session admin via iron-session
    ├── url.ts                   # normalisation URL canonique (strip UTM, etc.)
    ├── keywords.ts              # parsing + matching mots-clés
    ├── dedup.ts                 # déduplication par URL et similarité titre
    ├── text.ts                  # troncatures pour les titres / extraits
    ├── serialize.ts             # DTO de sortie pour l'API
    └── batch/
        ├── http.ts              # fetch poli avec UA et timeout
        ├── rateLimit.ts         # concurrence et délai par hôte
        ├── robots.ts            # parsing et cache robots.txt
        ├── discover.ts          # auto-discovery de flux RSS
        ├── extract.ts           # extraction métadonnées article (HTML/JSON-LD)
        ├── window.ts            # calcul des fenêtres temporelles Paris
        ├── run.ts               # orchestrateur du batch
        ├── types.ts
        └── fetchers/
            ├── rss.ts
            ├── sitemap.ts
            └── html.ts
prisma/
├── schema.prisma                # schéma Source / Keyword / Article / BatchRun
└── seed.ts                      # seed des 87 sources + mots-clés
scripts/
└── run-batch.ts                 # entrée CLI pour le cron
```

### Détection des articles

1. **Stratégie de fetch par source** (`Source.fetchStrategy`)
   - `auto` (défaut) : essaie le flux configuré → auto-discovery RSS → scraping HTML.
   - `rss` : utilise exclusivement `feedUrl`.
   - `sitemap` : utilise `sitemapUrl` (avec support des sitemap index).
   - `html` : scrape la homepage à la recherche de liens d'articles.

2. **Extraction** : pour chaque candidat, si la date / canonical / extrait
   manque, on charge la page article et on lit `og:*`, `<meta>`, JSON-LD,
   `<link rel="canonical">`, `<html lang>`.

3. **Filtrage par fenêtre temporelle** : seuls les articles dont la
   `publishedAt` tombe dans la fenêtre courante sont conservés.

4. **Matching mots-clés** :
   - Mots-clés simples (`Amcor`) : sous-chaîne insensible à la casse.
   - Phrases entre guillemets (`"Bottle Collective"`) : la phrase complète
     doit être présente (toujours insensible à la casse).
   - Le matching porte sur titre + extrait + contenu si disponible.
   - Les mots-clés ayant matché sont stockés dans `Article.matchedKeywords`.

5. **Déduplication** :
   - URL canonique normalisée (UTM, fragments, ports par défaut, etc.
     supprimés) — voir `src/lib/url.ts`.
   - Si l'URL n'est pas déjà connue, on cherche un article au titre très
     similaire (Jaccard ≥ 0.85) dans une fenêtre de 48 h.

6. **Respect des sites** :
   - `robots.txt` lu et appliqué pour chaque URL (cache 6 h).
   - 2 requêtes parallèles maximum par hôte (`PER_HOST_CONCURRENCY`) et 1.5 s
     minimum entre deux requêtes (`PER_HOST_MIN_DELAY_MS`).
   - User-Agent personnalisé contenant un contact.
   - Aucun contournement de paywall / captcha.

### Fenêtres temporelles

| Mode      | Fenêtre                                                |
| --------- | ------------------------------------------------------ |
| `daily`   | Veille 00:00:01 → 23:59:59 (Europe/Paris)              |
| `backfill`| Maintenant moins 30 jours → maintenant                 |
| `manual`  | Identique à `daily` par défaut (modifiable côté admin) |

## 3. Cron quotidien (00:00 Paris)

Sur macOS / Linux, ajoutez une entrée crontab. Exemple pour `00:00 Europe/Paris`
(la crontab s'exprime dans le fuseau système — adaptez si besoin) :

```bash
# Editez la crontab
crontab -e

# Ajouter (en remplaçant le chemin)
0 0 * * * cd /Users/anthonycharrieau/Documents/Applications/Web-Screening && /usr/local/bin/npm run batch:run >> ~/.packaging-news.log 2>&1
```

Pour vous assurer que le fuseau est bon, vous pouvez forcer dans la commande :

```cron
0 0 * * * cd /chemin/projet && TZ=Europe/Paris /usr/local/bin/npm run batch:run >> ~/.packaging-news.log 2>&1
```

> Le script lit `.env.local`. Le `BATCH_TIMEZONE` (par défaut `Europe/Paris`)
> détermine la veille à analyser, indépendamment du fuseau du serveur.

Sur un serveur Linux, un service systemd + timer est une alternative propre :

```ini
# /etc/systemd/system/packaging-news.service
[Service]
Type=oneshot
WorkingDirectory=/srv/packaging-news
EnvironmentFile=/srv/packaging-news/.env.local
ExecStart=/usr/bin/npm run batch:run
User=packaging-news

# /etc/systemd/system/packaging-news.timer
[Timer]
OnCalendar=*-*-* 00:00:00 Europe/Paris
Persistent=true

[Install]
WantedBy=timers.target
```

## 4. Administration

`/admin` est protégé par un mot de passe partagé (`ADMIN_PASSWORD`).
Une fois connecté on peut :

- **Sources** — ajouter, modifier, désactiver, supprimer ; définir manuellement
  l'URL du flux RSS, du sitemap, la stratégie (`auto/rss/sitemap/html`), la
  langue par défaut et la limite quotidienne.
- **Mots-clés** — ajouter / modifier / désactiver / supprimer. Une phrase
  entre guillemets (`"…"`) est traitée comme une expression exacte.
- **Batchs** — historique avec durée, statut, articles trouvés/ajoutés et
  sources en erreur.
- **Lancer un batch** — boutons « Backfill 30 jours » et « Batch manuel »
  pour exécuter immédiatement.

Modifier les sources ou mots-clés n'altère **jamais** les articles déjà
collectés : les changements s'appliquent uniquement aux exécutions futures du
batch.

## 5. Variables d'environnement

| Nom                          | Valeur par défaut             | Rôle                                                       |
| ---------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`               | `file:./dev.db`               | Connexion Prisma (SQLite par défaut).                      |
| `ADMIN_PASSWORD`             | —                             | Mot de passe d'accès à /admin.                             |
| `SESSION_SECRET`             | —                             | Clé HMAC pour cookies iron-session (≥ 32 caractères).      |
| `USER_AGENT`                 | `PackagingNewsBot/0.1 …`      | UA utilisé par le scraper.                                 |
| `DEFAULT_PER_SOURCE_DAILY_LIMIT` | `10`                      | Limite par source/jour utilisée si la source n'en a pas.   |
| `BATCH_TIMEZONE`             | `Europe/Paris`                | Fuseau pour le calcul des fenêtres.                        |
| `REQUEST_TIMEOUT_MS`         | `20000`                       | Timeout des requêtes HTTP.                                 |
| `PER_HOST_CONCURRENCY`       | `2`                           | Concurrence max par hôte.                                  |
| `PER_HOST_MIN_DELAY_MS`      | `1500`                        | Délai minimum entre deux requêtes au même hôte.            |
| `GLOBAL_SOURCE_CONCURRENCY`  | `6`                           | Nombre maximum de sources traitées en parallèle.           |
| `LOG_LEVEL`                  | `info`                        | Niveau de log (`debug`/`info`/`warn`/`error`).             |

## 6. Évolutions prévues (architecture-friendly)

- **Traduction automatique** — le champ `rawExcerpt` (pré-troncature) et
  `language` sont déjà stockés ; il suffit d'ajouter un module
  `src/lib/translate.ts` (DeepL / LibreTranslate) appelé au moment du persist
  ou lazy à l'affichage, et de stocker les champs traduits côté `Article`.
- **Recherche full-text** — passer SQLite → Postgres + `pg_trgm` (ou un
  index dédié) pour de meilleures performances que le `LIKE` actuel.
- **Notifications email** — un cron supplémentaire qui requête les articles
  ajoutés sur les dernières 24 h via `/api/news?from=…` et envoie un digest.
- **Authentification multi-utilisateurs** — remplacer `ADMIN_PASSWORD` par une
  table `User` + provider NextAuth.

## 7. Tests rapides après installation

```bash
# Lance un batch manuel sur la fenêtre d'hier
npm run batch:run

# Lance un backfill 30 jours
npm run batch:backfill

# Ouvre Prisma Studio pour inspecter la base
npm run db:studio
```

Sur la page d'accueil, vérifiez :

- les news apparaissent par date décroissante ;
- les filtres source / mot-clé / date / recherche texte fonctionnent ;
- le clic sur la source ouvre l'article original dans un nouvel onglet ;
- l'admin (/admin) permet d'ajouter une source et de relancer un batch sur
  cette source uniquement (via Prisma Studio ou l'API REST).
