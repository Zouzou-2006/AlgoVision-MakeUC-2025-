// Security utilities for handling user code safely
/**
 * Escapes HTML to prevent XSS when displaying code snippets
 */
export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };
    // Ensure the replacer always returns a string (fallback to the original
    // character if a mapping is somehow missing) to satisfy the TS signatures.
    return text.replace(/[&<>"'/]/g, (m) => map[m] ?? m);
}
/**
 * Sanitizes metadata to prevent prototype pollution
 */
export function sanitizeMetadata(metadata) {
    if (typeof metadata !== 'object' || metadata === null) {
        return {};
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(metadata)) {
        // Remove dangerous keys
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;
        }
        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeMetadata(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
/**
 * Validates visualization data structure
 */
export function validateVisualizationData(data) {
    if (!data || typeof data !== 'object')
        return false;
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges))
        return false;
    if (!data.rootNode || !data.language)
        return false;
    // Validate nodes
    for (const node of data.nodes) {
        if (!node.id || !node.name || !node.type || !node.location) {
            return false;
        }
    }
    // Validate edges
    for (const edge of data.edges) {
        if (!edge.id || !edge.from || !edge.to || !edge.type) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=escape.js.map