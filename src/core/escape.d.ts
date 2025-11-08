/**
 * Escapes HTML to prevent XSS when displaying code snippets
 */
export declare function escapeHtml(text: string): string;
/**
 * Sanitizes metadata to prevent prototype pollution
 */
export declare function sanitizeMetadata(metadata: any): Record<string, any>;
/**
 * Validates visualization data structure
 */
export declare function validateVisualizationData(data: any): boolean;
//# sourceMappingURL=escape.d.ts.map