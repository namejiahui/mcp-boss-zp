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

