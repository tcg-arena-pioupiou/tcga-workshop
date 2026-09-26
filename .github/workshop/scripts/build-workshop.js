// Build quotidien : télécharge tous les workshop.json listés dans registry.json
// et régénère data/games.json (lu par le site).
const fs = require("fs");
const path = require("path");
const { loadGame, mapWithLimit } = require("./workshop-lib");

// Chemins relatifs à la racine du repo (surchargeables par variables d'environnement)
const REGISTRY_FILE = process.env.REGISTRY_FILE || "registry.json";
const OVERRIDES_FILE = process.env.OVERRIDES_FILE || ".github/workshop/overrides.json";
// Ces deux fichiers vivent sur la branche workshop-data, extraite dans publish/
const STATE_FILE = process.env.STATE_FILE || "publish/state.json";   // hash, dates, dernière version valide
const OUTPUT_FILE = process.env.OUTPUT_FILE || "publish/games.json"; // fichier public lu par le site
const CONCURRENCY = 5;

function readJson(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data, pretty) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, pretty ? 2 : 0) + "\n");
}

async function main() {
    const today = new Date().toISOString().slice(0, 10);
    const registry = readJson(REGISTRY_FILE, []);
    const overrides = readJson(OVERRIDES_FILE, {});
    const previousState = readJson(STATE_FILE, {});

    if (!Array.isArray(registry)) throw new Error(`${REGISTRY_FILE} must be a list [ ... ]`);

    const report = []; // pour le résumé affiché dans l'onglet Actions

    // 1. Téléchargement de chaque jeu
    const newState = {};
    await mapWithLimit(registry, CONCURRENCY, async (reg) => {
        const url = reg.workshopUrl;
        const previous = previousState[url];
        try {
            const { entry, hash } = await loadGame(url);
            const changed = !previous || previous.hash !== hash;
            newState[url] = {
                hash,
                createdAt: previous?.createdAt ?? today,
                lastUpdated: changed ? today : previous.lastUpdated,
                entry,
            };
            report.push({ name: reg.name, status: !previous ? "🆕 new" : changed ? "🔄 updated" : "✅ unchanged" });
        } catch (e) {
            // En cas d'erreur, on garde la dernière version valide connue
            if (previous) newState[url] = previous;
            report.push({
                name: reg.name,
                status: previous ? "⚠️ error, previous version kept" : "❌ error, not published",
                error: e.message,
            });
        }
    });

    // 2. Construction de la liste publique, dans l'ordre du registry
    const games = [];
    const seenNames = new Map();
    for (const reg of registry) {
        const state = newState[reg.workshopUrl];
        if (!state) continue;

        // Overrides indexés par le "name" du registry (le repère que toi tu contrôles)
        const override = overrides[reg.name] || {};
        if (override.hidden) continue;

        // Nom unique : l'entrée la plus ancienne du registry garde le nom
        const name = state.entry.name;
        if (seenNames.has(name)) {
            report.push({
                name: reg.name,
                status: "❌ skipped",
                error: `name "${name}" already used by "${seenNames.get(name)}"`,
            });
            continue;
        }
        seenNames.set(name, reg.name);

        games.push({
            ...state.entry,
            createdAt: state.createdAt,
            lastUpdated: state.lastUpdated,
            popularity: override.popularity ?? 0,
        });
    }

    writeJson(STATE_FILE, newState, true);
    writeJson(OUTPUT_FILE, games, false);

    // 3. Résumé
    const lines = [
        `## Workshop build — ${today}`,
        ``,
        `${games.length} game(s) published out of ${registry.length} registered.`,
        ``,
        `| Game | Status | Details |`,
        `|---|---|---|`,
        ...report.map((r) => `| ${r.name} | ${r.status} | ${(r.error || "").replace(/\|/g, "\\|")} |`),
    ];
    console.log(lines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
