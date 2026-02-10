// ==UserScript==
// @name         Meshy GLB Decryptor
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Intercept and decrypt Meshy GLB files
// @author       You
// @match        https://*.meshy.ai/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('%c🔓 Meshy Decryptor v1.2', 'font-size: 16px; color: lime; background: black; padding: 4px;');

    window.__meshyGLB = null;
    window.__meshyDecryptorReady = false;

    function init() {
        if (window.__meshyDecryptorReady) return;
        window.__meshyDecryptorReady = true;

        console.log('[Meshy] Decryptor starting...');

        // WebAssembly intercept
        const oriCompile = WebAssembly.compile;
        WebAssembly.compile = function(bufferSource) {
            return oriCompile.call(this, bufferSource);
        };

        const oriInstantiate = WebAssembly.instantiate;
        WebAssembly.instantiate = function(bufferSource, importObject) {
            return oriInstantiate.call(this, bufferSource, importObject).then(function(result) {
                if (result && result.instance && result.instance.exports) {
                    const exports = result.instance.exports;

                    if (exports.processFileWithDetails) {
                        console.log('[WASM] processFileWithDetails found!');
                        const original = exports.processFileWithDetails;
                        exports.processFileWithDetails = function() {
                            const result = original.apply(this, arguments);

                            if (result && typeof result.then === 'function') {
                                result.then(function(decrypted) {
                                    if (decrypted && decrypted.success && decrypted.data) {
                                        handleDecryptedGLB(decrypted.data);
                                    }
                                });
                            } else if (result && result.success && result.data) {
                                handleDecryptedGLB(result.data);
                            }

                            return result;
                        };
                    }
                }
                return result;
            });
        };

        // Blob intercept
        const oriCreateURL = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
            const url = oriCreateURL.apply(this, arguments);
            if (blob && (blob.type === 'application/octet-stream' || blob.type === 'model/gltf-binary')) {
                console.log('[BLOB] GLB detected!');
                blob.arrayBuffer().then(function(buffer) {
                    console.log('[BLOB] Size:', buffer.byteLength);
                    window.__meshyGLB = blob;
                    window.__meshyGLBBuffer = buffer;
                    console.log('[BLOB] Captured!');
                });
            }
            return url;
        };

        // Add button after page load
        setTimeout(addButton, 2000);
    }

    function handleDecryptedGLB(data) {
        console.log('[WASM] Decryption success! Size:', data.byteLength || data.length);

        try {
            const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data);
            const blob = new Blob([uint8], { type: 'model/gltf-binary' });

            window.__meshyGLB = blob;
            window.__meshyGLBBuffer = blob;

            // Auto download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'meshy_decrypted_' + Date.now() + '.glb';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            console.log('[WASM] Auto downloaded!');
        } catch (e) {
            console.error('[WASM] Error:', e);
        }
    }

    function addButton() {
        if (document.getElementById('meshy-decrypt-btn')) return;

        // Wait for canvas
        const canvas = document.querySelector('canvas');
        if (!canvas) {
            console.log('[Meshy] Waiting for canvas...');
            setTimeout(addButton, 1000);
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'meshy-decrypt-btn';
        btn.innerHTML = '💾 Download GLB';
        btn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999999; padding: 12px 24px; background: #00ff00; color: black; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px;';
        btn.onclick = function() {
            if (window.__meshyGLB) {
                const url = URL.createObjectURL(window.__meshyGLB);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'meshy_' + Date.now() + '.glb';
                a.click();
            } else {
                alert('No GLB captured yet. Export a model first.');
            }
        };
        document.body.appendChild(btn);
        console.log('[Meshy] Button added');
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
