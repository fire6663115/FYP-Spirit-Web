/* Shared declarative theme schema and layout checks for Studio and the AR pages. */
(function (root) {
    'use strict';

    const views = Object.freeze({
        launch: {
            backdrop: ['#launch-screen', '启动背景', true, true],
            title: ['.spirit-title', '主标题'],
            intro: ['.spirit-entry > p:first-of-type', '启动说明'],
            start: ['#btn-start-ar', '开始 AR', true],
            catalog: ['#btn-open-codex', '怪兽图鉴', true],
            status: ['#launch-status', '启动状态', true],
        },
        scan: {
            guide: ['#scan-guide', '扫描提示'],
            nav: ['#session-nav', '顶部操作栏', true],
            hud: ['#hud-panel', '怪兽资料面板'],
            tools: ['#top-right-tools', '微调与环境光', true],
            actions: ['#action-bar', '底部操作栏', true],
            detach: ['#btn-detach', '踏入现实', true],
            shutter: ['#btn-snap', '拍照', true],
        },
        codex: {
            backdrop: ['main.spirit-screen', '图鉴背景', true, true],
            title: ['.codex-header h1', '图鉴标题'],
            back: ['.codex-header .codex-back', '返回 AR 入口', true],
            status: ['#codex-status', '发现数量'],
            panel: ['#codex-grid', '怪兽卡片列表', true],
            detail: ['#detail-title', '怪兽详情标题'],
            close: ['#codex-close', '返回目录', true],
        },
        photo: {
            panel: ['#reality-panel', '合影说明面板', true],
            spatial: ['#btn-spatial-ar', '空间 AR', true],
            actions: ['#action-bar', '底部操作栏', true],
            detach: ['#btn-detach', '返回卡牌', true],
            shutter: ['#btn-snap', '拍照', true],
            image: ['#photo-image', '照片预览'],
            save: ['#photo-save', '保存照片', true],
            close: ['#photo-close', '返回 AR', true],
        },
    });
    const fonts = Object.freeze({
        sans: 'system-ui, sans-serif',
        serif: 'Georgia, "Songti SC", serif',
        mono: 'ui-monospace, monospace',
    });
    const fileLimit = 650000;
    const artwork = ['#spirit-theme-artwork', '装饰图片'];
    const extraId = id => /^extra-[0-9]{1,6}$/.test(id);
    const shapeNames = Object.freeze({ rect:'矩形', round:'圆角矩形', circle:'圆形', ellipse:'椭圆', triangle:'三角形',
        polygon:'多边形', star:'星形', line:'直线', arrow:'箭头', path:'自由路径', pen:'钢笔路径', bezier:'曲线路径' });
    const extraKinds = { text: '装饰文字', panel: '装饰面板', image: '装饰图片', shape: '形状' };
    const entries = (view, layers = {}) => ({
        ...views[view], artwork,
        ...Object.fromEntries(Object.entries(layers).filter(([id]) => extraId(id)).map(([id, layer]) =>
            [id, ['#spirit-theme-' + id, layer?.label || ((shapeNames[layer?.shape?.type] || extraKinds[layer?.kind] || '装饰') + ' ' + id.slice(6))]])),
    });
    const empty = (name = 'THE SPIRIT 默认') => ({ version: 1, name, pages: {} });
    const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const paletteDefaults = Object.freeze({ accent: '#00d5df', ink: '#07131c', energy: '#d1ab5a' });
    const colorPattern = /^#[a-f0-9]{6}([a-f0-9]{2})?$/i;
    function colorValue(value, tokens = true) {
        if (typeof value !== 'string' || !(colorPattern.test(value) ||
            (tokens && value.startsWith('@') && has(paletteDefaults, value.slice(1))))) {
            throw Error('颜色须为 HEX 或已定义的主题色');
        }
        return value;
    }
    function resolveColor(value, palette = {}) {
        return value.startsWith('@') ? (palette[value.slice(1)] || paletteDefaults[value.slice(1)]) : value;
    }
    function fields(value, allowed, label) {
        if (!isObject(value) || Object.keys(value).some(key => !allowed.includes(key))) throw Error(label + ' 格式无效');
    }
    function range(value, min, max, label) {
        if (!Number.isFinite(value) || value < min || value > max) throw Error(label + ' 超出范围');
        return value;
    }
    function validateFill(value) {
        if (value?.type === 'solid') {
            fields(value, ['type', 'color'], '纯色');
            return { type: 'solid', color: colorValue(value.color) };
        }
        if (!['linear', 'radial'].includes(value?.type)) throw Error('填充类型无效');
        fields(value, ['type', 'angle', 'stops'], '渐变');
        if (!Array.isArray(value.stops) || value.stops.length < 2 || value.stops.length > 8) {
            throw Error('渐变须包含 2 至 8 个色标');
        }
        const stops = value.stops.map(stop => {
            fields(stop, ['at', 'color'], '色标');
            return { at: range(stop.at, 0, 100, '色标位置'), color: colorValue(stop.color) };
        });
        return { type: value.type, angle: range(value.angle ?? 90, 0, 360, '渐变角度'), stops };
    }
    function cssFill(fill, palette = {}) {
        if (fill.type === 'solid') return resolveColor(fill.color, palette);
        const stops = [...fill.stops].sort((a, b) => a.at - b.at)
            .map(stop => resolveColor(stop.color, palette) + ' ' + stop.at + '%').join(', ');
        return fill.type === 'linear' ? 'linear-gradient(' + fill.angle + 'deg, ' + stops + ')' :
            'radial-gradient(ellipse at center, ' + stops + ')';
    }
    function validateBorder(value) {
        fields(value, ['width', 'color', 'style', 'radii', 'gradient'], '边框');
        const result = {};
        if (value.width !== undefined) result.width = range(value.width, 0, 12, '边框粗细');
        if (value.color !== undefined) result.color = colorValue(value.color);
        if (value.style !== undefined) {
            if (!['solid', 'dashed', 'dotted'].includes(value.style)) throw Error('边框样式无效');
            result.style = value.style;
        }
        if (value.radii !== undefined) {
            if (!Array.isArray(value.radii) || value.radii.length !== 4) throw Error('圆角须为四个数字');
            result.radii = value.radii.map(r => range(r, 0, 80, '圆角'));
        }
        if (value.gradient !== undefined) {
            result.gradient = validateFill(value.gradient);
            if (result.gradient.type === 'solid') throw Error('渐变边框须含色标');
        }
        return result;
    }
    function validateEffects(value) {
        fields(value, ['outer', 'inner', 'glow'], '特效');
        const result = {};
        for (const key of ['outer', 'inner']) {
            if (!value[key]) continue;
            const shadow = value[key];
            fields(shadow, ['x', 'y', 'blur', 'spread', 'color'], '阴影');
            result[key] = {
                x: range(shadow.x, -24, 24, '阴影偏移'),
                y: range(shadow.y, -24, 24, '阴影偏移'),
                blur: range(shadow.blur, 0, 40, '阴影柔化'),
                spread: range(shadow.spread, -12, 12, '阴影扩展'),
                color: colorValue(shadow.color),
            };
        }
        if (value.glow) {
            fields(value.glow, ['radius', 'strength', 'color'], '光晕');
            result.glow = {
                radius: range(value.glow.radius, 0, 40, '光晕范围'),
                strength: range(value.glow.strength, 0, 100, '光晕强度'),
                color: colorValue(value.glow.color),
            };
        }
        return result;
    }
    function cssEffects(effects, palette) {
        const parts = [];
        for (const key of ['outer', 'inner']) {
            const s = effects[key];
            if (s) parts.push((key === 'inner' ? 'inset ' : '') +
                [s.x, s.y, s.blur, s.spread].map(n => n + 'px').join(' ') + ' ' + resolveColor(s.color, palette));
        }
        const glow = effects.glow;
        if (glow?.strength && glow.radius) {
            const color = resolveColor(glow.color, palette);
            const alpha = color.length === 9 ? parseInt(color.slice(7), 16) : 255;
            const opacity = Math.round(alpha * glow.strength / 100).toString(16).padStart(2, '0');
            parts.push('0 0 ' + glow.radius + 'px ' + color.slice(0, 7) + opacity);
        }
        return parts.join(', ') || 'none';
    }
    const numbers = {
        x: [-85, 85], y: [-85, 85], width: [44, 900], height: [44, 900],
        size: [12, 96], opacity: [0.2, 1], order: [-8, 8],
    };
    const colors = ['color', 'background'];
    const flags = ['hidden', 'locked'];
    const pathKinds = new Set(['line','arrow','path','pen']);


    function validateBezier(value) {
        fields(value, ['type','nodes','closed'], '曲线路径');
        if (value.closed !== undefined && typeof value.closed !== 'boolean') throw Error('闭合状态无效');
        const closed = value.closed === true;
        if (!Array.isArray(value.nodes) || value.nodes.length < (closed ? 3 : 2) || value.nodes.length > 48) {
            throw Error('曲线路径需要 2 至 48 个节点，闭合路径至少需要 3 个');
        }
        const pair = point => {
            if (!Array.isArray(point) || point.length !== 2) throw Error('曲线路径坐标无效');
            return point.map(value => range(value, 0, 100, '曲线坐标'));
        };
        return {type:'bezier', closed, nodes:value.nodes.map(node => {
            fields(node, ['point','incoming','outgoing'], '曲线节点');
            return {point:pair(node.point), incoming:node.incoming == null ? null : pair(node.incoming),
                outgoing:node.outgoing == null ? null : pair(node.outgoing)};
        })};
    }

    function bezierData(shape) {
        if (!shape.nodes.length) return '';
        const [first, ...rest] = shape.nodes;
        let data = 'M ' + first.point.join(' ');
        let previous = first;
        for (const node of shape.closed ? [...rest, first] : rest) {
            data += previous.outgoing || node.incoming
                ? ' C ' + (previous.outgoing || previous.point).join(' ') + ' ' +
                    (node.incoming || node.point).join(' ') + ' ' + node.point.join(' ')
                : ' L ' + node.point.join(' ');
            previous = node;
        }
        return data + (shape.closed ? ' Z' : '');
    }

    function validateShape(value) {
        if (value?.type === 'bezier') return validateBezier(value);
        fields(value, ['type','points','sides','inner','closed'], '形状');
        if (!has(shapeNames, value.type)) throw Error('未知的形状');
        const result = {type:value.type};
        if (pathKinds.has(value.type)) {
            const limit = ['line','arrow'].includes(value.type) ? 2 : 96;
            if (!Array.isArray(value.points) || value.points.length < 2 || value.points.length > limit) throw Error('路径节点数量无效');
            result.points = value.points.map(point => {
                if (!Array.isArray(point) || point.length !== 2) throw Error('路径节点无效');
                return point.map(n => range(n, 0, 100, '路径节点'));
            });
        }
        if (value.type === 'polygon' || value.type === 'star') {
            const sides = value.sides ?? 5;
            if (!Number.isInteger(sides)) throw Error('角数必须是整数');
            result.sides = range(sides, 3, 16, '角数');
            if (value.type === 'star') result.inner = range(value.inner ?? 48, 12, 88, '星形内径');
        }
        if (value.type === 'path' || value.type === 'pen') result.closed = value.closed === true;
        return result;
    }

    function validateIcon(value) {
        if (typeof value !== 'string' || value.length > 130000 ||
            !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
            throw Error('图标须为有大小限制的内嵌 PNG');
        }
        const bytes = atob(value.slice(22));
        if (!bytes.startsWith('\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR') || bytes.length < 45) {
            throw Error('图标不是有效的 PNG 文件');
        }
        const dimension = start => [0, 1, 2, 3].reduce((value, i) => value * 256 + bytes.charCodeAt(start + i), 0);
        if (![dimension(16), dimension(20)].every(n => n > 0 && n <= 192)) {
            throw Error('图标最大为 192 × 192 像素');
        }
        let offset = 8;
        let finished = false;
        while (offset + 12 <= bytes.length) {
            const length = dimension(offset);
            const type = bytes.slice(offset + 4, offset + 8);
            if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw Error('主题只支持静态 PNG 图标');
            offset += 12 + length;
            if (offset > bytes.length) break;
            if (type === 'IEND' && length === 0) { finished = true; break; }
        }
        if (!finished || offset !== bytes.length) throw Error('PNG 图标数据不完整');
        return value;
    }


    const motionFrames = Object.freeze({
        fade: [{opacity:0},{opacity:1}],
        // Layer placement and rotation use individual translate/rotate properties. Motion is additive to them.
        slide: [{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],
        pop: [{opacity:0,transform:'scale(.88)'},{opacity:1,transform:'scale(1)'}],
        breath: [{opacity:1},{opacity:.72},{opacity:1}],
        float: [{transform:'translateY(0)'},{transform:'translateY(-6px)'},{transform:'translateY(0)'}],
        press: [{outline:'2px solid #8ce9e0',outlineOffset:'-2px'},
            {outline:'2px solid transparent',outlineOffset:'-2px'}],
    });
    const pressTargets = {launch:['start','catalog'], scan:['detach','shutter'],
        codex:['back','close'], photo:['spatial','detach','shutter','save','close']};
    const motionMargin = value => value?.effect === 'slide' ? 12 : value?.effect === 'float' ? 6 : 0;
    const motionEffects = (view, id) => extraId(id) ? ['fade','slide','pop','breath','float'] :
        pressTargets[view]?.includes(id) ? ['press'] : [];

    function timelineKeys(value) {
        if (!Array.isArray(value) || value.length < 2 || value.length > 8) {
            throw Error('关键帧需为 2 至 8 个');
        }
        let previous = -1;
        const keys = value.map(key => {
            fields(key, ['at','x','y','scale','rotation','opacity','glow'], '关键帧');
            const at = range(key.at, 0, 100, '关键帧时间');
            if (!Number.isInteger(at) || at <= previous) throw Error('关键帧时间必须按顺序且不重复');
            previous = at;
            return {at, x:range(key.x ?? 0,-36,36,'横向位移'), y:range(key.y ?? 0,-36,36,'纵向位移'),
                scale:range(key.scale ?? 1,.8,1.2,'缩放'), rotation:range(key.rotation ?? 0,-25,25,'旋转'),
                opacity:range(key.opacity ?? 1,0,1,'透明度'), glow:range(key.glow ?? 0,0,1,'光晕')};
        });
        if (keys[0].at !== 0 || keys.at(-1).at !== 100) throw Error('保留 0% 和 100% 的关键帧');
        return keys;
    }
    const hasTimelineGlow = value => value?.effect === 'timeline' && value.keys.some(key => key.glow > 0);
    function motionFramesFor(value, baseOpacity = 1) {
        if (value.effect !== 'timeline') return motionFrames[value.effect];
        const glow = hasTimelineGlow(value);
        return value.keys.map(key => ({
            offset:key.at / 100,
            transform:'translate(' + key.x + 'px,' + key.y + 'px) rotate(' + key.rotation + 'deg) scale(' + key.scale + ')',
            opacity:baseOpacity * key.opacity,
            ...(glow ? {filter:'drop-shadow(0 0 ' + key.glow * 4 + 'px rgba(107,232,225,' + key.glow * .72 + '))'} : {})
        }));
    }
    function motionBoxMargin(value, box) {
        if (value?.effect !== 'timeline') return motionMargin(value);
        const radius = Math.hypot(box.width, box.height) / 2;
        // Cover interpolated movement, scale and rotation in addition to the halo.
        const displacement = Math.max(...value.keys.map(key => Math.hypot(key.x,key.y)));
        const scale = Math.max(1,...value.keys.map(key => key.scale));
        const rotation = Math.max(...value.keys.map(key => Math.abs(key.rotation)));
        return displacement + radius * (scale - 1 + 2 * Math.sin(rotation * Math.PI / 360)) +
            (hasTimelineGlow(value) ? 12 : 0);
    }

    function validateMotion(value, view, id) {
        const timeline = value?.effect === 'timeline';
        fields(value, timeline ? ['effect','duration','delay','easing','loops','keys'] : ['effect','duration','delay','easing','loops'], '动画');
        if (timeline ? !extraId(id) : !motionEffects(view, id).includes(value.effect)) throw Error('此图层不允许使用这种动画');
        const easing = value.easing ?? 'ease-out';
        if (!['linear','ease-out','ease-in-out'].includes(easing)) throw Error('动画曲线无效');
        const duration = range(value.duration, 180, 2600, '动画时长');
        const delay = range(value.delay ?? 0, 0, 1500, '动画延迟');
        const loops = range(value.loops ?? 1, 1, 3, '动画次数');
        if (!Number.isInteger(loops) || (loops !== 1 && !['breath','float','timeline'].includes(value.effect))) {
            throw Error('此动画不允许重复');
        }
        if (value.effect === 'press' && (delay || duration > 500)) throw Error('点击反馈最长 500 毫秒，不能延迟');
        return {effect:value.effect, duration, delay, easing, loops, ...(timeline ? {keys:timelineKeys(value.keys)} : {})};
    }
    function motionRule(selector, value, opacity) {
        const timeline = value.effect === 'timeline';
        const key = 'spirit-motion-' + (timeline ? selector.slice(1) : value.effect);
        const frames = motionFramesFor(value,opacity);
        const keyframes = frames.map(({offset,...frame}, i) => (timeline ? value.keys[i].at : Math.round(i * 100 / (frames.length - 1))) + '%{' +
            Object.entries(frame).map(([name, content]) => name === 'outlineOffset' ? 'outline-offset:' + content : name + ':' + content).join(';') + '}').join('');
        const target = selector + (value.effect === 'press' ? ':active' : '');
        return '@media(prefers-reduced-motion:no-preference){@keyframes ' + key + '{' + keyframes + '}' + target +
            '{animation:' + key + ' ' + value.duration + 'ms ' + value.easing + ' ' + value.delay + 'ms ' + value.loops + ' backwards}}';
    }
    function motionPreview(node, value, opacity) {
        if (node.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
        const timeline = value.effect === 'timeline';
        const frames = motionFramesFor(value,opacity);
        // CSS animation easing is evaluated in each keyframe interval.
        return node.animate(timeline ? frames.map(frame => ({...frame,easing:value.easing})) : frames, {
            duration:value.duration, delay:value.delay, easing:timeline ? 'linear' : value.easing, iterations:value.loops, fill:'backwards',
        });
    }


    const componentKeys = ['fill','background','color','border','effects','opacity','font','size'];
    function validateComponents(value, pages) {
        fields(value, ['masters','links'], '主组件');
        if (!isObject(value.masters) || !isObject(value.links) || Object.keys(value.masters).length > 16) {
            throw Error('每份设计最多保留 16 个主组件');
        }
        const masters = {}, links = {};
        const styleOf = style => {
            fields(style, componentKeys, '组件外观');
            return validate({version:1,name:'组件外观',pages:{launch:{title:style}}}).pages.launch.title;
        };
        for (const [id, master] of Object.entries(value.masters)) {
            fields(master, ['name','style','history'], '主组件');
            if (!/^[a-f0-9]{16}$/.test(id) || typeof master.name !== 'string' || !master.name.trim() ||
                master.name.length > 36 || /[\u0000-\u001f]/.test(master.name) ||
                !Array.isArray(master.history) || master.history.length > 5) throw Error('主组件资料无效');
            masters[id] = {name:master.name.trim(), style:styleOf(master.style), history:master.history.map(styleOf)};
        }
        for (const [page, layers] of Object.entries(value.links)) {
            if (!has(views,page) || !isObject(layers)) throw Error('组件引用页面无效');
            links[page] = {};
            for (const [id, master] of Object.entries(layers)) {
                if (!has(pages[page] || {},id)) continue; // A removed layer releases its link.
                if (typeof master !== 'string' || !has(masters,master) || views[page][id]?.[3]) throw Error('组件引用无效');
                links[page][id] = master;
            }
        }
        return {masters,links};
    }

    function validate(theme) {
        if (!isObject(theme) || Object.keys(theme).some(key => !['version', 'name', 'pages', 'palette', 'components'].includes(key)) ||
            ![1, 2, 3, 4, 5].includes(theme.version) || typeof theme.name !== 'string' || !theme.name.trim() ||
            theme.name.length > 48 || /[\u0000-\u001f]/.test(theme.name) || !isObject(theme.pages)) {
            throw Error('主题格式或名称无效');
        }
        if (JSON.stringify(theme).length > fileLimit) throw Error('主题文件太大，请减少图标');
        const result = empty(theme.name.trim());
        result.version = theme.version;
        const upgrade = version => { result.version = Math.max(result.version, version); };
        if (theme.palette !== undefined) {
            fields(theme.palette, Object.keys(paletteDefaults), '主题色');
            result.palette = Object.fromEntries(Object.entries(theme.palette).map(([key, value]) => [key, colorValue(value, false)]));
            upgrade(2);
        }
        for (const [view, layers] of Object.entries(theme.pages)) {
            if (!has(views, view) || !isObject(layers)) throw Error('主题含有未知页面');
            result.pages[view] = {};
            const allowed = entries(view, layers);
            const count = Object.keys(layers).filter(extraId).length;
            if (count > 24) throw Error('每页最多可添加 24 个装饰图层');
            if (count > 8) upgrade(3);
            if (Object.values(layers).filter(layer => layer?.motion).length > 6) throw Error('每页最多 6 个动画图层');
            for (const [id, input] of Object.entries(layers)) {
                if (!has(allowed, id) || !isObject(input)) throw Error('主题含有未知图层');
                const [, label, interactive, backdrop] = allowed[id];
                const layer = {};
                const extra = extraId(id);
                if (extra) {
                    if (!has(extraKinds, input.kind)) throw Error('未知的装饰类型');
                    layer.kind = input.kind;
                    upgrade(2);
                    if (layer.kind === 'shape' && !input.shape) throw Error('形状缺少绘图数据');
                }
                for (const [key, value] of Object.entries(input)) {
                    if (backdrop && !['fill', 'background', 'color', 'locked'].includes(key)) throw Error('全屏背景只支持填充与颜色');
                    if (has(numbers, key)) {
                        const [min, max] = extra && key === 'order' ? [-24,24] :
                            layer.kind === 'shape' && (key === 'width' || key === 'height') ? [4,900] : numbers[key];
                        if (!Number.isFinite(value) || value < min || value > max ||
                            (key === 'order' && !Number.isInteger(value)) ||
                            (interactive && key === 'opacity' && value < 0.75)) {
                            throw Error(label + ' 的数值超出安全范围');
                        }
                        if (extra && key === 'order' && Math.abs(value) > 8) upgrade(3);
                    } else if (colors.includes(key)) {
                        colorValue(value);
                        if (value.length !== 7 || value.startsWith('@')) upgrade(2);
                    } else if (key === 'fill') {
                        layer.fill = validateFill(value);
                        upgrade(2);
                        continue;
                    } else if (key === 'border' || key === 'effects') {
                        layer[key] = key === 'border' ? validateBorder(value) : validateEffects(value);
                        upgrade(2);
                        continue;
                    } else if (flags.includes(key)) {
                        if (typeof value !== 'boolean' || (interactive && key === 'hidden' && value)) {
                            throw Error(label + ' 包含不可隐藏的操作');
                        }
                    } else if (key === 'font') {
                        if (typeof value !== 'string' || !has(fonts, value)) throw Error('字体不在系统字体列表');
                    } else if (key === 'motion') {
                        layer.motion = validateMotion(value, view, id);
                        upgrade(layer.motion.effect === 'timeline' ? 5 : 4);
                        continue;
                    } else if (extra && key === 'kind') {
                        continue;
                    } else if (extra && key === 'label') {
                        if (typeof value !== 'string' || !value.trim() || value.length > 48 || /[\u0000-\u001f]/.test(value)) throw Error('图层名称无效');
                        upgrade(3);
                    } else if (extra && key === 'group') {
                        if (typeof value !== 'string' || !/^[a-z0-9]{1,20}$/.test(value)) throw Error('组合编号无效');
                        upgrade(3);
                    } else if (layer.kind === 'shape' && key === 'shape') {
                        layer.shape = validateShape(value);
                        upgrade(layer.shape.type === 'bezier' ? 5 : 3);
                        continue;
                    } else if (extra && key === 'rotation') {
                        range(value, -360, 360, '旋转');
                        upgrade(3);
                    } else if (extra && key === 'text' && layer.kind === 'text') {
                        if (typeof value !== 'string' || value.length > 80 || /[\u0000-\u001f]/.test(value)) throw Error('装饰文字最多 80 字');
                    } else if (key === 'icon' && (!extra || layer.kind === 'image')) {
                        validateIcon(value);
                    } else {
                        throw Error('主题包含不支持的属性');
                    }
                    layer[key] = value;
                }
                result.pages[view][id] = layer;
            }
            const glowing = Object.values(result.pages[view]).filter(layer => hasTimelineGlow(layer.motion));
            if (glowing.length > 1 || glowing.some(layer => (layer.width || 120) > 160 || (layer.height || 48) > 160)) {
                throw Error('每页只允许一个动态光晕，图层宽和高不得超过 160');
            }
        }
        if (theme.components !== undefined) {
            result.components = validateComponents(theme.components,result.pages);
            upgrade(5);
        }
        return result;
    }

    function bounds(doc, insets) {
        const viewport = doc.documentElement;
        return {
            left: insets.left, top: insets.top,
            right: viewport.clientWidth - insets.right,
            bottom: viewport.clientHeight - insets.bottom,
            width: viewport.clientWidth, height: viewport.clientHeight,
        };
    }

    function visible(element) {
        if (!element?.getClientRects().length) return false;
        for (let node = element; node; node = node.parentElement) {
            const style = element.ownerDocument.defaultView.getComputedStyle(node);
            if (style.visibility !== 'visible' || Number(style.opacity) < 0.05) return false;
        }
        return true;
    }

    function rect(element) {
        const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
        return { left, top, right, bottom, width, height };
    }
    function intersection(a, b) {
        return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    }
    function overflow(box, safe) {
        return Math.max(0, safe.left - box.left) + Math.max(0, box.right - safe.right) +
            Math.max(0, safe.top - box.top) + Math.max(0, box.bottom - safe.bottom);
    }

    function contrast(style) {
        const background = style.backgroundColor.match(/[\d.]+/g)?.map(Number);
        const color = style.color.match(/[\d.]+/g)?.map(Number);
        if (background?.length !== 3 || color?.length !== 3 || style.backgroundImage !== 'none') return null;
        const luminance = channels => channels.map(value => value / 255)
            .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
            .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        const a = luminance(color), b = luminance(background);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    }

    function sample(doc, safe) {
        const buttons = new Map();
        const activeModal = doc.querySelector('#photo-preview:not([hidden])');
        const scope = activeModal || doc;
        for (const element of scope.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)')) {
            if (!visible(element)) continue;
            const box = rect(element);
            if (!intersection(box, { left: 0, top: 0, right: safe.width, bottom: safe.height })) continue;
            let available = 0;
            let hits = 0;
            for (const [x, y] of [[.5, .5], [.23, .25], [.77, .25], [.23, .75], [.77, .75]]) {
                const px = box.left + box.width * x;
                const py = box.top + box.height * y;
                if (px < 0 || py < 0 || px >= safe.width || py >= safe.height) continue;
                available++;
                const hit = doc.elementFromPoint(px, py);
                if (hit && element.contains(hit)) hits++;
            }
            if (available) buttons.set(element, { box, hits, available, contrast: contrast(doc.defaultView.getComputedStyle(element)) });
        }
        return buttons;
    }

    function drawShape(doc, element, id, layer, palette) {
        const signature = JSON.stringify([layer.shape, layer.fill, layer.border, layer.effects,
            layer.background, layer.width, layer.height, palette]);
        if (signature === element.dataset.shapeSignature) return;
        element.dataset.shapeSignature = signature;
        const make = (tag, values, parent) => {
            const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
            for (const [key, value] of Object.entries(values)) node.setAttribute(key, value);
            if (parent) parent.append(node);
            return node;
        };
        const svg = make('svg', {viewBox:'0 0 100 100', preserveAspectRatio:'none', width:'100%', height:'100%',
            overflow:'visible', 'aria-hidden':'true'});
        const defs = make('defs', {}, svg);
        const paint = (fill, key, fallback) => {
            if (!fill || fill.type === 'solid') return resolveColor(fill?.color || fallback, palette);
            const gradientId = 'spirit-shape-' + id + '-' + key;
            const angle = (fill.angle ?? 90) * Math.PI / 180;
            const dx = Math.sin(angle) * 50, dy = -Math.cos(angle) * 50;
            const common = {id:gradientId, gradientUnits:'userSpaceOnUse'};
            const gradient = fill.type === 'radial' ? make('radialGradient', {...common,cx:50,cy:50,r:70}, defs) :
                make('linearGradient', {...common,x1:50-dx,y1:50-dy,x2:50+dx,y2:50+dy}, defs);
            for (const stop of [...fill.stops].sort((a,b) => a.at-b.at)) {
                make('stop', {offset:stop.at+'%', 'stop-color':resolveColor(stop.color,palette)}, gradient);
            }
            return 'url(#' + gradientId + ')';
        };
        const shape = layer.shape, border = layer.border || {};
        const open = (pathKinds.has(shape.type) || shape.type === 'bezier') && !shape.closed;
        const fill = paint(layer.fill, 'fill', layer.background || '#25c7cd');
        const stroke = paint(border.gradient, 'stroke', border.color || '#d0ffff');
        const attrs = {fill:open ? 'none' : fill, stroke:open && !border.color && !border.gradient ? fill : stroke,
            'stroke-width':border.width ?? (open ? 3 : 0), 'vector-effect':'non-scaling-stroke',
            'stroke-linecap':'round', 'stroke-linejoin':'round'};
        if (border.style === 'dashed') attrs['stroke-dasharray'] = '7 4';
        if (border.style === 'dotted') attrs['stroke-dasharray'] = '1 4';
        let graphic;
        if (shape.type === 'rect' || shape.type === 'round') {
            const fallback = shape.type === 'round' ? 14 : 0;
            const radii = (border.radii || [fallback,fallback,fallback,fallback]).map(value =>
                [Math.min(50, value*100/(layer.width || 120)), Math.min(50, value*100/(layer.height || 48))]);
            const [[a,A],[b,B],[c,C],[d,D]] = radii;
            graphic = make('path', {...attrs, d:'M'+a+' 0 H'+(100-b)+' Q100 0 100 '+B+' V'+(100-C)+' Q100 100 '+(100-c)+' 100 H'+d+
                ' Q0 100 0 '+(100-D)+' V'+A+' Q0 0 '+a+' 0 Z'}, svg);
        } else if (shape.type === 'circle' || shape.type === 'ellipse') {
            graphic = make('ellipse', {...attrs,cx:50,cy:50,rx:50,ry:50}, svg);
        } else if (shape.type === 'bezier') {
            graphic = make('path', {...attrs, d:bezierData(shape)}, svg);
        } else if (pathKinds.has(shape.type)) {
            graphic = make(shape.closed ? 'polygon' : 'polyline', {...attrs, points:shape.points.map(p=>p.join(',')).join(' ')}, svg);
            if (shape.type === 'arrow') {
                const [start,end] = shape.points, w = layer.width || 100, h = layer.height || 100;
                const angle = Math.atan2((end[1]-start[1])*h, (end[0]-start[0])*w);
                const back = side => [end[0]-100*(Math.cos(angle)*9+Math.sin(angle)*side)/w,
                    end[1]-100*(Math.sin(angle)*9-Math.cos(angle)*side)/h];
                make('polygon',{points:[end,back(5),back(-5)].map(p=>p.join(',')).join(' '),fill:attrs.stroke},svg);
            }
        } else {
            const sides = shape.type === 'triangle' ? 3 : shape.sides;
            const star = shape.type === 'star', count = sides*(star?2:1);
            const vertices = Array.from({length:count},(_,i)=>{
                const angle = i*2*Math.PI/count-Math.PI/2, radius = i%2 && star ? shape.inner/2 : 50;
                return [50+radius*Math.cos(angle),50+radius*Math.sin(angle)];
            });
            const extent = axis => [Math.min(...vertices.map(p=>p[axis])),Math.max(...vertices.map(p=>p[axis]))];
            const extents = [extent(0),extent(1)];
            const points = vertices.map(p=>p.map((n,axis)=>(n-extents[axis][0])*100/(extents[axis][1]-extents[axis][0])).join(',')).join(' ');
            graphic = make('polygon',{...attrs,points},svg);
        }
        const inner = layer.effects?.inner;
        if (inner) {
            const filterId = 'spirit-shape-inner-' + id;
            const filter = make('filter',{id:filterId,x:'-60%',y:'-60%',width:'220%',height:'220%'},defs);
            make('feOffset',{in:'SourceAlpha',dx:inner.x,dy:inner.y,result:'shift'},filter);
            make('feGaussianBlur',{in:'shift',stdDeviation:inner.blur/2,result:'blur'},filter);
            make('feComposite',{in:'SourceAlpha',in2:'blur',operator:'out',result:'edge'},filter);
            make('feFlood',{'flood-color':resolveColor(inner.color,palette),result:'ink'},filter);
            make('feComposite',{in:'ink',in2:'edge',operator:'in',result:'shade'},filter);
            const merge = make('feMerge',{},filter);
            make('feMergeNode',{in:'SourceGraphic'},merge); make('feMergeNode',{in:'shade'},merge);
            graphic.setAttribute('filter','url(#'+filterId+')');
        }
        const filters = [];
        const outer = layer.effects?.outer, glow = layer.effects?.glow;
        if (outer) filters.push('drop-shadow('+outer.x+'px '+outer.y+'px '+outer.blur/2+'px '+resolveColor(outer.color,palette)+')');
        if (glow?.strength && glow.radius) {
            const color = resolveColor(glow.color,palette), alpha = color.length===9 ? parseInt(color.slice(7),16) : 255;
            filters.push('drop-shadow(0 0 '+glow.radius/2+'px '+color.slice(0,7)+Math.round(alpha*glow.strength/100).toString(16).padStart(2,'0')+')');
        }
        svg.style.filter = filters.join(' ');
        element.replaceChildren(svg);
    }

    class Layout {
        constructor(doc) {
            this.doc = doc;
            this.sheet = doc.createElement('style');
            this.sheet.dataset.spiritTheme = '';
            this.transitions = doc.createElement('style');
            doc.head.append(this.sheet, this.transitions);
            this.icons = new Map();
            this.baseOrder = new WeakMap();
            this.previousSelectors = [];
        }
        clear() {
            this.sheet.textContent = '';
            for (const icon of this.icons.values()) icon.remove();
            this.icons.clear();
            this.baseOrder = new WeakMap();
        }
        preview(view, layers, insets, palette) {
            this.paint(view, layers, bounds(this.doc, insets), palette);
        }
        paint(view, layers, safe, palette) {
            const doc = this.doc;
            const rules = [];
            const activeIcons = new Set();
            const getIcon = (id, src) => {
                activeIcons.add(id);
                let icon = this.icons.get(id);
                if (!icon) {
                    icon = doc.createElement('img');
                    icon.alt = '';
                    icon.setAttribute('aria-hidden', 'true');
                    this.icons.set(id, icon);
                }
                if (icon.getAttribute('src') !== src) icon.src = src;
                return icon;
            };
            const defs = entries(view, layers);
            for (const [id, layer] of Object.entries(layers)) {
                const [selector, label] = defs[id];
                if (id === 'artwork' || extraId(id)) {
                    if (layer.hidden) continue;
                    const kind = layer.kind || 'image';
                    if (kind === 'image' && !layer.icon) continue;
                    activeIcons.add(id);
                    let element = kind === 'image' ? getIcon(id, layer.icon) : this.icons.get(id);
                    if (!element) {
                        element = doc.createElement('div');
                        element.setAttribute('aria-hidden', 'true');
                        this.icons.set(id, element);
                    }
                    element.id = selector.slice(1);
                    element.dataset.spiritDecoration = label;
                    const z = view === 'launch' || view === 'codex' ? 301 : view === 'photo' ? 401 : 110;
                    const size = kind === 'image' ? 'width:64px;height:64px;object-fit:contain' :
                        kind === 'shape' ? 'width:120px;height:48px;line-height:0' :
                        'width:120px;height:48px;display:grid;place-content:center;text-align:center;overflow-wrap:anywhere;overflow:hidden';
                    const origin = id === 'artwork' ? 'left:12px;top:120px;' : 'left:28px;top:80px;';
                    const style = 'position:fixed;box-sizing:border-box;' + origin + 'color:#e8f2f5;pointer-events:none;z-index:' + z + ';' + size;
                    if (element.getAttribute('style') !== style) element.setAttribute('style', style);
                    if (kind === 'text' && element.textContent !== layer.text) element.textContent = layer.text || '';
                    if (kind === 'shape') drawShape(doc, element, id, layer, palette);
                    if (!element.isConnected) doc.body.append(element);
                }
                const node = doc.querySelector(selector);
                if (!node) continue;
                const css = [];
                const put = (key, value) => css.push(key + ':' + value + ' !important');
                if (layer.x || layer.y) {
                    const x = safe.width * (layer.x || 0) / 100;
                    const y = safe.height * (layer.y || 0) / 100;
                    put('translate', x + 'px ' + y + 'px');
                }
                if (layer.width) put('width', Math.min(layer.width, safe.right - safe.left - 8) + 'px');
                if (layer.height) put('height', Math.min(layer.height, safe.bottom - safe.top - 8) + 'px');
                if (layer.size) put('font-size', layer.size + 'px');
                if (layer.font) put('font-family', fonts[layer.font]);
                if (layer.color) put('color', resolveColor(layer.color, palette));
                if (layer.rotation) put('rotate', layer.rotation + 'deg');
                if (layer.kind !== 'shape' && layer.fill && layer.fill.type !== 'solid') {
                    put('background-color', 'transparent');
                    put('background-image', cssFill(layer.fill, palette));
                } else if (layer.kind !== 'shape' && (layer.fill || layer.background)) {
                    put('background-color', layer.fill ? cssFill(layer.fill, palette) : resolveColor(layer.background, palette));
                    put('background-image', 'none');
                }
                if (layer.opacity !== undefined && layer.opacity !== 1) {
                    if (layer.motion?.effect === 'timeline') css.push('opacity:' + layer.opacity);
                    else put('filter', 'opacity(' + layer.opacity + ')');
                }
                if (layer.hidden) put('visibility', 'hidden');
                const border = layer.kind === 'shape' ? null : layer.border;
                const ring = border?.gradient && border.width !== 0;
                if (layer.order || ring) {
                    let style = this.baseOrder.get(node);
                    if (!style) {
                        const base = doc.defaultView.getComputedStyle(node);
                        style = { position: base.position, zIndex: base.zIndex };
                        this.baseOrder.set(node, style);
                    }
                    if (style.position === 'static') put('position', 'relative');
                    if (layer.order) put('z-index', (parseInt(style.zIndex, 10) || 0) + layer.order);
                }
                if (border) {
                    if (border.color) put('border-color', resolveColor(border.color, palette));
                    if (border.width !== undefined || ring) put('border-width', (border.width ?? 2) + 'px');
                    if (border.style || border.width || ring) put('border-style', ring ? 'solid' : border.style || 'solid');
                    if (border.radii) put('border-radius', border.radii.map(n => n + 'px').join(' '));
                    if (ring) {
                        const width = border.width ?? 2;
                        const color = cssFill(border.gradient, palette);
                        const stroke = selector + '::after{content:"";position:absolute;inset:-' + width +
                            'px;padding:' + width + 'px;border-radius:inherit;background:' + color +
                            ';pointer-events:none;mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude}';
                        rules.push('@supports(mask-composite:exclude){' + selector + '{border-color:transparent !important}' + stroke + '}');
                        // The supports rule is emitted after normal declarations below.
                    }
                }
                if (layer.effects && layer.kind !== 'shape') put('box-shadow', cssEffects(layer.effects, palette));
                if (layer.icon && node.matches('button,a')) {
                    const icon = getIcon(id, layer.icon);
                    icon.style.cssText = 'width:1.1em;height:1.1em;object-fit:contain;margin-inline-end:.4em;vertical-align:middle;pointer-events:none';
                    if (icon.parentNode !== node) node.prepend(icon);
                }
                if (css.length) {
                    const rule = selector + '{' + css.join(';') + '}';
                    if (ring) rules.splice(rules.length - 1, 0, rule);
                    else rules.push(rule);
                }
                // Editor/check iframes keep static geometry. The player uses the same validated effects.
                if (doc === root.document && layer.motion) rules.push(motionRule(selector, layer.motion, layer.opacity));
            }
            for (const [key, icon] of this.icons) {
                if (activeIcons.has(key)) continue;
                icon.remove();
                this.icons.delete(key);
            }
            const css = rules.join('\n');
            if (this.sheet.textContent !== css) this.sheet.textContent = css;
        }
        apply(view, layers, insets, { enforce = true, palette } = {}) {
            const defs = entries(view, layers);
            const currentSelectors = Object.keys(layers).map(id => defs[id][0]);
            const measuring = [...new Set([...this.previousSelectors, ...currentSelectors])];
            // Preserve the original HUD fade and transform transitions. Theme geometry
            // must be measured at its final position, including under reduced motion.
            this.transitions.textContent = measuring.length ?
                measuring.join(',') + '{transition-property:opacity,transform !important;animation:none !important}' : '';
            try {
                const issues = this.check(view, layers, insets, enforce, palette);
                this.previousSelectors = enforce && issues.length ? [] : currentSelectors;
                return issues;
            } finally {
                this.doc.documentElement.getBoundingClientRect();
                this.transitions.textContent = '';
            }
        }
        check(view, layers, insets, enforce, palette) {
            this.clear();
            if (!Object.keys(layers).length) return [];
            const doc = this.doc;
            const safe = bounds(doc, insets);
            const before = sample(doc, safe);
            const nodes = new Map();
            const defs = entries(view, layers);
            for (const [id, layer] of Object.entries(layers)) {
                if (layer.hidden) continue;
                const [selector] = defs[id];
                const node = selector && doc.querySelector(selector);
                if (node && visible(node)) nodes.set(id, {
                    box: rect(node),
                    clipped: Math.max(0, node.scrollHeight - node.clientHeight, node.scrollWidth - node.clientWidth),
                });
            }
            this.paint(view, layers, safe, palette);
            const after = sample(doc, safe);
            const issues = new Set();
            for (const [id, old] of nodes) {
                const [selector, label] = defs[id];
                const node = doc.querySelector(selector);
                if (overflow(rect(node), safe) > overflow(old.box, safe) + 2) {
                    issues.add(label + ' 超出屏幕安全区');
                }
                const layer = layers[id];
                if ((layer.width || layer.height || layer.size || layer.font) &&
                    Math.max(0, node.scrollHeight - node.clientHeight, node.scrollWidth - node.clientWidth) > old.clipped + 2) {
                    issues.add(label + ' 的内容超出图层边界');
                }
            }
            const decorations = Array.from(doc.querySelectorAll('[data-spirit-decoration]'), node => {
                const box = rect(node);
                const margin = motionBoxMargin(layers[node.id.replace(/^spirit-theme-/, '')]?.motion,box);
                if (!margin) return [node, box, false];
                return [node, {left:box.left-margin, top:box.top-margin, right:box.right+margin, bottom:box.bottom+margin,
                    width:box.width+2*margin, height:box.height+2*margin}, true];
            });
            for (const [node, box] of decorations) {
                if (overflow(box, safe) > 2) issues.add(node.dataset.spiritDecoration + '超出屏幕安全区');
            }
            const buttons = Array.from(before);
            for (const [i, [element, old]] of buttons.entries()) {
                const label = element.getAttribute('aria-label') || element.textContent.trim().slice(0, 24) || '操作控件';
                const current = after.get(element);
                if (current?.hits) for (const [node, box, moving] of decorations) {
                    if (intersection(box, current.box) <= 16) continue;
                    if (moving) {
                        issues.add(node.dataset.spiritDecoration + '的动画可能遮挡 ' + label);
                        continue;
                    }
                    const x = (Math.max(box.left, current.box.left) + Math.min(box.right, current.box.right)) / 2;
                    const y = (Math.max(box.top, current.box.top) + Math.min(box.bottom, current.box.bottom)) / 2;
                    const original = node.style.pointerEvents;
                    node.style.pointerEvents = 'auto';
                    try {
                        if (node.contains(doc.elementFromPoint(x, y))) issues.add(node.dataset.spiritDecoration + '遮挡 ' + label);
                    } finally { node.style.pointerEvents = original; }
                }
                if (old.hits && (!current || current.hits < Math.min(old.hits, current.available))) {
                    issues.add(label + ' 有遮挡或无法点击');
                }
                if (!current) continue;
                if (current.contrast !== null && current.contrast + .05 < Math.min(old.contrast ?? 4.5, 4.5)) {
                    issues.add(label + ' 文字与纯色背景对比不足');
                }
                const oldMin = Math.min(old.box.width, old.box.height, 44);
                if (Math.min(current.box.width, current.box.height) + 1 < oldMin) issues.add(label + ' 点击区域过小');
                if (old.hits && overflow(current.box, safe) > overflow(old.box, safe) + 2) {
                    issues.add(label + ' 超出屏幕安全区');
                }
                for (const [other, oldOther] of buttons.slice(i + 1)) {
                    const newOther = after.get(other);
                    if (newOther && current.hits && newOther.hits &&
                        intersection(current.box, newOther.box) > intersection(old.box, oldOther.box) + 16) {
                        issues.add(label + ' 与另一操作控件重叠');
                    }
                }
            }
            if (enforce && issues.size) this.clear();
            return Array.from(issues);
        }
    }

    const api = { views, fonts, entries, extraId, empty, validate, validateIcon, validateFill, cssFill,
        colorValue, resolveColor, paletteDefaults, fileLimit, Layout, visible,
        motion: Object.freeze({effects:motionEffects, validate:validateMotion, preview:motionPreview, frames:motionFramesFor}) };
    api.bezier = Object.freeze({data:bezierData});
    api.componentKeys = Object.freeze(componentKeys);
    root.SpiritUITheme = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
