// @ts-check

/**
 * BOSS 直聘页面操作统一分发器 (IIFE 模块模式)
 */
(() => {
    const CARD_SELECTORS = '.job-card-wrapper, .job-card-box, li.job-card-box, li.job-card-wrapper, .card-item';
    const CHAT_BTN_SELECTORS = '.op-btn-chat, .btn-startchat, [class*="startchat"], a.btn';

    /**
     * 将 BOSS 直聘混淆字体的私有 Unicode 字符 (\ue030 - \ue039) 还原为真实数字 0-9
     * @param {string} str 包含混淆字体的原始文本
     * @returns {string} 还原后的标准明文字符串
     */
    function decodeBossSalary(str) {
        if (!str) return '';
        return Array.from(str).map(char => {
            const code = char.charCodeAt(0);
            if (code >= 0xE030 && code <= 0xE039) {
                return String(code - 0xE030);
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

    /**
     * @param {'getJobs'} action 操作指令名称
     * @param {any[]} args 传递给具体操作的参数
     * @returns {Promise<string>} 序列化后的 JSON 字符串
     */
    return async (action, ...args) => {
        switch (action) {
            case 'getJobs': {
                const cards = await waitForAll(CARD_SELECTORS);

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
                    const cleanSalary = decodeBossSalary(rawSalary);
                    const cleanJobName = nameEl ? (nameEl.textContent || '').trim() : '未知职位';
                    const cleanCompanyName = companyEl ? (companyEl.textContent || '').trim() : '未知公司';

                    result.push({
                        index: idx + 1,
                        jobName: cleanJobName,
                        salary: cleanSalary,
                        companyName: cleanCompanyName,
                        companyScale: location,
                        tags: tags,
                        bossInfo: bossEl ? (bossEl.textContent || '').trim() : '',
                        alreadyChatted: alreadyChatted
                    });
                });

                return JSON.stringify(result);
            }

            default:
                throw new Error(`未知的操作指令: ${action}`);
        }
    };
})()
