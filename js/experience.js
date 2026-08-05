// experience.js - 极简优雅交互
(function() {
    'use strict';

    // ========== 背景动画 - 极简网格 ==========
    class GridBackground {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
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

            // 极简网格
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
            this.ctx.lineWidth = 1;

            const gridSize = 80;
            const time = Date.now() * 0.0001;
            const offset = (time % 1) * gridSize;

            for (let x = offset; x < w; x += gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, h);
                this.ctx.stroke();
            }

            for (let y = offset; y < h; y += gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(w, y);
                this.ctx.stroke();
            }

            requestAnimationFrame(() => this.draw());
        }

        init() {
            window.addEventListener('resize', () => this.resize());
            this.draw();
        }
    }

    // ========== 滚动渐显动画 ==========
    function initScrollReveal() {
        const timelineItems = document.querySelectorAll('.timeline-item');
        const projectCards = document.querySelectorAll('.project-card');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, index * 100);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

        [...timelineItems, ...projectCards].forEach(el => {
            observer.observe(el);
        });
    }

    // ========== 链接悬停效果 ==========
    function initLinkHover() {
        const links = document.querySelectorAll('.project-card__link');
        links.forEach(link => {
            link.addEventListener('mouseenter', () => {
                link.style.color = '#e8e8e8';
            });
            link.addEventListener('mouseleave', () => {
                link.style.color = '#555555';
            });
        });
    }

    // ========== 初始化 ==========
    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('bgCanvas');
        if (canvas) {
            new GridBackground(canvas).init();
        }
        initScrollReveal();
        initLinkHover();
    });

})();
