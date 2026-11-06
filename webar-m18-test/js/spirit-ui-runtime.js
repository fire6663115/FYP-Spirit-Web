/* Apply a reviewed theme without taking ownership of any AR interaction. */
(function () {
    'use strict';

    const theme = window.SpiritUITheme;
    const kind = document.currentScript.dataset.page;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const directory = new URL('./', location.href);
    const storageKey = 'the-spirit.ui.preview.v1:' + directory.pathname;
    const app = { source: 'default', view: null, issues: [], checks: 0, lastCheckMs: 0 };
    window.SpiritUI = app;

    function view() {
        if (kind === 'codex') return 'codex';
        if (document.body.dataset.appMode !== 'ar') return 'launch';
        if (document.querySelector('#reality-panel:not([hidden]), #photo-preview:not([hidden])')) return 'photo';
        return 'scan';
    }

    function installPreviewBadge() {
        const link = document.createElement('a');
        link.id = 'spirit-theme-exit-preview';
        link.href = './studio-ui.html';
        link.dataset.spiritUi = '';
        link.textContent = '结束主题试用';
        link.style.cssText = 'min-height:44px;display:inline-flex;align-items:center;background:#172834;color:#baf8f4;padding:6px 10px;border:1px solid #5c8089;border-radius:5px;font:13px system-ui';
        link.addEventListener('click', event => {
            event.preventDefault();
            try { sessionStorage.removeItem(storageKey); } catch (_) {}
            if (window.SpiritApp) window.SpiritApp.navigate(link.href);
            else location.assign(link.href);
        });
        const mount = kind === 'codex' ? document.querySelector('.codex-page') : document.querySelector('.spirit-entry');
        mount.append(link);
        return link;
    }

    async function read() {
        if (local) {
            let draft;
            try {
                if (new URLSearchParams(location.search).get('uiDefault') === '1') {
                    sessionStorage.removeItem(storageKey);
                    app.source = 'default';
                    return theme.empty();
                }
                draft = sessionStorage.getItem(storageKey);
            } catch (_) {}
            if (draft !== null && draft !== undefined) {
                if (draft.length > theme.fileLimit) throw Error('试用主题太大');
                const validated = theme.validate(JSON.parse(draft));
                app.source = 'local-preview';
                return validated;
            }
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
            const response = await fetch(new URL('./ui_config.json', directory), {
                cache: 'no-cache', credentials: 'same-origin', redirect: 'error', signal: controller.signal,
            });
            if (!response.ok) throw Error('主题文件不可用');
            if (Number(response.headers.get('content-length')) > theme.fileLimit) throw Error('主题文件太大');
            const raw = await response.text();
            if (raw.length > theme.fileLimit) throw Error('主题文件太大');
            const validated = theme.validate(JSON.parse(raw));
            if (Object.keys(validated.pages).length) app.source = 'config';
            return validated;
        } finally { clearTimeout(timeout); }
    }

    async function start() {
        let design;
        try { design = await read(); }
        catch (_) {
            document.body.dataset.themeState = 'invalid-default';
            return app;
        }
        const badge = app.source === 'local-preview' ? installPreviewBadge() : null;
        if (!badge && !Object.values(design.pages).some(layers => Object.keys(layers).length)) {
            document.body.dataset.themeState = 'default';
            return app;
        }
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
        }
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
        document.body.append(probe);
        const layout = new theme.Layout(document);
        let pending = 0;
        const update = () => {
            pending = 0;
            const started = performance.now();
            app.view = view();
            const padding = getComputedStyle(probe);
            const insets = {};
            for (const edge of ['top', 'right', 'bottom', 'left']) insets[edge] = parseFloat(padding.getPropertyValue('padding-' + edge)) || 0;
            try { app.issues = layout.apply(app.view, design.pages[app.view] || {}, insets, { palette: design.palette }); }
            catch (_) { layout.clear(); app.issues = ['主题无法应用']; }
            app.checks++;
            app.lastCheckMs = performance.now() - started;
            document.body.dataset.themeState = app.issues.length ? 'layout-default' : 'applied';
            if (badge) badge.textContent = app.issues.length ? '已恢复原版面 · 结束试用' : '结束主题试用';
        };
        const schedule = () => { if (!pending) pending = requestAnimationFrame(update); };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-app-mode'] });
        for (const id of ['launch-screen', 'btn-reload-ar', 'session-nav', 'system-notice', 'hud-panel', 'action-bar',
            'top-right-tools', 'tweak-panel', 'reality-panel', 'photo-preview', 'codex-detail', 'codex-grid']) {
            const node = document.getElementById(id);
            if (!node) continue;
            observer.observe(node, { attributes: true, attributeFilter: ['class', 'hidden'], childList: id === 'codex-grid' });
            node.addEventListener('transitionend', schedule);
        }
        for (const node of document.querySelectorAll('.spirit-screen, #photo-preview')) node.addEventListener('scroll', schedule, { passive: true });
        document.getElementById('photo-image')?.addEventListener('load', schedule);
        window.addEventListener('resize', schedule);
        window.addEventListener('pageshow', schedule);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
        update();
        return app;
    }

    app.ready = start();
})();
