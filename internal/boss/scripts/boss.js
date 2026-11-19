// @ts-check

/**
 * BOSS 直聘页面操作统一分发器
 * @param {'getJobs' | 'getCardElement' | 'waitForChatButton'} action 操作指令名称
 * @param {any[]} args 传递给具体操作的参数
 * @returns {Promise<any>}
 */
async (action, ...args) => {
    const CARD_SELECTORS = '.job-card-wrapper, .job-card-box, li.job-card-box, li.job-card-wrapper, .card-item';
    const CHAT_BTN_SELECTORS = '.op-btn-chat, .btn-startchat, [class*="startchat"], a.btn';

    /**
     * BOSS 直聘用自定义 @font-face 混淆薪资数字：文本层是私有区（PUA）字符，
     * 渲染层由字体把 PUA 码点画成数字字形，且映射表会不定期轮换
     * （静态假设 \ue030-\ue039 → 0-9 已实测整体偏移失效）。
     * 因此改为运行时自校准：用 canvas 把 PUA 字符与参考数字 0-9 按同一字体
     * 渲染成位图，按像素 IoU 匹配出映射表，并在 window 上缓存供本页面复用。
     */
    const STATIC_DIGIT_BASE = 0xE030; // 校准失败时的静态兜底（旧行为，可能因字体轮换失效）

    /**
     * 收集字符串中出现的全部 PUA（私有区）字符
     * @param {string} str
     * @returns {string[]}
     */
    function collectPuaChars(str) {
        return Array.from(str).filter(ch => {
            const code = ch.codePointAt(0) || 0;
            return code >= 0xE000 && code <= 0xF8FF;
        });
    }

    /**
     * 用指定 font 把字符渲染为归一化（等比缩放、居中至 32x40）的二值位图
     * @param {string} char
     * @param {string} font 合法 canvas font 值（含字号，如 "64px xxx"）
     * @returns {{ bits: Uint8Array } | null} 字体不含该字符时返回 null
     */
    function renderGlyphBitmap(char, font) {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.font = font;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#000';
        ctx.fillText(char, 16, 72);

        const W = canvas.width, H = canvas.height;
        const img = ctx.getImageData(0, 0, W, H).data;
        let minX = W, minY = H, maxX = -1, maxY = -1;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (img[(y * W + x) * 4 + 3] > 64) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < 0) return null;

        const cols = 32, rows = 40;
        const scale = Math.min(cols / (maxX - minX + 1), rows / (maxY - minY + 1));
        const tw = Math.max(1, Math.round((maxX - minX + 1) * scale));
        const th = Math.max(1, Math.round((maxY - minY + 1) * scale));
        const offX = Math.floor((cols - tw) / 2);
        const offY = Math.floor((rows - th) / 2);

        const bits = new Uint8Array(cols * rows);
        for (let y = 0; y < th; y++) {
            const sy = Math.min(H - 1, minY + Math.round((y + 0.5) / scale - 0.5));
            for (let x = 0; x < tw; x++) {
                const sx = Math.min(W - 1, minX + Math.round((x + 0.5) / scale - 0.5));
                if (img[(sy * W + sx) * 4 + 3] > 64) bits[(y + offY) * cols + x + offX] = 1;
            }
        }
        return { bits };
    }

    /**
     * 两个位图的 IoU（交并比）
     * @param {{bits: Uint8Array}} a
     * @param {{bits: Uint8Array}} b
     * @returns {number}
     */
    function bitmapIou(a, b) {
        let inter = 0, union = 0;
        for (let i = 0; i < a.bits.length; i++) {
            const x = a.bits[i], y = b.bits[i];
            if (x || y) union++;
            if (x && y) inter++;
        }
        return union === 0 ? 0 : inter / union;
    }

    /**
     * 用单一字体做一轮校准：每个 PUA 字符与 0-9 参考位图比对，
     * IoU 最高且与次高拉开差距的才采信（避免 1/7、3/8 形近误判），
     * 并施加单射约束（同一数字只保留 IoU 最高的字符）
     * @param {string[]} puaChars
     * @param {string} font
     * @returns {Record<string, string>} 仅含可信映射的子集
     */
    function calibrateWithFont(puaChars, font) {
        const refs = [];
        for (let d = 0; d <= 9; d++) {
            const bm = renderGlyphBitmap(String(d), font);
            if (!bm) return {};
            refs.push(bm);
        }
        /** @type {Record<string, { digit: string, iou: number }>} */
        const scored = {};
        for (const ch of puaChars) {
            const bm = renderGlyphBitmap(ch, font);
            if (!bm) continue;
            let best = -1, second = -1, bestD = -1;
            for (let d = 0; d <= 9; d++) {
                const iou = bitmapIou(bm, refs[d]);
                if (iou > best) { second = best; best = iou; bestD = d; }
                else if (iou > second) { second = iou; }
            }
            if (best >= 0.55 && best - second >= 0.08) scored[ch] = { digit: String(bestD), iou: best };
        }
        const map = {};
        const usedBy = {};
        for (const ch of Object.keys(scored)) {
            const s = scored[ch];
            const prev = usedBy[s.digit];
            if (prev === undefined) { usedBy[s.digit] = ch; map[ch] = s.digit; }
            else if (s.iou > scored[prev].iou) { delete map[prev]; usedBy[s.digit] = ch; map[ch] = s.digit; }
        }
        return map;
    }

    /**
     * 获取（或构建并缓存）PUA→数字 映射表；依次尝试薪资元素字体、系统字体。
     * 只有覆盖全部 PUA 字符的完整映射才返回，否则返回 null 走静态兜底
     * @param {string[]} puaChars
     * @param {Element | null} styleEl 提供字体的元素（第一个薪资元素）
     * @returns {Record<string, string> | null}
     */
    function getDigitMap(puaChars, styleEl) {
        /** @type {any} */ const w = window;
        if (w.__bossDigitMap && puaChars.every(ch => w.__bossDigitMap[ch] !== undefined)) {
            return w.__bossDigitMap;
        }
        const fontFamily = styleEl ? getComputedStyle(styleEl).fontFamily : '';
        const candidates = fontFamily ? ['64px ' + fontFamily, '64px sans-serif'] : ['64px sans-serif'];
        for (const font of candidates) {
            const map = calibrateWithFont(puaChars, font);
            if (puaChars.length > 0 && puaChars.every(ch => map[ch] !== undefined)) {
                w.__bossDigitMap = map;
                return map;
            }
        }
        return null;
    }

    /**
     * 将 BOSS 混淆字体的薪资文本还原为真实数字：
     * 优先用 canvas 自校准映射；校准失败退回静态表；静态表覆盖不到的 PUA 保留原字符
     * @param {string} str 原始文本
     * @param {Record<string, string> | null} digitMap 自校准映射表
     * @returns {string}
     */
    function decodeBossSalary(str, digitMap) {
        if (!str) return '';
        return Array.from(str).map(char => {
            const code = char.codePointAt(0) || 0;
            if (code >= 0xE000 && code <= 0xF8FF) {
                if (digitMap && digitMap[char] !== undefined) return digitMap[char];
                if (code >= STATIC_DIGIT_BASE && code <= STATIC_DIGIT_BASE + 9) {
                    return String(code - STATIC_DIGIT_BASE);
                }
                return char;
            }
            return char;
        }).join('');
    }

    /**
     * 原生 MutationObserver 事件驱动等待元素列表挂载
     * @param {string} sel CSS 选择器
     * @param {number} [timeout=5000] 超时毫秒数
     * @returns {Promise<HTMLElement[]>}
     */
    async function waitForAll(sel, timeout = 5000) {
        /** @returns {HTMLElement[]} */
        const query = () => Array.from(document.querySelectorAll(sel));
        const existing = query();
        if (existing.length > 0) return existing;

        return new Promise(resolve => {
            const timer = setTimeout(() => {
                observer.disconnect();
                resolve(query());
            }, timeout);

            const observer = new MutationObserver(() => {
                const list = query();
                if (list.length > 0) {
                    clearTimeout(timer);
                    observer.disconnect();
                    resolve(list);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    switch (action) {
        case 'getJobs': {
            const cards = await waitForAll(CARD_SELECTORS);

            // 混淆字体自校准：收集本页薪资文本中的全部 PUA 字符，构建 PUA→数字 映射表
            const salaryEls = cards
                .map(card => card.querySelector('.job-salary, .salary'))
                .filter(Boolean);
            const puaChars = [...new Set(
                salaryEls.flatMap(el => collectPuaChars((el.textContent || '').trim()))
            )];
            const digitMap = puaChars.length > 0
                ? getDigitMap(puaChars, salaryEls[0] || null)
                : null;

            /** @type {import('./types').VisibleJob[]} */
            const result = [];

            cards.forEach((card, idx) => {
                const nameEl = card.querySelector('.job-name');
                const salaryEl = card.querySelector('.job-salary, .salary');
                if (!nameEl && !salaryEl) return;

                const companyEl = card.querySelector('.boss-name, .company-name, .brand-name');
                const bossEl = card.querySelector('.boss-info, .boss-title');
                const btnEl = card.querySelector(CHAT_BTN_SELECTORS);

                const tagEls = card.querySelectorAll('.tag-list li, .job-labels span');
                const tags = Array.from(tagEls).map(el => (el.textContent || '').trim()).filter(Boolean);

                const locEl = card.querySelector('.company-location');
                const location = locEl ? (locEl.textContent || '').trim() : '';

                const btnText = btnEl ? (btnEl.textContent || '').trim() : '';
                const alreadyChatted = btnText.includes('继续') || btnText.includes('已沟通') || btnText.includes('聊过');

                const rawSalary = salaryEl ? (salaryEl.textContent || '').trim() : '薪资面议';
                const cleanSalary = decodeBossSalary(rawSalary, digitMap);
                const cleanJobName = nameEl ? (nameEl.textContent || '').trim() : '未知职位';
                const cleanCompanyName = companyEl ? (companyEl.textContent || '').trim() : '未知公司';

                const cardLink = card.querySelector('a[href*="/job_detail/"]');
                const cardHref = cardLink ? cardLink.getAttribute('href') || '' : '';
                const matchJobId = cardHref.match(/\/job_detail\/([a-zA-Z0-9~_-]+)\.html/);
                const jobId = matchJobId ? matchJobId[1] : '';

                result.push({
                    index: idx + 1,
                    jobId: jobId,
                    jobName: cleanJobName,
                    salary: cleanSalary,
                    companyName: cleanCompanyName,
                    companyScale: location,
                    experience: tags.length > 0 ? tags[0] : '',
                    degree: tags.length > 1 ? tags[1] : '',
                    location: location,
                    tags: tags,
                    bossInfo: bossEl ? (bossEl.textContent || '').trim() : '',
                    alreadyChatted: alreadyChatted
                });
            });

            return JSON.stringify(result);
        }

        case 'getCardElement': {
            const targetIndex = Number(args[0]);
            if (!Number.isInteger(targetIndex) || targetIndex <= 0) {
                throw new Error(`非法的职位卡片序号: ${args[0]}，卡片序号必须是从 1 开始的正整数`);
            }
            const cards = document.querySelectorAll(CARD_SELECTORS);
            return cards[targetIndex - 1] || null;
        }

        case 'waitForChatButton': {
            const targetJobId = String(args[0] || '').trim();
            const timeout = Number(args[1]) || 8000;

            /**
             * 尝试从右侧详情区提取目标职位的沟通按钮
             * @returns {HTMLElement | null}
             */
            const queryTargetChatBtn = () => {
                const detailBox = document.querySelector('.job-detail-box');
                if (!detailBox) return null;

                // 若还在 loading 骨架屏状态，说明网络请求未完成，继续等待
                if (detailBox.querySelector('.job-detail-loading, .load_placeholder')) {
                    return null;
                }

                // 异步渲染完成后，核对 targetJobId 确保对齐
                if (targetJobId && !detailBox.querySelector(`[href*="${targetJobId}"]`)) {
                    return null;
                }

                // 从详情区查找唯一的【立即沟通】主按钮
                const buttons = Array.from(detailBox.querySelectorAll('a, button'));
                return buttons.find(el => {
                    return (el.textContent || '').trim() === '立即沟通' &&
                        el.offsetWidth > 0 &&
                        el.offsetHeight > 0 &&
                        el.isConnected;
                }) || null;
            };

            return new Promise(resolve => {
                const immediate = queryTargetChatBtn();
                if (immediate) {
                    resolve(immediate);
                    return;
                }

                let timer;
                const observer = new MutationObserver(() => {
                    const btn = queryTargetChatBtn();
                    if (btn) {
                        clearTimeout(timer);
                        observer.disconnect();
                        resolve(btn);
                    }
                });

                // 监听 .job-detail-container 或 .job-detail-box 的子树异步变动
                const targetNode = document.querySelector('.job-detail-container, .job-detail-box') || document.body;
                observer.observe(targetNode, { childList: true, subtree: true });

                timer = setTimeout(() => {
                    observer.disconnect();
                    // 超时兜底获取详情区内存在的沟通按钮
                    resolve(queryTargetChatBtn());
                }, timeout);
            });
        }

        default:
            throw new Error(`未知的操作指令: ${action}`);
    }
}

