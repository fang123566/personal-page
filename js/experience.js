/* experience.js - 经验页面交互 */

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
            this.particles = [];
            this.resize();
            this.initParticles();
        }

        resize() {
            this.canvas.width = window.innerWidth * this.dpr;
            this.canvas.height = window.innerHeight * this.dpr;
            this.ctx.scale(this.dpr, this.dpr);
        }

        initParticles() {
            this.particles = [];
            for (let i = 0; i < 30; i++) {
                this.particles.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    size: Math.random() * 3 + 1,
                    speedX: (Math.random() - 0.5) * 0.5,
                    speedY: (Math.random() - 0.5) * 0.5,
                    opacity: Math.random() * 0.5 + 0.2
                });
            }
        }

        draw() {
            const w = window.innerWidth;
            const h = window.innerHeight;
            this.ctx.clearRect(0, 0, w, h);

            // 移动网格
            this.offset.x = (this.offset.x - this.speed + this.gridSize) % this.gridSize;
            this.offset.y = (this.offset.y - this.speed + this.gridSize) % this.gridSize;

            // 绘制网格线
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
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

            // 绘制粒子
            this.particles.forEach(p => {
                p.x += p.speedX;
                p.y += p.speedY;

                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(99, 102, 241, ${p.opacity})`;
                this.ctx.fill();
            });

            // 渐变叠加
            const gradient = this.ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
            gradient.addColorStop(0, 'rgba(10, 185, 129, 0)');
            gradient.addColorStop(1, 'rgba(10, 10, 15, 0.8)');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, w, h);

            requestAnimationFrame(() => this.draw());
        }

        init() {
            window.addEventListener('resize', () => {
                this.resize();
                this.initParticles();
            });
            this.draw();
        }
    }

    // ========== 滚动渐显 ==========
    function initScrollReveal() {
        const reveals = document.querySelectorAll('.reveal, .timeline-item, .project-card');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, index * 100);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        reveals.forEach(el => observer.observe(el));
    }

    // ========== Tab 切换 ==========
    function initTabs() {
        const tabs = document.querySelectorAll('.exp-tab');
        const sections = document.querySelectorAll('.exp-section');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                sections.forEach(section => {
                    if (section.id === target) {
                        section.classList.remove('hidden');
                        // 重新触发滚动动画
                        section.querySelectorAll('.timeline-item, .project-card').forEach((el, i) => {
                            el.classList.remove('visible');
                            setTimeout(() => el.classList.add('visible'), i * 100);
                        });
                    } else {
                        section.classList.add('hidden');
                    }
                });
            });
        });
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
        initTabs();
    });

})();
