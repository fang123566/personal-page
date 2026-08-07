/* experience.js - 复用 GridAnimation + 入场动画 */
(function() {
    'use strict';

    const isPhone = /Mobile|Android|iOS|iPhone|iPad|iPod|Windows Phone|KFAPWI/i.test(navigator.userAgent);

    // ========== GridAnimation（共用） ==========
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
                ...options,
            };
            this.gridOffset = { x: 0, y: 0 };
            this.hoveredSquare = null;
            this.animationFrame = null;
            this.currentOpacity = 0;
            this.targetOpacity = 0;
            this.lastTimestamp = 0;
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
                this.canvas.addEventListener('touchend', () => this.handleTouchEnd(), { passive: false });
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
                this.targetOpacity = 0.8 * this.options.touchSensitivity;
                this.handleTouchMoveAt(touch.clientX - rect.left, touch.clientY - rect.top);
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

            for (let x = startX; x < this.canvas.width / dpr + this.options.squareSize; x += this.options.squareSize) {
                for (let y = startY; y < this.canvas.height / dpr + this.options.squareSize; y += this.options.squareSize) {
                    const squareX = Math.round(x - (this.gridOffset.x % this.options.squareSize));
                    const squareY = Math.round(y - (this.gridOffset.y % this.options.squareSize));
                    const gridX = Math.floor((x - startX) / this.options.squareSize);
                    const gridY = Math.floor((y - startY) / this.options.squareSize);

                    if (this.specialBlock && gridX === this.specialBlock.x && gridY === this.specialBlock.y) {
                        this.ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
                        this.ctx.shadowBlur = 16;
                        this.ctx.fillStyle = this.specialBlock.color;
                        this.ctx.fillRect(squareX, squareY, this.options.squareSize, this.options.squareSize);
                        this.ctx.shadowBlur = 0;
                    }

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
            el.textContent = Math.round(current * (1 - eased));
            if (progress < 1) requestAnimationFrame(tick);
            else { el.textContent = '—'; el.dataset.current = 0; }
        }
        requestAnimationFrame(tick);
    }

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
        });
    }

    // ========== Gallery 轮播 ==========
    class Gallery {
        constructor(id, images) {
            this.id = id;
            this.images = images;
            this.current = 0;
            this.total = images.length;
            this.track = document.getElementById('gallery-track-' + id);
            this.curEl = document.getElementById('gallery-cur-' + id);
            this.totalEl = document.getElementById('gallery-total-' + id);
            this.dotsEl = document.getElementById('gallery-dots-' + id);
            this.imageSets = {}; // 存储多组图片
            this.currentSet = null;
            this.init();
        }

        init() {
            this.render();
            this.initTabs();
            this.initEvents();
        }

        // 设置图片组
        setImageSet(name, images) {
            this.imageSets[name] = images;
            if (!this.currentSet) {
                this.currentSet = name;
                this.images = images;
                this.total = images.length;
                this.current = 0;
                this.render();
            }
        }

        // 切换图片组
        switchSet(name) {
            if (!this.imageSets[name] || this.currentSet === name) return;
            this.currentSet = name;
            this.images = this.imageSets[name];
            this.total = this.images.length;
            this.current = 0;
            this.render();
        }

        render() {
            this.track.innerHTML = '';
            this.dotsEl.innerHTML = '';
            this.totalEl.textContent = this.total;
            
            this.images.forEach((src, i) => {
                const img = document.createElement('img');
                img.src = src;
                img.alt = '产品截图 ' + (i + 1);
                img.style.opacity = i === 0 ? '1' : '0';
                this.track.appendChild(img);
            });

            for (let i = 0; i < this.total; i++) {
                const dot = document.createElement('span');
                if (i === 0) dot.className = 'active';
                dot.addEventListener('click', () => this.go(i));
                this.dotsEl.appendChild(dot);
            }
            
            this.track.style.transform = 'translateX(0)';
            this.curEl.textContent = '1';
        }

        initTabs() {
            const tabs = document.querySelectorAll(`.gallery__tab[data-gallery="gallery-${this.id}"]`);
            tabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止冒泡
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.switchSet(tab.dataset.set);
                });
            });
        }

        initEvents() {
            this.track.parentElement.addEventListener('click', (e) => {
                e.stopPropagation();
                
                if (e.target.classList.contains('gallery__btn--next')) {
                    this.next();
                } else if (e.target.classList.contains('gallery__btn--prev')) {
                    this.prev();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (!document.getElementById('lightbox').classList.contains('open')) return;
                if (e.key === 'ArrowLeft') lbNav(-1);
                if (e.key === 'ArrowRight') lbNav(1);
                if (e.key === 'Escape') closeLightbox();
            });

            let startX = 0;
            const el = this.track.parentElement;
            el.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
            el.addEventListener('touchend', e => {
                const dx = e.changedTouches[0].clientX - startX;
                if (Math.abs(dx) > 50) { dx < 0 ? this.next() : this.prev(); }
            }, { passive: true });
        }

        go(index) {
            this.current = (index + this.total) % this.total;
            const imgs = this.track.querySelectorAll('img');
            imgs.forEach((img, i) => {
                img.style.opacity = i === this.current ? '1' : '0';
            });
            this.curEl.textContent = this.current + 1;
            const dots = this.dotsEl.querySelectorAll('span');
            dots.forEach((d, i) => d.classList.toggle('active', i === this.current));
        }

        next() { this.go(this.current + 1); }
        prev() { this.go(this.current - 1); }
    }

    // ========== Lightbox ==========
    let lbImages = [], lbCurrent = 0;

    function openLightbox(images, index) {
        lbImages = images; lbCurrent = index;
        const lb = document.getElementById('lightbox');
        const img = lb.querySelector('img');
        img.src = images[index];
        lb.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        document.getElementById('lightbox').classList.remove('open');
        document.body.style.overflow = '';
    }

    function lbNav(dir) {
        lbCurrent = (lbCurrent + dir + lbImages.length) % lbImages.length;
        document.getElementById('lightbox').querySelector('img').src = lbImages[lbCurrent];
    }

    // ========== 卡片入场 ==========
    function initReveal() {
        const elements = document.querySelectorAll('.job');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        elements.forEach(el => observer.observe(el));
    }

    // ========== 初始化 ==========
    document.addEventListener('DOMContentLoaded', () => {
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

        // metrics hover 数字滚动
        initMetrics();

        // gallery 轮播初始化
        // 项目1: 工地大脑 - 8张图片
        const brainImages = [
            'assets/brain/brain_1.png',
            'assets/brain/brain_2.png',
            'assets/brain/brain_3.png',
            'assets/brain/brain_4.png',
            'assets/brain/brain_5.png',
            'assets/brain/brain_6.png',
            'assets/brain/brain_7.png',
            'assets/brain/brain_8.png'
        ];
        new Gallery(1, brainImages);
        
        // 项目2: AIPPT - 图片待补充
        new Gallery(2, []);
        
        // 项目3: 智博会 H5 - 支持 tab 切换
        const expoGallery = new Gallery(3, []);
        expoGallery.setImageSet('prototype', [
            '实习文档/智能建造博览会H5行程填报+VIP车牌识别放行系统/微信图片_20260727101743_567_1656.png',
            '实习文档/智能建造博览会H5行程填报+VIP车牌识别放行系统/微信图片_20260727101826_571_1656.png',
            '实习文档/智能建造博览会H5行程填报+VIP车牌识别放行系统/微信图片_20260727101917_572_1656.png'
        ]);
        expoGallery.setImageSet('flowchart', [
            'assets/internship/flowchart/flowchart-1.png',
            'assets/internship/flowchart/flowchart-2.png',
            'assets/internship/flowchart/flowchart-3.png'
        ]);
        
        // 项目4: 超级制单助手
        new Gallery(4, [
            'assets/internship/super-order/super-order-1.png',
            'assets/internship/super-order/super-order-2.png',
            'assets/internship/super-order/super-order-3.png',
            'assets/internship/super-order/super-order-4.png',
            'assets/internship/super-order/super-order-5.png',
            'assets/internship/super-order/super-order-6.png',
            'assets/internship/super-order/super-order-7.png'
        ]);

        // gallery 点击打开 lightbox（点击按钮时不触发）
        document.querySelectorAll('.gallery').forEach(g => {
            g.addEventListener('click', (e) => {
                // 点击按钮时不打开 lightbox
                if (e.target.closest('.gallery__btn') || e.target.closest('.gallery__dots')) return;
                
                const track = g.querySelector('.gallery__track');
                const imgs = Array.from(track.querySelectorAll('img')).map(img => img.src);
                const cur = Math.abs(parseInt(track.style.transform.replace('translateX(', '').replace('%)', ''))) / 100;
                openLightbox(imgs, cur || 0);
            });
        });

        // 入场动画
        initReveal();
    });

})();