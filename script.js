// ==UserScript==
// @name         Meshy GLB Decryptor
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Intercept and decrypt Meshy GLB files
// @author       Youssef02
// @match        https://*.meshy.ai/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Inject all interception code directly into the page context via a <script> tag.
    // This is required because Tampermonkey runs in an isolated sandbox — window.Worker
    // overrides set there don't affect the page's own window.Worker.
    const script = document.createElement('script');
    script.textContent = `(${pageScript.toString()})();`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    function pageScript() {
        if (window.__meshyDecryptorInjected) return;
        window.__meshyDecryptorInjected = true;

        console.log('%c🔓 Meshy Decryptor v2.1', 'font-size:16px;color:lime;background:black;padding:4px;');

        window.__meshyGLBs = [];
        window.__meshyLastGLB = null;

        // ─── DEBUG ────────────────────────────────────────────────────────────
        function dbg(tag, msg, data) {
            const s = 'color:cyan;font-weight:bold;';
            data !== undefined
                ? console.log('%c[Meshy:' + tag + ']', s, msg, data)
                : console.log('%c[Meshy:' + tag + ']', s, msg);
        }

        function isGLBBuffer(buf) {
            if (!buf || buf.byteLength < 4) return false;
            return new Uint32Array(buf.slice ? buf.slice(0, 4) : buf)[0] === 0x46546C67;
        }

        function isMeshyEncrypted(buf) {
            if (!buf || buf.byteLength < 8) return false;
            return new TextDecoder().decode(new Uint8Array(buf, 0, 8)).startsWith('MESHY.AI');
        }

        function looksLikeGLBUrl(url) {
            if (!url || typeof url !== 'string') return false;
            if (url.includes('.glb')) return true;
            if (url.includes('misc/cdn-models')) return true;
            return false;
        }

        // ─── CAPTURE ──────────────────────────────────────────────────────────
        function captureGLB(blob, src) {
            const entry = { blob, src, time: Date.now() };
            window.__meshyGLBs.push(entry);
            window.__meshyLastGLB = entry;
            dbg('CAPTURE', 'GLB captured! size=' + blob.size + ' src=' + src);
            updateButton();
            // Auto-download immediately
            const url = _origCreateObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'meshy_' + Date.now() + '.glb';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        }

        // ─── HOOK: Worker ─────────────────────────────────────────────────────
        const _OrigWorker = window.Worker;
        window.Worker = function MeshyWorkerProxy(scriptURL, options) {
            const w = new _OrigWorker(scriptURL, options);
            dbg('WORKER', 'Created: ' + String(scriptURL).slice(-80));

            // Wrap onmessage via defineProperty on the prototype descriptor
            const proto = Object.getPrototypeOf(w);
            const desc = Object.getOwnPropertyDescriptor(proto, 'onmessage');
            if (desc && desc.set) {
                Object.defineProperty(w, 'onmessage', {
                    configurable: true,
                    get() { return desc.get ? desc.get.call(w) : undefined; },
                    set(fn) {
                        desc.set.call(w, function(e) {
                            spyWorkerMsg(e);
                            return fn.call(this, e);
                        });
                    }
                });
            }

            // Also wrap addEventListener
            const _origAEL = w.addEventListener.bind(w);
            w.addEventListener = function(type, listener, opts) {
                if (type === 'message') {
                    return _origAEL(type, function(e) {
                        spyWorkerMsg(e);
                        return listener.call(this, e);
                    }, opts);
                }
                return _origAEL(type, listener, opts);
            };

            return w;
        };
        window.Worker.prototype = _OrigWorker.prototype;
        // Make sure new Worker(...) instanceof Worker still works
        Object.defineProperty(window.Worker, Symbol.hasInstance, {
            value: function(instance) { return instance instanceof _OrigWorker; }
        });

        function spyWorkerMsg(e) {
            const d = e.data;
            if (!d || !d.type) return;
            dbg('WORKER', 'msg type=' + d.type + (d.error ? ' err=' + d.error : '') + (d.success !== undefined ? ' ok=' + d.success : ''));
            if (d.type === 'process' && d.success && d.data) {
                dbg('WORKER', 'DECRYPTED! size=' + d.data.byteLength);
                try {
                    const copy = d.data.slice(0); // copy before app uses it
                    captureGLB(new Blob([copy], { type: 'model/gltf-binary' }), 'worker');
                } catch(ex) { dbg('WORKER', 'capture error: ' + ex); }
            }
        }

        // ─── HOOK: fetch ──────────────────────────────────────────────────────
        const _origFetch = window.fetch;
        window.fetch = async function(input) {
            const url = typeof input === 'string' ? input : (input && input.url) || String(input);
            const hit = looksLikeGLBUrl(url);
            if (hit) dbg('FETCH', 'intercepting: ' + url.slice(-80));
            const p = _origFetch.apply(this, arguments);
            if (!hit) return p;
            return p.then(async resp => {
                try {
                    const buf = await resp.clone().arrayBuffer();
                    dbg('FETCH', 'size=' + buf.byteLength + ' encrypted=' + isMeshyEncrypted(buf) + ' glb=' + isGLBBuffer(buf));
                    if (isGLBBuffer(buf)) {
                        captureGLB(new Blob([buf], { type: 'model/gltf-binary' }), 'fetch');
                    }
                } catch(ex) { dbg('FETCH', 'read err: ' + ex); }
                return resp;
            });
        };

        // ─── HOOK: createObjectURL ────────────────────────────────────────────
        const _origCreateObjectURL = URL.createObjectURL.bind(URL);
        URL.createObjectURL = function(blob) {
            const url = _origCreateObjectURL(blob);
            if (blob instanceof Blob || blob instanceof File) {
                if (blob.size > 1000) {
                    dbg('BLOB', 'type=' + blob.type + ' size=' + blob.size);
                }
                if (blob.type === 'model/gltf-binary') {
                    dbg('BLOB', 'GLB blob! capturing...');
                    captureGLB(blob, 'createObjectURL');
                } else if (blob.size > 100000) {
                    blob.arrayBuffer().then(buf => {
                        if (isGLBBuffer(buf)) {
                            dbg('BLOB', 'GLB magic in untyped blob!');
                            captureGLB(new Blob([buf], { type: 'model/gltf-binary' }), 'createObjectURL-magic');
                        }
                    }).catch(() => {});
                }
            }
            return url;
        };

        // ─── BUTTON ───────────────────────────────────────────────────────────
        function updateButton() {
            const btn = document.getElementById('meshy-decrypt-btn');
            if (!btn) return;
            const n = window.__meshyGLBs.length;
            btn.textContent = n > 0 ? '💾 GLB (' + n + ' captured)' : '💾 Download GLB';
            btn.style.background = n > 0 ? '#00ff00' : '#888';
        }

        function addButton() {
            if (document.getElementById('meshy-decrypt-btn')) return;
            if (!document.querySelector('canvas')) { setTimeout(addButton, 1000); return; }

            const btn = document.createElement('button');
            btn.id = 'meshy-decrypt-btn';
            btn.textContent = '💾 Download GLB';
            btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;padding:12px 24px;background:#888;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;';
            btn.onclick = function() {
                const glbs = window.__meshyGLBs;
                if (!glbs.length) {
                    alert('No GLB captured yet.\\n\\nOpen a model, then try the Export/Download button first.\\nCheck F12 console for [Meshy:*] logs.');
                    return;
                }
                glbs.forEach((entry, i) => {
                    const url = _origCreateObjectURL(entry.blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'meshy_' + (i+1) + '_' + Date.now() + '.glb';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                });
            };
            document.body.appendChild(btn);
            dbg('UI', 'Button added');
            updateButton();
        }

        setTimeout(addButton, 2000);
    }
})();
