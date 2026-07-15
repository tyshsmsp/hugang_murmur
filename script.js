// ============================================================
// 虎崗碎碎念 V2 — Script
// ============================================================

var OK_TAG = 'ok';

var SOURCES = [
    {
        id: 'freshman',
        title: '新生入學專題',
        subtitle: '校園日常、避坑指南、生存法則與新生提問',
        sheetId: '1HrVHWkav_i-sBEJkLbBarLTxQZI2DQOLXZAYc-D05PM',
        formUrl: 'https://forms.gle/98NDrigY8sowqvKW7',
        gasUrl: 'https://script.google.com/macros/s/AKfycbz-BLzgNqhlQ4YV-ZTEVuyiQZk77X2_i47hJnaYzSQnLzpw8uS8SnDpqf1X8UzGxvch/exec',
        badge: 'SURVIVAL GUIDE',
        enabled: true
    },
    {
        id: 'literary',
        title: '文藝專欄',
        subtitle: '散文、短詩、小說片段、書寫練習與校園文學',
        sheetId: '1ZL6lr4LK-09tevWUTOvwHeDO_iwqJBCiPhSj3ql5Bh4',
        formUrl: 'https://forms.gle/pakcKATufdwZXeQeA',
        gasUrl: 'https://script.google.com/macros/s/AKfycbxUBfOvk5si31wfytlRVsugSqjvQ_eUdGnq33qSKUHTloUcB516GB1b_MbgFK-gRGyokA/exec',
        badge: 'LITERARY PAGE',
        enabled: true
    }
];

var complaintsData = [];
var allSubmissionsData = [];
var activeTopic = 'all';
var pendingPublish = null;
var searchQuery = '';

// 後台專用暫存資料
var adminAllSubmissions = [];
var adminCommentsData = [];
var adminActiveTab = 'posts'; // 'posts' | 'comments' | 'configs'

// ============================================================
// Initialization
// ============================================================

window.onload = function () {
    const dateOpt = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('today-date').textContent = new Date().toLocaleDateString('zh-TW', dateOpt);

    applyPreferredTheme();
    startCountdown();
    // 優先從本地快取載入舊資料，實現秒開
    loadCachedData();
    populateSubmitSources();
    loadSheetData(); // 背景/非同步載入最新資料
    initBackToTop();
    handleHashLink();

    // 註冊 PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker 註冊成功', reg))
            .catch(err => console.log('Service Worker 註冊失敗', err));
    }
};

// ============================================================
// Countdown
// ============================================================

