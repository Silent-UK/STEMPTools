// Copyright (C) 2026 Vyraj. AGPL-3.0-only. Corresponding source: ../src/
export function fold(s) {
    return s.toLowerCase().replace(/[‘’‚‛′`´]/g, "'").replace(/[“”„‟″]/g, '"');
}
