/* main.js — 核心动画逻辑：贪吃蛇网格 + 页面切换 */
(function () {
    'use strict';

    window.$ = selector => document.querySelector(selector);
    
    const getOriginalContent = selector => $(selector).getAttribute("original-content");
    window.subtitle = getOriginalContent(".content-subtitle");

    window.hiddenProperty =
        "hidden" in document ? "hidden" :
        "webkitHidden" in document ? "webkitHidden" :
        "mozHidden" in document ? "mozHidden" : null;

    window.visibilityChangeEvent = hiddenProperty.replace(/hidden/i, "visibilitychange");

    window.isPhone = /Mobile|Android|iOS|iPhone|iPad|iPod|Windows Phone|KFAPWI/i.test(navigator.userAgent);

    window.DIRECTIONS = {
        UP: "UP", DOWN: "DOWN", LEFT: "LEFT", RIGHT: "RIGHT", UNDIRECTED: "UNDIRECTED"
    };

    // ==================== GridAnimation 类 ====================
    class GridAnimation {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext("2d");
            this.options = {
                direction: options.direction || "right",
                speed: options.speed || 1,
                borderColor: options.borderColor || "rgba(255, 255, 255, 0.05)",
                squareSize: options.squareSize || 40,
                hoverFillColor: options.hoverFillColor || "rgba(255, 255, 255, 0.6)",
                hoverShadowColor: options.hoverShadowColor || "rgba(255, 255, 255, 0.3)",
                transitionDuration: options.transitionDuration || 200,
                trailDuration: options.trailDuration || 1000,
                specialBlockColor: options.specialBlockColor || "rgba(255, 100, 100, 0.8)",
                snakeHeadColor: options.snakeHeadColor || "rgba(255, 255, 255, 0.9)",
                snakeTailColor: options.snakeTailColor || "rgba(100, 100, 255, 0.3)",
                snakeColorDecay: options.snakeColorDecay || 0.7,
                touchSensitivity: options.touchSensitivity || 1.0,
                vibrationEnabled: options.vibrationEnabled || false,
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
            document.addEventListener(visibilityChangeEvent, this.handleVisibilityChange.bind(this));
            this.animate();
        }

        resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = this.canvas.offsetWidth;
            const displayHeight = this.canvas.offsetHeight;
            this.canvas.width = Math.floor(displayWidth * dpr);
            this.canvas.height = Math.floor(displayHeight * dpr);
            this.canvas.style.width = `${displayWidth}px`;
            this.canvas.style.height = `${displayHeight}px`;
            this.ctx.scale(dpr, dpr);
        }

        setupEventListeners() {
            window.addEventListener("resize", () => this.resizeCanvas());
            this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
            this.canvas.addEventListener("mouseleave", () => this.handleMouseLeave());
            if (isPhone) {
                this.canvas.addEventListener("touchstart", (e) => this.handleTouchStart(e), { passive: false });
                this.canvas.addEventListener("touchmove", (e) => this.handleTouchMove(e), { passive: false });
                this.canvas.addEventListener("touchend", (e) => this.handleTouchEnd(e), { passive: false });
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

        handleTouchEnd(e) {
            e.preventDefault();
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
                this.ctx.shadowBlur = 15;
                
                if (index === 0) {
                    this.ctx.fillStyle = this.options.snakeHeadColor;
                } else {
                    const factor = Math.pow(this.options.snakeColorDecay, index);
                    this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.2, factor)})`;
                }
                this.ctx.fillRect(squareX, squareY, this.options.squareSize, this.options.squareSize);
                this.ctx.shadowBlur = 0;
            });

            // 绘制网格和特效
            for (let x = startX; x < this.canvas.width / dpr + this.options.squareSize; x += this.options.squareSize) {
                for (let y = startY; y < this.canvas.height / dpr + this.options.squareSize; y += this.options.squareSize) {
                    const squareX = Math.round(x - (this.gridOffset.x % this.options.squareSize));
                    const squareY = Math.round(y - (this.gridOffset.y % this.options.squareSize));
                    const gridX = Math.floor((x - startX) / this.options.squareSize);
                    const gridY = Math.floor((y - startY) / this.options.squareSize);

                    // 食物
                    if (this.specialBlock && gridX === this.specialBlock.x && gridY === this.specialBlock.y) {
                        this.ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
                        this.ctx.shadowBlur = 20;
                        this.ctx.fillStyle = this.specialBlock.color;
                        this.ctx.fillRect(squareX, squareY, this.options.squareSize, this.options.squareSize);
                        this.ctx.shadowBlur = 0;
                    }

                    // 蛇头
                    if (this.hoveredSquare && gridX === this.hoveredSquare.x && gridY === this.hoveredSquare.y) {
                        this.ctx.shadowColor = this.options.hoverShadowColor;
                        this.ctx.shadowBlur = 15;
                        const color = this.options.hoverFillColor.replace("0.6", this.currentOpacity.toString());
                        this.ctx.fillStyle = color;
                        this.ctx.fillRect(squareX, squareY, this.options.squareSize, this.options.squareSize);
                        this.ctx.shadowBlur = 0;
                    }

                    this.ctx.strokeStyle = this.options.borderColor;
                    this.ctx.strokeRect(squareX, squareY, this.options.squareSize, this.options.squareSize);
                }
            }

            // 暗角
            const gradient = this.ctx.createRadialGradient(
                this.canvas.width / dpr / 2, this.canvas.height / dpr / 2, 0,
                this.canvas.width / dpr / 2, this.canvas.height / dpr / 2,
                Math.sqrt(Math.pow(this.canvas.width / dpr, 2) + Math.pow(this.canvas.height / dpr, 2)) / 2
            );
            gradient.addColorStop(0, "rgba(6, 6, 6, 0)");
            gradient.addColorStop(1, "#060606");
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
        }

        updateAnimation(timestamp) {
            if (!this.lastTimestamp) this.lastTimestamp = timestamp;
            const deltaTime = timestamp - this.lastTimestamp;
            this.lastTimestamp = timestamp;

            if (this.currentOpacity !== this.targetOpacity) {
                const progress = Math.min(deltaTime / this.options.transitionDuration, 1);
                this.currentOpacity = this.currentOpacity + (this.targetOpacity - this.currentOpacity) * progress;
            }

            for (const [key, square] of this.trailSquares) {
                square.opacity -= deltaTime / this.options.trailDuration;
                if (square.opacity <= 0) this.trailSquares.delete(key);
            }

            const effectiveSpeed = isPhone ? this.options.speed * 0.8 : this.options.speed;
            const moveAmount = isPhone ? Math.round(effectiveSpeed * 100) / 100 : effectiveSpeed;

            switch (this.options.direction) {
                case "diagonal":
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

        handleVisibilityChange() {
            if (document[hiddenProperty]) {
                if (this.animationFrame) { cancelAnimationFrame(this.animationFrame); this.animationFrame = null; }
            } else {
                if (!this.animationFrame) { this.lastTimestamp = 0; this.animate(); }
            }
        }
    }

    window.GridAnimation = GridAnimation;

    // ==================== 页面初始化 ====================
    function loadIntro() {
        if (document[hiddenProperty] || loadIntro.loaded) return;
        setTimeout(() => {
            const wrap = document.querySelector("#introWrap");
            if (wrap) wrap.classList.add("in");
            setTimeout(() => {
                const subtitle = document.querySelector(".content-subtitle");
                if (subtitle && window.subtitle) {
                    subtitle.innerHTML = ' ' + [...window.subtitle].join(' ');
                }
            }, 270);
        }, 0);
        loadIntro.loaded = true;
    }

    // 页面切换
    function switchPage() {
        if (switchPage.switched) return;
        switchPage.switched = true;

        const intro = document.querySelector(".content-intro");
        const path = document.querySelector(".shape-wrap path");
        const shape = document.querySelector("svg.shape");
        
        if (intro) {
            anime({
                targets: intro,
                duration: 1100,
                easing: "easeInOutSine",
                translateY: "-200vh",
            });
        }

        if (shape) {
            shape.style.transformOrigin = "50% 0%";
            anime({
                targets: shape,
                scaleY: [{ value: [0.8, 1.8], duration: 550, easing: "easeInQuad" }, { value: 1, duration: 550, easing: "easeOutQuad" }],
            });
        }

        if (path) {
            anime({
                targets: path,
                duration: 1100,
                easing: "easeOutQuad",
                d: path.getAttribute("pathdata:id"),
            });
        }

        // 启用滚动
        document.body.style.overflow = "auto";

        // 加载 main 内容
        loadMain();
    }

    function loadMain() {
        if (loadMain.loaded) return;
        setTimeout(() => {
            const cardInner = document.querySelector("#mainContent .card-inner");
            if (cardInner) cardInner.classList.add("in");
            setTimeout(() => {
                const canvas = document.getElementById("gridCanvas");
                if (canvas) {
                    const grid = new GridAnimation(canvas, {
                        direction: "diagonal",
                        speed: isPhone ? 0.03 : 0.05,
                        borderColor: isPhone ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.08)",
                        squareSize: isPhone ? 50 : 40,
                        hoverFillColor: "rgba(255, 255, 255, 0.8)",
                        hoverShadowColor: "rgba(255, 255, 255, 0.6)",
                        transitionDuration: isPhone ? 150 : 200,
                        trailDuration: isPhone ? 2000 : 1500,
                        specialBlockColor: "rgba(100, 255, 152, 0.8)",
                        snakeHeadColor: "rgba(255, 255, 255, 0.95)",
                        snakeTailColor: "rgba(218, 231, 255, 0.25)",
                        snakeColorDecay: 0.85,
                        touchSensitivity: isPhone ? 1.2 : 1.0,
                        vibrationEnabled: isPhone,
                    });
                    grid.init();
                }
            }, 1100);
        }, 400);
        loadMain.loaded = true;
    }

    function loadAll() {
        if (loadAll.loaded) return;
        switchPage();
        loadAll.loaded = true;
    }

    // ==================== 事件绑定 ====================
    window.addEventListener(visibilityChangeEvent, loadIntro);
    window.addEventListener("DOMContentLoaded", loadIntro);

    const enterEl = document.querySelector(".enter");
    if (enterEl) {
        enterEl.addEventListener("click", loadAll);
    }

    // 滚动进入
    function handleScrollEvent(e) {
        const deltaY = e.deltaY || e.wheelDelta * -1 || e.detail;
        if (deltaY > 0) loadAll();
    }
    document.body.addEventListener("wheel", handleScrollEvent, { passive: true });
    document.body.addEventListener("mousewheel", handleScrollEvent, { passive: true });
    document.body.addEventListener("DOMMouseScroll", handleScrollEvent, { passive: true });

    const arrows = document.querySelectorAll(".arrow");
    arrows.forEach(arrow => arrow.addEventListener("mouseenter", loadAll));

    // 移动端手势
    if (isPhone) {
        document.addEventListener("touchstart", (e) => {
            window.startx = e.touches[0].pageX;
            window.starty = e.touches[0].pageY;
        }, { passive: true });
        document.addEventListener("touchend", (e) => {
            const endx = e.changedTouches[0].pageX;
            const endy = e.changedTouches[0].pageY;
            const angx = endx - window.startx;
            const angy = endy - window.starty;
            if (Math.abs(angx) < 2 && Math.abs(angy) < 2) return;
            const angle = (Math.atan2(angy, angx) * 180) / Math.PI;
            if (angle >= -135 && angle <= -45) loadAll();
        }, { passive: true });
    }

})();
