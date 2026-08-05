/* skills.js - 能力页面交互 */

(function() {
    'use strict';

    // ========== 背景动画 ==========
    class GridBackground {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.gridSize = 60;
            this.offset = { x: 0, y: 0 };
            this.speed = 0.3;
            this.dpr = window.devicePixelRatio || 1;
            this.resize();
        }

        resize() {
            this.canvas.width = window.innerWidth * this.dpr;
            this.canvas.height = window.innerHeight * this.dpr;
            this.ctx.scale(this.dpr, this.dpr);
        }

        draw() {
            const w = window.innerWidth;
            const h = window.innerHeight;
            this.ctx.clearRect(0, 0, w, h);

            // 移动网格
            this.offset.x = (this.offset.x - this.speed + this.gridSize) % this.gridSize;
            this.offset.y = (this.offset.y - this.speed + this.gridSize) % this.gridSize;

            // 绘制网格线
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            this.ctx.lineWidth = 1;

            for (let x = this.offset.x; x < w; x += this.gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, h);
                this.ctx.stroke();
            }

            for (let y = this.offset.y; y < h; y += this.gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(w, y);
                this.ctx.stroke();
            }

            // 绘制渐变叠加
            const gradient = this.ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0)');
            gradient.addColorStop(1, 'rgba(10, 10, 15, 0.8)');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, w, h);

            requestAnimationFrame(() => this.draw());
        }

        init() {
            window.addEventListener('resize', () => this.resize());
            this.draw();
        }
    }

    // ========== 滚动渐显 ==========
    function initScrollReveal() {
        const reveals = document.querySelectorAll('.reveal, .skill-card, .timeline-item');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        reveals.forEach(el => observer.observe(el));
    }

    // ========== 标签筛选 ==========
    function initTagFilter() {
        const filters = document.querySelectorAll('.tag-filter');
        const cards = document.querySelectorAll('.skill-card');

        filters.forEach(filter => {
            filter.addEventListener('click', () => {
                const cat = filter.dataset.filter;
                
                filters.forEach(f => f.classList.remove('active'));
                filter.classList.add('active');

                cards.forEach(card => {
                    const cats = card.dataset.cats || '';
                    if (cat === 'all' || cats.includes(cat)) {
                        card.classList.remove('hidden');
                    } else {
                        card.classList.add('hidden');
                    }
                });
            });
        });
    }

    // ========== 数字计数动画 ==========
    function initCounters() {
        const counters = document.querySelectorAll('[data-count]');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const target = parseInt(el.dataset.count);
                    const duration = 1500;
                    const start = performance.now();

                    function tick(now) {
                        const progress = Math.min((now - start) / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        el.textContent = Math.round(target * eased);
                        if (progress < 1) requestAnimationFrame(tick);
                    }

                    requestAnimationFrame(tick);
                    observer.unobserve(el);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(el => observer.observe(el));
    }

    // ========== 初始化 ==========
    document.addEventListener('DOMContentLoaded', () => {
        // 背景
        const canvas = document.getElementById('bgCanvas');
        if (canvas) {
            new GridBackground(canvas).init();
        }

        // 交互
        initScrollReveal();
        initTagFilter();
        initCounters();
    });

})();
