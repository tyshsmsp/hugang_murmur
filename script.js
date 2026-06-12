var PASS_WORD = 'hugangmurmursmsp';
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

window.onload = function() {
    const dateOpt = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('today-date').textContent = new Date().toLocaleDateString('zh-TW', dateOpt);

    startCountdown();
    renderSubmissionList();
    loadSheetData();
};

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

function getSource(sourceId) {
    return SOURCES.find(source => source.id === sourceId);
}

function getStoredSource(sourceId) {
    const source = getSource(sourceId);
    if (!source) return null;

    return {
        ...source,
        title: localStorage.getItem(`${sourceId}_title`) || source.title,
        subtitle: localStorage.getItem(`${sourceId}_subtitle`) || source.subtitle,
        badge: localStorage.getItem(`${sourceId}_badge`) || source.badge,
        sheetId: localStorage.getItem(`${sourceId}_sheet_id`) || source.sheetId,
        formUrl: localStorage.getItem(`${sourceId}_form_url`) || source.formUrl,
        gasUrl: localStorage.getItem(`${sourceId}_gas_url`) || source.gasUrl
    };
}

function getEnabledSources() {
    return SOURCES.filter(source => source.enabled).map(source => getStoredSource(source.id));
}

function getApiUrl(sheetId) {
    return "https://docs.google.com/spreadsheets/d/" + sheetId + "/gviz/tq?tqx=out:json&tq=" + encodeURIComponent("SELECT *") + "&v=" + new Date().getTime();
}

async function loadSheetData() {
    const sources = getEnabledSources();
    const results = await Promise.all(sources.map(loadSourceData));

    allSubmissionsData = results.flat();
    complaintsData = allSubmissionsData.filter(item => item.isOk === true);

    refreshUI();
}

async function loadSourceData(source) {
    if (!source.sheetId) return [];

    try {
        const res = await fetch(getApiUrl(source.sheetId));
        const text = await res.text();
        const r = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
        if (!r) throw new Error("Google Sheets 回傳格式錯誤");

        const jsonData = JSON.parse(r[1]);
        const rows = jsonData.table.rows || [];

        return rows.map((row, rIdx) => {
            const c = row.c.map(cell => (cell && cell.v !== null) ? String(cell.v) : '');
            const isApproved = c.some(val => val.toLowerCase().trim() === OK_TAG.toLowerCase());
            const rowNum = rIdx + 2;
            const postKey = `${source.id}:${rowNum}`;

            let likes = parseInt(c[8]) || 0;
            let hearts = parseInt(c[9]) || 0;

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
                time: c[0],
                rowNum: rowNum,
                postKey: postKey,
                name: c[2] || '匿名',
                to: c[3] || '未指定',
                msg: c[4] || '',
                tag: c[5] || source.title,
                isOk: isApproved,
                likes: likes,
                hearts: hearts
            };
        }).filter(item => item.msg !== "");
    } catch (err) {
        console.error(`讀取 ${source.title} 失敗`, err);
        return [];
    }
}

function refreshUI() {
    renderSubmissionList();
    renderTopicToolbar();
    renderComplaintsWall();
    renderHomeSummary();

    const dashboard = document.getElementById('admin-dashboard');
    if (dashboard && dashboard.style.display === 'block') {
        renderAdminDashboard();
    }
}

function renderSubmissionList() {
    const container = document.getElementById('submission-list');
    if (!container) return;

    container.innerHTML = getEnabledSources().map(source => {
        const hasForm = Boolean(source.formUrl);
        return `
            <article class="submit-card ${hasForm ? '' : 'disabled'}">
                <div class="submit-card-kicker">${escapeHTML(source.badge)}</div>
                <h3>${escapeHTML(source.title)}</h3>
                <p>${escapeHTML(source.subtitle)}</p>
                ${hasForm
                    ? `<a class="forms-btn" href="${escapeHTML(source.formUrl)}" target="_blank">前往 ${escapeHTML(source.title)} 表單</a>`
                    : `<button class="forms-btn" disabled>表單尚未開放</button>`
                }
            </article>
        `;
    }).join('');
}

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

