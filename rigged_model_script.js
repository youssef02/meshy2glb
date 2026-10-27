 // the original script was not downloading the rigged models, so here is the updated script for downloading rigged models too.
 // ==UserScript==
 // @name         Meshy Rigged Model Export Helper
 // @namespace    http://tampermonkey.net/
 // @version      5.0
 // @description  Find rigged and animated GLB assets in accessible Meshy task responses
 // @match        https://meshy.ai/*
 // @match        https://*.meshy.ai/*
 // @run-at       document-start
 // @grant        none
 // ==/UserScript==

 (() => {
     'use strict';

     if (window.__meshyRiggedExportHelper) return;
     window.__meshyRiggedExportHelper = true;

     const assets = new Map();
     let panel;

     function log(...args) {
         console.log('[Meshy Rigged Export]', ...args);
     }

     function addAsset(name, url) {
         if (typeof url !== 'string' ||
             !/^https:\/\//i.test(url) ||
             !/\.glb(?:[?#]|$)/i.test(url)) return;

         if (assets.has(url)) return;
         assets.set(url, name);
         log('Found GLB asset:', name);
         renderPanel();
     }

     function inspectTask(json) {
         const results = Array.isArray(json?.result)
             ? json.result
             : [json];

         for (const task of results) {
             const actions = task?.result?.animate?.actions;

             if (!Array.isArray(actions)) continue;

             for (const action of actions) {
                 addAsset(
                     'Armature GLB',
                     action.armatureGlbUrl
                 );

                 addAsset(
                     'Animated Character GLB',
                     action.animationGlbUrl
                 );
             }
         }
     }

     // Observe JSON returned by requests the page already makes.
     const originalFetch = window.fetch;

     window.fetch = async function (...args) {
         const response = await originalFetch.apply(this, args);

         try {
             const type = response.headers.get('content-type') || '';

             if (response.ok && /json/i.test(type)) {
                 const data = await response.clone().json();
                 inspectTask(data);
             }
         } catch (error) {
             log('JSON inspection error:', String(error));
         }

         return response;
     };

     function renderPanel() {
         if (!document.body) return;

         if (!panel) {
             panel = document.createElement('div');
             panel.style.cssText = [
                 'position:fixed',
                 'right:16px',
                 'bottom:16px',
                 'z-index:2147483647',
                 'width:310px',
                 'max-height:50vh',
                 'overflow:auto',
                 'padding:14px',
                 'background:#202124',
                 'color:#fff',
                 'border:1px solid #666',
                 'border-radius:10px',
                 'font:13px Arial,sans-serif',
                 'box-shadow:0 4px 20px #0008'
             ].join(';');

             document.body.appendChild(panel);
         }

         panel.replaceChildren();

         const heading = document.createElement('strong');
         heading.textContent = 'Meshy GLB Assets';
         panel.appendChild(heading);

         if (!assets.size) {
             const message = document.createElement('p');
             message.textContent =
                 'No GLB URLs detected yet. Open or refresh the animation task.';
             panel.appendChild(message);
             return;
         }

         for (const [url, name] of assets) {
             const row = document.createElement('p');
             const link = document.createElement('a');

             link.href = url;
             link.target = '_blank';
             link.rel = 'noopener noreferrer';
             link.textContent = 'Open ' + name;
             link.style.cssText =
                 'display:block;color:#b8f28b;margin-top:10px;overflow-wrap:anywhere';

             row.appendChild(link);
             panel.appendChild(row);
         }

         const note = document.createElement('p');
         note.textContent =
             'If a link opens the GLB in a new tab instead of downloading it, use the browser download option if available.';
         panel.appendChild(note);
     }

     function start() {
         renderPanel();
     }

     if (document.readyState === 'loading') {
         document.addEventListener('DOMContentLoaded', start, {
             once: true
         });
     } else {
         start();
     }

     log('Installed. Open or refresh the Meshy animation task.');
 })();
