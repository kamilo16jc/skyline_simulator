// ═══════════════════════════════════════════════════════════════
//  SkyLine — SaveSystem.js
//  Portado desde SaveSystem.cs (Unity C#)
//  Guarda y carga la partida usando localStorage (navegador)
// ═══════════════════════════════════════════════════════════════

const SaveSystem = {
    SAVE_KEY:        'skyline_save',
    CURRENT_VERSION: 1,

    // ─────────────────────────────────────────────────────────
    //  GUARDAR
    // ─────────────────────────────────────────────────────────

    save(data) {
        try {
            data.version = this.CURRENT_VERSION;
            data.savedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

            const json = JSON.stringify(data, null, 2);
            localStorage.setItem(this.SAVE_KEY, json);
            console.log(`[SaveSystem] Partida guardada → localStorage key: "${this.SAVE_KEY}"`);
            return true;
        } catch (e) {
            console.error(`[SaveSystem] Error al guardar: ${e.message}`);
            return false;
        }
    },

    // ─────────────────────────────────────────────────────────
    //  CARGAR
    // ─────────────────────────────────────────────────────────

    load() {
        try {
            const json = localStorage.getItem(this.SAVE_KEY);
            if (!json) {
                console.log('[SaveSystem] No se encontró partida guardada.');
                return null;
            }

            const data = JSON.parse(json);
            if (!data) {
                console.warn('[SaveSystem] Archivo de guardado corrupto o vacío.');
                return null;
            }

            console.log(`[SaveSystem] Partida cargada (v${data.version}) — guardada el ${data.savedAt}`);
            return data;
        } catch (e) {
            console.error(`[SaveSystem] Error al cargar partida: ${e.message}`);
            return null;
        }
    },

    // ─────────────────────────────────────────────────────────
    //  UTILIDADES
    // ─────────────────────────────────────────────────────────

    hasSave() {
        return localStorage.getItem(this.SAVE_KEY) !== null;
    },

    deleteSave() {
        localStorage.removeItem(this.SAVE_KEY);
        console.log('[SaveSystem] Partida guardada eliminada.');
    },

    getSaveInfo() {
        if (!this.hasSave()) return 'Sin partida guardada';
        const data = this.load();
        if (!data) return 'Archivo corrupto';

        const airline = data.airline?.airlineName ?? '?';
        const date    = data.currentDate
            ? `${data.currentDate.day}/${data.currentDate.month}/${data.currentDate.year}`
            : '?';
        return `${airline} — ${date} — Guardado: ${data.savedAt}`;
    },

    // ─────────────────────────────────────────────────────────
    //  EXPORTAR / IMPORTAR (backup a archivo)
    // ─────────────────────────────────────────────────────────

    exportToFile() {
        const json = localStorage.getItem(this.SAVE_KEY);
        if (!json) { console.warn('[SaveSystem] No hay partida para exportar.'); return; }

        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `skyline_save_${new Date().toISOString().substring(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('[SaveSystem] Partida exportada a archivo.');
    },

    importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
                    console.log('[SaveSystem] Partida importada desde archivo.');
                    resolve(data);
                } catch (err) {
                    console.error('[SaveSystem] Archivo inválido:', err.message);
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
};

// Exportar
if (typeof module !== 'undefined') module.exports = { SaveSystem };
else window.SaveSystem = SaveSystem;