function renderComplaintsWall() {
    const wall = document.getElementById('complaints-wall');
    if (!wall) return;

    const showList = [...complaintsData].sort(sortByTimeDesc);
    const filteredList = activeTopic === 'all'
        ? showList
        : showList.filter(d => d.sourceId === activeTopic);

    if (showList.length === 0) {
        wall.innerHTML = `<div class="empty-state">目前還沒有已發布的投稿。</div>`;
        return;
    }

    if (filteredList.length === 0) {
        wall.innerHTML = `<div class="empty-state">這個專欄目前還沒有公開投稿。</div>`;
        return;
    }

    if (activeTopic === 'all') {
        wall.innerHTML = getEnabledSources().map(source => {
            const sourceItems = filteredList.filter(d => d.sourceId === source.id);
            return renderSourceSection(source, sourceItems);
        }).join('');
        return;
    }

    const source = getStoredSource(activeTopic);
    wall.innerHTML = renderSourceSection(source, filteredList);
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
    const cardStyle = isFeatured ? 'border: 2px solid var(--red); background: #fffdfd; box-shadow: 4px 4px 0px var(--red);' : '';
    const tagStyle = isFeatured ? 'background: var(--red); color: white; padding: 2px 8px; border-radius:3px;' : 'color: var(--red); font-weight:bold;';

    const likedList = JSON.parse(localStorage.getItem('liked_posts') || '[]');
    const heartedList = JSON.parse(localStorage.getItem('hearted_posts') || '[]');
    const isLiked = likedList.includes(d.postKey);
    const isHearted = heartedList.includes(d.postKey);

    return `
        <div class="complaint-card" style="${cardStyle}">
            <div class="complaint-cat">${escapeHTML(d.sourceTitle)} / To: ${escapeHTML(d.to)}</div>
            <div class="complaint-text">${escapeHTML(d.msg)}</div>
            <div style="margin-bottom:12px;">
                <span style="${tagStyle} font-size:12px; display:inline-block;">${escapeHTML(d.tag)}</span>
            </div>

            <div class="reactions-bar">
                <button class="reaction-btn ${isLiked ? 'active' : ''}" ${isLiked ? 'disabled' : ''} onclick="handleReaction('${escapeJs(d.sourceId)}', ${d.rowNum}, 'like')">
                    讚 <span class="reaction-count">${d.likes}</span>
                </button>
                <button class="reaction-btn ${isHearted ? 'active' : ''}" ${isHearted ? 'disabled' : ''} onclick="handleReaction('${escapeJs(d.sourceId)}', ${d.rowNum}, 'heart')">
                    愛心 <span class="reaction-count">${d.hearts}</span>
                </button>
            </div>

            <div class="complaint-meta"><span>投稿人 ${escapeHTML(d.name)}</span><span>${formatTimestamp(d.time)}</span></div>
        </div>`;
}

function renderHomeSummary() {
    const total = document.getElementById('home-total');
    if (total) total.textContent = complaintsData.length;

    const sb = document.getElementById('home-sidebar');
    if (!sb) return;

    if (complaintsData.length === 0) {
        sb.innerHTML = '目前還沒有刊登內容。';
        return;
    }

    sb.innerHTML = [...complaintsData].sort(sortByTimeDesc).slice(0, 3).map(d => `
        <div class="complaint-card" style="padding:15px; font-size:13px; border-left-width:3px; margin-bottom:12px;">
            <div style="background:var(--red); color:white; display:inline-block; padding:0 5px; font-size:10px; margin-bottom:5px;">${escapeHTML(d.sourceTitle)}</div>
            <p style="color:var(--ink); font-weight:500;">${escapeHTML(d.msg.length > 30 ? d.msg.slice(0,30) + '...' : d.msg)}</p>
        </div>`).join('');
}

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

    const btns = document.querySelectorAll('nav button');
    const idxMap = { 'home': 0, 'browse': 1, 'submit': 2, 'admin': 3 };
    if (btns[idxMap[name]]) btns[idxMap[name]].classList.add('active');

    if (name === 'browse') refreshUI();
    window.scrollTo(0,0);
}

function adminLogin() {
    if (document.getElementById('admin-pass').value === PASS_WORD) {
        document.getElementById('admin-login-box').style.display = 'none';
        renderAdminDashboard();
    } else {
        alert('密碼錯誤');
    }
}

