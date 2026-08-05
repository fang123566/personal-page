// background.js - WebGL 流体动画（修复版：内联 dither 纹理）
(function() {
    'use strict';

    var canvas = document.getElementById("background");
    if (!canvas) return;

    // ==================== 配置 ====================
    var config = {
        SIM_RESOLUTION: 128,
        DYE_RESOLUTION: 1024,
        DENSITY_DISSIPATION: 0.97,
        VELOCITY_DISSIPATION: 0.98,
        PRESSURE: 0.8,
        PRESSURE_ITERATIONS: 20,
        CURL: 30,
        SPLAT_RADIUS: 0.25,
        SPLAT_FORCE: 6000,
        SUNRAYS: true,
        SUNRAYS_RESOLUTION: 196,
        SUNRAYS_WEIGHT: 1.0,
        BLOOM: true,
        BLOOM_RESOLUTION: 256,
        BLOOM_ITERATIONS: 8,
        BLOOM_INTENSITY: 0.8,
        BLOOM_THRESHOLD: 0.6,
        BLOOM_SOFT_KNEE: 0.7,
        COLORFUL: true,
        COLOR_UPDATE_SPEED: 10,
        BACK_COLOR: { r: 6 / 255, g: 6 / 255, b: 6 / 255 },
        TRANSPARENT: false,
        SHADING: true,
        PAUSED: false
    };

    // ==================== 工具函数 ====================
    function _typeof(e) {
        return typeof e === "undefined" ? "undefined" : typeof e;
    }

    function HSVtoRGB(h, s, v) {
        var r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        i = i % 6;
        return { r: [v, q, p, p, t, v][i], g: [t, v, v, q, p, p][i], b: [p, p, t, v, v, q][i] };
    }

    function generateColor() {
        var c = HSVtoRGB(Math.random(), 1, 1);
        c.r *= 0.15; c.g *= 0.15; c.b *= 0.15;
        return c;
    }

    function scaleByPixelRatio(e) {
        return Math.floor(e * (window.devicePixelRatio || 1));
    }

    function getResolution(e) {
        var r = canvas.width / canvas.height;
        if (r < 1) r = 1 / r;
        var t = Math.round(e), n = Math.round(e * r);
        return canvas.width > canvas.height ? { width: n, height: t } : { width: t, height: n };
    }

    // ==================== WebGL 初始化 ====================
    var pointers = [];
    var splatStack = [];

    function getWebGLContext(canvas) {
        var params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
        var gl = canvas.getContext("webgl2", params) || canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);
        if (!gl) return null;
        gl.clearColor(0, 0, 0, 1);
        return gl;
    }

    var gl = getWebGLContext(canvas);
    if (!gl) return;

    // ==================== 着色器编译 ====================
    function compileShader(type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    function createProgram(vsSource, fsSource) {
        var vs = compileShader(gl.VERTEX_SHADER, vsSource);
        var fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
        var program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        return program;
    }

    // 顶点着色器
    var baseVertexShader = `
        precision highp float;
        attribute vec2 aPosition;
        varying vec2 vUv;
        varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform vec2 texelSize;
        void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `;

    // 片段着色器们
    var copyShader = `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        void main () { gl_FragColor = texture2D(uTexture, vUv); }
    `;

    var clearShader = `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform float value;
        void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
    `;

    var displayShaderSource = `
        precision highp float;
        varying vec2 vUv;
        varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uTexture;
        uniform sampler2D uBloom;
        uniform sampler2D uSunrays;
        uniform sampler2D uDithering;
        uniform vec2 ditherScale;
        uniform vec2 texelSize;
        
        vec3 linearToGamma(vec3 c) {
            return max(1.055 * pow(c, vec3(0.416667)) - 0.055, vec3(0.0));
        }
        
        void main () {
            vec3 c = texture2D(uTexture, vUv).rgb;
            
            #ifdef SHADING
            vec3 lc = texture2D(uTexture, vL).rgb;
            vec3 rc = texture2D(uTexture, vR).rgb;
            vec3 tc = texture2D(uTexture, vT).rgb;
            vec3 bc = texture2D(uTexture, vB).rgb;
            float dx = length(rc) - length(lc);
            float dy = length(tc) - length(bc);
            vec3 n = normalize(vec3(dx, dy, length(texelSize)));
            vec3 l = vec3(0.0, 0.0, 1.0);
            float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
            c *= diffuse;
            #endif
            
            #ifdef BLOOM
            vec3 bloom = texture2D(uBloom, vUv).rgb;
            #endif
            
            #ifdef SUNRAYS
            float sunrays = texture2D(uSunrays, vUv).r;
            c *= sunrays;
            #ifdef BLOOM
            bloom *= sunrays;
            #endif
            #endif
            
            #ifdef BLOOM
            float noise = texture2D(uDithering, vUv * ditherScale).r;
            noise = noise * 2.0 - 1.0;
            bloom += noise / 255.0;
            bloom = linearToGamma(bloom);
            c += bloom;
            #endif
            
            float a = max(c.r, max(c.g, c.b));
            gl_FragColor = vec4(c, a);
        }
    `;

    var bloomPrefilterShader = `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec3 curve;
        uniform float threshold;
        void main () {
            vec3 c = texture2D(uTexture, vUv).rgb;
            float br = max(c.r, max(c.g, c.b));
            float rq = clamp(br - curve.x, 0.0, curve.y);
            rq = curve.z * rq * rq;
            c *= max(rq, br - threshold) / max(br, 0.0001);
            gl_FragColor = vec4(c, 0.0);
        }
    `;

    var bloomBlurShader = `
        precision mediump float;
        varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uTexture;
        void main () {
            vec4 s = vec4(0.0);
            s += texture2D(uTexture, vL); s += texture2D(uTexture, vR);
            s += texture2D(uTexture, vT); s += texture2D(uTexture, vB);
            s *= 0.25;
            gl_FragColor = s;
        }
    `;

    var bloomFinalShader = `
        precision mediump float;
        varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uTexture;
        uniform float intensity;
        void main () {
            vec4 s = vec4(0.0);
            s += texture2D(uTexture, vL); s += texture2D(uTexture, vR);
            s += texture2D(uTexture, vT); s += texture2D(uTexture, vB);
            s *= 0.25;
            gl_FragColor = s * intensity;
        }
    `;

    var sunraysMaskShader = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        void main () {
            vec4 c = texture2D(uTexture, vUv);
            float br = max(c.r, max(c.g, c.b));
            c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
            gl_FragColor = c;
        }
    `;

    var sunraysShader = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform float weight;
        #define ITERATIONS 16
        void main () {
            float Density = 0.3, Decay = 0.95, Exposure = 0.7;
            vec2 coord = vUv;
            vec2 dir = vUv - 0.5;
            dir *= 1.0 / float(ITERATIONS) * Density;
            float illuminationDecay = 1.0;
            float color = texture2D(uTexture, vUv).a;
            for (int i = 0; i < ITERATIONS; i++) {
                coord -= dir;
                float col = texture2D(uTexture, coord).a;
                color += col * illuminationDecay * weight;
                illuminationDecay *= Decay;
            }
            gl_FragColor = vec4(color * Exposure, 0.0, 0.0, 1.0);
        }
    `;

    var splatShader = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;
        void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
        }
    `;

    var advectionShader = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform float dt;
        uniform float dissipation;
        void main () {
            vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
            vec4 result = texture2D(uSource, coord);
            float decay = 1.0 + dissipation * dt;
            gl_FragColor = result / decay;
        }
    `;

    var divergenceShader = `
        precision mediump float;
        varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;
            vec2 C = texture2D(uVelocity, vUv).xy;
            if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
            if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
    `;

    var curlShader = `
        precision mediump float;
        varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
    `;

    var vorticityShader = `
        precision highp float;
        varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform float curl;
        uniform float dt;
        void main () {
            float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;
            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001;
            force *= curl * C;
            force.y *= -1.0;
            vec2 vel = texture2D(uVelocity, vUv).xy;
            gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
        }
    `;

    var pressureShader = `
        precision mediump float;
        varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        void main () {
            float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
            float C = texture2D(uPressure, vUv).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
    `;

    var gradientSubtractShader = `
        precision mediump float;
        varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
    `;

    // ==================== 程序创建 ====================
    var copyProgram = createProgram(baseVertexShader, copyShader);
    var clearProgram = createProgram(baseVertexShader, clearShader);
    var bloomPrefilterProgram = createProgram(baseVertexShader, bloomPrefilterShader);
    var bloomBlurProgram = createProgram(baseVertexShader, bloomBlurShader);
    var bloomFinalProgram = createProgram(baseVertexShader, bloomFinalShader);
    var sunraysMaskProgram = createProgram(baseVertexShader, sunraysMaskShader);
    var sunraysProgram = createProgram(baseVertexShader, sunraysShader);
    var splatProgram = createProgram(baseVertexShader, splatShader);
    var advectionProgram = createProgram(baseVertexShader, advectionShader);
    var divergenceProgram = createProgram(baseVertexShader, divergenceShader);
    var curlProgram = createProgram(baseVertexShader, curlShader);
    var vorticityProgram = createProgram(baseVertexShader, vorticityShader);
    var pressureProgram = createProgram(baseVertexShader, pressureShader);
    var gradientSubtractProgram = createProgram(baseVertexShader, gradientSubtractShader);

    // displayShader 需要动态关键字
    var displayMaterial = {
        programs: {},
        activeProgram: null,
        uniforms: null,
        setKeywords: function(keywords) {
            var hash = 0;
            keywords.forEach(function(k) { hash += hashCode(k); });
            var program = this.programs[hash];
            if (!program) {
                var fs = displayShaderSource;
                keywords.forEach(function(k) { fs = "#define " + k + "\n" + fs; });
                program = createProgram(baseVertexShader, fs);
                this.programs[hash] = program;
            }
            if (program !== this.activeProgram) {
                this.uniforms = getUniforms(program);
                this.activeProgram = program;
            }
        },
        bind: function() { gl.useProgram(this.activeProgram); }
    };

    function getUniforms(program) {
        var uniforms = [];
        var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < count; i++) {
            var name = gl.getActiveUniform(program, i).name;
            uniforms[name] = gl.getUniformLocation(program, name);
        }
        return uniforms;
    }

    function hashCode(s) {
        if (s.length === 0) return 0;
        var h = 0;
        for (var i = 0; i < s.length; i++) {
            h = (h << 5) - h + s.charCodeAt(i);
            h |= 0;
        }
        return h;
    }

    // ==================== 缓冲区 ====================
    var blit = (function() {
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,1,1,1,1,-1]), gl.STATIC_DRAW);
        var indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        return function(target) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        };
    })();

    // ==================== FBO 管理 ====================
    var dye, velocity, divergence, curl, pressure, bloom, sunrays, sunraysTemp;
    var bloomFramebuffers = [];
    var ditheringTexture;

    function getSupportedFormat(gl, internalFormat, format, type) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }

    function createFBO(w, h, internalFormat, format, type, filter) {
        gl.activeTexture(gl.TEXTURE0);
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return {
            texture: texture,
            fbo: fbo,
            width: w,
            height: h,
            texelSizeX: 1 / w,
            texelSizeY: 1 / h,
            attach: function(id) {
                gl.activeTexture(gl.TEXTURE0 + id);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                return id;
            }
        };
    }

    function createDoubleFBO(w, h, internalFormat, format, type, filter) {
        var fbo1 = createFBO(w, h, internalFormat, format, type, filter);
        var fbo2 = createFBO(w, h, internalFormat, format, type, filter);
        return {
            width: w, height: h,
            texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
            get read() { return fbo1; },
            set read(v) { fbo1 = v; },
            get write() { return fbo2; },
            set write(v) { fbo2 = v; },
            swap: function() { var temp = fbo1; fbo1 = fbo2; fbo2 = temp; }
        };
    }

    function resizeFBO(target, w, h, internalFormat, format, type, filter) {
        var newFBO = createFBO(w, h, internalFormat, format, type, filter);
        copyProgram.bind();
        gl.uniform1i(copyProgram.uniforms ? copyProgram.uniforms.uTexture : gl.getUniformLocation(copyProgram, "uTexture"), target.attach(0));
        blit(newFBO.fbo);
        return newFBO;
    }

    function resizeDoubleFBO(target, w, h, internalFormat, format, type, filter) {
        if (target.width === w && target.height === h) return target;
        target.read = resizeFBO(target.read, w, h, internalFormat, format, type, filter);
        target.write = createFBO(w, h, internalFormat, format, type, filter);
        target.width = w;
        target.height = h;
        target.texelSizeX = 1 / w;
        target.texelSizeY = 1 / h;
        return target;
    }

    // 生成程序化抖动纹理
    function createDitherTexture() {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        
        // 生成 64x64 噪声纹理
        var size = 64;
        var data = new Uint8Array(size * size * 4);
        for (var i = 0; i < size * size; i++) {
            var val = Math.random() * 256 | 0;
            data[i * 4] = val;
            data[i * 4 + 1] = val;
            data[i * 4 + 2] = val;
            data[i * 4 + 3] = 255;
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        
        return {
            texture: texture,
            width: size,
            height: size,
            attach: function(id) {
                gl.activeTexture(gl.TEXTURE0 + id);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                return id;
            }
        };
    }

    function initFramebuffers() {
        var simRes = getResolution(config.SIM_RESOLUTION);
        var dyeRes = getResolution(config.DYE_RESOLUTION);
        
        var texType = gl.FLOAT;
        if (!gl.getExtension('EXT_color_buffer_float')) {
            texType = gl.HALF_FLOAT;
        }
        
        dye = dye ? resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, gl.RGBA, gl.RGBA, texType, gl.LINEAR) 
                   : createDoubleFBO(dyeRes.width, dyeRes.height, gl.RGBA, gl.RGBA, texType, gl.LINEAR);
        velocity = velocity ? resizeDoubleFBO(velocity, simRes.width, simRes.height, gl.RGBA, gl.RGBA, texType, gl.LINEAR)
                            : createDoubleFBO(simRes.width, simRes.height, gl.RGBA, gl.RGBA, texType, gl.LINEAR);
        divergence = createFBO(simRes.width, simRes.height, gl.RGBA, gl.RGBA, texType, gl.NEAREST);
        curl = createFBO(simRes.width, simRes.height, gl.RGBA, gl.RGBA, texType, gl.NEAREST);
        pressure = createDoubleFBO(simRes.width, simRes.height, gl.RGBA, gl.RGBA, texType, gl.NEAREST);
        
        initBloomFramebuffers();
        initSunraysFramebuffers();
        
        ditheringTexture = createDitherTexture();
    }

    function initBloomFramebuffers() {
        var res = getResolution(config.BLOOM_RESOLUTION);
        bloom = createFBO(res.width, res.height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
        bloomFramebuffers = [];
        for (var i = 0; i < config.BLOOM_ITERATIONS; i++) {
            var w = res.width >> (i + 1);
            var h = res.height >> (i + 1);
            if (w < 2 || h < 2) break;
            bloomFramebuffers.push(createFBO(w, h, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR));
        }
    }

    function initSunraysFramebuffers() {
        var res = getResolution(config.SUNRAYS_RESOLUTION);
        sunrays = createFBO(res.width, res.height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
        sunraysTemp = createFBO(res.width, res.height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    }

    // ==================== 核心渲染 ====================
    var lastUpdateTime = Date.now();
    var colorUpdateTimer = 0;

    function update() {
        var now = Date.now();
        var dt = (now - lastUpdateTime) / 1000;
        dt = Math.min(dt, 0.016666);
        lastUpdateTime = now;

        resizeCanvas();
        updateColors(dt);
        applyInputs();
        if (!config.PAUSED) step(dt);
        render();
        requestAnimationFrame(update);
    }

    function resizeCanvas() {
        var w = scaleByPixelRatio(canvas.clientWidth);
        var h = scaleByPixelRatio(canvas.clientHeight);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            return true;
        }
        return false;
    }

    function updateColors(dt) {
        if (config.COLORFUL) {
            colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
            if (colorUpdateTimer >= 1) {
                colorUpdateTimer = colorUpdateTimer % 1;
                pointers.forEach(function(p) { p.color = generateColor(); });
            }
        }
    }

    function applyInputs() {
        if (splatStack.length > 0) {
            multipleSplats(splatStack.pop());
        }
        pointers.forEach(function(p) {
            if (p.moved) {
                p.moved = false;
                splatPointer(p);
            }
        });
    }

    function step(dt) {
        gl.disable(gl.BLEND);
        
        // Curl
        curlProgram.bind();
        gl.uniform2f(gl.getUniformLocation(curlProgram, "texelSize"), velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(curlProgram, "uVelocity"), velocity.read.attach(0));
        blit(curl.fbo);
        
        // Vorticity
        vorticityProgram.bind();
        gl.uniform2f(gl.getUniformLocation(vorticityProgram, "texelSize"), velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(vorticityProgram, "uVelocity"), velocity.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(vorticityProgram, "uCurl"), curl.attach(1));
        gl.uniform1f(gl.getUniformLocation(vorticityProgram, "curl"), config.CURL);
        gl.uniform1f(gl.getUniformLocation(vorticityProgram, "dt"), dt);
        blit(velocity.write.fbo);
        velocity.swap();
        
        // Divergence
        divergenceProgram.bind();
        gl.uniform2f(gl.getUniformLocation(divergenceProgram, "texelSize"), velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(divergenceProgram, "uVelocity"), velocity.read.attach(0));
        blit(divergence.fbo);
        
        // Clear pressure
        clearProgram.bind();
        gl.uniform1i(gl.getUniformLocation(clearProgram, "uTexture"), pressure.read.attach(0));
        gl.uniform1f(gl.getUniformLocation(clearProgram, "value"), config.PRESSURE);
        blit(pressure.write.fbo);
        pressure.swap();
        
        // Pressure iterations
        pressureProgram.bind();
        gl.uniform2f(gl.getUniformLocation(pressureProgram, "texelSize"), velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(pressureProgram, "uDivergence"), divergence.attach(0));
        for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
            gl.uniform1i(gl.getUniformLocation(pressureProgram, "uPressure"), pressure.read.attach(1));
            blit(pressure.write.fbo);
            pressure.swap();
        }
        
        // Gradient subtract
        gradientSubtractProgram.bind();
        gl.uniform2f(gl.getUniformLocation(gradientSubtractProgram, "texelSize"), velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(gradientSubtractProgram, "uPressure"), pressure.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(gradientSubtractProgram, "uVelocity"), velocity.read.attach(1));
        blit(velocity.write.fbo);
        velocity.swap();
        
        // Advect velocity
        advectionProgram.bind();
        gl.uniform2f(gl.getUniformLocation(advectionProgram, "texelSize"), velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform2f(gl.getUniformLocation(advectionProgram, "dyeTexelSize"), velocity.texelSizeX, velocity.texelSizeY);
        var velId = velocity.read.attach(0);
        gl.uniform1i(gl.getUniformLocation(advectionProgram, "uVelocity"), velId);
        gl.uniform1i(gl.getUniformLocation(advectionProgram, "uSource"), velId);
        gl.uniform1f(gl.getUniformLocation(advectionProgram, "dt"), dt);
        gl.uniform1f(gl.getUniformLocation(advectionProgram, "dissipation"), config.VELOCITY_DISSIPATION);
        blit(velocity.write.fbo);
        velocity.swap();
        
        // Advect dye
        gl.viewport(0, 0, dye.width, dye.height);
        gl.uniform2f(gl.getUniformLocation(advectionProgram, "dyeTexelSize"), dye.texelSizeX, dye.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(advectionProgram, "uVelocity"), velocity.read.attach(0));
        gl.uniform1i(gl.getUniformLocation(advectionProgram, "uSource"), dye.read.attach(1));
        gl.uniform1f(gl.getUniformLocation(advectionProgram, "dissipation"), config.DENSITY_DISSIPATION);
        blit(dye.write.fbo);
        dye.swap();
    }

    function render() {
        if (config.BLOOM) applyBloom(dye.read, bloom);
        if (config.SUNRAYS) {
            applySunrays(dye.read, dye.write, sunrays);
            blur(sunrays, sunraysTemp, 1);
        }
        
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        // Background
        if (!config.TRANSPARENT) {
            var prog = createProgram(baseVertexShader, `
                precision mediump float;
                varying vec2 vUv;
                uniform vec4 color;
                void main() { gl_FragColor = color; }
            `);
            gl.useProgram(prog);
            gl.uniform4f(gl.getUniformLocation(prog, "color"), config.BACK_COLOR.r, config.BACK_COLOR.g, config.BACK_COLOR.b, 1);
            blit(null);
        }
        
        // Display
        var keywords = [];
        if (config.SHADING) keywords.push("SHADING");
        if (config.BLOOM) keywords.push("BLOOM");
        if (config.SUNRAYS) keywords.push("SUNRAYS");
        displayMaterial.setKeywords(keywords);
        displayMaterial.bind();
        gl.uniform2f(displayMaterial.uniforms.texelSize, 1 / canvas.width, 1 / canvas.height);
        gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
        if (config.BLOOM) {
            gl.uniform1i(displayMaterial.uniforms.uBloom, bloom.attach(1));
            gl.uniform1i(displayMaterial.uniforms.uDithering, ditheringTexture.attach(2));
            gl.uniform2f(displayMaterial.uniforms.ditherScale, canvas.width / ditheringTexture.width, canvas.height / ditheringTexture.height);
        }
        if (config.SUNRAYS) {
            gl.uniform1i(displayMaterial.uniforms.uSunrays, sunrays.attach(3));
        }
        blit(null);
    }

    function applyBloom(source, target) {
        if (bloomFramebuffers.length < 2) return;
        
        var t = target;
        
        // Prefilter
        var knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
        bloomPrefilterProgram.bind();
        gl.uniform3f(gl.getUniformLocation(bloomPrefilterProgram, "curve"), config.BLOOM_THRESHOLD - knee, 2 * knee, 0.25 / knee);
        gl.uniform1f(gl.getUniformLocation(bloomPrefilterProgram, "threshold"), config.BLOOM_THRESHOLD);
        gl.uniform1i(gl.getUniformLocation(bloomPrefilterProgram, "uTexture"), source.attach(0));
        gl.viewport(0, 0, t.width, t.height);
        blit(t.fbo);
        
        // Blur passes
        bloomBlurProgram.bind();
        for (var i = 0; i < bloomFramebuffers.length; i++) {
            var b = bloomFramebuffers[i];
            gl.uniform2f(gl.getUniformLocation(bloomBlurProgram, "texelSize"), t.texelSizeX, t.texelSizeY);
            gl.uniform1i(gl.getUniformLocation(bloomBlurProgram, "uTexture"), t.attach(0));
            gl.viewport(0, 0, b.width, b.height);
            blit(b.fbo);
            t = b;
        }
        
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.enable(gl.BLEND);
        for (var j = bloomFramebuffers.length - 2; j >= 0; j--) {
            var b = bloomFramebuffers[j];
            gl.uniform2f(gl.getUniformLocation(bloomBlurProgram, "texelSize"), t.texelSizeX, t.texelSizeY);
            gl.uniform1i(gl.getUniformLocation(bloomBlurProgram, "uTexture"), t.attach(0));
            gl.viewport(0, 0, b.width, b.height);
            blit(b.fbo);
            t = b;
        }
        gl.disable(gl.BLEND);
        
        // Final
        bloomFinalProgram.bind();
        gl.uniform2f(gl.getUniformLocation(bloomFinalProgram, "texelSize"), t.texelSizeX, t.texelSizeY);
        gl.uniform1i(gl.getUniformLocation(bloomFinalProgram, "uTexture"), t.attach(0));
        gl.uniform1f(gl.getUniformLocation(bloomFinalProgram, "intensity"), config.BLOOM_INTENSITY);
        gl.viewport(0, 0, target.width, target.height);
        blit(target.fbo);
    }

    function applySunrays(source, mask, target) {
        gl.disable(gl.BLEND);
        sunraysMaskProgram.bind();
        gl.uniform1i(gl.getUniformLocation(sunraysMaskProgram, "uTexture"), source.attach(0));
        gl.viewport(0, 0, mask.width, mask.height);
        blit(mask.fbo);
        
        sunraysProgram.bind();
        gl.uniform1f(gl.getUniformLocation(sunraysProgram, "weight"), config.SUNRAYS_WEIGHT);
        gl.uniform1i(gl.getUniformLocation(sunraysProgram, "uTexture"), mask.attach(0));
        gl.viewport(0, 0, target.width, target.height);
        blit(target.fbo);
    }

    function blur(source, target, iterations) {
        bloomBlurProgram.bind();
        for (var i = 0; i < iterations; i++) {
            gl.uniform2f(gl.getUniformLocation(bloomBlurProgram, "texelSize"), source.texelSizeX, 0);
            gl.uniform1i(gl.getUniformLocation(bloomBlurProgram, "uTexture"), source.attach(0));
            blit(target.fbo);
            
            gl.uniform2f(gl.getUniformLocation(bloomBlurProgram, "texelSize"), 0, source.texelSizeY);
            gl.uniform1i(gl.getUniformLocation(bloomBlurProgram, "uTexture"), target.attach(0));
            blit(source.fbo);
        }
    }

    // ==================== 交互 ====================
    function splatPointer(pointer) {
        var dx = pointer.deltaX * config.SPLAT_FORCE;
        var dy = pointer.deltaY * config.SPLAT_FORCE;
        splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
    }

    function multipleSplats(num) {
        for (var i = 0; i < num; i++) {
            var c = generateColor();
            c.r *= 10; c.g *= 10; c.b *= 10;
            splat(Math.random(), Math.random(), (Math.random() - 0.5) * 1000, (Math.random() - 0.5) * 1000, c);
        }
    }

    function splat(x, y, dx, dy, color) {
        gl.viewport(0, 0, velocity.width, velocity.height);
        splatProgram.bind();
        gl.uniform1i(gl.getUniformLocation(splatProgram, "uTarget"), velocity.read.attach(0));
        gl.uniform1f(gl.getUniformLocation(splatProgram, "aspectRatio"), canvas.width / canvas.height);
        gl.uniform2f(gl.getUniformLocation(splatProgram, "point"), x, y);
        gl.uniform3f(gl.getUniformLocation(splatProgram, "color"), dx, dy, 0);
        gl.uniform1f(gl.getUniformLocation(splatProgram, "radius"), correctRadius(config.SPLAT_RADIUS / 100));
        blit(velocity.write.fbo);
        velocity.swap();
        
        gl.viewport(0, 0, dye.width, dye.height);
        gl.uniform1i(gl.getUniformLocation(splatProgram, "uTarget"), dye.read.attach(0));
        gl.uniform3f(gl.getUniformLocation(splatProgram, "color"), color.r, color.g, color.b);
        blit(dye.write.fbo);
        dye.swap();
    }

    function correctRadius(radius) {
        var aspectRatio = canvas.width / canvas.height;
        if (aspectRatio > 1) radius *= aspectRatio;
        return radius;
    }

    // Pointer events
    pointers.push({
        id: -1,
        texcoordX: 0, texcoordY: 0,
        prevTexcoordX: 0, prevTexcoordY: 0,
        deltaX: 0, deltaY: 0,
        down: false, moved: false,
        color: generateColor()
    });

    function updatePointerDownData(pointer, id, pageX, pageY) {
        pointer.id = id;
        pointer.down = true;
        pointer.moved = false;
        pointer.texcoordX = pageX / canvas.width;
        pointer.texcoordY = 1 - pageY / canvas.height;
        pointer.prevTexcoordX = pointer.texcoordX;
        pointer.prevTexcoordY = pointer.texcoordY;
        pointer.deltaX = 0;
        pointer.deltaY = 0;
        pointer.color = generateColor();
    }

    function updatePointerMoveData(pointer, pageX, pageY) {
        pointer.prevTexcoordX = pointer.texcoordX;
        pointer.prevTexcoordY = pointer.texcoordY;
        pointer.texcoordX = pageX / canvas.width;
        pointer.texcoordY = 1 - pageY / canvas.height;
        pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
        pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
        pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
    }

    function updatePointerUpData(pointer) {
        pointer.down = false;
    }

    function correctDeltaX(delta) {
        var aspectRatio = canvas.width / canvas.height;
        if (aspectRatio < 1) delta *= aspectRatio;
        return delta;
    }

    function correctDeltaY(delta) {
        var aspectRatio = canvas.width / canvas.height;
        if (aspectRatio > 1) delta /= aspectRatio;
        return delta;
    }

    // ==================== 事件监听 ====================
    window.addEventListener("mousedown", function(e) {
        var pointer = pointers.find(function(p) { return p.id === -1; });
        if (!pointer) return;
        var x = scaleByPixelRatio(e.pageX);
        var y = scaleByPixelRatio(e.pageY);
        updatePointerDownData(pointer, -1, x, y);
    });

    window.addEventListener("mousemove", function(e) {
        var pointer = pointers[0];
        if (!pointer.down) return;
        var x = scaleByPixelRatio(e.pageX);
        var y = scaleByPixelRatio(e.pageY);
        updatePointerMoveData(pointer, x, y);
    });

    window.addEventListener("mouseup", function() {
        updatePointerUpData(pointers[0]);
    });

    window.addEventListener("touchstart", function(e) {
        e.preventDefault();
        for (var i = 0; i < e.targetTouches.length; i++) {
            var touch = e.targetTouches[i];
            var x = scaleByPixelRatio(touch.pageX);
            var y = scaleByPixelRatio(touch.pageY);
            updatePointerDownData(pointers[i + 1] || { id: -1 }, touch.identifier, x, y);
        }
    }, { passive: false });

    window.addEventListener("touchmove", function(e) {
        e.preventDefault();
        for (var i = 0; i < e.targetTouches.length; i++) {
            var touch = e.targetTouches[i];
            var x = scaleByPixelRatio(touch.pageX);
            var y = scaleByPixelRatio(touch.pageY);
            updatePointerMoveData(pointers[i + 1], x, y);
        }
    }, { passive: false });

    window.addEventListener("touchend", function(e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            var touch = e.changedTouches[i];
            var pointer = pointers.find(function(p) { return p.id === touch.identifier; });
            if (pointer) updatePointerUpData(pointer);
        }
    });

    // 空格键添加 splat
    window.addEventListener("keydown", function(e) {
        if (e.code === "Space") splatStack.push(parseInt(Math.random() * 20) + 5);
    });

    // ==================== 初始化 ====================
    function init() {
        resizeCanvas();
        initFramebuffers();
        multipleSplats(parseInt(Math.random() * 20) + 5);
        
        // 改变背景颜色
        document.querySelector(".content-inner").style.background = "unset";
        var shape = document.querySelector(".shape");
        if (shape) shape.style.fill = "#1e1f21";
        
        update();
    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