function startCountdown() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    const targetDate = new Date("September 1, 2026 09:00:00").getTime();
    const now = new Date().getTime();
    const gap = targetDate - now;
    const timerElement = document.getElementById('countdown-timer');

    if (!timerElement) return;

    if (gap <= 0) {
        timerElement.innerHTML = "新學期已開刊";
        return;
    }

    const d = Math.floor(gap / (1000 * 60 * 60 * 24));
    const h = Math.floor((gap % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((gap % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((gap % (1000 * 60)) / 1000);

    timerElement.innerHTML = `${d}天 ${h}時 ${m}分 ${s}秒`;
}

// ============================================================
// Source Helpers
// ============================================================

function getSource(id) {
    return SOURCES.find(s => s.id === id) || null;
}

function getStoredSource(sourceId) {
    const s = getSource(sourceId);
    if (!s) return null;
    return {
        id: s.id,
        title: localStorage.getItem(`${sourceId}_title`) || s.title,
        subtitle: localStorage.getItem(`${sourceId}_subtitle`) || s.subtitle,
        badge: localStorage.getItem(`${sourceId}_badge`) || s.badge,
        sheetId: localStorage.getItem(`${sourceId}_sheet_id`) || s.sheetId,
        formUrl: localStorage.getItem(`${sourceId}_form_url`) || s.formUrl,
        gasUrl: localStorage.getItem(`${sourceId}_gas_url`) || s.gasUrl,
        enabled: s.enabled
    };
}

function getEnabledSources() {
    return SOURCES.filter(source => source.enabled).map(source => getStoredSource(source.id));
}

function getApiUrl(sheetId) {
    return "https://docs.google.com/spreadsheets/d/" + sheetId + "/gviz/tq?tqx=out:json&tq=" + encodeURIComponent("SELECT *") + "&v=" + new Date().getTime();
}

// ============================================================
// Data Loading
// ============================================================

async function loadSheetData() {
    const sources = getEnabledSources();
    const results = await Promise.all(sources.map(loadSourceData));

    allSubmissionsData = results.flat();
    complaintsData = allSubmissionsData.filter(item => item.isOk === true);

    // 將資料存入快取
    try {
        localStorage.setItem('cached_submissions_data', JSON.stringify(allSubmissionsData));
    } catch (e) {
        console.error("寫入快取失敗", e);
    }

    refreshUI();
}

function loadCachedData() {
    try {
        const cached = localStorage.getItem('cached_submissions_data');
        if (cached) {
            allSubmissionsData = JSON.parse(cached);
            complaintsData = allSubmissionsData.filter(item => item.isOk === true);
            refreshUI();
        }
    } catch (e) {
        console.error("載入快取失敗", e);
    }
}

// fetch with AbortController timeout (ms)
async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(tid);
    }
}

async function loadSourceData(source) {
    if (!source.gasUrl) return [];

    try {
        const res = await fetchWithTimeout(`${source.gasUrl}?action=getApproved`, {}, 10000);
        const data = await res.json();
        
        if (data && data.error) {
            console.error(`讀取 ${source.title} 錯誤:`, data.error);
            return [];
        }

        if (!Array.isArray(data)) return [];

        return data.map((item) => {
            const postKey = `${source.id}:${item.rowNum}`;

            let likes = item.likes;
            let hearts = item.hearts;

            const likedList = JSON.parse(localStorage.getItem('liked_posts') || '[]');
            const heartedList = JSON.parse(localStorage.getItem('hearted_posts') || '[]');
            const baselines = JSON.parse(localStorage.getItem('reaction_baselines') || '{}');

            if (likedList.includes(postKey)) {
                const baseline = baselines[postKey] ? baselines[postKey].likesBefore : 0;
                if (likes <= baseline) likes = baseline + 1;
            }

            if (heartedList.includes(postKey)) {
                const baseline = baselines[postKey] ? baselines[postKey].heartsBefore : 0;
                if (hearts <= baseline) hearts = baseline + 1;
            }

            return {
                sourceId: source.id,
                sourceTitle: source.title,
                sourceBadge: source.badge,
                time: item.time,
                rowNum: item.rowNum,
                postKey: postKey,
                name: item.name || '匿名',
                to: item.to || '未指定',
                msg: item.msg || '',
                tag: item.tag || source.title,
                isOk: item.isOk,
                likes: likes,
                hearts: hearts
            };
        });
    } catch (err) {
        console.error(`讀取 ${source.title} 失敗`, err);
        return [];
    }
}

// ============================================================
// UI Refresh
// ============================================================

async function refreshUI() {
    renderTopicToolbar();
    renderComplaintsWall();
    renderHomeSummary();

    const dashboard = document.getElementById('admin-dashboard');
    if (dashboard && dashboard.style.display === 'block') {
        await loadAdminData();
        renderAdminDashboard();
    }
}

// ============================================================
// Render: Submission List (投稿頁)
// ============================================================

function populateSubmitSources() {
    const select = document.getElementById('submit-source');
    if (!select) return;
    
    select.innerHTML = getEnabledSources().map(source => 
        `<option value="${escapeHTML(source.id)}">${escapeHTML(source.title)}</option>`
    ).join('');
    
    updateFormPlaceholder();
}

function updateCharCount() {
    const msg = document.getElementById('submit-msg');
    const countSpan = document.getElementById('char-count');
    if (msg && countSpan) {
        countSpan.textContent = msg.value.length;
    }
}

function updateFormPlaceholder() {
    const select = document.getElementById('submit-source');
    const msg = document.getElementById('submit-msg');
    const tag = document.getElementById('submit-tag');
    if (!select || !msg || !tag) return;
    
    const sourceId = select.value;
    const source = getStoredSource(sourceId);
    if (!source) return;
    
    if (source.id === 'literary') {
        msg.placeholder = "請寫下散文、短詩、小說片段或書寫練習內容...";
        tag.placeholder = "自訂標籤 (例如：#散文、#詩集，留空則預設為 #文藝專欄)";
    } else {
        msg.placeholder = "校園日常、避坑指南、吐槽、告白或新生求問...";
        tag.placeholder = "自訂標籤 (例如：#求救、#告白，留空則預設為 #新生入學專題)";
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const sourceId = document.getElementById('submit-source').value;
    const to = document.getElementById('submit-to').value.trim();
    const msg = document.getElementById('submit-msg').value.trim();
    const name = document.getElementById('submit-name').value.trim() || "匿名";
    const tag = document.getElementById('submit-tag').value.trim();
    
    if (!msg) {
        showToast("投稿內容不能為空", "error");
        return;
    }
    
    const source = getStoredSource(sourceId);
    if (!source || !source.gasUrl) {
        showToast("該專欄尚未設定 Apps Script URL，無法送出投稿。", "error");
        return;
    }
    
    const submitBtn = document.getElementById('submit-btn');
    const oldBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        傳送中...
    `;
    
    try {
        const resp = await fetch(source.gasUrl, {
            method: 'POST',
            body: JSON.stringify({
                action: 'submit',
                name: name,
                to: to,
                msg: msg,
                tag: tag || source.title
            })
        });
        
        let result;
        try { result = await resp.json(); } catch (_) { result = {}; }
        
        if (result.success) {
            showToast("投稿成功！已送至後台進行審核。", "success");
            document.getElementById('submission-form').reset();
            updateCharCount();
            setTimeout(() => {
                showPage('browse');
            }, 1500);
        } else {
            showToast("投稿失敗：" + (result.error || "未知錯誤"), "error");
        }
    } catch (err) {
        console.error("投稿連線錯誤", err);
        showToast("連線發生異常，請稍後再試。", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = oldBtnHTML;
    }
}

// ============================================================
// Render: Topic Toolbar
// ============================================================

function renderTopicToolbar() {
    const toolbar = document.getElementById('topic-toolbar');
    if (!toolbar) return;

    const sources = getEnabledSources();
    const availableIds = sources.map(source => source.id);
    if (activeTopic !== 'all' && !availableIds.includes(activeTopic)) activeTopic = 'all';

    const buttons = [
        `<button class="topic-btn ${activeTopic === 'all' ? 'active' : ''}" onclick="setTopic('all')">全部 <span>${complaintsData.length}</span></button>`
    ].concat(sources.map(source => {
        const count = complaintsData.filter(d => d.sourceId === source.id).length;
        return `<button class="topic-btn ${activeTopic === source.id ? 'active' : ''}" onclick="setTopic('${escapeJs(source.id)}')">${escapeHTML(source.title)} <span>${count}</span></button>`;
    }));

    toolbar.innerHTML = buttons.join('');
}

// ============================================================
// Render: Complaints Wall
// ============================================================

function renderComplaintsWall() {
    const wall = document.getElementById('complaints-wall');
    if (!wall) return;

    let showList = [...complaintsData].sort(sortByTimeDesc);

    // Apply search filter
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        showList = showList.filter(d =>
            d.msg.toLowerCase().includes(q) ||
            d.name.toLowerCase().includes(q) ||
            d.to.toLowerCase().includes(q) ||
            d.tag.toLowerCase().includes(q)
        );
    }

    const filteredList = activeTopic === 'all'
        ? showList
        : showList.filter(d => d.sourceId === activeTopic);

    if (complaintsData.length === 0 && !searchQuery) {
        wall.innerHTML = `<div class="empty-state">目前還沒有已發布的投稿。</div>`;
        return;
    }

    if (filteredList.length === 0) {
        wall.innerHTML = searchQuery
            ? `<div class="no-results">找不到符合「${escapeHTML(searchQuery)}」的投稿。</div>`
            : `<div class="empty-state">這個專欄目前還沒有公開投稿。</div>`;
        return;
    }

    if (activeTopic === 'all' && !searchQuery) {
        wall.innerHTML = getEnabledSources().map(source => {
            const sourceItems = filteredList.filter(d => d.sourceId === source.id);
            return renderSourceSection(source, sourceItems);
        }).join('');
    } else if (activeTopic === 'all' && searchQuery) {
        wall.innerHTML = filteredList.map(renderComplaintCard).join('');
    } else {
        const source = getStoredSource(activeTopic);
        wall.innerHTML = renderSourceSection(source, filteredList);
    }

    // Trigger card entrance animations
    requestAnimationFrame(() => {
        const cards = wall.querySelectorAll('.complaint-card');
        cards.forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 60);
        });
    });
}

function renderSourceSection(source, items) {
    return `
        <section class="topic-section">
            <div class="topic-section-head">
                <h3>${escapeHTML(source.title)}</h3>
                <span>${items.length} 則</span>
            </div>
            ${items.length > 0
                ? items.map(renderComplaintCard).join('')
                : `<div class="empty-state">${escapeHTML(source.title)} 目前尚無公開投稿。</div>`
            }
        </section>
    `;
}

function renderComplaintCard(d) {
    const isFeatured = d.sourceId === 'literary';
    const cardClass = isFeatured ? 'complaint-card featured' : 'complaint-card';
    const tagClass = isFeatured ? 'complaint-tag featured' : 'complaint-tag default';

    const likedList = JSON.parse(localStorage.getItem('liked_posts') || '[]');
    const heartedList = JSON.parse(localStorage.getItem('hearted_posts') || '[]');
    const isLiked = likedList.includes(d.postKey);
    const isHearted = heartedList.includes(d.postKey);

    return `
        <div class="${cardClass}">
            <div class="complaint-cat">${escapeHTML(d.sourceTitle)} / To: ${escapeHTML(d.to)}</div>
            <div class="complaint-text">${escapeHTML(d.msg)}</div>
            <div style="margin-bottom:12px;">
                <span class="${tagClass}">${escapeHTML(d.tag)}</span>
            </div>

            <div class="reactions-bar" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 14px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="reaction-btn ${isLiked ? 'active' : ''}" ${isLiked ? 'disabled' : ''} onclick="handleReaction(event, '${escapeJs(d.sourceId)}', ${d.rowNum}, 'like')">
                        👍 <span class="reaction-count">${d.likes}</span>
                    </button>
                    <button class="reaction-btn ${isHearted ? 'active' : ''}" ${isHearted ? 'disabled' : ''} onclick="handleReaction(event, '${escapeJs(d.sourceId)}', ${d.rowNum}, 'heart')">
                        ❤️ <span class="reaction-count">${d.hearts}</span>
                    </button>
                    <button class="reaction-btn" onclick="toggleComments(event, '${escapeJs(d.sourceId)}', ${d.rowNum}, '${escapeJs(d.postKey)}')">
                        💬 留言
                    </button>
                </div>
                <button class="card-share-btn" onclick="copyShareLink(event, '${escapeJs(d.sourceId)}', ${d.rowNum}, '${escapeJs(d.postKey)}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    分享
                </button>
            </div>

            <!-- 留言展開區塊 -->
            <div class="comments-section" id="comments-${d.sourceId}-${d.rowNum}">
                <div class="comments-list" id="comments-list-${d.sourceId}-${d.rowNum}">
                    <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 8px 0;">載入留言中...</div>
                </div>
                <form class="comment-form" onsubmit="submitComment(event, '${escapeJs(d.sourceId)}', ${d.rowNum}, '${escapeJs(d.postKey)}')">
                    <div class="comment-form-row">
                        <input type="text" class="comment-input-name" id="comment-name-${d.sourceId}-${d.rowNum}" placeholder="您的暱稱 (選填)">
                        <input type="text" class="comment-input-msg" id="comment-msg-${d.sourceId}-${d.rowNum}" placeholder="寫下留言..." required>
                        <button type="submit" class="comment-submit-btn" id="comment-btn-${d.sourceId}-${d.rowNum}">送出</button>
                    </div>
                </form>
            </div>

            <div class="complaint-meta"><span>投稿人 ${escapeHTML(d.name)}</span><span>${formatTimestamp(d.time)}</span></div>
        </div>`;
}

// ============================================================
// Render: Home Summary
// ============================================================

function renderHomeSummary() {
    const total = document.getElementById('home-total');
    if (total) total.textContent = complaintsData.length;

    const sb = document.getElementById('home-sidebar');
    if (!sb) return;

    if (complaintsData.length === 0) {
        sb.innerHTML = '<div style="color:var(--text-muted); font-size:14px;">目前還沒有刊登內容。</div>';
        return;
    }

    sb.innerHTML = [...complaintsData].sort(sortByTimeDesc).slice(0, 3).map(d => `
        <div class="sidebar-card">
            <div class="sidebar-card-badge">${escapeHTML(d.sourceTitle)}</div>
            <p>${escapeHTML(d.msg.length > 40 ? d.msg.slice(0, 40) + '...' : d.msg)}</p>
        </div>`).join('');
}

// ============================================================
// Search
// ============================================================

function handleSearch(value) {
    searchQuery = value.trim();
    renderComplaintsWall();
}

// ============================================================
// Page Navigation
// ============================================================

function setTopic(topic) {
    activeTopic = topic;
    renderTopicToolbar();
    renderComplaintsWall();
}

function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));

    const target = document.getElementById('page-' + name);
    if (target) target.classList.add('active');

    const navBtn = document.getElementById('nav-' + name);
    if (navBtn) navBtn.classList.add('active');

    if (name === 'browse') refreshUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// Admin
// ============================================================

async function adminLogin() {
    const pass = document.getElementById('admin-pass').value.trim();
    if (!pass) {
        showToast('請輸入密碼', 'warning');
        return;
    }

    const btn = document.querySelector('#page-admin button');
    if (!btn) return;
    const oldHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '驗證中...';

    try {
        const source = getEnabledSources()[0];
        if (!source) {
            showToast('未找到啟用的專欄設定。', 'error');
            return;
        }

        const res = await fetch(`${source.gasUrl}?action=getAll&pass=${encodeURIComponent(pass)}`);
        const data = await res.json();

        if (data && data.error === 'Unauthorized') {
            showToast('密碼錯誤！請再次確認您的管理密碼。', 'error');
        } else if (Array.isArray(data)) {
            showToast('登入成功！', 'success');
            sessionStorage.setItem('admin_pass', pass);
            document.getElementById('admin-login-box').style.display = 'none';
            adminActiveTab = 'posts';
            await loadAdminData();
            renderAdminDashboard();
        } else {
            showToast('登入失敗，請確認 Apps Script 部署正常。', 'error');
        }
    } catch (err) {
        console.error("登入驗證錯誤", err);
        showToast('登入連線發生異常，請稍後再試。', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHTML;
    }
}

// ============================================================
// Reactions (with particle effect)
// ============================================================

async function handleReaction(event, sourceId, rowNum, type) {
    const postKey = `${sourceId}:${rowNum}`;
    const key = type === 'like' ? 'liked_posts' : 'hearted_posts';
    const list = JSON.parse(localStorage.getItem(key) || '[]');

    if (list.includes(postKey)) {
        showToast("您已經反應過這則投稿了。", "warning");
        return;
    }

    // Spawn particles
    if (event && event.currentTarget) {
        spawnParticles(event.currentTarget, type === 'like' ? '👍' : '❤️');
    }

    const item = allSubmissionsData.find(d => d.postKey === postKey);
    if (item) {
        const baselines = JSON.parse(localStorage.getItem('reaction_baselines') || '{}');
        if (!baselines[postKey]) baselines[postKey] = {};
        if (type === 'like') {
            baselines[postKey].likesBefore = item.likes;
            item.likes++;
        } else {
            baselines[postKey].heartsBefore = item.hearts;
            item.hearts++;
        }
        localStorage.setItem('reaction_baselines', JSON.stringify(baselines));
    }

    list.push(postKey);
    localStorage.setItem(key, JSON.stringify(list));
    refreshUI();

    const source = getStoredSource(sourceId);
    if (source && source.gasUrl) {
        try {
            await fetch(source.gasUrl, {
                method: 'POST',
                body: JSON.stringify({ action: type, rowNum: rowNum })
            });
        } catch (err) {
            console.error("送出反應失敗", err);
        }
    }
}

function spawnParticles(btn, emoji) {
    for (let i = 0; i < 6; i++) {
        const particle = document.createElement('span');
        particle.className = 'reaction-particle';
        particle.textContent = emoji;
        const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.5;
        const dist = 30 + Math.random() * 30;
        particle.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        particle.style.setProperty('--ty', Math.sin(angle) * dist - 20 + 'px');
        particle.style.left = '50%';
        particle.style.top = '50%';
        btn.appendChild(particle);
        setTimeout(() => particle.remove(), 700);
    }
}

// ============================================================
// Admin Dashboard
// ============================================================

async function loadAdminData() {
    const pass = sessionStorage.getItem('admin_pass');
    if (!pass) return;

    const sources = getEnabledSources();
    const results = await Promise.all(sources.map(async (source) => {
        if (!source.gasUrl) return [];
        try {
            const res = await fetch(`${source.gasUrl}?action=getAll&pass=${encodeURIComponent(pass)}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                return data.map(item => ({
                    ...item,
                    sourceId: source.id,
                    sourceTitle: source.title,
                    sourceBadge: source.badge,
                    postKey: `${source.id}:${item.rowNum}`
                }));
            }
        } catch (e) {
            console.error(`後台讀取 ${source.title} 失敗`, e);
        }
        return [];
    }));
    adminAllSubmissions = results.flat();

    const commentResults = await Promise.all(sources.map(async (source) => {
        if (!source.gasUrl) return [];
        try {
            const res = await fetch(`${source.gasUrl}?action=getPendingComments&pass=${encodeURIComponent(pass)}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                return data.map(item => ({
                    ...item,
                    sourceId: source.id,
                    sourceTitle: source.title
                }));
            }
        } catch (e) {
            console.error(`後台讀取 ${source.title} 留言失敗`, e);
        }
        return [];
    }));
    adminCommentsData = commentResults.flat();
}

function renderAdminDashboard() {
    const dashboard = document.getElementById('admin-dashboard');
    if (!dashboard) return;

    dashboard.style.display = 'block';

    let html = `
        <div class="admin-header">
            <h3>後台審稿室</h3>
            <p>這裡會同時讀取各專欄的 Google Sheets 進行管理。</p>
            <div class="admin-tabs">
                <button class="admin-tab ${adminActiveTab === 'posts' ? 'active' : ''}" onclick="setAdminTab('posts')">貼文審核</button>
                <button class="admin-tab ${adminActiveTab === 'comments' ? 'active' : ''}" onclick="setAdminTab('comments')">留言審核</button>
                <button class="admin-tab ${adminActiveTab === 'configs' ? 'active' : ''}" onclick="setAdminTab('configs')">專欄設定</button>
            </div>
        </div>
    `;

    if (adminActiveTab === 'configs') {
        html += `
            <div class="admin-source-settings">
                ${getEnabledSources().map(renderAdminSourceSettings).join('')}
            </div>
        `;
    } else if (adminActiveTab === 'posts') {
        html += getEnabledSources().map(source => {
            const list = [...adminAllSubmissions]
                .filter(d => d.sourceId === source.id)
                .sort(sortByTimeDesc);

            return `
                <section class="admin-source-section">
                    <div class="topic-section-head">
                        <h3>${escapeHTML(source.title)} - 貼文</h3>
                        <span>${list.length} 筆</span>
                    </div>
                    ${list.length === 0
                        ? `<div class="empty-state">目前沒有投稿資料。</div>`
                        : `<div class="admin-list">${list.map(renderAdminCard).join('')}</div>`
                    }
                </section>
            `;
        }).join('');
    } else if (adminActiveTab === 'comments') {
        const pendingList = adminCommentsData.filter(c => !c.isOk);
        html += `
            <div class="admin-comments-container">
                <div class="topic-section-head">
                    <h3>待審核留言</h3>
                    <span>${pendingList.length} 筆</span>
                </div>
                ${pendingList.length === 0 
                    ? '<div class="empty-state">目前沒有待審留言。</div>' 
                    : `<div class="admin-list">${pendingList.map(renderAdminCommentCard).join('')}</div>`}
            </div>
        `;
    }

    dashboard.innerHTML = html;
}

function setAdminTab(tab) {
    adminActiveTab = tab;
    renderAdminDashboard();
}

function renderAdminSourceSettings(source) {
    return `
        <div class="source-config">
            <div class="source-config-row">
                <div class="source-config-field">
                    <label for="${source.id}-title">專欄名稱</label>
                    <input type="text" id="${source.id}-title" placeholder="例如：文藝專欄" value="${escapeHTML(source.title)}">
                </div>
                <div class="source-config-field">
                    <label for="${source.id}-badge">Kicker/標籤</label>
                    <input type="text" id="${source.id}-badge" placeholder="例如：LITERARY PAGE" value="${escapeHTML(source.badge)}">
                </div>
            </div>
            <div class="source-config-row">
                <div class="source-config-field">
                    <label for="${source.id}-subtitle">專欄簡介</label>
                    <input type="text" id="${source.id}-subtitle" placeholder="專欄簡介敘述..." value="${escapeHTML(source.subtitle)}">
                </div>
            </div>
            <div class="source-config-row grid-3">
                <div class="source-config-field">
                    <label for="${source.id}-sheet-id">Google Sheets ID</label>
                    <input type="text" id="${source.id}-sheet-id" placeholder="試算表 ID" value="${escapeHTML(source.sheetId)}">
                </div>
                <div class="source-config-field">
                    <label for="${source.id}-form-url">Google Form URL</label>
                    <input type="text" id="${source.id}-form-url" placeholder="表單連結" value="${escapeHTML(source.formUrl)}">
                </div>
                <div class="source-config-field">
                    <label for="${source.id}-gas-url">Apps Script Web App URL</label>
                    <input type="text" id="${source.id}-gas-url" placeholder="GAS 網頁應用程式 URL" value="${escapeHTML(source.gasUrl)}">
                </div>
            </div>
            <div style="text-align: right; margin-top: 10px;">
                <button class="forms-btn" style="margin: 0; padding: 10px 24px; font-size: 13px;" onclick="saveSourceSettings('${escapeJs(source.id)}')">儲存設定</button>
            </div>
        </div>
    `;
}

function renderAdminCard(d) {
    const statusText = d.isOk ? '已發布' : '待審核';
    const statusClass = d.isOk ? 'approved' : 'pending';
    const actionBtn = d.isOk
        ? `<button class="admin-btn reject" onclick="setPostStatus(this, '${escapeJs(d.sourceId)}', ${d.rowNum}, 'reject')">取消發布</button>`
        : `<button class="admin-btn approve" onclick="openPublishConfirm(this, '${escapeJs(d.sourceId)}', ${d.rowNum})">發布</button>`;

    return `
        <div class="admin-card">
            <div class="admin-card-header">
                <span class="admin-status ${statusClass}">${statusText}</span>
                <span style="font-size:11px; color:var(--text-muted);">${formatTimestamp(d.time)}</span>
            </div>
            <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; color:var(--text-primary);">To: ${escapeHTML(d.to)} | 投稿人 ${escapeHTML(d.name)}</div>
            <div class="admin-card-msg">${escapeHTML(d.msg)}</div>
            <div style="font-size: 11px; color:var(--text-muted); margin-bottom: 10px;">專欄：${escapeHTML(d.sourceTitle)}｜標籤：${escapeHTML(d.tag || '未分類')}</div>
            <div style="font-size: 11px; margin-bottom: 10px; font-weight:600; color:var(--text-secondary);">👍 ${d.likes} | ❤️ ${d.hearts}</div>
            <div class="admin-card-actions">
                ${actionBtn}
            </div>
        </div>
    `;
}

function renderAdminCommentCard(c) {
    const statusText = c.isOk ? '已核准' : '待審核';
    const statusClass = c.isOk ? 'approved' : 'pending';
    const actionBtn = c.isOk
        ? `<button class="admin-btn reject" style="padding: 6px 12px; font-size:11px;" onclick="setCommentStatus(this, '${escapeJs(c.sourceId)}', ${c.rowNum}, 'rejectComment')">取消核准</button>`
        : `<button class="admin-btn approve" style="padding: 6px 12px; font-size:11px;" onclick="setCommentStatus(this, '${escapeJs(c.sourceId)}', ${c.rowNum}, 'approveComment')">核准</button>`;

    return `
        <div class="admin-comment-card">
            <div class="admin-comment-header">
                <span class="admin-status ${statusClass}">${statusText}</span>
                <span style="font-size:11px; color:var(--text-muted);">${formatTimestamp(c.time)}</span>
            </div>
            <div class="admin-comment-name">留言人：${escapeHTML(c.name)}</div>
            <div class="admin-comment-msg">${escapeHTML(c.msg)}</div>
            <div class="admin-comment-meta">
                <span>貼文 Key：<span class="admin-comment-ref">${escapeHTML(c.postKey)}</span></span>
                <span>來源：${escapeHTML(c.sourceTitle)}</span>
            </div>
            <div class="admin-comment-actions">
                ${actionBtn}
            </div>
        </div>
    `;
}

// ============================================================
// Publish Confirm Dialog
// ============================================================

function openPublishConfirm(btn, sourceId, rowNum) {
    const item = adminAllSubmissions.find(d => d.sourceId === sourceId && d.rowNum === rowNum);
    const overlay = document.getElementById('publish-confirm');
    const preview = document.getElementById('confirm-preview');

    if (!item || !overlay || !preview) return;

    pendingPublish = { btn: btn, sourceId: sourceId, rowNum: rowNum };
    preview.innerHTML = `
        <div><strong>專欄：</strong>${escapeHTML(item.sourceTitle)}</div>
        <div><strong>標籤：</strong>${escapeHTML(item.tag)}</div>
        <div><strong>To：</strong>${escapeHTML(item.to)}</div>
        <div><strong>內容：</strong>${escapeHTML(item.msg)}</div>
    `;

    overlay.classList.add('active');
    overlay.removeAttribute('aria-hidden');

    const confirmBtn = document.getElementById('confirm-publish-btn');
    if (confirmBtn) confirmBtn.focus();
}

function closePublishConfirm() {
    const overlay = document.getElementById('publish-confirm');
    if (!overlay) return;

    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');

    if (pendingPublish && pendingPublish.btn) {
        pendingPublish.btn.focus();
    }

    pendingPublish = null;
}

function confirmPublishPost() {
    if (!pendingPublish) return;
    const task = pendingPublish;
    closePublishConfirm();
    setPostStatus(task.btn, task.sourceId, task.rowNum, 'approve');
}

// ============================================================
// Save Source Settings
// ============================================================

function saveSourceSettings(sourceId) {
    const title = document.getElementById(`${sourceId}-title`).value.trim();
    const subtitle = document.getElementById(`${sourceId}-subtitle`).value.trim();
    const badge = document.getElementById(`${sourceId}-badge`).value.trim();
    const sheetId = document.getElementById(`${sourceId}-sheet-id`).value.trim();
    const formUrl = document.getElementById(`${sourceId}-form-url`).value.trim();
    const gasUrl = document.getElementById(`${sourceId}-gas-url`).value.trim();

    if (!title) {
        showToast('專欄名稱不能為空', 'error');
        return;
    }

    localStorage.setItem(`${sourceId}_title`, title);
    localStorage.setItem(`${sourceId}_subtitle`, subtitle);
    localStorage.setItem(`${sourceId}_badge`, badge);
    localStorage.setItem(`${sourceId}_sheet_id`, sheetId);
    localStorage.setItem(`${sourceId}_form_url`, formUrl);
    localStorage.setItem(`${sourceId}_gas_url`, gasUrl);

    showToast('設定已儲存', 'success');
    loadSheetData();
}

// ============================================================
// Set Post Status (Approve / Reject)
// ============================================================

async function setPostStatus(btn, sourceId, rowNum, action) {
    const source = getStoredSource(sourceId);
    const pass = sessionStorage.getItem('admin_pass');
    if (!source || !source.gasUrl || !pass) {
        showToast("授權憑證失效，請重新整理頁面登入後台。", "warning");
        return;
    }

    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "處理中...";

    let fetchError = null;
    try {
        const resp = await fetch(source.gasUrl, {
            method: 'POST',
            body: JSON.stringify({ action: action, rowNum: rowNum, pass: pass })
        });

        let result;
        try { result = await resp.json(); } catch (_) { result = {}; }

        if (result.error) {
            showToast("伺服器回傳錯誤：" + result.error, "error");
            btn.disabled = false;
            btn.textContent = oldText;
            return;
        }
    } catch (err) {
        fetchError = err;
        console.warn("fetch 拋出例外（可能是 GAS CORS 重導向，繼續驗證結果）：", err);
    }

    btn.textContent = "驗證中...";
    let succeeded = false;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        await new Promise(r => setTimeout(r, attempt === 0 ? 2000 : 3000));
        await Promise.race([
            loadSheetData(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('reload timeout')), 12000))
        ]).catch(err => console.warn('重新載入資料失敗：', err));

        // Reload admin data as well
        await loadAdminData();

        const updated = allSubmissionsData.find(d => d.sourceId === sourceId && d.rowNum === rowNum);
        succeeded = updated && (action === 'approve' ? updated.isOk === true : updated.isOk === false);
        if (succeeded) break;
        console.log(`第 ${attempt + 1} 次驗證未確認，繼續重試...`);
    }

    if (succeeded) {
        showToast(action === 'approve' ? "已發布到碎碎念牆。" : "已取消發布。", "success");
    } else {
        showToast("試算表快取延遲，後台已成功送出指令——請等待數秒後重新整理。", "info");
    }

    btn.disabled = false;
    btn.textContent = oldText;
    renderAdminDashboard();
}

// ============================================================
// Set Comment Status (Approve / Reject)
// ============================================================

async function setCommentStatus(btn, sourceId, rowNum, action) {
    const source = getStoredSource(sourceId);
    const pass = sessionStorage.getItem('admin_pass');
    if (!source || !source.gasUrl || !pass) {
        showToast("授權憑證失效，請重新登入。", "warning");
        return;
    }

    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "處理中...";

    try {
        const resp = await fetch(source.gasUrl, {
            method: 'POST',
            body: JSON.stringify({ action: action, rowNum: rowNum, pass: pass })
        });

        let result = {};
        try { result = await resp.json(); } catch (_) {}

        if (result.error) {
            showToast("後台錯誤：" + result.error, "error");
        } else if (result.success) {
            showToast(action === 'approveComment' ? "留言已核准顯示。" : "已拒絕留言並刪除。", "success");
            await loadAdminData();
            renderAdminDashboard();
        } else {
            showToast("更新狀態失敗。", "error");
        }
    } catch (err) {
        console.warn("CORS 重導向，繼續更新資料...", err);
        await new Promise(r => setTimeout(r, 2500));
        await loadAdminData();
        renderAdminDashboard();
        showToast("狀態已送出更新，正刷新資料庫...", "info");
    } finally {
        btn.disabled = false;
        btn.textContent = oldText;
    }
}

// ============================================================
// Comments Public Handler
// ============================================================

async function toggleComments(event, sourceId, rowNum, postKey) {
    if (event) event.stopPropagation();
    const section = document.getElementById(`comments-${sourceId}-${rowNum}`);
    if (!section) return;

    const isActive = section.classList.toggle('active');
    if (isActive) {
        await loadComments(sourceId, rowNum, postKey);
    }
}

async function loadComments(sourceId, rowNum, postKey) {
    const listDiv = document.getElementById(`comments-list-${sourceId}-${rowNum}`);
    if (!listDiv) return;

    const source = getStoredSource(sourceId);
    if (!source || !source.gasUrl) {
        listDiv.innerHTML = '<div style="color: var(--text-muted); font-size:12px; text-align:center;">此專欄未設定 API</div>';
        return;
    }

    try {
        const res = await fetch(`${source.gasUrl}?action=getComments&postKey=${encodeURIComponent(postKey)}`);
        const comments = await res.json();

        if (comments && comments.error) {
            listDiv.innerHTML = `<div style="color: var(--text-muted); font-size:12px; text-align:center;">${escapeHTML(comments.error)}</div>`;
            return;
        }

        if (!Array.isArray(comments) || comments.length === 0) {
            listDiv.innerHTML = '<div style="color: var(--text-muted); font-size:12px; text-align:center; padding: 12px 0;">尚無已審核留言，快來搶沙發！</div>';
            return;
        }

        listDiv.innerHTML = comments.map(c => `
            <div class="comment-item">
                <div class="comment-item-header">
                    <span class="comment-item-name">${escapeHTML(c.name)}</span>
                    <span>${formatTimestamp(c.time)}</span>
                </div>
                <div class="comment-item-body">${escapeHTML(c.msg)}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error("載入留言失敗", err);
        listDiv.innerHTML = '<div style="color: var(--text-muted); font-size:12px; text-align:center;">載入留言失敗，請稍後再試。</div>';
    }
}

async function submitComment(event, sourceId, rowNum, postKey) {
    if (event) event.preventDefault();

    const nameInput = document.getElementById(`comment-name-${sourceId}-${rowNum}`);
    const msgInput = document.getElementById(`comment-msg-${sourceId}-${rowNum}`);
    const submitBtn = document.getElementById(`comment-btn-${sourceId}-${rowNum}`);

    if (!msgInput || !msgInput.value.trim()) return;

    const name = nameInput.value.trim() || "匿名";
    const msg = msgInput.value.trim();

    const source = getStoredSource(sourceId);
    if (!source || !source.gasUrl) {
        showToast("該專欄尚未設定 API，無法送出留言。", "error");
        return;
    }

    // Cooldown check (30 seconds)
    const lastSubmitKey = 'last_comment_submit_time';
    const lastSubmit = parseInt(localStorage.getItem(lastSubmitKey) || '0');
    const now = Date.now();
    if (now - lastSubmit < 30000) {
        const waitSec = Math.ceil((30000 - (now - lastSubmit)) / 1000);
        showToast(`留言冷卻中 (請等待 ${waitSec} 秒)`, "warning");
        return;
    }

    submitBtn.disabled = true;
    const oldText = submitBtn.textContent;
    submitBtn.textContent = "...";

    try {
        const resp = await fetch(source.gasUrl, {
            method: 'POST',
            body: JSON.stringify({
                action: 'submitComment',
                postKey: postKey,
                name: name,
                msg: msg
            })
        });
        let result = {};
        try { result = await resp.json(); } catch (_) {}

        if (result.success) {
            showToast("留言成功！已送至後台進行審核，核准後將會顯示。", "success");
            msgInput.value = "";
            nameInput.value = "";
            localStorage.setItem(lastSubmitKey, String(now));
        } else {
            showToast("留言失敗：" + (result.error || "未知錯誤"), "error");
        }
    } catch (err) {
        console.error("送出留言失敗", err);
        showToast("連線異常，請稍後再試。", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = oldText;
    }
}

// ============================================================
// Share Links & Themes
// ============================================================

function copyShareLink(event, sourceId, rowNum, postKey) {
    if (event) event.stopPropagation();
    const link = `${window.location.origin}${window.location.pathname}#post-${sourceId}-${rowNum}`;

    navigator.clipboard.writeText(link).then(() => {
        showToast("已複製貼文分享連結！可直接分享給同學。", "success");
    }).catch(err => {
        console.error("複製連結失敗", err);
        showToast("複製連結失敗，請手動複製網址。", "error");
    });
}

function handleHashLink() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#post-')) return;

    const parts = hash.substring(6).split('-'); // [sourceId, rowNum]
    if (parts.length < 2) return;

    const sourceId = parts[0];
    const rowNum = parts[1];

    showPage('browse');

    setTimeout(() => {
        const card = document.querySelector(`#comments-${sourceId}-${rowNum}`)?.closest('.complaint-card');
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.remove('highlighted');
            void card.offsetWidth; // force reflow
            card.classList.add('highlighted');
        }
    }, 1200);
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function applyPreferredTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

// ============================================================
// Auto-Refresh
// ============================================================

setInterval(loadSheetData, 30000);

// ============================================================
// Back to Top
// ============================================================

function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ============================================================
// Utilities
// ============================================================

function sortByTimeDesc(a, b) {
    return parseComparableTime(b.time) - parseComparableTime(a.time);
}

function parseComparableTime(timeStr) {
    if (!timeStr) return 0;
    const match = String(timeStr).match(/Date\((\d+),(\d+),(\d+),?(\d+)?,?(\d+)?,?(\d+)?\)/);
    if (match) {
        return new Date(
            parseInt(match[1]),
            parseInt(match[2]),
            parseInt(match[3]),
            parseInt(match[4] || 0),
            parseInt(match[5] || 0),
            parseInt(match[6] || 0)
        ).getTime();
    }
    const parsed = Date.parse(timeStr);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function formatTimestamp(timeStr) {
    if (!timeStr) return '';
    const match = String(timeStr).match(/Date\((\d+),(\d+),(\d+),?(\d+)?,?(\d+)?,?(\d+)?\)/);
    if (match) {
        const y = match[1];
        const m = String(parseInt(match[2]) + 1).padStart(2, '0');
        const d = String(parseInt(match[3])).padStart(2, '0');
        const h = match[4] ? String(parseInt(match[4])).padStart(2, '0') : '00';
        const min = match[5] ? String(parseInt(match[5])).padStart(2, '0') : '00';
        return `${y}-${m}-${d} ${h}:${min}`;
    }
    return timeStr;
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeJs(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ============================================================
// Toast Notification System
// ============================================================

function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
            <span>${icon}</span>
            <span>${message}</span>
        </span>
        <button class="toast-close" aria-label="關閉提示">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('toast-fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    });

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-fade-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }
    }, duration);
}
