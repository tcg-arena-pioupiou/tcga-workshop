// Vérification d'une PR sur registry.json.
// Le fichier de la PR est lu comme simple donnée, jamais exécuté.
const fs = require("fs");
const { loadGame, isNonEmptyString } = require("./workshop-lib");

const BASE_REGISTRY_FILE = process.env.BASE_REGISTRY_FILE || "registry.json";
const STATE_FILE = process.env.STATE_FILE || "workshop-data/state.json";
const PR_REGISTRY_FILE = process.env.PR_REGISTRY_PATH;
const COMMENT_FILE = process.env.COMMENT_FILE;

const problems = [];   // bloquent la PR
const results = [];    // détail par jeu ajouté

function writeComment() {
    const ok = problems.length === 0 && results.every((r) => r.ok);
    const lines = [
        ok
            ? `### ✅ Everything looks good!\nThe maintainer will merge this soon. Your game will appear on the next daily update.`
            : `### ❌ Something needs fixing\nEdit your change on this pull request, this check will run again automatically.`,
        ``,
    ];
    for (const p of problems) lines.push(`- ${p}`);
    for (const r of results) {
        lines.push(r.ok
            ? `- ✅ **${r.name}** → found game "${r.gameName}"`
            : `- ❌ **${r.name}**: ${r.error}`);
    }
    const text = lines.join("\n");
    console.log(text);
    if (COMMENT_FILE) fs.writeFileSync(COMMENT_FILE, text + "\n");
    return ok;
}

// Transforme "position 123" d'une erreur JSON en numéro de ligne lisible
function jsonErrorMessage(text, e) {
    const match = /position (\d+)/.exec(e.message);
    if (!match) return `The file is not valid JSON (${e.message}).`;
    const pos = Number(match[1]);
    const line = text.slice(0, pos).split("\n").length;
    return `The file is not valid JSON around **line ${line}**. ` +
        `Most of the time it's a missing or extra comma, or a missing quote "`;
}

async function main() {
    const text = fs.readFileSync(PR_REGISTRY_FILE, "utf8").replace(/^\uFEFF/, "");

    let registry;
    try {
        registry = JSON.parse(text);
    } catch (e) {
        problems.push(jsonErrorMessage(text, e));
        return writeComment();
    }

    if (!Array.isArray(registry)) {
        problems.push("The file must stay a list: it starts with `[` and ends with `]`.");
        return writeComment();
    }

    // Structure de chaque entrée
    const seenUrls = new Set();
    const seenNames = new Set();
    registry.forEach((reg, i) => {
        const where = `Entry #${i + 1}`;
        if (reg === null || typeof reg !== "object" || Array.isArray(reg)) {
            problems.push(`${where} must look like { "name": "...", "workshopUrl": "..." }`);
            return;
        }
        if (!isNonEmptyString(reg.name)) problems.push(`${where}: "name" is missing or empty`);
        if (!isNonEmptyString(reg.workshopUrl) || !/^https?:\/\//.test(reg.workshopUrl)) {
            problems.push(`${where}: "workshopUrl" must be a full link starting with https://`);
        }
        if (seenUrls.has(reg.workshopUrl)) problems.push(`${where}: this workshopUrl is already in the list`);
        if (seenNames.has(reg.name)) problems.push(`${where}: the name "${reg.name}" is already in the list`);
        seenUrls.add(reg.workshopUrl);
        seenNames.add(reg.name);
    });
    if (problems.length) return writeComment();

    // Seules les entrées nouvelles (URL absente de la branche principale) sont téléchargées
    const baseRegistry = fs.existsSync(BASE_REGISTRY_FILE)
        ? JSON.parse(fs.readFileSync(BASE_REGISTRY_FILE, "utf8"))
        : [];
    const baseUrls = new Set(baseRegistry.map((r) => r.workshopUrl));
    const added = registry.filter((r) => !baseUrls.has(r.workshopUrl));

    const prUrls = new Set(registry.map((r) => r.workshopUrl));
    const removed = baseRegistry.filter((r) => !prUrls.has(r.workshopUrl));
    for (const r of removed) problems.push(`"${r.name}" was removed from the list. Only the maintainer can remove a game.`);

    if (added.length === 0 && removed.length === 0) {
        problems.push("No new game found in this change. Add a new entry with your own workshopUrl.");
    }

    // Noms déjà publiés, pour éviter les doublons
    const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
    const publishedNames = new Set(Object.values(state).map((s) => s.entry.name));

    const newNames = new Set();
    for (const reg of added) {
        try {
            const { entry } = await loadGame(reg.workshopUrl);
            if (publishedNames.has(entry.name) || newNames.has(entry.name)) {
                throw new Error(`a game named "${entry.name}" already exists on the workshop`);
            }
            newNames.add(entry.name);
            results.push({ name: reg.name, ok: true, gameName: entry.name });
        } catch (e) {
            results.push({ name: reg.name, ok: false, error: e.message });
        }
    }

    return writeComment();
}

main()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
