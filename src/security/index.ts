/**
 * Security inspection module for MCP tools.
 * Detects command injection, encoding obfuscation, PII, and other threats.
 * Tracks fetched secret values for redaction and exfiltration protection.
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
    redacted?: string;
}

// ── Threat patterns ──────────────────────────────────

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
    // Allow HTTP verbs after flags (e.g. curl -X POST https://...) — otherwise "POST" breaks the URL match
    {
        name: "data_exfil",
        pattern:
            /(?:curl|wget|nc)\s+(?:(?:-[a-zA-Z]*\s+)|(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+)*https?:\/\//i,
        severity: "critical" as const,
    },
];

const PII_PATTERNS = [
    { name: "email", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, severity: "medium" as const },
    { name: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/, severity: "critical" as const },
    { name: "credit_card", pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{1,4}\b/, severity: "critical" as const },
    { name: "phone_us", pattern: /\b(?:\+1[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/, severity: "low" as const },
    { name: "aws_key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/, severity: "critical" as const },
    { name: "private_key_header", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, severity: "critical" as const },
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

// ── Secret value registry (vault-manifest-aware redaction) ───

const MIN_SECRET_LENGTH = 6;
const secretValues = new Map<string, string>();

/** Tools that legitimately return or accept secret values. */
const SECRET_TOOLS = new Set([
    "get_secret",
    "get_env_bundle",
    "put_secret",
    "rotate_and_store",
]);

/**
 * Register a secret value for redaction and exfiltration protection.
 * Called after get_secret / get_env_bundle returns a value.
 */
export function registerSecret(path: string, value: string): void {
    if (value.length >= MIN_SECRET_LENGTH) {
        secretValues.set(value, path);
    }
}

/**
 * Clear all tracked secrets (e.g. on session teardown).
 */
export function clearSecrets(): void {
    secretValues.clear();
}

/**
 * Return the number of tracked secret values.
 */
export function trackedSecretCount(): number {
    return secretValues.size;
}

// ── Feature flags ────────────────────────────────────

export function isSecurityEnabled(): boolean {
    return process.env.ONECLAW_MCP_SECURITY_ENABLED !== "false";
}

export function isSecretRedactionEnabled(): boolean {
    if (!isSecurityEnabled()) return false;
    return process.env.ONECLAW_MCP_REDACT_SECRETS !== "false";
}

export function isPiiDetectionEnabled(): boolean {
    if (!isSecurityEnabled()) return false;
    return process.env.ONECLAW_MCP_PII_DETECTION !== "false";
}

export function getExfilProtectionMode(): "block" | "warn" | "off" {
    if (!isSecurityEnabled()) return "off";
    const mode = process.env.ONECLAW_MCP_EXFIL_PROTECTION;
    if (mode === "warn" || mode === "off") return mode;
    return "block";
}

export function getSanitizationMode(): "block" | "surgical" | "log_only" {
    const mode = process.env.ONECLAW_MCP_SANITIZATION_MODE;
    if (mode === "surgical" || mode === "log_only") {
        return mode;
    }
    return "block";
}

// ── Unicode normalization ────────────────────────────

export function normalizeUnicode(text: string): { normalized: string; modified: boolean } {
    let modified = false;
    
    let normalized = text.replace(ZERO_WIDTH_CHARS, () => {
        modified = true;
        return '';
    });
    
    normalized = normalized.replace(CONFUSABLE_REGEX, (char) => {
        modified = true;
        return CONFUSABLES[char] || char;
    });
    
    return { normalized, modified };
}

// ── Threat detection ─────────────────────────────────

function detectThreats(text: string): ThreatDetection[] {
    const threats: ThreatDetection[] = [];
    
    for (const { name, pattern, severity } of COMMAND_INJECTION_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            threats.push({ type: "command_injection", pattern: name, location: match[0], severity });
        }
    }
    
    for (const { name, pattern, severity } of ENCODING_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            threats.push({ type: "encoding_obfuscation", pattern: name, location: match[0].slice(0, 50), severity });
        }
    }
    
    for (const { name, pattern, severity } of SOCIAL_ENGINEERING_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            threats.push({ type: "social_engineering", pattern: name, location: match[0], severity });
        }
    }
    
    for (const { name, pattern, severity } of NETWORK_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            threats.push({ type: "network_threat", pattern: name, location: match[0], severity });
        }
    }
    
    return threats;
}

function detectPii(text: string): ThreatDetection[] {
    if (!isPiiDetectionEnabled()) return [];
    const threats: ThreatDetection[] = [];
    for (const { name, pattern, severity } of PII_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            threats.push({ type: "pii", pattern: name, location: match[0].slice(0, 30), severity });
        }
    }
    return threats;
}

// ── Secret redaction ─────────────────────────────────

function redactSecrets(text: string): { redacted: string; matches: Array<{ path: string }> } {
    const matches: Array<{ path: string }> = [];
    let redacted = text;
    for (const [value, path] of secretValues) {
        if (redacted.includes(value)) {
            redacted = redacted.split(value).join(`[REDACTED:${path}]`);
            matches.push({ path });
        }
    }
    return { redacted, matches };
}

// ── Exfiltration detection (secrets in tool inputs) ──

function detectExfiltration(text: string): ThreatDetection[] {
    const mode = getExfilProtectionMode();
    if (mode === "off") return [];
    const threats: ThreatDetection[] = [];
    for (const [value, path] of secretValues) {
        if (text.includes(value)) {
            threats.push({
                type: "secret_exfiltration",
                pattern: `known_secret:${path}`,
                severity: "critical",
            });
        }
    }
    return threats;
}

// ── Public API ───────────────────────────────────────

/**
 * Inspect tool input arguments for threats, PII, and secret exfiltration.
 */
export function inspectInput(toolName: string, args: unknown): InspectionResult {
    if (!isSecurityEnabled()) {
        return { passed: true, threats: [] };
    }
    
    const text = JSON.stringify(args);
    const { normalized, modified } = normalizeUnicode(text);
    const threats = detectThreats(normalized);
    
    if (modified) {
        threats.push({ type: "unicode_obfuscation", pattern: "confusables_or_zero_width", severity: "medium" });
    }
    
    threats.push(...detectPii(normalized));
    
    if (!SECRET_TOOLS.has(toolName)) {
        const exfil = detectExfiltration(normalized);
        threats.push(...exfil);
        const exfilMode = getExfilProtectionMode();
        if (exfil.length > 0 && exfilMode === "block") {
            return { passed: false, threats };
        }
    }
    
    const mode = getSanitizationMode();
    const hasCritical = threats.some((t) => t.severity === "critical" && t.type !== "secret_exfiltration");
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
 * Inspect tool output for threats, PII, and optionally redact known secrets.
 */
export function inspectOutput(toolName: string, result: string): InspectionResult {
    if (!isSecurityEnabled()) {
        return { passed: true, threats: [] };
    }
    
    const threats = detectThreats(result);
    threats.push(...detectPii(result));
    
    if (!SECRET_TOOLS.has(toolName) && isSecretRedactionEnabled()) {
        const { redacted, matches } = redactSecrets(result);
        if (matches.length > 0) {
            for (const m of matches) {
                threats.push({
                    type: "secret_leak",
                    pattern: `redacted:${m.path}`,
                    severity: "critical",
                });
            }
            return { passed: true, threats, redacted };
        }
    }
    
    return { passed: true, threats };
}
