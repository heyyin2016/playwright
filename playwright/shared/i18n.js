// 全站中英切换运行时
// 用法：
//   <script src="../shared/i18n.js"></script>
//   <script src="./i18n-dict.js"></script>   <!-- 该页的词典；调用 I18N.registerDict({...}) -->
// 由 home.html 通过 localStorage 写入语言；其他页面只读。
(function () {
    const LS_KEY = 'app-lang';
    const STATE = {
        lang: (function () {
            try { return localStorage.getItem(LS_KEY) || 'zh'; }
            catch (e) { return 'zh'; }
        })(),
        dict: {},                    // { "中文": "English" }
        patterns: [],                // [{re: RegExp, repl: 'replacement with $1 ...'}]
        dictPlaceholder: {}          // 仅 placeholder/title/alt 等属性用的覆盖（可选）
    };

    function setLang(lang) {
        STATE.lang = lang === 'en' ? 'en' : 'zh';
        try { localStorage.setItem(LS_KEY, STATE.lang); } catch (e) { }
        // 不立刻 reload；调用方决定（home 切换后会跳转或刷新）
    }

    function getLang() { return STATE.lang; }
    function getSpeechLang() { return STATE.lang === 'en' ? 'en-US' : 'zh-CN'; }

    function isCJK(s) { return /[一-鿿]/.test(s); }

    function translateRemainingCJK(text) {
        // 在已经被模式替换过的英文字符串里，把仍然剩下的中文片段也替换掉。
        // 按字典里 key 长度从长到短贪心替换，避免短串先替换吃掉长串。
        const keys = Object.keys(STATE.dict).sort(function (a, b) { return b.length - a.length; });
        let out = text;
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (!isCJK(k)) continue;
            if (out.indexOf(k) !== -1) {
                out = out.split(k).join(STATE.dict[k]);
            }
        }
        return out;
    }

    function lookup(text) {
        if (text == null) return null;
        // 完全匹配
        if (Object.prototype.hasOwnProperty.call(STATE.dict, text)) {
            return STATE.dict[text];
        }
        // 去首尾空白
        const trimmed = String(text).replace(/^\s+|\s+$/g, '');
        if (trimmed && Object.prototype.hasOwnProperty.call(STATE.dict, trimmed)) {
            // 保留前后空白以维持原排版
            return text.replace(trimmed, STATE.dict[trimmed]);
        }
        // 模式匹配（用于带变量的模板字符串）
        for (let i = 0; i < STATE.patterns.length; i++) {
            const p = STATE.patterns[i];
            if (p.re.test(text)) {
                let replaced = text.replace(p.re, p.repl);
                // 替换完后，捕获组里可能还残留中文，递归再翻一次
                if (isCJK(replaced)) replaced = translateRemainingCJK(replaced);
                return replaced;
            }
        }
        // 没命中模式，也尝试做"残留中文"清理：
        // 如果文本里有任何字典中的中文键作为子串，就替换掉
        if (isCJK(text)) {
            const fallback = translateRemainingCJK(text);
            if (fallback !== text) return fallback;
        }
        return null;
    }

    function translateTextNode(node) {
        if (!node || node.nodeType !== 3) return;
        if (!isCJK(node.textContent)) return;
        const t = lookup(node.textContent);
        if (t != null && t !== node.textContent) node.textContent = t;
    }

    function translateAttributes(el) {
        if (!el || el.nodeType !== 1) return;
        ['placeholder', 'title', 'alt', 'aria-label', 'value'].forEach(function (attr) {
            const v = el.getAttribute && el.getAttribute(attr);
            if (v && isCJK(v)) {
                const t = lookup(v);
                if (t != null && t !== v) el.setAttribute(attr, t);
            }
        });
        // <input type="button|submit"> 的 value 也算
    }

    function applyToTree(root) {
        if (STATE.lang === 'zh' || !root) return;
        // 文本节点
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        let n;
        while ((n = walker.nextNode())) {
            // 跳过 <script> / <style> 内的文本
            const p = n.parentNode;
            if (!p) continue;
            const tag = p.nodeName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
            if (isCJK(n.textContent)) textNodes.push(n);
        }
        textNodes.forEach(translateTextNode);
        // 属性
        const elWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        let el;
        while ((el = elWalker.nextNode())) translateAttributes(el);
        // root 自己也要处理
        if (root.nodeType === 1) translateAttributes(root);
        if (root.nodeType === 3) translateTextNode(root);
    }

    function registerDict(d) {
        if (!d) return;
        Object.keys(d).forEach(function (k) { STATE.dict[k] = d[k]; });
        // 字典更新后立即重扫一遍，确保已经渲染的节点能翻
        if (STATE.lang === 'en' && document.body) applyToTree(document.body);
    }

    // 注册带变量的模板翻译。pattern 是 RegExp（或字符串），replacement 用 $1, $2... 引用捕获组。
    // 例：registerPatterns([[/^第 (.+?) 位数字存在但位置错误$/, 'Position $1: digit exists but wrong position']]);
    function registerPatterns(list) {
        if (!list) return;
        list.forEach(function (item) {
            const re = item[0] instanceof RegExp ? item[0] : new RegExp(item[0]);
            STATE.patterns.push({ re: re, repl: item[1] });
        });
        if (STATE.lang === 'en' && document.body) applyToTree(document.body);
    }

    // 让 alert / confirm 也走翻译
    const _alert = window.alert;
    const _confirm = window.confirm;
    window.alert = function (msg) {
        if (STATE.lang === 'en' && typeof msg === 'string') {
            const t = lookup(msg);
            return _alert.call(window, t != null ? t : msg);
        }
        return _alert.call(window, msg);
    };
    window.confirm = function (msg) {
        if (STATE.lang === 'en' && typeof msg === 'string') {
            const t = lookup(msg);
            return _confirm.call(window, t != null ? t : msg);
        }
        return _confirm.call(window, msg);
    };

    // 暴露给页面：当 JS 里需要写中文文案时，可以走 I18N.t('中文')
    function t(zh) {
        if (STATE.lang === 'zh') return zh;
        const r = lookup(zh);
        return r != null ? r : zh;
    }

    function startObserver() {
        if (STATE.lang === 'zh' || !document.body) return;
        const observer = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(function (node) {
                        if (node.nodeType === 1) applyToTree(node);
                        else if (node.nodeType === 3) translateTextNode(node);
                    });
                } else if (m.type === 'characterData') {
                    translateTextNode(m.target);
                } else if (m.type === 'attributes') {
                    translateAttributes(m.target);
                }
            });
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['placeholder', 'title', 'alt', 'aria-label', 'value']
        });
    }

    // 全站通用词典：home / game-portal.js（auth、历史记录、返回起始页等）
    // 这些字符串在每个游戏页都会出现，所以放在 i18n.js 内置一次注册。
    const PORTAL_DICT = {
        // home.html
        '心灵探索传送门': 'Mind Exploration Portal',
        '选择一个游戏开始': 'Pick a game to start',
        '情绪气象站': 'Emotion Weather Station',
        '选择你的情绪天气，整理能量和心愿 — 帮助你了解自己的情绪状态。': 'Choose your emotion weather and organize your energy & wishes — helps you understand your moods.',
        '外星学习实验室': 'Alien Learning Lab',
        '用文字或语音表达你的学习方式 — 帮助你了解自己喜欢怎么学习。': 'Express your learning style by text or voice — helps you understand how you learn best.',
        '职业岛屿': 'Career Islands',
        '探索职业岛并给喜欢的工作排排名 — 帮助你找到你的兴趣密码。': 'Explore career islands and rank your favorite jobs — helps you find your interest code.',
        '魔法市场': 'Magic Market',
        '每轮做决定并花魔法币 — 帮助你了解自己的紧张感和快乐感。': 'Make decisions and spend magic coins each round — helps you understand your tension and fun.',
        '星际动物家庭': 'Star Animal Family',
        '选出星动物家人并回答问题 — 帮助你了解你的家庭角色。': 'Pick star animal family members and answer questions — helps you understand your family role.',
        '星际探索者·兴趣宇宙大冒险': 'Star Explorer · Interest Universe Adventure',
        '探索不同的任务和职业方向 — 帮助你了解你的职业偏好。': 'Explore different tasks and career paths — helps you understand your career preferences.',
        '星际密码破译': 'Cosmic Cipher',
        '猜密码并记录你的推理过程 — 帮助你了解你的思考方式。': 'Crack the code and track your reasoning — helps you understand how you think.',
        '银河探索学院·危机指挥官': 'Galaxy Academy · Crisis Commander',
        '扮演指挥官做出危机决策 — 帮助你了解你的领导风格。': 'Play as a commander making crisis decisions — helps you understand your leadership style.',
        '进入游戏': 'Enter game',

        // game-portal.js auth card
        '账号与云端保存': 'Account & Cloud Save',
        '正在连接云端服务...': 'Connecting to cloud service...',
        '输入账号（自己的英文名字+任意数字）': 'Enter username (your English name + any digits)',
        '输入密码（至少 6 位）': 'Enter password (at least 6 chars)',
        '注册': 'Register',
        '登录': 'Log in',
        '退出登录': 'Log out',
        '当前用户：': 'Current user: ',
        '已连接到云端，所有游戏都可以共用这个登录状态。': 'Connected to cloud — all games share this login.',
        '注册一次账号后，所有游戏都可以复用这个账号并保存记录。': 'Once registered, all games can reuse this account and save records.',
        '正在注册...': 'Registering...',
        '正在登录...': 'Logging in...',
        '正在退出...': 'Logging out...',
        '注册并登录成功': 'Registered and logged in',
        '登录成功': 'Logged in',
        '已退出登录': 'Logged out',
        '已登录用户': 'Logged-in user',
        '请先输入账号': 'Please enter username first',
        '请先输入账号和密码': 'Please enter username and password first',
        '账号只支持 3-20 位英文、数字、下划线或短横线': 'Username supports 3-20 letters, digits, underscores or hyphens',
        '这个账号名已经被使用了，请换一个': 'This username is already taken, please choose another',
        '当前必须关闭邮箱验证确认后，账号登录模式才能正常注册。请到 Supabase Authentication 里关闭 Confirm email。': "Email confirmation must be disabled in Supabase Authentication for this signup to work.",

        // history card
        '我的历史记录': 'My History',
        '全部游戏': 'All games',
        '全部时间': 'All time',
        '最近 7 天': 'Last 7 days',
        '最近 30 天': 'Last 30 days',
        '最近 90 天': 'Last 90 days',
        '登录后可以查看所有游戏的历史记录。': 'Log in to see history across all games.',
        '正在加载历史记录...': 'Loading history...',
        '还没有历史记录，先完成一次测试并保存吧。': 'No history yet — finish a test and save it.',
        '展开详情': 'Show details',
        '收起历史记录': 'Collapse history',
        '展开更多': 'Show more',
        '导出记录': 'Export record',
        '刷新历史记录': 'Refresh history',
        '暂无完整记录': 'No full record',
        '暂无记录': 'No record',
        '未命名记录': 'Untitled record',

        // game status / next game
        '正在检查登录状态...': 'Checking login status...',
        '返回起始页': 'Back to Home',
        '已登录用户': 'Logged-in user',
        '当前未登录，请先在起始页或当前页面登录': 'Not logged in. Please log in on home or this page.',
        '未登录，可返回起始页先登录，或在当前页下方登录后再保存': 'Not logged in. Go back to home to log in, or log in on this page before saving.',
        '已完成全部游戏，即将返回起始页...': 'All games completed — returning to home...',
        '已取消自动跳转，你也可以点击页面按钮继续。': 'Auto-redirect cancelled; you can click the buttons to continue.',
        '这个任务完成啦，要不要开启下一道传送门？': 'Mission complete — open the next portal?',
        '记录已保存到云端': 'Record saved to cloud',
        '已保存一条记录': 'Record saved',

        // common ui
        '保存失败：': 'Save failed: ',
        '加载失败：': 'Load failed: ',
        '云端连接失败：': 'Cloud connection failed: ',
        '退出失败：': 'Logout failed: ',
        '注册失败：': 'Registration failed: ',
        '登录失败：': 'Login failed: ',
        '请稍后刷新': 'Please refresh later',
        '请稍后重试': 'Please retry later',
        'Supabase SDK 尚未加载': 'Supabase SDK not loaded',
    };

    const PORTAL_PATTERNS = [
        // game-portal 模板
        [/^共找到 (.+?) 条历史记录。$/, 'Found $1 records.'],
        [/^展开剩余 (.+?) 条$/, 'Show remaining $1'],
        [/^前往下一个游戏：(.+)$/, 'Next game: $1'],
        [/^当前游戏已完成，即将进入下一个游戏：(.+)$/, 'Current game finished, next: $1'],
        [/^已登录：(.+?)，本页可直接保存到云端$/, 'Logged in as $1 — this page saves directly to cloud'],
        [/^当前用户：(.+)$/, 'Current user: $1'],
        [/^已找到 (.+?) 条历史记录。$/, 'Found $1 records.'],
    ];

    function init() {
        // 自动注册全站通用词典
        Object.keys(PORTAL_DICT).forEach(function (k) {
            if (!Object.prototype.hasOwnProperty.call(STATE.dict, k)) {
                STATE.dict[k] = PORTAL_DICT[k];
            }
        });
        PORTAL_PATTERNS.forEach(function (p) {
            STATE.patterns.push({ re: p[0], repl: p[1] });
        });

        if (STATE.lang === 'en') {
            applyToTree(document.body);
        }
        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.I18N = {
        setLang: setLang,
        getLang: getLang,
        getSpeechLang: getSpeechLang,
        registerDict: registerDict,
        registerPatterns: registerPatterns,
        t: t,
        applyToTree: applyToTree
    };
})();
