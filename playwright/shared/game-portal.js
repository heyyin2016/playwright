(function () {
    const STORAGE_KEY = 'game-portal-last-record';
    const SUPABASE_URL = 'https://sxtqkgtbalcwzewqfovp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4dHFrZ3RiYWxjd3pld3Fmb3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDQzNzAsImV4cCI6MjA5MDQyMDM3MH0.hS67yc5El6RaVb4nHb607H8SWge30GOS_grXVSQbXO4';
    const GAME_OPTIONS = [
        { key: 'alien-learning', title: '外星学习实验室' },
        { key: 'emotion-weather', title: '情绪气象站' },
        { key: 'animal-family', title: '星际动物家庭' },
        { key: 'magic-market', title: '魔法市场' },
        { key: 'career-islands', title: '职业岛屿' },
        { key: 'career-experience', title: '星际探索者·兴趣宇宙大冒险' },
        { key: 'cipher-decode', title: '星际密码破译' },
        { key: 'alien-division', title: '银河探索学院·危机指挥官' }
    ];
    const GAME_SEQUENCE = [
        'emotion-weather',
        'alien-learning',
        'career-islands',
        'career-experience',
        'magic-market',
        'animal-family',
        'cipher-decode',
        'alien-division'
    ];

    let supabaseClient = null;
    let currentUser = null;
    let currentProfile = null;
    let authInitialized = false;
    const authListeners = [];

    function ensureSupabase() {
        if (supabaseClient) return supabaseClient;
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            throw new Error('Supabase SDK 尚未加载');
        }
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return supabaseClient;
    }

    async function initializeAuth() {
        if (authInitialized) return currentUser;
        const client = ensureSupabase();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        currentUser = data.session ? data.session.user : null;
        if (currentUser) {
            currentProfile = await fetchCurrentProfile(currentUser.id);
        } else {
            currentProfile = null;
        }
        authInitialized = true;

        client.auth.onAuthStateChange(async (_event, session) => {
            currentUser = session ? session.user : null;
            currentProfile = currentUser ? await fetchCurrentProfile(currentUser.id) : null;
            authListeners.forEach((listener) => listener(currentUser));
        });

        return currentUser;
    }

    function onAuthChange(listener) {
        authListeners.push(listener);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getGameTitle(gameKey) {
        const matched = GAME_OPTIONS.find((game) => game.key === gameKey);
        return matched ? matched.title : gameKey;
    }

    function getNextGamePath(gameKey) {
        const currentIndex = GAME_SEQUENCE.indexOf(gameKey);
        if (currentIndex === -1) return '../home.html';
        const nextGameKey = GAME_SEQUENCE[currentIndex + 1];
        // 根据当前游戏所在层级决定相对路径前缀
        const fromRoot = (gameKey === 'cipher-decode' || gameKey === 'alien-division');
        const prefix = fromRoot ? './' : '../';
        switch (nextGameKey) {
            case 'emotion-weather':
                return `${prefix}气象站/1情绪气象站.html`;
            case 'alien-learning':
                return `${prefix}2外星学习者/index.html`;
            case 'career-islands':
                return `${prefix}17职业岛屿/17职业岛屿.html`;
            case 'magic-market':
                return `${prefix}魔法市场/13魔法市场.html`;
            case 'animal-family':
                return `${prefix}星际动物家庭/5星际动物家庭.html`;
            case 'career-experience':
                return `${prefix}职业体验馆/7 职业体验馆.html`;
            case 'cipher-decode':
                return `${prefix}12密码破译游戏.html`;
            case 'alien-division':
                return `${prefix}13外星分工游戏.html`;
            default:
                return `${prefix}home.html`;
        }
    }

    function createNextStepMessage(gameKey) {
        const currentIndex = GAME_SEQUENCE.indexOf(gameKey);
        if (currentIndex === -1 || currentIndex === GAME_SEQUENCE.length - 1) {
            return '已完成全部游戏，即将返回起始页...';
        }
        return `当前游戏已完成，即将进入下一个游戏：${getGameTitle(GAME_SEQUENCE[currentIndex + 1])}`;
    }

    function getNextGameLabel(gameKey) {
        const currentIndex = GAME_SEQUENCE.indexOf(gameKey);
        if (currentIndex === -1 || currentIndex === GAME_SEQUENCE.length - 1) {
            return '返回起始页';
        }
        return `前往下一个游戏：${getGameTitle(GAME_SEQUENCE[currentIndex + 1])}`;
    }

    function normalizeMarkdown(text) {
        return String(text || '').trim();
    }

    function buildPreview(markdown) {
        const lines = normalizeMarkdown(markdown)
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));
        return escapeHtml((lines.slice(0, 4).join('\n') || markdown || '暂无记录').slice(0, 220));
    }

    function downloadTextFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function formatTimestamp(dateObj) {
        const date = dateObj || new Date();
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    }

    function getEmailRedirectTo() {
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            return window.location.href;
        }
        return undefined;
    }

    function normalizeUsername(rawValue) {
        return String(rawValue || '').trim().toLowerCase();
    }

    function validateUsername(rawValue) {
        const username = normalizeUsername(rawValue);
        if (!username) {
            return '请先输入账号';
        }
        if (!/^[a-z0-9_-]{3,20}$/.test(username)) {
            return '账号只支持 3-20 位英文、数字、下划线或短横线';
        }
        return '';
    }

    function buildLoginEmail(username) {
        return `${normalizeUsername(username)}@wanwu-local.auth`;
    }

    async function fetchCurrentProfile(userId) {
        if (!userId) return null;
        const client = ensureSupabase();
        const { data, error } = await client
            .from('user_profiles')
            .select('id, username, login_email')
            .eq('id', userId)
            .maybeSingle();
        if (error) {
            console.error('加载用户资料失败:', error);
            return null;
        }
        return data || null;
    }

    async function signUp(username, password) {
        const client = ensureSupabase();
        const normalizedUsername = normalizeUsername(username);
        const loginEmail = buildLoginEmail(normalizedUsername);
        const { data, error } = await client.auth.signUp({
            email: loginEmail,
            password,
            options: {
                emailRedirectTo: getEmailRedirectTo(),
                data: {
                    username: normalizedUsername
                }
            }
        });
        if (error) throw error;
        currentUser = data.session ? data.session.user : null;

        if (!data.session || !currentUser) {
            throw new Error('当前必须关闭邮箱验证确认后，账号登录模式才能正常注册。请到 Supabase Authentication 里关闭 Confirm email。');
        }

        const { error: profileError } = await client
            .from('user_profiles')
            .insert({
                id: currentUser.id,
                username: normalizedUsername,
                login_email: loginEmail
            });
        if (profileError) {
            await client.auth.signOut();
            currentUser = null;
            if (profileError.code === '23505') {
                throw new Error('这个账号名已经被使用了，请换一个');
            }
            throw profileError;
        }

        currentProfile = {
            id: data.user ? data.user.id : currentUser.id,
            username: normalizedUsername,
            login_email: loginEmail
        };
        return {
            user: currentUser,
            message: '注册并登录成功'
        };
    }

    async function signIn(username, password) {
        const client = ensureSupabase();
        const loginEmail = buildLoginEmail(username);
        const { data, error } = await client.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        currentUser = data.session ? data.session.user : null;
        currentProfile = currentUser ? await fetchCurrentProfile(currentUser.id) : null;
        return currentUser;
    }

    async function signOut() {
        const client = ensureSupabase();
        const { error } = await client.auth.signOut();
        if (error) throw error;
        currentUser = null;
        currentProfile = null;
    }

    function getDisplayAccount(user) {
        if (currentProfile && currentProfile.username) return currentProfile.username;
        if (user && user.user_metadata && user.user_metadata.username) return user.user_metadata.username;
        if (user && user.email) return user.email.replace(/@.*$/, '');
        return '已登录用户';
    }

    async function saveRecord(payload) {
        await initializeAuth();
        if (!currentUser) {
            return {
                savedToCloud: false,
                message: '当前未登录，请先在起始页或当前页面登录'
            };
        }

        const recordMarkdown = normalizeMarkdown(payload.recordMarkdown);
        const summary = normalizeMarkdown(payload.summary) || normalizeMarkdown(payload.resultType) || '已保存一条记录';
        const detailJson = payload.detailJson || {};
        const client = ensureSupabase();
        const { error } = await client.from('session_records').insert({
            user_id: currentUser.id,
            game_key: payload.gameKey,
            game_title: payload.gameTitle || getGameTitle(payload.gameKey),
            record_type: payload.recordType || 'assessment',
            result_type: payload.resultType || summary,
            summary,
            record_markdown: recordMarkdown,
            detail_json: detailJson,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            gameKey: payload.gameKey,
            gameTitle: payload.gameTitle || getGameTitle(payload.gameKey),
            summary,
            recordMarkdown,
            savedAt: new Date().toISOString()
        }));
        return {
            savedToCloud: true,
            message: '记录已保存到云端'
        };
    }

    function renderAuthCard(container, options) {
        const mount = typeof container === 'string' ? document.querySelector(container) : container;
        if (!mount) return;

        const config = options || {};
        mount.innerHTML = `
            <div class="portal-auth-card">
                <h3>${escapeHtml(config.title || '账号与云端保存')}</h3>
                <p class="portal-auth-summary" data-role="summary">正在连接云端服务...</p>
                <div class="portal-auth-form" data-role="form">
                    <input data-role="username" type="text" placeholder="输入账号（自己的英文名字+任意数字）" />
                    <input data-role="password" type="password" placeholder="输入密码（至少 6 位）" />
                    <div class="portal-auth-actions">
                        <button type="button" data-role="signup">注册</button>
                        <button type="button" data-role="signin">登录</button>
                    </div>
                </div>
                <div class="portal-auth-user hidden" data-role="user-panel">
                    <p>当前用户：<span data-role="user-email"></span></p>
                    <div class="portal-auth-actions">
                        <button type="button" data-role="signout">退出登录</button>
                    </div>
                </div>
                <p class="portal-auth-status" data-role="status"></p>
            </div>
        `;

        const summaryEl = mount.querySelector('[data-role="summary"]');
        const formEl = mount.querySelector('[data-role="form"]');
        const userPanelEl = mount.querySelector('[data-role="user-panel"]');
        const userEmailEl = mount.querySelector('[data-role="user-email"]');
        const statusEl = mount.querySelector('[data-role="status"]');
        const usernameEl = mount.querySelector('[data-role="username"]');
        const passwordEl = mount.querySelector('[data-role="password"]');

        function setStatus(message, isError) {
            statusEl.textContent = message || '';
            statusEl.style.color = isError ? '#ffb3b3' : '';
        }

        function render(user) {
            if (user) {
                summaryEl.textContent = config.loggedInText || '已连接到云端，所有游戏都可以共用这个登录状态。';
                formEl.classList.add('hidden');
                userPanelEl.classList.remove('hidden');
                userEmailEl.textContent = getDisplayAccount(user);
            } else {
                summaryEl.textContent = config.loggedOutText || '注册一次账号后，所有游戏都可以复用这个账号并保存记录。';
                formEl.classList.remove('hidden');
                userPanelEl.classList.add('hidden');
                userEmailEl.textContent = '';
            }
        }

        mount.querySelector('[data-role="signup"]').addEventListener('click', async function () {
            const username = usernameEl.value.trim();
            const password = passwordEl.value;
            const usernameError = validateUsername(username);
            if (usernameError) {
                setStatus(usernameError, true);
                return;
            }
            if (!password) {
                setStatus('请先输入账号和密码', true);
                return;
            }
            setStatus('正在注册...');
            try {
                const result = await signUp(username, password);
                render(currentUser);
                usernameEl.value = '';
                passwordEl.value = '';
                setStatus(result.message);
                if (typeof config.onAuthChange === 'function') config.onAuthChange(currentUser);
            } catch (error) {
                setStatus(`注册失败：${error.message || '请稍后重试'}`, true);
            }
        });

        mount.querySelector('[data-role="signin"]').addEventListener('click', async function () {
            const username = usernameEl.value.trim();
            const password = passwordEl.value;
            const usernameError = validateUsername(username);
            if (usernameError) {
                setStatus(usernameError, true);
                return;
            }
            if (!password) {
                setStatus('请先输入账号和密码', true);
                return;
            }
            setStatus('正在登录...');
            try {
                await signIn(username, password);
                render(currentUser);
                passwordEl.value = '';
                setStatus('登录成功');
                if (typeof config.onAuthChange === 'function') config.onAuthChange(currentUser);
            } catch (error) {
                setStatus(`登录失败：${error.message || '请稍后重试'}`, true);
            }
        });

        mount.querySelector('[data-role="signout"]').addEventListener('click', async function () {
            setStatus('正在退出...');
            try {
                await signOut();
                render(null);
                setStatus('已退出登录');
                if (typeof config.onAuthChange === 'function') config.onAuthChange(null);
            } catch (error) {
                setStatus(`退出失败：${error.message || '请稍后重试'}`, true);
            }
        });

        initializeAuth()
            .then((user) => {
                render(user);
                if (typeof config.onAuthChange === 'function') config.onAuthChange(user);
            })
            .catch((error) => {
                setStatus(`云端连接失败：${error.message || '请稍后刷新'}`, true);
            });

        onAuthChange(function (user) {
            render(user);
            if (typeof config.onAuthChange === 'function') config.onAuthChange(user);
        });
    }

    async function loadHistory(options) {
        await initializeAuth();
        if (!currentUser) return [];
        const config = options || {};
        let query = ensureSupabase()
            .from('session_records')
            .select('id, game_key, game_title, record_type, result_type, summary, record_markdown, detail_json, created_at')
            .order('created_at', { ascending: false });

        if (config.gameKey && config.gameKey !== 'all') {
            query = query.eq('game_key', config.gameKey);
        }
        if (config.days && Number(config.days) > 0) {
            const sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - Number(config.days));
            query = query.gte('created_at', sinceDate.toISOString());
        }
        const { data, error } = await query.limit(config.limit || 30);
        if (error) throw error;
        return data || [];
    }

    function renderHistoryCard(container, options) {
        const mount = typeof container === 'string' ? document.querySelector(container) : container;
        if (!mount) return;
        const config = options || {};
        const collapsedCount = Number(config.collapsedCount) > 0 ? Number(config.collapsedCount) : 0;
        let showingAll = false;

        mount.innerHTML = `
            <div class="portal-history-card">
                <div class="portal-history-header">
                    <h3>${escapeHtml(config.title || '我的历史记录')}</h3>
                    <div class="portal-history-filters">
                        <select data-role="game-filter">
                            <option value="all">全部游戏</option>
                            ${GAME_OPTIONS.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.title)}</option>`).join('')}
                        </select>
                        <select data-role="time-filter">
                            <option value="all">全部时间</option>
                            <option value="7">最近 7 天</option>
                            <option value="30">最近 30 天</option>
                            <option value="90">最近 90 天</option>
                        </select>
                    </div>
                </div>
                <p class="portal-history-status" data-role="status">登录后可以查看所有游戏的历史记录。</p>
                <div class="portal-history-list hidden" data-role="list"></div>
                <div class="portal-history-footer">
                    <button type="button" class="portal-history-toggle hidden" data-role="toggle">展开更多</button>
                    <button type="button" class="portal-history-refresh hidden" data-role="refresh">刷新历史记录</button>
                </div>
            </div>
        `;

        const statusEl = mount.querySelector('[data-role="status"]');
        const listEl = mount.querySelector('[data-role="list"]');
        const refreshEl = mount.querySelector('[data-role="refresh"]');
        const toggleEl = mount.querySelector('[data-role="toggle"]');
        const gameFilterEl = mount.querySelector('[data-role="game-filter"]');
        const timeFilterEl = mount.querySelector('[data-role="time-filter"]');

        async function refresh() {
            await initializeAuth();
            if (!currentUser) {
                statusEl.textContent = '登录后可以查看所有游戏的历史记录。';
                listEl.classList.add('hidden');
                listEl.innerHTML = '';
                refreshEl.classList.add('hidden');
                toggleEl.classList.add('hidden');
                return;
            }

            refreshEl.classList.remove('hidden');
            statusEl.textContent = '正在加载历史记录...';
            try {
                const records = await loadHistory({
                    gameKey: gameFilterEl.value,
                    days: timeFilterEl.value === 'all' ? null : Number(timeFilterEl.value),
                    limit: config.limit || 30
                });
                if (!records.length) {
                    listEl.classList.add('hidden');
                    listEl.innerHTML = '';
                    statusEl.textContent = '还没有历史记录，先完成一次测试并保存吧。';
                    toggleEl.classList.add('hidden');
                    return;
                }
                const visibleRecords = collapsedCount > 0 && !showingAll ? records.slice(0, collapsedCount) : records;
                listEl.innerHTML = visibleRecords.map((record) => `
                    <article class="portal-history-item">
                        <div class="portal-history-item-top">
                            <div>
                                <h4>${escapeHtml(record.game_title || getGameTitle(record.game_key))}</h4>
                                <p>${escapeHtml(record.summary || record.result_type || '未命名记录')}</p>
                            </div>
                            <span>${escapeHtml(new Date(record.created_at).toLocaleString('zh-CN'))}</span>
                        </div>
                        <div class="portal-history-preview">${buildPreview(record.record_markdown)}</div>
                        <div class="portal-history-actions">
                            <button type="button" data-record-id="${escapeHtml(record.id)}" data-action="toggle">展开详情</button>
                            <button type="button" data-record-id="${escapeHtml(record.id)}" data-action="download">导出记录</button>
                        </div>
                        <pre class="portal-history-detail hidden" id="portal-history-detail-${escapeHtml(record.id)}">${escapeHtml(record.record_markdown || '暂无完整记录')}</pre>
                    </article>
                `).join('');
                listEl.classList.remove('hidden');
                statusEl.textContent = `共找到 ${records.length} 条历史记录。`;
                if (collapsedCount > 0 && records.length > collapsedCount) {
                    toggleEl.classList.remove('hidden');
                    toggleEl.textContent = showingAll ? '收起历史记录' : `展开剩余 ${records.length - collapsedCount} 条`;
                } else {
                    toggleEl.classList.add('hidden');
                }
            } catch (error) {
                statusEl.textContent = `加载失败：${error.message || '请稍后重试'}`;
                toggleEl.classList.add('hidden');
            }
        }

        listEl.addEventListener('click', function (event) {
            const action = event.target.getAttribute('data-action');
            const recordId = event.target.getAttribute('data-record-id');
            if (!action || !recordId) return;
            const detailEl = document.getElementById(`portal-history-detail-${recordId}`);
            if (action === 'toggle' && detailEl) {
                detailEl.classList.toggle('hidden');
            }
            if (action === 'download' && detailEl) {
                downloadTextFile(detailEl.textContent || '', `game_record_${recordId}.md`, 'text/markdown;charset=utf-8');
            }
        });

        gameFilterEl.addEventListener('change', refresh);
        timeFilterEl.addEventListener('change', refresh);
        refreshEl.addEventListener('click', refresh);
        toggleEl.addEventListener('click', function () {
            showingAll = !showingAll;
            refresh();
        });

        initializeAuth()
            .then(refresh)
            .catch((error) => {
                statusEl.textContent = `云端连接失败：${error.message || '请稍后刷新'}`;
            });

        onAuthChange(refresh);
    }

    function renderGameStatus(container, options) {
        const mount = typeof container === 'string' ? document.querySelector(container) : container;
        if (!mount) return;
        const config = options || {};
        mount.innerHTML = `
            <div class="portal-game-status">
                <a class="portal-home-link" href="${escapeHtml(config.homeHref || '../home.html')}">返回起始页</a>
                <span data-role="status">正在检查登录状态...</span>
            </div>
        `;
        const statusEl = mount.querySelector('[data-role="status"]');

        function render(user) {
            statusEl.textContent = user
                ? `已登录：${getDisplayAccount(user)}，本页可直接保存到云端`
                : '未登录，可返回起始页先登录，或在当前页下方登录后再保存';
        }

        initializeAuth()
            .then(render)
            .catch((error) => {
                statusEl.textContent = `云端连接失败：${error.message || '请稍后刷新'}`;
            });

        onAuthChange(render);
    }

    function goToNextGame(gameKey) {
        window.location.href = getNextGamePath(gameKey);
    }

    function scheduleNextGame(gameKey, options) {
        const config = options || {};
        const delayMs = Number(config.delayMs) > 0 ? Number(config.delayMs) : 3000;
        const statusEl = config.statusTarget
            ? (typeof config.statusTarget === 'string' ? document.querySelector(config.statusTarget) : config.statusTarget)
            : null;
        const nextMessage = createNextStepMessage(gameKey);

        if (statusEl) {
            statusEl.textContent = statusEl.textContent
                ? `${statusEl.textContent} ${nextMessage}`.trim()
                : nextMessage;
        }

        window.setTimeout(function () {
            const confirmed = window.confirm('这个任务完成啦，要不要开启下一道传送门？');
            if (confirmed) {
                goToNextGame(gameKey);
            } else if (statusEl) {
                statusEl.textContent = '已取消自动跳转，你也可以点击页面按钮继续。';
            }
        }, delayMs);
    }

    window.GamePortal = {
        initializeAuth,
        onAuthChange,
        renderAuthCard,
        renderHistoryCard,
        renderGameStatus,
        scheduleNextGame,
        goToNextGame,
        getNextGameLabel,
        saveRecord,
        downloadTextFile,
        formatTimestamp,
        getCurrentUser: function () {
            return currentUser;
        },
        getCurrentProfile: function () {
            return currentProfile;
        },
        getGameTitle
    };
})();
