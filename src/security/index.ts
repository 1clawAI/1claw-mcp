/**
 * Security inspection module for MCP tools.
 * Detects command injection, encoding obfuscation, and other threats.
 */

export interface ThreatDetection {
    type: string;
    pattern: string;
    location?: string;
    severity: "low" | "medium" | "high" | "critical";
}

export interface InspectionResult {
    passed: boolean;
    threats: ThreatDetection[];
    sanitized?: string;
}

const COMMAND_INJECTION_PATTERNS = [
    { name: "shell_chain", pattern: /(?:;|\||&&|\|\|)\s*(?:curl|wget|bash|sh|nc|python|perl|ruby|php|node)\b/i, severity: "critical" as const },
    { name: "command_substitution", pattern: /\$\([^)]+\)|`[^`]+`/, severity: "critical" as const },
    { name: "reverse_shell", pattern: /(?:bash\s+-i|nc\s+-[elp]|python\s+-c\s+['"]import\s+(?:socket|os))/i, severity: "critical" as const },
    { name: "path_traversal", pattern: /(?:\.\.\/){2,}/, severity: "high" as const },
    { name: "sensitive_paths", pattern: /(?:\/etc\/(?:passwd|shadow|sudoers)|\/proc\/self|~\/.ssh\/|\.env\b)/i, severity: "high" as const },
];

const ENCODING_PATTERNS = [
    { name: "base64_long", pattern: /(?:[A-Za-z0-9+/]{4}){8,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/, severity: "medium" as const },
    // Note: JSON.stringify doubles backslashes, so we need to match \\\\x for a literal \x
    { name: "hex_escape", pattern: /(?:\\\\x[0-9a-fA-F]{2}){3,}/, severity: "medium" as const },
    { name: "unicode_escape", pattern: /(?:\\\\u[0-9a-fA-F]{4}){2,}/, severity: "medium" as const },
];

const SOCIAL_ENGINEERING_PATTERNS = [
    { name: "urgency", pattern: /\b(?:urgent(?:ly)?|immediately|right\s+now|asap|emergency)\b/i, severity: "medium" as const },
    { name: "authority", pattern: /\b(?:i\s+am\s+(?:an?\s+)?(?:admin|administrator|manager|root|superuser))/i, severity: "high" as const },
    { name: "secrecy", pattern: /\b(?:don't\s+tell\s+(?:anyone|anybody)|keep\s+(?:this\s+)?secret)\b/i, severity: "high" as const },
    { name: "bypass", pattern: /\b(?:skip\s+(?:the\s+)?(?:verification|authentication|security)|bypass\s+(?:the\s+)?(?:check|security))\b/i, severity: "critical" as const },
    { name: "credential_request", pattern: /\b(?:(?:what\s+is|tell\s+me|give\s+me)\s+(?:your|the)\s+(?:password|api\s+key|secret|credentials?|token))\b/i, severity: "critical" as const },
];

const NETWORK_PATTERNS = [
    { name: "ngrok", pattern: /(?:ngrok\.io|ngrok\.app)/i, severity: "high" as const },
    { name: "pastebin", pattern: /pastebin\.com/i, severity: "high" as const },
    { name: "ip_url", pattern: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, severity: "medium" as const },
    { name: "data_exfil", pattern: /(?:curl|wget|nc)\s+(?:-[a-zA-Z]*\s+)*https?:\/\//i, severity: "critical" as const },
];

// Zero-width and invisible characters
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

// Cyrillic/Greek confusables
const CONFUSABLES: Record<string, string> = {
    'а': 'a', 'А': 'A', 'с': 'c', 'С': 'C', 'е': 'e', 'Е': 'E',
    'о': 'o', 'О': 'O', 'р': 'p', 'Р': 'P', 'х': 'x', 'Х': 'X',
    'у': 'y', 'У': 'Y', 'і': 'i', 'І': 'I', 'Α': 'A', 'Β': 'B',
    'Ε': 'E', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N',
    'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X', 'Ζ': 'Z',
};

const CONFUSABLE_REGEX = new RegExp(`[${Object.keys(CONFUSABLES).join('')}]`, 'g');

/**
 * Check if MCP security inspection is enabled.
 */
export function isSecurityEnabled(): boolean {
    return process.env.ONECLAW_MCP_SECURITY_ENABLED !== "false";
}

/**
 * Get the configured sanitization mode.
 */
export function getSanitizationMode(): "block" | "surgical" | "log_only" {
    const mode = process.env.ONECLAW_MCP_SANITIZATION_MODE;
    if (mode === "surgical" || mode === "log_only") {
        return mode;
    }
    return "block";
}

/**
 * Normalize text by replacing confusables and stripping zero-width characters.
 */
export function normalizeUnicode(text: string): { normalized: string; modified: boolean } {
    let modified = false;
    
    // Strip zero-width chars
    let normalized = text.replace(ZERO_WIDTH_CHARS, () => {
        modified = true;
        return '';
    });
    
    // Replace confusables
    normalized = normalized.replace(CONFUSABLE_REGEX, (char) => {
        modified = true;
        return CONFUSABLES[char] || char;
    });
    
    return { normalized, modified };
}

/**
 * Detect threats in a string.
 */
function detectThreats(text: string): ThreatDetection[] {
    const threats: ThreatDetection[] = [];
    
    // Command injection
    for (const { name, pattern, severity } of COMMAND_INJECTION_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            threats.push({
                type: "command_injection",
                pattern: name,
                location: match[0],
                severity,
            });
        }
    }
    
    // Encoding obfuscation
    for (const { name, pattern, severity } of ENCODING_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            threats.push({
                type: "encoding_obfuscation",
                pattern: name,
                location: match[0].slice(0, 50),
                severity,
            });
        }
    }
    
    // Social engineering
    for (const { name, pattern, severity } of SOCIAL_ENGINEERING_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            threats.push({
                type: "social_engineering",
                pattern: name,
                location: match[0],
                severity,
            });
        }
    }
    
    // Network threats
    for (const { name, pattern, severity } of NETWORK_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            threats.push({
                type: "network_threat",
                pattern: name,
                location: match[0],
                severity,
            });
        }
    }
    
    return threats;
}

/**
 * Inspect tool input arguments for threats.
 */
export function inspectInput(toolName: string, args: unknown): InspectionResult {
    if (!isSecurityEnabled()) {
        return { passed: true, threats: [] };
    }
    
    const text = JSON.stringify(args);
    
    // Normalize Unicode first
    const { normalized, modified } = normalizeUnicode(text);
    
    // Detect threats
    const threats = detectThreats(normalized);
    
    // Add Unicode warnings if modified
    if (modified) {
        threats.push({
            type: "unicode_obfuscation",
            pattern: "confusables_or_zero_width",
            severity: "medium",
        });
    }
    
    const mode = getSanitizationMode();
    const hasCritical = threats.some((t) => t.severity === "critical");
    const hasHigh = threats.some((t) => t.severity === "high");
    
    if (mode === "block" && (hasCritical || hasHigh)) {
        return { passed: false, threats };
    }
    
    if (mode === "surgical" && modified) {
        try {
            const sanitizedArgs = JSON.parse(normalized);
            return { passed: true, threats, sanitized: JSON.stringify(sanitizedArgs) };
        } catch {
            return { passed: true, threats };
        }
    }
    
    return { passed: true, threats };
}

/**
 * Inspect tool output for threats (mainly for logging).
 */
export function inspectOutput(toolName: string, result: string): InspectionResult {
    if (!isSecurityEnabled()) {
        return { passed: true, threats: [] };
    }
    
    const threats = detectThreats(result);
    
    // Output inspection is typically log-only
    return { passed: true, threats };
}
