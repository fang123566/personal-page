/* portfolio.js — 简历交互：滚动渐显 / 项目筛选 / 数字计数 / 返回顶部 */
(function () {
    'use strict';

    // 滚动渐显
    const reveals = document.querySelectorAll('.cv-reveal');
    if ('IntersectionObserver' in window && reveals.length) {
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        reveals.forEach(function (el) { io.observe(el); });
    } else {
        reveals.forEach(function (el) { el.classList.add('is-visible'); });
    }

    // 数字计数
    const counters = document.querySelectorAll('[data-count]');
    if ('IntersectionObserver' in window && counters.length) {
        const counterIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                const target = parseFloat(el.getAttribute('data-count'));
                const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
                const duration = 1400;
                const start = performance.now();
                function tick(now) {
                    const progress = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const value = target * eased;
                    el.textContent = decimals > 0
                        ? value.toFixed(decimals)
                        : Math.round(value).toLocaleString();
                    if (progress < 1) requestAnimationFrame(tick);
                    else {
                        el.textContent = decimals > 0
                            ? target.toFixed(decimals)
                            : target.toLocaleString();
                    }
                }
                requestAnimationFrame(tick);
                counterIO.unobserve(el);
            });
        }, { threshold: 0.5 });
        counters.forEach(function (el) { counterIO.observe(el); });
    }

    // 项目筛选
    const tabs = document.querySelectorAll('.cv-tab');
    const projects = document.querySelectorAll('.cv-project');
    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            const filter = tab.getAttribute('data-filter');
            tabs.forEach(function (t) { t.classList.remove('is-active'); });
            tab.classList.add('is-active');
            projects.forEach(function (p) {
                const cat = p.getAttribute('data-cat') || '';
                if (filter === 'all' || cat.indexOf(filter) !== -1) {
                    p.classList.remove('is-hidden');
                } else {
                    p.classList.add('is-hidden');
                }
            });
        });
    });

    // 返回顶部
    const topBtn = document.querySelector('.cv-top');
    if (topBtn) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 600) topBtn.classList.add('is-visible');
            else topBtn.classList.remove('is-visible');
        });
        topBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 平滑滚动到锚点
    document.querySelectorAll('a[href^="#cv-"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            const id = a.getAttribute('href').slice(1);
            const target = document.getElementById(id);
            if (target) {
                e.preventDefault();
                window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' });
            }
        });
    });
})();
