/* skills.js - 蛇形网格 + 数字计数 + 进度条动画 */
(function() {
    'use strict';

    const isPhone = /Mobile|Android|iOS|iPhone|iPad|iPod|Windows Phone|KFAPWI/i.test(navigator.userAgent);

    // ========== GridAnimation 类（复刻参考页面） ==========
    class GridAnimation {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.options = {
                direction: 'right',
                speed: 1,
                borderColor: 'rgba(0, 0, 0, 0.06)',
                squareSize: 40,
                hoverFillColor: 'rgba(59, 130, 246, 0.6)',
                hoverShadowColor: 'rgba(59, 130, 246, 0.4)',
                transitionDuration: 200,
                trailDuration: 1000,
                specialBlockColor: 'rgba(99, 102, 241, 0.8)',
                snakeHeadColor: 'rgba(59, 130, 246, 0.9)',
                snakeTailColor: 'rgba(59, 130, 246, 0.15)',
                snakeColorDecay: 0.7,
                touchSensitivity: 1.0,
                vibrationEnabled: false,
                ...options,
            };
            this.gridOffset = { x: 0, y: 0 };
            this.hoveredSquare = null;
            this.animationFrame = null;
            this.currentOpacity = 0;
            this.targetOpacity = 0;
            this.lastTimestamp = 0;
            this.trailSquares = new Map();
            this.specialBlock = null;
            this.snakeBody = [];
            this.shouldGrow = false;
        }

        init() {
            this.resizeCanvas();
            this.setupEventListeners();
            this.createSpecialBlock();
            this.animate();
        }

        resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = this.canvas.offsetWidth;
            const displayHeight = this.canvas.offsetHeight;
            this.canvas.width = Math.floor(displayWidth * dpr);
            this.canvas.height = Math.floor(displayHeight * dpr);
            this.canvas.style.width = displayWidth + 'px';
            this.canvas.style.height = displayHeight + 'px';
            this.ctx.scale(dpr, dpr);
        }

        setupEventListeners() {
            window.addEventListener('resize', () => this.resizeCanvas());
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
            if (isPhone) {
                this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
                this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
                this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
            }
        }

        handleMouseMove(event) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const startX = Math.floor(this.gridOffset.x / this.options.squareSize) * this.options.squareSize;
            const startY = Math.floor(this.gridOffset.y / this.options.squareSize) * this.options.squareSize;
            const hoveredSquareX = Math.floor((mouseX + this.gridOffset.x - startX) / this.options.squareSize);
            const hoveredSquareY = Math.floor((mouseY + this.gridOffset.y - startY) / this.options.squareSize);

            if (this.hoveredSquare?.x !== hoveredSquareX || this.hoveredSquare?.y !== hoveredSquareY) {
                if (this.hoveredSquare) {
                    this.snakeBody.unshift({ x: this.hoveredSquare.x, y: this.hoveredSquare.y });
                    if (!this.shouldGrow && this.snakeBody.length > 0) this.snakeBody.pop();
                    this.shouldGrow = false;
                }
                this.hoveredSquare = { x: hoveredSquareX, y: hoveredSquareY };
                this.targetOpacity = 0.6;
                if (this.specialBlock && hoveredSquareX === this.specialBlock.x && hoveredSquareY === this.specialBlock.y) {
                    this.shouldGrow = true;
                    this.createSpecialBlock();
                }
            }
        }

        handleMouseLeave() {
            this.hoveredSquare = null;
            this.targetOpacity = 0;
        }

        handleTouchStart(e) {
            e.preventDefault();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                this.targetOpacity = 0.8 * this.options.touchSensitivity;
                this.handleTouchMoveAt(x, y);
            }
        }

        handleTouchMove(e) {
            e.preventDefault();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.handleTouchMoveAt(touch.clientX - rect.left, touch.clientY - rect.top);
            }
        }

        handleTouchMoveAt(x, y) {
            const startX = Math.floor(this.gridOffset.x / this.options.squareSize) * this.options.squareSize;
            const startY = Math.floor(this.gridOffset.y / this.options.squareSize) * this.options.squareSize;
            const hoveredSquareX = Math.floor((x + this.gridOffset.x - startX) / this.options.squareSize);
            const hoveredSquareY = Math.floor((y + this.gridOffset.y - startY) / this.options.squareSize);

            if (this.hoveredSquare?.x !== hoveredSquareX || this.hoveredSquare?.y !== hoveredSquareY) {
                if (this.hoveredSquare) {
                    this.snakeBody.unshift({ x: this.hoveredSquare.x, y: this.hoveredSquare.y });
                    if (!this.shouldGrow && this.snakeBody.length > 0) this.snakeBody.pop();
                    this.shouldGrow = false;
                }
                this.hoveredSquare = { x: hoveredSquareX, y: hoveredSquareY };
                if (this.specialBlock && hoveredSquareX === this.specialBlock.x && hoveredSquareY === this.specialBlock.y) {
                    this.shouldGrow = true;
                    this.createSpecialBlock();
                }
            }
        }

        handleTouchEnd() {
            this.targetOpacity = 0.3;
        }

        createSpecialBlock() {
            const dpr = window.devicePixelRatio || 1;
            const numSquaresX = Math.ceil(this.canvas.width / dpr / this.options.squareSize);
            const numSquaresY = Math.ceil(this.canvas.height / dpr / this.options.squareSize);
            let newX, newY;
            do {
                newX = 1 + Math.floor(Math.random() * (numSquaresX - 2));
                newY = 1 + Math.floor(Math.random() * (numSquaresY - 2));
            } while (this.snakeBody.some((s) => s.x === newX && s.y === newY));
            this.specialBlock = { x: newX, y: newY, color: this.options.specialBlockColor };
        }

        drawGrid() {
            const dpr = window.devicePixelRatio || 1;
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const startX = Math.floor(this.gridOffset.x / this.options.squareSize) * this.options.squareSize;
            const startY = Math.floor(this.gridOffset.y / this.options.squareSize) * this.options.squareSize;
            this.ctx.lineWidth = isPhone ? 1.0 : 0.5;

            // 绘制蛇身
            this.snakeBody.forEach((segment, index) => {
                const squareX = Math.round(segment.x * this.options.squareSize + startX - (this.gridOffset.x % this.options.squareSize));
                const squareY = Math.round(segment.y * this.options.squareSize + startY - (this.gridOffset.y % this.options.squareSize));
                this.ctx.shadowColor = this.options.hoverShadowColor;
                this.ctx.shadowBlur = 12;

                if (index === 0) {
                    this.ctx.fillStyle = this.options.snakeHeadColor;
                } else {
                    const factor = Math.pow(this.options.snakeColorDecay, index);
                    this.ctx.fillStyle = `rgba(59, 130, 246, ${Math.max(0.15, factor * 0.3)})`;
                }
                this.ctx.fillRect(squareX, squareY, this.options.squareSize, this.options.squareSize);
                this.ctx.shadowBlur = 0;
            });

            // 绘制网格
            for (let x = startX; x < this.canvas.width / dpr + this.options.squareSize; x += this.options.squareSize) {
                for (let y = startY; y < this.canvas.height / dpr + this.options.squareSize; y += this.options.squareSize) {
                    const squareX = Math.round(x - (this.gridOffset.x % this.options.squareSize));
                    const squareY = Math.round(y - (this.gridOffset.y % this.options.squareSize));
                    const gridX = Math.floor((x - startX) / this.options.squareSize);
                    const gridY = Math.floor((y - startY) / this.options.squareSize);

                    // 食物
                    if (this.specialBlock && gridX === this.specialBlock.x && gridY === this.specialBlock.y) {
                        this.ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
                        this.ctx.shadowBlur = 16;
                        this.ctx.fillStyle = this.specialBlock.color;
                        this.ctx.fillRect(squareX, squareY, this.options.squareSize, this.options.squareSize);
                        this.ctx.shadowBlur = 0;
                    }

                    // 蛇头
                    if (this.hoveredSquare && gridX === this.hoveredSquare.x && gridY === this.hoveredSquare.y) {
                        this.ctx.shadowColor = this.options.hoverShadowColor;
                        this.ctx.shadowBlur = 12;
                        const color = this.options.hoverFillColor.replace(/[\d.]+\)$/, this.currentOpacity.toString() + ')');
                        this.ctx.fillStyle = color;
                        this.ctx.fillRect(squareX, squareY, this.options.squareSize, this.options.squareSize);
                        this.ctx.shadowBlur = 0;
                    }

                    this.ctx.strokeStyle = this.options.borderColor;
                    this.ctx.strokeRect(squareX, squareY, this.options.squareSize, this.options.squareSize);
                }
            }
        }

        updateAnimation(timestamp) {
            if (!this.lastTimestamp) this.lastTimestamp = timestamp;
            const deltaTime = timestamp - this.lastTimestamp;
            this.lastTimestamp = timestamp;

            if (this.currentOpacity !== this.targetOpacity) {
                const progress = Math.min(deltaTime / this.options.transitionDuration, 1);
                this.currentOpacity = this.currentOpacity + (this.targetOpacity - this.currentOpacity) * progress;
            }

            const effectiveSpeed = isPhone ? this.options.speed * 0.8 : this.options.speed;
            const moveAmount = isPhone ? Math.round(effectiveSpeed * 100) / 100 : effectiveSpeed;

            switch (this.options.direction) {
                case 'diagonal':
                    this.gridOffset.x = (this.gridOffset.x - moveAmount + this.options.squareSize) % this.options.squareSize;
                    this.gridOffset.y = (this.gridOffset.y - moveAmount + this.options.squareSize) % this.options.squareSize;
                    break;
            }

            this.drawGrid();
            this.animationFrame = requestAnimationFrame((ts) => this.updateAnimation(ts));
        }

        animate() {
            this.animationFrame = requestAnimationFrame((ts) => this.updateAnimation(ts));
        }
    }

    // ========== 数字计数动画（hover 触发） ==========
    function animateCounter(el, target, duration = 1400) {
        const start = performance.now();
        const startVal = parseInt(el.dataset.current || '0', 10) || 0;

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo - 起始快、结尾减速，最有高级感
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const current = Math.round(startVal + (target - startVal) * eased);
            el.textContent = current;
            el.dataset.current = current;
            if (progress < 1) requestAnimationFrame(tick);
            else { el.textContent = target; el.dataset.current = target; }
        }
        requestAnimationFrame(tick);
    }

    function resetCounter(el, duration = 600) {
        const start = performance.now();
        const current = parseInt(el.dataset.current || '0', 10) || 0;

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = Math.round(current * (1 - eased));
            el.textContent = value;
            el.dataset.current = value;
            if (progress < 1) requestAnimationFrame(tick);
            else { el.textContent = '—'; el.dataset.current = 0; }
        }
        requestAnimationFrame(tick);
    }

    // ========== metrics 区 - hover 触发数字滚动 ==========
    function initMetrics() {
        const items = document.querySelectorAll('.metric');
        items.forEach(item => {
            const counter = item.querySelector('.counter');
            const target = parseInt(item.dataset.target, 10) || 0;

            item.addEventListener('mouseenter', () => {
                item.classList.add('is-active');
                item.classList.remove('is-leaving');
                animateCounter(counter, target, 1400);
            });

            item.addEventListener('mouseleave', () => {
                item.classList.remove('is-active');
                item.classList.add('is-leaving');
                setTimeout(() => item.classList.remove('is-leaving'), 350);
                resetCounter(counter, 500);
            });

            // 移动端 - 触屏即触发
            item.addEventListener('touchstart', () => {
                item.classList.add('is-active');
                animateCounter(counter, target, 1400);
            }, { passive: true });
        });

        // 进入视口时使用 IntersectionObserver 错开 stagger 进场
        const metricsEl = document.querySelector('.metrics');
        if (metricsEl) {
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        metricsEl.classList.add('in-view');
                        obs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.2 });
            obs.observe(metricsEl);
        }
    }

    // ========== 卡片入场 + 进度条动画 ==========
    function initCaps() {
        const caps = document.querySelectorAll('.cap');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    const fills = entry.target.querySelectorAll('.cap__bar-fill');
                    fills.forEach(fill => {
                        const pct = fill.getAttribute('data-pct') || '0';
                        setTimeout(() => { fill.style.width = pct + '%'; }, 200);
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        caps.forEach(cap => observer.observe(cap));
    }

    // ========== 字符动画（重新触发） ==========
    function initCharAnimation() {
        const subs = document.querySelectorAll('.intro__subtitle');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const chars = entry.target.querySelectorAll('.ch');
                    chars.forEach(ch => {
                        ch.style.animation = 'none';
                        ch.offsetHeight; // 触发重排
                        ch.style.animation = '';
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        subs.forEach(s => observer.observe(s));
    }

    // ========== 初始化 ==========
    document.addEventListener('DOMContentLoaded', () => {
        // 贪吃蛇网格
        const gridCanvas = document.getElementById('gridCanvas');
        if (gridCanvas) {
            const grid = new GridAnimation(gridCanvas, {
                direction: 'diagonal',
                speed: isPhone ? 0.03 : 0.05,
                borderColor: isPhone ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                squareSize: isPhone ? 50 : 40,
                hoverFillColor: 'rgba(59, 130, 246, 0.7)',
                hoverShadowColor: 'rgba(59, 130, 246, 0.4)',
                transitionDuration: isPhone ? 150 : 200,
                trailDuration: isPhone ? 2000 : 1500,
                specialBlockColor: 'rgba(99, 102, 241, 0.8)',
                snakeHeadColor: 'rgba(59, 130, 246, 0.85)',
                snakeTailColor: 'rgba(59, 130, 246, 0.15)',
                snakeColorDecay: 0.78,
                touchSensitivity: isPhone ? 1.2 : 1.0,
            });
            grid.init();
        }

        // metrics - hover 触发数字滚动
        initMetrics();

        // 卡片入场
        initCaps();

        // 字符动画
        initCharAnimation();
    });

})();