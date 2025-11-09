import { Parser } from 'web-tree-sitter';
export type SupportedLanguage = 'python' | 'csharp';
type LanguageConfig = {
    id: SupportedLanguage;
    displayName: string;
    wasmUrl: string;
};
export declare function initTreeSitter(preloadAll?: boolean): Promise<{
    coldStartMs: number;
}>;
export declare function getParser(language: SupportedLanguage): Promise<Parser>;
export declare function getLanguageConfigs(): LanguageConfig[];
export declare function clearCachesForTesting(): void;
declare const _default: {
    initTreeSitter: typeof initTreeSitter;
    getParser: typeof getParser;
    getLanguageConfigs: typeof getLanguageConfigs;
    clearCachesForTesting: typeof clearCachesForTesting;
};
export default _default;
//# sourceMappingURL=ts-init.d.ts.map