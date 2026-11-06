/* Exclusive native session ownership and fresh horizontal placement. */
(function (root) {
    'use strict';

    class SessionOwner {
        constructor(xr, ended) {
            this.xr = xr;
            this.ended = ended;
            this.run = null;
        }

        start(overlay, activate) {
            if (this.run) return this.run.pending;
            const run = this.run = {cancelled: false, session: null, source: null, finished: false};
            const ensureCurrent = () => {
                if (run.cancelled || run.finished) throw new DOMException('已退出', 'AbortError');
            };
            let request;
            try {
                request = this.xr.requestSession('immersive-ar', {
                    requiredFeatures: ['hit-test', 'dom-overlay'],
                    optionalFeatures: ['local-floor', 'anchors'],
                    domOverlay: {root: overlay}
                });
            } catch (error) {
                request = Promise.reject(error);
            }
            run.pending = Promise.resolve(request).then(async session => {
                run.session = session;
                session.addEventListener('end', () => this.finish(run), {once: true});
                ensureCurrent();
                if (!session.domOverlayState || typeof session.requestHitTestSource !== 'function') {
                    throw new DOMException('缺少定位或屏幕操作功能', 'NotSupportedError');
                }
                let referenceType = 'local-floor';
                const reference = await session.requestReferenceSpace(referenceType).catch(() => {
                    ensureCurrent();
                    referenceType = 'local';
                    return session.requestReferenceSpace(referenceType);
                });
                ensureCurrent();
                const viewer = await session.requestReferenceSpace('viewer');
                ensureCurrent();
                const source = await session.requestHitTestSource({space: viewer});
                if (run.cancelled || run.finished) source.cancel();
                else run.source = source;
                ensureCurrent();
                await activate({session, reference, referenceType, source, ensureCurrent});
                ensureCurrent();
                return session;
            }).catch(async error => {
                await this.close(run);
                throw error;
            });
            return run.pending;
        }

        finish(run) {
            if (run.finished) return;
            run.finished = true;
            try { run.source?.cancel(); } catch (_) {}
            if (this.run === run) {
                this.run = null;
                this.ended();
            }
        }

        close(run) {
            if (run.closing) return run.closing;
            run.closing = (async () => {
                if (run.session && !run.finished) {
                    try { await run.session.end(); } catch (_) {}
                }
                this.finish(run);
            })();
            return run.closing;
        }

        stop() {
            const run = this.run;
            if (!run) return Promise.resolve();
            run.cancelled = true;
            // A permission prompt cannot be cancelled by script. The resolution
            // still belongs to this run and any late session will be closed.
            return run.session ? this.close(run) : Promise.resolve();
        }
    }

    const distance = (a, b) => Math.hypot(a[12] - b[12], a[13] - b[13], a[14] - b[14]);

    class GroundTarget {
        constructor() {
            this.reset();
        }

        reset() {
            this.matrix = null;
            this.origin = null;
            this.count = 0;
            this.time = -Infinity;
        }

        update(matrix, now) {
            if (!matrix || !(matrix[5] > .94) || ![matrix[12], matrix[13], matrix[14]].every(Number.isFinite)) {
                this.reset();
                return false;
            }
            if (!this.origin || now - this.time > 160 || distance(this.origin, matrix) > .08) {
                this.origin = matrix;
                this.count = 0;
            }
            this.matrix = matrix;
            this.time = now;
            this.count++;
            return this.count >= 3;
        }

        fresh(now) {
            return this.count >= 3 && now - this.time <= 160;
        }
    }

    root.SpiritXR18Session = {SessionOwner, GroundTarget, distance};
    if (typeof module !== 'undefined' && module.exports) module.exports = root.SpiritXR18Session;
})(typeof window === 'undefined' ? globalThis : window);
