// skills.js - 极简优雅交互
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
        const elements = document.querySelectorAll('.skill-card, .cloud-tag, .tool-tag');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0) translateX(0)';
                    }, index * 50);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

        elements.forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(16px)';
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            observer.observe(el);
        });
    }

    // ========== 标签悬停效果 ==========
    function initTagHover() {
        const tags = document.querySelectorAll('.cloud-tag, .tool-tag');
        tags.forEach(tag => {
            tag.addEventListener('mouseenter', () => {
                tag.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            });
            tag.addEventListener('mouseleave', () => {
                tag.style.borderColor = 'rgba(255, 255, 255, 0.06)';
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
        initTagHover();
    });

})();
