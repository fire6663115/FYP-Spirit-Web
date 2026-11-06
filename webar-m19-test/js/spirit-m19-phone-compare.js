/* Installed only in the independent phone comparison. No extra animation loop. */
window.SpiritPhoneCompare = (() => {
    'use strict';
    const profiles = {"plane": "Plane", "original": {"normal": 1.2999999523162842, "roughness": 0.2454545497894287, "planeBump": true}, "a": {"normal": 0.55, "roughness": 0.2454545497894287, "planeBump": false}, "b": {"normal": 0.55, "roughness": 0.55, "planeBump": false}};
    const panel = document.getElementById('xr-compare');
    const summary = document.getElementById('xr-compare-stats');
    const buttons = [...panel.querySelectorAll('button')];
    let active;

    function bind(model) {
        const materials = new Set();
        let plane;
        model.traverse(mesh => {
            if (!mesh.isMesh) return;
            const items = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of items) if (material.name === 'gray') materials.add(material);
            if (mesh.name === profiles.plane && !Array.isArray(mesh.material) && mesh.material.name === 'gray') plane = mesh;
        });
        if (!plane || !materials.size) return null;
        plane.material = plane.material.clone();
        const planeNormal = plane.material.normalMap;
        materials.add(plane.material);
        return key => {
            const profile = profiles[key];
            if (!profile) return false;
            for (const material of materials) {
                material.normalScale.setScalar(profile.normal);
                material.roughness = profile.roughness;
            }
            const next = profile.planeBump ? planeNormal : null;
            if (plane.material.normalMap !== next) {
                plane.material.normalMap = next;
                plane.material.needsUpdate = true;
            }
            return true;
        };
    }

    function reset(state) {
        state.previous = null;
        state.elapsed = state.windowMs = state.frames = state.stalls = 0;
        summary.textContent = '运行 0:00 · FPS — · 卡顿 0 次';
    }

    function place(apply) {
        if (!apply) return;
        if (active?.apply !== apply) {
            active = {apply, key:'original'};
            buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.quality === 'original')));
        }
        reset(active);
        panel.hidden = false;
    }

    panel.addEventListener('click', event => {
        const button = event.target.closest('button[data-quality]');
        if (!active || !button) return;
        const key = button.dataset.quality;
        if (active.key === key || !active.apply(key)) return;
        active.key = key;
        buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        reset(active);
    });

    function frame(time, visible) {
        if (!active || panel.hidden) return;
        const state = active;
        if (!visible) {
            state.previous = null;
            return;
        }
        const previous = state.previous;
        state.previous = time;
        if (previous === null || time <= previous) return;
        const delta = time - previous;
        state.elapsed += delta;
        state.windowMs += delta;
        state.frames++;
        if (delta > 50) state.stalls++;
        if (state.windowMs < 1000) return;
        const seconds = Math.floor(state.elapsed / 1000);
        const clock = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
        summary.textContent = '运行 ' + clock + ' · FPS ' + Math.round(state.frames * 1000 / state.windowMs) +
            ' · 卡顿 ' + state.stalls + ' 次';
        state.windowMs = state.frames = 0;
    }

    function suspend() {
        if (active) active.previous = null;
    }

    function hide() {
        panel.hidden = true;
        suspend();
    }

    function close() {
        hide();
        active = null;
    }

    return {bind, place, frame, suspend, hide, close};
})();
