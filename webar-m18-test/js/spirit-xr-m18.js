/* Local M18 candidate. All world poses come from the native immersive session. */
(() => {
    'use strict';
    const get = id => document.getElementById(id);
    const overlay = get('xr-overlay');
    const start = get('xr-start');
    const place = get('xr-place');
    const replace = get('xr-replace');
    const back = get('xr-back');
    const status = get('xr-status');
    const loading = get('xr-loading');
    const feedback = get('xr-feedback');
    const {SessionOwner, GroundTarget, distance} = window.SpiritXR18Session;
    const xr = isSecureContext ? navigator.xr : null;
    const scanner = !!get('ar-scene');
    const params = new URLSearchParams(location.search);
    const returnUrl = './index.html' + (params.get('exhibit') === '1' ? '?exhibit=1' : '');
    let selected, releaseScannerModel, active, returning = false;
    let supported = typeof xr?.requestSession === 'function' ? null : false;
    const metrics = {};
    const mark = name => { if (metrics[name] === undefined) metrics[name] = performance.now(); };
    const owner = new SessionOwner(xr, () => {
        const run = active;
        dispose(run);
        start.disabled = false;
        if (returning || !run || run.starting || run.error) return;
        showError('空间 AR 已结束，可以重新进入或返回卡牌。');
    });
    back.href = returnUrl;

    function say(text = '') {
        feedback.textContent = text;
        feedback.hidden = !text;
    }

    function setPhase(phase, text, usable = false) {
        if (overlay.dataset.phase !== phase) {
            say();
            overlay.dataset.phase = phase;
        }
        if (status.textContent !== text) status.textContent = text;
        const presenting = overlay.hasAttribute('data-presenting');
        const hidePlace = !presenting || phase === 'placed' || phase === 'error' ||
            (phase === 'tracking-lost' && active?.placed);
        const hideReplace = !presenting || (phase !== 'placed' && !(phase === 'tracking-lost' && active?.placed));
        if (place.hidden !== hidePlace) place.hidden = hidePlace;
        if (replace.hidden !== hideReplace) replace.hidden = hideReplace;
        const disabled = String(!usable);
        if (place.getAttribute('aria-disabled') !== disabled) place.setAttribute('aria-disabled', disabled);
    }

    function showError(text, retry = true) {
        overlay.hidden = false;
        overlay.removeAttribute('data-presenting');
        loading.hidden = true;
        setPhase('error', text);
        start.hidden = !retry;
        start.disabled = !!owner.run;
        start.textContent = '重新进入空间 AR';
    }

    function showMonster(monster) {
        get('xr-monster').textContent = SpiritData.displayName(monster) + ' · ' + monster.realityHeightM + ' 米 · 身高锁定';
    }

    function releaseAnchor(run) {
        run.revision++;
        try { run.anchor?.delete(); } catch (_) {}
        run.anchor = null;
    }

    function dispose(run) {
        if (!run || run.disposed) return;
        run.disposed = true;
        clearTimeout(run.startTimeout);
        clearTimeout(run.downloadTimeout);
        run.abort.abort();
        releaseAnchor(run);
        run.renderer?.setAnimationLoop(null);
        run.mixer?.stopAllAction();
        if (run.model) {
            run.mixer?.uncacheRoot(run.model);
            SpiritViewer.dispose(run.model);
        }
        run.reticle?.traverse(node => {
            node.geometry?.dispose();
            node.material?.dispose();
        });
        run.renderer?.dispose();
        run.renderer?.forceContextLoss();
        run.canvas?.remove();
        if (active === run) active = null;
        overlay.removeAttribute('data-presenting');
        loading.hidden = true;
    }

    function stopWithError(run, message) {
        if (run !== active || run.error) return;
        run.error = message;
        owner.stop();
        showError(message);
    }

    function sessionError(error) {
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError')
            return '空间 AR 未获允许。请检查浏览器相机权限，再点下方按钮重试。';
        if (error.name === 'NotSupportedError')
            return '此浏览器无法同时提供空间 AR、地面定位和屏幕按钮。请返回卡牌。';
        if (error.name === 'InvalidStateError' || error.name === 'NotReadableError')
            return '相机或另一个空间会话仍在使用。请等一会，再点下方按钮重试。';
        return '空间 AR 启动失败。请重试或返回卡牌。';
    }

    async function download(run) {
        run.downloadTimeout = setTimeout(() => run.abort.abort(), 45000);
        try {
            const response = await fetch(run.monster.modelUrl, {signal: run.abort.signal});
            if (!response.ok) throw Error('HTTP ' + response.status);
            const bytes = await response.arrayBuffer();
            mark('modelBytes');
            return {bytes};
        } catch (_) {
            return {error: true};
        } finally {
            clearTimeout(run.downloadTimeout);
        }
    }

    async function prepareModel(run) {
        loading.hidden = false;
        loading.dataset.loading = '';
        loading.textContent = '正在召唤' + run.monster.nameZh + '…';
        try {
            const {bytes, error} = await run.download;
            if (run.disposed) return;
            if (error) throw Error('download');
            const {THREE} = run;
            const base = new URL('.', new URL(run.monster.modelUrl, location.href)).href;
            mark('parseStart');
            const gltf = await new THREE.GLTFLoader().parseAsync(bytes, base);
            if (run.disposed) {
                SpiritViewer.dispose(gltf.scene);
                return;
            }
            mark('modelParsed');
            run.model = gltf.scene;
            run.mixer = new THREE.AnimationMixer(run.model);
            const clip = gltf.animations.find(item => item.name.toLowerCase() === 'idle') || gltf.animations[0];
            if (clip) run.mixer.clipAction(clip).play();
            run.mixer.update(0);
            const bounds = SpiritGeometry.measure(run.model, THREE);
            const scale = SpiritGeometry.heightScale(run.monster.realityHeightM, bounds);
            const metric = new THREE.Group(), foot = new THREE.Group();
            metric.scale.setScalar(scale);
            foot.position.y = -bounds.min.y;
            foot.add(run.model);
            metric.add(foot);
            run.placement.add(metric);
            run.metricScale = scale;
            run.nativeHeight = bounds.height;
            mark('modelReady');
            loading.hidden = true;
            delete loading.dataset.loading;
            say();
        } catch (_) {
            if (run.disposed) return;
            run.modelError = true;
            delete loading.dataset.loading;
            loading.textContent = '怪兽资源无法准备。请检查网络，再点下方重试。';
            start.hidden = false;
            start.textContent = '重试加载怪兽';
        }
    }

    function makeRing(THREE) {
        const group = new THREE.Group();
        group.matrixAutoUpdate = false;
        group.visible = false;
        // Dark outer stroke maintains contrast against a bright floor.
        for (const [inner, outer, color, height] of [[.225, .295, 0x112b24, .003], [.24, .28, 0x59ff92, .004]]) {
            const geometry = new THREE.RingGeometry(inner, outer, 40);
            geometry.rotateX(-Math.PI / 2);
            const ring = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color, side: THREE.DoubleSide, toneMapped: false}));
            ring.position.y = height;
            group.add(ring);
        }
        return group;
    }

    function trackAnchor(run, frame) {
        if (!run.anchor) return true;
        const pose = frame.getPose(run.anchor.anchorSpace, run.reference);
        if (!pose) return false;
        const position = pose.transform.position;
        run.placement.position.set(position.x, position.y, position.z).add(run.anchorOffset);
        return true;
    }

    function placeModel(run, hit, matrix, selectedMatrix) {
        const {THREE, placement} = run;
        run.placed = true;
        placement.position.set(selectedMatrix[12], selectedMatrix[13], selectedMatrix[14]);
        placement.visible = true;
        run.reticle.visible = false;
        setPhase('placed', '放置成功。可以靠近或绕着怪兽观察。');
        const revision = ++run.revision;
        if (typeof hit.createAnchor !== 'function') return;
        const offset = placement.position.clone().sub(new THREE.Vector3(matrix[12], matrix[13], matrix[14]));
        // Create only inside this native XR frame. The offset retains the exact
        // position the green marker had when the user confirmed.
        try {
            hit.createAnchor().then(anchor => {
                if (run.disposed || run.revision !== revision) {
                    try { anchor.delete(); } catch (_) {}
                    return;
                }
                run.anchor = anchor;
                run.anchorOffset = offset;
            }).catch(() => {
                if (!run.disposed && run.revision === revision) say('空间锚点不可用，已保留本次会话中的放置位置。');
            });
        } catch (_) {
            say('空间锚点不可用，已保留本次会话中的放置位置。');
        }
    }

    function frameUpdate(run, time, frame) {
        if (!frame || run.disposed || run.error || run.session.visibilityState === 'hidden') return;
        if (!frame.getViewerPose(run.reference)) {
            run.target.reset();
            run.queued = null;
            run.reticle.visible = false;
            run.placement.visible = false;
            run.lastTime = null;
            setPhase('tracking-lost', '空间追踪暂时中断，请缓慢移动手机找回位置。');
            return;
        }
        mark('firstXRPose');
        if (run.placed) {
            const tracked = trackAnchor(run, frame);
            run.placement.visible = tracked;
            if (tracked) {
                setPhase('placed', '放置成功。可以靠近或绕着怪兽观察。');
                run.mixer.update(run.lastTime === null ? 0 : Math.min(.05, (time - run.lastTime) / 1000));
            } else {
                setPhase('tracking-lost', '放置位置暂时找不到。请移回原处，或重新放置。');
            }
        } else {
            const now = performance.now();
            const hit = frame.getHitTestResults(run.source)[0];
            const matrix = hit?.getPose(run.reference)?.transform.matrix;
            const stable = run.target.update(matrix, now);
            run.reticle.visible = stable;
            if (stable) {
                mark('firstStableGround');
                run.reticle.matrix.fromArray(matrix);
                run.reticle.matrixWorldNeedsUpdate = true;
                run.searchSince = now;
                setPhase('ground', run.metricScale ? '已找到平面，点击放置怪兽' : '已找到平面，等怪兽准备好后即可放置',
                         !!run.metricScale && !run.queued);
            } else {
                const guidance = now - run.searchSince > 8500
                    ? '仍在寻找地面。试试补光、放慢移动，避开反光表面。'
                    : '请缓慢移动手机，对准地面';
                setPhase('search', guidance);
            }
            if (run.queued) {
                const queued = run.queued;
                run.queued = null;
                if (stable && now - queued.at <= 160 && distance(queued.matrix, matrix) <= .06) {
                    placeModel(run, hit, matrix, queued.matrix);
                } else {
                    say('刚才的定位点已变化，请对准绿色圈后再放置。');
                }
            }
        }
        run.lastTime = time;
        run.renderer.render(run.scene, run.camera);
        if (run.placed && run.placement.visible) mark('firstPlacedRender');
    }

    async function activate(run, {session, reference, referenceType, source, ensureCurrent}) {
        mark('sessionReady');
        const THREE = run.THREE = await SpiritViewer.engine();
        ensureCurrent();
        const canvas = run.canvas = document.createElement('canvas');
        canvas.className = 'xr-m18-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        overlay.before(canvas);
        canvas.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            if (!run.disposed) stopWithError(run, '3D 画面中断。请重新进入空间 AR，或返回卡牌。');
        }, {signal: run.abort.signal});
        const renderer = run.renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: false});
        renderer.useLegacyLights = true;
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
        renderer.setSize(innerWidth, innerHeight, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.xr.enabled = true;
        renderer.xr.setReferenceSpaceType(referenceType);
        await renderer.xr.setSession(session);
        ensureCurrent();
        renderer.xr.setReferenceSpace(reference);
        run.session = session;
        run.source = source;
        run.reference = reference;
        run.scene = new THREE.Scene();
        run.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .05, Math.max(1000, run.monster.realityHeightM * 20));
        window.addEventListener('resize', () => {
            if (renderer.xr.isPresenting) return;
            renderer.setSize(innerWidth, innerHeight, false);
            run.camera.aspect = innerWidth / innerHeight;
            run.camera.updateProjectionMatrix();
        }, {signal: run.abort.signal});
        const light = new THREE.DirectionalLight(0xffffff, 1.4);
        light.position.set(2, 5, 3);
        run.reticle = makeRing(THREE);
        run.placement = new THREE.Group();
        run.placement.visible = false;
        run.scene.add(new THREE.AmbientLight(0xffffff, .6), light, run.reticle, run.placement);
        reference.addEventListener('reset', () => {
            resetPlacement(run);
            say('空间坐标已变化，请重新选择放置位置。');
        }, {signal: run.abort.signal});
        session.addEventListener('visibilitychange', () => {
            if (session.visibilityState !== 'visible') {
                run.target.reset();
                run.reticle.visible = false;
                run.queued = null;
                run.lastTime = null;
                setPhase('tracking-lost', '空间画面已暂停。回到画面后请重新对准。');
            }
        }, {signal: run.abort.signal});
        run.searchSince = performance.now();
        overlay.setAttribute('data-presenting', '');
        setPhase('search', '请缓慢移动手机，对准地面');
        renderer.setAnimationLoop((time, frame) => {
            try { frameUpdate(run, time, frame); }
            catch (_) { stopWithError(run, '空间画面无法继续显示。请重新进入，或返回卡牌。'); }
        });
        releaseScannerModel?.();
        releaseScannerModel = null;
        void prepareModel(run);
    }

    function resetPlacement(run) {
        releaseAnchor(run);
        run.queued = null;
        run.placed = false;
        run.target.reset();
        run.searchSince = performance.now();
        run.placement.visible = false;
        run.reticle.visible = false;
        setPhase('search', '请缓慢移动手机，对准地面');
    }

    function begin(monster, handoff, evict) {
        if (!monster || active || owner.run || returning) return;
        selected = monster;
        overlay.hidden = false;
        showMonster(monster);
        if (supported === false) {
            showError('这台设备或浏览器目前无法开启空间 AR。可以返回使用卡牌和近似合影。', false);
            return;
        }
        releaseScannerModel = evict;
        if (scanner && !history.state?.spiritM18XR) history.pushState({spiritM18XR: true}, '', location.href);
        const run = active = {monster, abort: new AbortController(), target: new GroundTarget(), starting: true, revision: 0, lastTime: null};
        for (const key of Object.keys(metrics)) delete metrics[key];
        mark('tap');
        start.hidden = true;
        setPhase('permission', '正在打开空间 AR。如浏览器询问，请选择允许。');
        // SpiritApp.exit stops its MediaStream synchronously before returning
        // its promise. No await, navigation, or permission check before XR.
        try {
            handoff?.();
            mark('request');
            const native = owner.start(overlay, resources => activate(run, resources));
            run.download = download(run);
            run.startTimeout = setTimeout(() => {
                stopWithError(run, '空间 AR 等待时间过长。请关闭浏览器的权限提示，或返回卡牌重试。');
                start.hidden = !!owner.run;
            }, 30000);
            native.then(() => {
                run.starting = false;
                clearTimeout(run.startTimeout);
            }).catch(error => {
                const message = run.error || sessionError(error);
                if (!returning && !overlay.hidden && (!active || active === run)) {
                    showError(message, error.name !== 'NotSupportedError');
                }
            });
        } catch (_) {
            dispose(run);
            showError('卡牌相机还没释放。请返回卡牌后重新进入。');
        }
    }

    async function returnToCards(fromHistory = false) {
        if (returning) return;
        returning = true;
        // Leaving the document also closes a permission prompt that has not yet
        // yielded a session. The next scanner still needs an explicit start.
        const pendingPermission = owner.run && !owner.run.session;
        let timeout;
        const stopped = await Promise.race([
            owner.stop().then(() => true),
            new Promise(resolve => { timeout = setTimeout(() => resolve(false), 2500); })
        ]);
        clearTimeout(timeout);
        dispose(active);
        if (!scanner || pendingPermission || !stopped) {
            location.replace(returnUrl);
            return;
        }
        overlay.hidden = true;
        if (!fromHistory && history.state?.spiritM18XR) history.back();
        returning = false;
    }

    overlay.addEventListener('beforexrselect', event => {
        if (event.target.closest('button, a')) event.preventDefault();
    });
    place.addEventListener('click', () => {
        const run = active;
        if (!run || run.placed || run.queued) return;
        const now = performance.now();
        if (!run.target.fresh(now)) return say('还没有可放置的位置。请对准地面，等绿色圈出现。');
        if (!run.metricScale) return say(run.modelError ? '怪兽加载失败，请点重试。' : '定位已就绪，正在准备怪兽。');
        mark('placeTap');
        run.queued = {at: now, matrix: new Float32Array(run.target.matrix)};
        place.setAttribute('aria-disabled', 'true');
    });
    replace.addEventListener('click', () => {
        if (active?.placed) resetPlacement(active);
    });
    start.addEventListener('click', () => {
        if (active?.modelError) {
            const run = active;
            // Retry the asset within the existing session; the camera stays on.
            run.modelError = false;
            if (run.model) {
                run.mixer?.stopAllAction();
                run.mixer?.uncacheRoot(run.model);
                SpiritViewer.dispose(run.model);
                run.model = null;
            }
            start.hidden = true;
            run.download = download(run);
            void prepareModel(run);
        } else {
            begin(selected, undefined, releaseScannerModel);
        }
    });
    back.addEventListener('click', event => {
        event.preventDefault();
        void returnToCards();
    });
    window.addEventListener('popstate', () => { if (!overlay.hidden) void returnToCards(true); });
    window.addEventListener('pagehide', () => {
        returning = true;
        void owner.stop();
        dispose(active);
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted && scanner) {
            overlay.hidden = true;
            returning = false;
        }
    });

    Promise.resolve().then(() => xr?.isSessionSupported?.('immersive-ar')).then(value => {
        if (typeof value === 'boolean') supported = value;
    }).catch(() => {});
    window.SpiritXR18 = {begin, metrics};
    if (!scanner) {
        overlay.hidden = false;
        setPhase('idle', '正在读取怪兽资料…');
        SpiritData.load().then(catalog => {
            selected = catalog.monsters.find(monster => monster.id === params.get('monster'));
            let storage;
            try { storage = localStorage; } catch (_) {}
            if (!selected || !new SpiritData.UnlockStore(storage).has(selected.id)) {
                selected = null;
                return showError('请先扫描实体卡牌，再从卡牌页面进入空间 AR。', false);
            }
            showMonster(selected);
            if (supported === false) return showError('此浏览器无法开启空间 AR。可以返回卡牌。', false);
            start.hidden = false;
            setPhase('idle', '准备好后，点下方按钮打开空间 AR。');
        }).catch(() => showError('怪兽资料无法读取，请返回卡牌后重试。', false));
    }
})();
