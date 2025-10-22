// ==UserScript==
// @name         Gallery Extension for FMKOREA
// @version      2.08
// @description  펨코 파워링크 제거, 제휴링크 정상화, 댓글 이미지 삽입
// @match        https://*.fmkorea.com/*
// @icon         https://www.google.com/s2/favicons?domain=fmkorea.com
// @homepage     https://gall.dcinside.com/mgallery/board/view/?id=adguard&no=2348
// @downloadURL  https://github.com/Zziniswell/Adguard-gallery-filter/raw/refs/heads/main/Gallery%20Extension.user.js
// @updateURL    https://github.com/Zziniswell/Adguard-gallery-filter/raw/refs/heads/main/Gallery%20Extension.user.js
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const CFG = {
        imgRx: /\.(jpe?g|png|webp|avif|gif)([?&#/].*)?$/i,
        vidRx: /\.(mp4|mkv)([?&#].*)?$/i,
        imgEncRx: /\.(jpe?g|png|webp|avif|gif)%3F/i,
        imgHosts: ['pbs.twimg.com', 'images?q', '/image/', '/img', 'thumb', '/_next/image?url=']
    };

    function neutralizeAd() {
        try {
            Object.defineProperty(unsafeWindow, 'link_url', {value: '', writable: false, configurable: false});
            Object.defineProperty(unsafeWindow, 'board_block_check', {value: function() {}, writable: false, configurable: false});
            Object.defineProperty(unsafeWindow, '_make_power_link_identifier', {value: function() {}, writable: false, configurable: false});
        } catch (e) {}
    }

    function removeAds() {
        if (!document.body || !document.body.classList.contains('mac_os')) return;

        try {
            const isEmptyFunction = fn => typeof fn === 'function' && fn.toString().replace(/\s/g, '') === 'function(){}';
            if (isEmptyFunction(unsafeWindow.board_block_check) || isEmptyFunction(unsafeWindow._make_power_link_identifier)) return;
        } catch (e) {
            return;
        }

        function isAd(element) {
            try {
                const style = window.getComputedStyle(element);
                const height = parseInt(style.height);
                if (height < 60 || height > 200) return false;

                const padding = parseFloat(style.padding);
                if (padding > 5) return false;

                const marginTop = parseFloat(style.marginTop);
                if (marginTop > 5) return false;

                return parseFloat(style.marginLeft) <= 5;
            } catch (e) {
                return false;
            }
        }

        function clean() {
            try {
                document.querySelectorAll('.bd_mobile.bd').forEach(element => isAd(element) && element.remove());
            } catch (e) {}
        }

        clean();
        let timer;
        const observer = new MutationObserver(mutations => {
            if (mutations.some(m => m.type === 'childList' && m.addedNodes.length)) {
                clearTimeout(timer);
                timer = setTimeout(clean, 20);
            }
        });
        observer.observe(document.body, {childList: true, subtree: true});
        setTimeout(() => observer.disconnect(), 1000);
    }

    function initLinkFix() {
        if (!document.body || !document.body.classList.contains('mac_os')) return;
        if (document.body.dataset.linkFixInit) return;
        
        document.body.dataset.linkFixInit = 'true';

        function fix(event) {
            try {
                if (event.target.matches('a[href*="link.fmkorea.org"]')) {
                    const anchor = event.target;
                    const url = anchor.textContent.trim();
                    anchor.href = url;
                    anchor.removeAttribute('data-document_srl');
                    anchor.className = '';
                }
            } catch (e) {}
        }

        ['mousedown', 'touchstart', 'pointerdown'].forEach(evt => document.body.addEventListener(evt, fix, true));
    }

    function initMedia() {
        const processed = new Set();
        let observerInstance = null;

        function cleanSet() {
            try {
                const currentLinks = new Set();
                document.querySelectorAll('li[id^="comment"] a[href]').forEach(link => currentLinks.add(link.getAttribute('href')));
                processed.forEach(url => !currentLinks.has(url) && processed.delete(url));
            } catch (e) {}
        }

        function getType(url) {
            if (CFG.imgRx.test(url) || CFG.imgEncRx.test(url)) return 'img';
            if (CFG.vidRx.test(url)) return 'video';
            return CFG.imgHosts.some(host => url.includes(host)) ? 'img' : null;
        }

        function makeElement(type, src, text) {
            const element = document.createElement(type);
            element.src = src.startsWith('//') ? 'https:' + src : src;
            Object.assign(element.style, {maxWidth: '100%', display: 'block', marginTop: '10px', marginBottom: '10px'});
            element.loading = 'lazy';
            if (type === 'img') element.alt = text;
            else element.controls = true;
            return element;
        }

        function embed() {
            try {
                cleanSet();
                document.querySelectorAll('li[id^="comment"]:not([data-done])').forEach(comment => {
                    comment.setAttribute('data-done', 'true');
                    comment.querySelectorAll('a[href]:not([data-done])').forEach(link => {
                        try {
                            const url = link.getAttribute('href');
                            if ((!url.startsWith('http') && !url.startsWith('//')) || url.includes('wikipedia.org')) return;

                            const type = getType(url);
                            if (!type) return;

                            link.setAttribute('data-done', 'true');
                            processed.add(url);
                            link.style.display = 'none';

                            const element = makeElement(type, url, link.textContent);
                            element.onerror = () => {
                                try {
                                    element.remove();
                                    link.style.display = '';
                                    processed.delete(url);
                                } catch (e) {}
                            };
                            link.parentNode.insertBefore(element, link.nextSibling);
                        } catch (e) {}
                    });
                });
            } catch (e) {}
        }

        function watch() {
            if (observerInstance) return;

            let timeout;
            observerInstance = new MutationObserver(mutations => {
                if (mutations.some(m => m.type === 'childList' && [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('li[id^="comment"]') || n.querySelector?.('li[id^="comment"]'))))) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => requestIdleCallback ? requestIdleCallback(embed) : setTimeout(embed, 0), 100);
                }
            });

            try {
                const container = document.querySelector('.comment_list') || document.body;
                observerInstance.observe(container, {childList: true, subtree: true});
            } catch (e) {}
        }

        requestIdleCallback ? requestIdleCallback(() => {embed(); watch();}) : setTimeout(() => {embed(); watch();}, 0);
    }
    
    neutralizeAd();

    if (document.readyState === 'loading') {
        document.addEventListener('readystatechange', () => {
            if (document.readyState === 'interactive') {
                removeAds();
                initLinkFix();
            }
        });
        document.addEventListener('DOMContentLoaded', initMedia, {once: true});
    } else {
        removeAds();
        initLinkFix();
        initMedia();
    }
})();
