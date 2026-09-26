// Fonctions partagées entre la vérification des PR et le build quotidien.
const crypto = require("crypto");

// --- Réglages ---
const LIMITS = {
    workshopBytes: 1_000_000,    // 1 Mo max pour un workshop.json
    gameBytes: 50_000_000,       // 50 Mo max pour le JSON du jeu
    timeoutMs: 20_000,           // 20 s max par téléchargement
};
const MAX_TAGS_LENGTH = 200;

// Où lire le nom et l'image dans le JSON du jeu (gameUrl).
// Chemin avec des points si c'est imbriqué, ex: "game.name".
const GAME_NAME_PATH = "name";
const GAME_IMAGE_PATH = "menuBackgroundImage";

// --- Réseau ---

async function fetchText(url, maxBytes) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIMITS.timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
        if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);

        const declared = Number(res.headers.get("content-length"));
        if (declared && declared > maxBytes) {
            throw new Error(`file too large (${declared} bytes, max ${maxBytes}) on ${url}`);
        }

        // Lecture en flux pour couper si le serveur n'annonce pas la taille
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.length;
            if (received > maxBytes) {
                controller.abort();
                throw new Error(`file too large (max ${maxBytes} bytes) on ${url}`);
            }
            chunks.push(value);
        }
        return Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "");
    } catch (e) {
        if (e.name === "AbortError") throw new Error(`timeout on ${url}`);
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchJson(url, maxBytes) {
    const text = await fetchText(url, maxBytes);
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error(`invalid JSON on ${url} (${e.message})`);
    }
}

// --- Utilitaires ---

// Sérialisation avec clés triées : un changement d'indentation ou d'ordre
// des clés ne change pas le hash, seul un vrai changement de contenu le fait.
function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value !== null && typeof value === "object") {
        return `{${Object.keys(value).sort()
            .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}

function hashOf(value) {
    return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function getPath(obj, path) {
    return path.split(".").reduce((o, key) => (o == null ? undefined : o[key]), obj);
}

// Résout un chemin relatif par rapport à l'URL du fichier qui le contient
function resolveUrl(value, baseUrl, field) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`"${field}" must be a non-empty text`);
    }
    let url;
    try {
        url = new URL(value.trim(), baseUrl);
    } catch {
        throw new Error(`"${field}" is not a valid URL or path: ${value}`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`"${field}" must be an http(s) URL: ${value}`);
    }
    return url.href;
}

// Une note ou un texte peut être une string, ou un tableau de lignes
function isTextOrLines(v) {
    return typeof v === "string" || (Array.isArray(v) && v.every((l) => typeof l === "string"));
}
function normalizeText(v) {
    return Array.isArray(v) ? v.join("\n") : v;
}

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

// --- Validation du workshop.json ---

function validateWorkshop(ws) {
    const errors = [];
    if (ws === null || typeof ws !== "object" || Array.isArray(ws)) {
        return ["workshop.json must contain a single object { ... }"];
    }

    if (!isNonEmptyString(ws.author)) errors.push(`"author" is missing or empty`);
    if (!isNonEmptyString(ws.gameUrl)) errors.push(`"gameUrl" is missing or empty`);

    if (typeof ws.tags !== "string") {
        errors.push(`"tags" is missing (use "" if you have no tags)`);
    } else if (ws.tags.length > MAX_TAGS_LENGTH) {
        errors.push(`"tags" is too long (${ws.tags.length} characters, max ${MAX_TAGS_LENGTH})`);
    }

    if (!Array.isArray(ws.langs) || ws.langs.length === 0 || !ws.langs.every(isNonEmptyString)) {
        errors.push(`"langs" must be a list with at least one language, ex: ["en"]`);
    }

    if (typeof ws.useAiArts !== "boolean") {
        errors.push(`"useAiArts" must be true or false (without quotes)`);
    }

    // Optionnels
    if (ws.contact !== undefined) {
        if (ws.contact === null || typeof ws.contact !== "object" || Array.isArray(ws.contact)) {
            errors.push(`"contact" must be an object, ex: { "discord": "mypseudo" }`);
        } else if (ws.contact.discord !== undefined && typeof ws.contact.discord !== "string") {
            errors.push(`"contact.discord" must be a text`);
        }
    }
    if (ws.screenshotUrls !== undefined &&
        !(Array.isArray(ws.screenshotUrls) && ws.screenshotUrls.every(isNonEmptyString))) {
        errors.push(`"screenshotUrls" must be a list of links or paths`);
    }
    if (ws.descriptionUrl !== undefined && !isNonEmptyString(ws.descriptionUrl)) {
        errors.push(`"descriptionUrl" must be a link or path to a .md file`);
    }
    if (ws.updates !== undefined &&
        !(Array.isArray(ws.updates) && ws.updates.every(isTextOrLines))) {
        errors.push(`"updates" must be a list of texts, newest first`);
    }

    return errors;
}

// --- Chargement complet d'un jeu à partir de son workshop.json ---
// Renvoie { entry, hash } ou lève une erreur lisible.
async function loadGame(workshopUrl) {
    const ws = await fetchJson(workshopUrl, LIMITS.workshopBytes);

    const errors = validateWorkshop(ws);
    if (errors.length) throw new Error(errors.join(" · "));

    // Chemins relatifs résolus par rapport au workshop.json
    const gameUrl = resolveUrl(ws.gameUrl, workshopUrl, "gameUrl");
    const screenshotUrls = (ws.screenshotUrls || [])
        .map((u, i) => resolveUrl(u, workshopUrl, `screenshotUrls[${i}]`));
    const descriptionUrl = ws.descriptionUrl
        ? resolveUrl(ws.descriptionUrl, workshopUrl, "descriptionUrl")
        : undefined;

    // Nom et image viennent du JSON du jeu lui-même
    const gameJson = await fetchJson(gameUrl, LIMITS.gameBytes);
    const name = getPath(gameJson, GAME_NAME_PATH);
    if (!isNonEmptyString(name)) {
        throw new Error(`the game file has no "${GAME_NAME_PATH}" (${gameUrl})`);
    }
    const rawImage = getPath(gameJson, GAME_IMAGE_PATH);
    if (!isNonEmptyString(rawImage)) {
        throw new Error(`the game file has no "${GAME_IMAGE_PATH}" (${gameUrl})`);
    }
    // L'image est relative au fichier du jeu, pas au workshop.json
    const imageUrl = resolveUrl(rawImage, gameUrl, GAME_IMAGE_PATH);

    const entry = {
        name: name.trim(),
        author: ws.author.trim(),
        workshopUrl,
        gameUrl,
        imageUrl,
        tags: ws.tags,
        langs: ws.langs.map((l) => l.trim().toLowerCase()),
        useAiArts: ws.useAiArts,
        screenshotUrls,
        ...(descriptionUrl && { descriptionUrl }),
        ...(ws.contact?.discord && { contact: { discord: ws.contact.discord.trim() } }),
        updates: (ws.updates || []).map(normalizeText),
    };

    // Seul le workshop.json compte pour la date de mise à jour
    return { entry, hash: hashOf(ws) };
}

// Exécute fn sur chaque élément avec au plus `limit` appels en parallèle,
// en gardant l'ordre des résultats.
async function mapWithLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

module.exports = {
    loadGame,
    validateWorkshop,
    mapWithLimit,
    isNonEmptyString,
    MAX_TAGS_LENGTH,
};
