// Tree-sitter bootstrap helpers shared by parser workers.
import { Parser, Language } from 'web-tree-sitter';
import parserWasmUrl from 'web-tree-sitter/tree-sitter.wasm?url';
const languageConfigs = {
    python: {
        id: 'python',
        displayName: 'Python',
        wasmUrl: '/wasm/tree-sitter-python.wasm',
    },
    csharp: {
        id: 'csharp',
        displayName: 'C#',
        wasmUrl: '/wasm/tree-sitter-c_sharp.wasm',
    },
};
let parserRuntimePromise = null;
const languagePromises = new Map();
const parserInstances = new Map();
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
async function ensureRuntime() {
    if (!parserRuntimePromise) {
        parserRuntimePromise = (async () => {
            await Parser.init({
                locateFile: () => parserWasmUrl,
            });
            return Parser;
        })();
    }
    return parserRuntimePromise;
}
async function loadLanguage(language) {
    if (!languagePromises.has(language)) {
        const config = languageConfigs[language];
        languagePromises.set(language, (async () => {
            await ensureRuntime();
            return Language.load(config.wasmUrl);
        })());
    }
    return languagePromises.get(language);
}
export async function initTreeSitter(preloadAll = true) {
    const start = now();
    await ensureRuntime();
    if (preloadAll) {
        await Promise.all(Object.keys(languageConfigs).map(language => loadLanguage(language)));
    }
    return { coldStartMs: now() - start };
}
export async function getParser(language) {
    if (!parserInstances.has(language)) {
        parserInstances.set(language, (async () => {
            const runtime = await ensureRuntime();
            const lang = await loadLanguage(language);
            const parser = new runtime();
            parser.setLanguage(lang);
            return parser;
        })());
    }
    return parserInstances.get(language);
}
export function getLanguageConfigs() {
    return Object.values(languageConfigs);
}
export function clearCachesForTesting() {
    languagePromises.clear();
    parserInstances.clear();
    parserRuntimePromise = null;
}
export default {
    initTreeSitter,
    getParser,
    getLanguageConfigs,
    clearCachesForTesting,
};
//# sourceMappingURL=ts-init.js.map