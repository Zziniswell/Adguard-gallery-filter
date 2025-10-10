// ==UserScript==
// @name         Gallery Extension for FMKOREA
// @version      2.06
// @description  펨코 파워링크 제거, 제휴링크 정상화, 댓글 이미지 삽입
// @match        https://*.fmkorea.com/*
// @icon         https://www.google.com/s2/favicons?domain=fmkorea.com
// @homepage     https://gall.dcinside.com/mgallery/board/view/?id=adguard&no=2348
// @downloadURL https://github.com/Zziniswell/Adguard-gallery-filter/raw/refs/heads/main/Gallery%20Extension.user.js
// @updateURL https://github.com/Zziniswell/Adguard-gallery-filter/raw/refs/heads/main/Gallery%20Extension.user.js
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const CFG = {
        imgRx: /\.(jpe?g|JPE?G|png|PNG|webp|WEBP|avif|gif|GIF)([?&#/].*)?$/i,
        vidRx: /\.(mp4|mkv)([?&#].*)?$/i,
        imgEncRx: /\.(jpe?g|JPE?G|png|PNG|webp|WEBP|avif|gif|GIF|avif|AVIF)%3F/i,
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
        if (!document.body.classList.contains('mac_os')) return;

        function isAd(e) {
            const s = window.getComputedStyle(e);
            return s.padding === "0px" && parseFloat(s.marginTop) <= 5 && parseFloat(s.marginLeft) <= 5 && 
                   parseInt(s.height) >= 60 && parseInt(s.height) <= 200;
        }

        function clean() {
            document.querySelectorAll('script ~ div[class*=" "], section.bd').forEach(e => isAd(e) && e.remove());
        }

        clean();
        let timer;
        const obs = new MutationObserver(muts => {
            if (muts.some(m => m.type === "childList" && m.addedNodes.length)) {
                clearTimeout(timer);
                timer = setTimeout(clean, 20);
            }
        });
        obs.observe(document.body, {childList: true, subtree: true});
        setTimeout(() => obs.disconnect(), 1000);
    }

    function initLinkFix() {
        if (!document.body.classList.contains('mac_os')) return;

        function fix(e) {
            if (e.target.matches('a[href*="link.fmkorea.org"]')) {
                const a = e.target, url = a.textContent.trim();
                a.href = url;
                a.removeAttribute('data-document_srl');
                a.className = '';
            }
        }

        ['mousedown', 'touchstart', 'pointerdown'].forEach(evt => 
            document.body.addEventListener(evt, fix, true)
        );
    }

    function initMedia() {
        const processed = new Set();

        function cleanSet() {
            const curr = new Set();
            document.querySelectorAll('li[id^="comment"] a[href]').forEach(l => curr.add(l.getAttribute('href')));
            processed.forEach(url => !curr.has(url) && processed.delete(url));
        }

        function getType(url) {
            if (CFG.imgRx.test(url) || CFG.imgEncRx.test(url)) return 'img';
            if (CFG.vidRx.test(url)) return 'video';
            return CFG.imgHosts.some(h => url.includes(h)) ? 'img' : null;
        }

        function makeEl(type, src, text) {
            const el = document.createElement(type);
            el.src = src.startsWith('//') ? 'https:' + src : src;
            Object.assign(el.style, {maxWidth: '100%', display: 'block', marginTop: '10px', marginBottom: '10px'});
            el.loading = 'lazy';
            if (type === 'img') el.alt = text;
            else el.controls = true;
            return el;
        }

        function embed() {
            cleanSet();
            document.querySelectorAll('li[id^="comment"]:not([data-done])').forEach(c => {
                c.setAttribute('data-done', 'true');
                c.querySelectorAll('a[href]:not([data-done])').forEach(l => {
                    const url = l.getAttribute('href');
                    if (!url.startsWith('http') && !url.startsWith('//') || url.includes('wikipedia.org')) return;
                    
                    const type = getType(url);
                    if (!type) return;

                    l.setAttribute('data-done', 'true');
                    processed.add(url);
                    l.style.display = 'none';

                    const el = makeEl(type, url, l.textContent);
                    el.onerror = () => {el.remove(); l.style.display = '';};
                    l.parentNode.insertBefore(el, l.nextSibling);
                });
            });
        }

        let watching = false;
        function watch() {
            if (watching) return;
            watching = true;

            let timeout;
            const obs = new MutationObserver(muts => {
                if (muts.some(m => m.type === 'childList' && 
                    [...m.addedNodes].some(n => n.nodeType === 1 && 
                        (n.matches?.('li[id^="comment"]') || n.querySelector?.('li[id^="comment"]'))))) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => requestIdleCallback ? requestIdleCallback(embed) : setTimeout(embed, 0), 100);
                }
            });

            const cont = document.querySelector('.comment_list') || document.body;
            obs.observe(cont, {childList: true, subtree: true});
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