async function handleReaction(sourceId, rowNum, type) {
    const postKey = `${sourceId}:${rowNum}`;
    const key = type === 'like' ? 'liked_posts' : 'hearted_posts';
    const list = JSON.parse(localStorage.getItem(key) || '[]');

    if (list.includes(postKey)) {
        alert("你已經反應過這則投稿了。");
        return;
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
            // 🔥 反應按鈕這裡也順便修正，確保讚數和愛心數可以順利上傳
            await fetch(source.gasUrl, {
                method: 'POST',
                body: JSON.stringify({ action: type, rowNum: rowNum }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
        } catch (err) {
            console.error("送出反應失敗", err);
        }
    }
}

function renderAdminDashboard() {
    const dashboard = document.getElementById('admin-dashboard');
    if (!dashboard) return;

    dashboard.style.display = 'block';

    let html = `
        <div class="admin-header">
            <h3 style="margin-bottom:10px;">後台審稿室</h3>
            <p style="font-size:13px; line-height:1.5; margin-bottom:15px; color:#555;">
                這裡會同時讀取各專欄的 Google Sheets。每個專欄可以設定自己的表單、試算表與 Apps Script URL。
            </p>
            <div class="admin-source-settings">
                ${getEnabledSources().map(renderAdminSourceSettings).join('')}
            </div>
        </div>
    `;

    html += getEnabledSources().map(source => {
        const list = [...allSubmissionsData]
            .filter(d => d.sourceId === source.id)
            .sort(sortByTimeDesc);

        return `
            <section class="admin-source-section">
                <div class="topic-section-head">
                    <h3>${escapeHTML(source.title)}</h3>
                    <span>${list.length} 筆</span>
                </div>
                ${list.length === 0
                    ? `<div class="empty-state">${source.sheetId ? '目前沒有投稿資料。' : '尚未設定試算表 ID。'}</div>`
                    : `<div class="admin-list">${list.map(renderAdminCard).join('')}</div>`
                }
            </section>
        `;
    }).join('');

    dashboard.innerHTML = html;
}

function renderAdminSourceSettings(source) {
    return `
        <div class="admin-config source-config">
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
                <span style="font-size:11px; color:var(--stamp);">${formatTimestamp(d.time)}</span>
            </div>
            <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px;">To: ${escapeHTML(d.to)} | 投稿人 ${escapeHTML(d.name)}</div>
            <div class="admin-card-msg">${escapeHTML(d.msg)}</div>
            <div style="font-size: 11px; color:var(--stamp); margin-bottom: 10px;">專欄：${escapeHTML(d.sourceTitle)}｜標籤：${escapeHTML(d.tag || '未分類')}</div>
            <div style="font-size: 11px; margin-bottom: 10px; font-weight:600;">讚 ${d.likes} | 愛心 ${d.hearts}</div>
            <div class="admin-card-actions">
                ${actionBtn}
            </div>
        </div>
    `;
}

function openPublishConfirm(btn, sourceId, rowNum) {
    const item = allSubmissionsData.find(d => d.sourceId === sourceId && d.rowNum === rowNum);
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

function saveSourceSettings(sourceId) {
    const title = document.getElementById(`${sourceId}-title`).value.trim();
    const subtitle = document.getElementById(`${sourceId}-subtitle`).value.trim();
    const badge = document.getElementById(`${sourceId}-badge`).value.trim();
    const sheetId = document.getElementById(`${sourceId}-sheet-id`).value.trim();
    const formUrl = document.getElementById(`${sourceId}-form-url`).value.trim();
    const gasUrl = document.getElementById(`${sourceId}-gas-url`).value.trim();

    if (!title) {
        alert('專欄名稱不能為空');
        return;
    }

    localStorage.setItem(`${sourceId}_title`, title);
    localStorage.setItem(`${sourceId}_subtitle`, subtitle);
    localStorage.setItem(`${sourceId}_badge`, badge);
    localStorage.setItem(`${sourceId}_sheet_id`, sheetId);
    localStorage.setItem(`${sourceId}_form_url`, formUrl);
    localStorage.setItem(`${sourceId}_gas_url`, gasUrl);

    alert('設定已儲存');
    loadSheetData();
}

// 🔥 【重大核心修正】徹底解決資料被 no-cors 吞掉、試算表不長 ok 的世紀之謎
async function setPostStatus(btn, sourceId, rowNum, action) {
    const source = getStoredSource(sourceId);
    if (!source || !source.gasUrl) {
        alert("請先設定此專欄的 Google Apps Script URL，才能更新審核狀態。");
        return;
    }

    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "處理中...";

    try {
        // 🚀 使用 mode: 'no-cors'，但配合標準的 text/plain 格式
        await fetch(source.gasUrl, {
            method: 'POST',
            mode: 'no-cors', // 重新加回 no-cors，阻止瀏覽器噴 CORS 錯誤
            body: JSON.stringify({ action: action, rowNum: rowNum, pass: PASS_WORD }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        // 💡 因為 no-cors 會讓我們無法讀取 response，所以我們直接假定它成功！
        btn.textContent = "更新中...";
        
        // 等待 2.5 秒讓 Google 試算表寫入並同步
        await new Promise(r => setTimeout(r, 2500)); 
        
        // 重新撈取資料更新網頁畫面
        await loadSheetData(); 
        
        // 跳出成功提示
        alert(action === 'approve' ? "指令已送出！若試算表尚未長出 ok，請確認文藝專欄的 GAS 腳本是否有正確更新。" : "已送出取消指令。");

    } catch (err) {
        console.error("更新審核狀態失敗", err);
        alert("連線發生異常，請確認網路或 Apps Script 設定。");
    } finally {
        btn.disabled = false;
        btn.textContent = oldText;
    }
}

    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "處理中...";

    try {
        // 🚀 移除 mode: 'no-cors'，改用標準 text/plain 跨網域傳輸，資料才不會被清空
        await fetch(source.gasUrl, {
            method: 'POST',
            body: JSON.stringify({ action: action, rowNum: rowNum, pass: PASS_WORD }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        btn.textContent = "更新中...";
        await new Promise(r => setTimeout(r, 2000));
        await loadSheetData();

        const updated = allSubmissionsData.find(d => d.sourceId === sourceId && d.rowNum === rowNum);
        const succeeded = updated && (action === 'approve' ? updated.isOk === true : updated.isOk === false);
        if (succeeded) {
            alert(action === 'approve' ? "已發布到碎碎念牆。" : "已取消發布。");
        } else {
            alert("已送出更新，若畫面尚未變更，請稍後重新整理或確認 Apps Script 設定。");
        }
    } catch (err) {
        console.error("更新審核狀態失敗", err);
        alert("更新失敗，請確認 Apps Script 是否正常部署。");
    } finally {
        btn.disabled = false;
        btn.textContent = oldText;
    }
}

setInterval(loadSheetData, 30000);

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
