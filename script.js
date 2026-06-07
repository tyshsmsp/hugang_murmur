var SHEET_ID = '1HrVHWkav_i-sBEJkLbBarLTxQZI2DQOLXZAYc-D05PM'; 
var PASS_WORD = 'hugangmurmursmsp';
var OK_TAG = 'ok';
var GAS_API_URL = 'https://script.google.com/macros/s/AKfycbz-BLzgNqhlQ4YV-ZTEVuyiQZk77X2_i47hJnaYzSQnLzpw8uS8SnDpqf1X8UzGxvch/exec'; // ⚠️ 請在此處貼上您部署好的 Google Apps Script 網頁應用程式 URL ⚠️

var API_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json&tq=" + encodeURIComponent("SELECT *") + "&v=" + new Date().getTime();

var complaintsData = [];
var allSubmissionsData = []; // 用於後台管理顯示所有投稿

// 在 window.onload 裡面加入啟動指令
window.onload = function() {
    const dateOpt = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('today-date').textContent = new Date().toLocaleDateString('zh-TW', dateOpt);
    
    // 確保這裡有被執行
    startCountdown(); 
    loadSheetData();
};

function startCountdown() {
    // 立即執行一次，避免顯示載入中
    updateCountdown(); 
    // 每秒更新
    setInterval(updateCountdown, 1000); 
}

function updateCountdown() {
    const targetDate = new Date("September 1, 2026 09:00:00").getTime();
    const now = new Date().getTime();
    const gap = targetDate - now;

    const timerElement = document.getElementById('countdown-timer');
    if (!timerElement) return; // 如果找不到 ID 就跳出，不報錯

    if (gap <= 0) {
        timerElement.innerHTML = "🎒 新學期開始囉！";
        return;
    }

    const d = Math.floor(gap / (1000 * 60 * 60 * 24));
    const h = Math.floor((gap % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((gap % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((gap % (1000 * 60)) / 1000);

    timerElement.innerHTML = `${d}天 ${h}時 ${m}分 ${s}秒`;
}

// --- 資料抓取與 UI 更新 ---
async function loadSheetData() {
    try {
        const res = await fetch(API_URL);
        const text = await res.text();
        const r = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
        if (!r) throw new Error("格式錯誤");
        
        const jsonData = JSON.parse(r[1]);
        const rows = jsonData.table.rows;
        
        const parsedRows = rows.map((row, rIdx) => {
            const c = row.c.map(cell => (cell && cell.v !== null) ? String(cell.v) : '');
            // 安全修正：僅檢查 Column H (Index 7) 的審核欄位
            const isApproved = c[7] && c[7].toLowerCase().trim() === OK_TAG;

            // gviz 自動跳過標頭列，回傳純資料列
            // 試算表實際列號 = gviz 索引 + 2（+1 指標頭列，+1 因為 GAS 從 1 開始計）
            const rowNum = rIdx + 2;

            let likes = parseInt(c[8]) || 0;
            let hearts = parseInt(c[9]) || 0;

            const likedList = JSON.parse(localStorage.getItem('liked_posts') || '[]');
            const heartedList = JSON.parse(localStorage.getItem('hearted_posts') || '[]');
            const baselines = JSON.parse(localStorage.getItem('reaction_baselines') || '{}');

            // 樂觀校正：如果本地點過讚，且 Google Sheets 讀回來的數值還小於或等於點讚前的基準值，則顯示為基準值 + 1
            if (likedList.includes(rowNum)) {
                const baseline = baselines[rowNum] ? baselines[rowNum].likesBefore : 0;
                if (likes <= baseline) {
                    likes = baseline + 1;
                }
            }

            // 樂觀校正：愛心
            if (heartedList.includes(rowNum)) {
                const baseline = baselines[rowNum] ? baselines[rowNum].heartsBefore : 0;
                if (hearts <= baseline) {
                    hearts = baseline + 1;
                }
            }

            return {
                time: c[0],
                rowNum: rowNum,
                name: c[2] || '匿名',
                to: c[3] || '日常',
                msg: c[4] || '',
                tag: c[5] || '',
                isOk: isApproved,
                likes: likes,
                hearts: hearts
            };
        }).filter(item => item.msg !== "");

        allSubmissionsData = parsedRows;
        complaintsData = parsedRows.filter(item => item.isOk === true);

        refreshUI();
    } catch (err) {
        console.error("讀取失敗:", err);
    }
}

function refreshUI() {
    const wall = document.getElementById('complaints-wall');
    if(!wall) return;

    const showList = [...complaintsData].reverse();

    if (showList.length === 0) {
        wall.innerHTML = `<div style="padding:40px; text-align:center;">目前牆上還沒有通過審核的指南...</div>`;
    } else {
        wall.innerHTML = showList.map(d => {
            const isSurvival = d.tag.includes('生存') || d.msg.includes('生存') || d.tag.includes('避坑') || d.msg.includes('避坑');
            const cardStyle = isSurvival ? 'border: 2px solid var(--red); background: #fffdfd; box-shadow: 4px 4px 0px var(--red);' : '';
            const tagStyle = isSurvival ? 'background: var(--red); color: white; padding: 2px 8px; border-radius:3px;' : 'color: var(--red); font-weight:bold;';

            // 檢查本地是否已點讚/點愛心
            const likedList = JSON.parse(localStorage.getItem('liked_posts') || '[]');
            const heartedList = JSON.parse(localStorage.getItem('hearted_posts') || '[]');
            const isLiked = likedList.includes(d.rowNum);
            const isHearted = heartedList.includes(d.rowNum);

            return `
                <div class="complaint-card" style="${cardStyle}">
                    <div class="complaint-cat">To: ${d.to}</div>
                    <div class="complaint-text">${d.msg}</div>
                    <div style="margin-bottom:12px;">
                        <span style="${tagStyle} font-size:12px; display:inline-block;">${d.tag}</span>
                    </div>
                    
                    <div class="reactions-bar">
                        <button class="reaction-btn ${isLiked ? 'active' : ''}" ${isLiked ? 'disabled' : ''} onclick="handleReaction(${d.rowNum}, 'like')">
                            👍 <span class="reaction-count">${d.likes}</span>
                        </button>
                        <button class="reaction-btn ${isHearted ? 'active' : ''}" ${isHearted ? 'disabled' : ''} onclick="handleReaction(${d.rowNum}, 'heart')">
                            ❤️ <span class="reaction-count">${d.hearts}</span>
                        </button>
                    </div>

                    <div class="complaint-meta"><span>👤 ${d.name}</span><span>📅 ${formatTimestamp(d.time)}</span></div>
                </div>`;
        }).join('');
    }
    
    if(document.getElementById('home-total')) document.getElementById('home-total').textContent = complaintsData.length;
    
    const sb = document.getElementById('home-sidebar');
    if (sb && complaintsData.length > 0) {
        sb.innerHTML = [...complaintsData].reverse().slice(0, 3).map(d => `
            <div class="complaint-card" style="padding:15px; font-size:13px; border-left-width:3px; margin-bottom:12px;">
                <div style="background:var(--red); color:white; display:inline-block; padding:0 5px; font-size:10px; margin-bottom:5px;">To: ${d.to}</div>
                <p style="color:var(--ink); font-weight:500;">${d.msg.length > 30 ? d.msg.slice(0,30) + '...' : d.msg}</p>
            </div>`).join('');
    }

    // 若後台儀表板目前顯示中，同步更新它
    const dashboard = document.getElementById('admin-dashboard');
    if (dashboard && dashboard.style.display === 'block') {
        renderAdminDashboard();
    }
}

function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const target = document.getElementById('page-' + name);
    if(target) target.classList.add('active');
    
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
    } else { alert('密碼錯誤！'); }
}

// --- 新增功能：按讚/按愛心處理 ---
async function handleReaction(rowNum, type) {
    const key = type === 'like' ? 'liked_posts' : 'hearted_posts';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (list.includes(rowNum)) {
        alert("你已經點過囉！");
        return;
    }
    
    // 樂觀更新前端資料並儲存基準值
    const item = allSubmissionsData.find(d => d.rowNum === rowNum);
    if (item) {
        const baselines = JSON.parse(localStorage.getItem('reaction_baselines') || '{}');
        if (!baselines[rowNum]) {
            baselines[rowNum] = {};
        }
        if (type === 'like') {
            baselines[rowNum].likesBefore = item.likes;
            item.likes++;
        } else {
            baselines[rowNum].heartsBefore = item.hearts;
            item.hearts++;
        }
        localStorage.setItem('reaction_baselines', JSON.stringify(baselines));
    }
    
    list.push(rowNum);
    localStorage.setItem(key, JSON.stringify(list));
    refreshUI();
    
    // 呼叫 GAS 後台 API 同步
    const gasUrl = localStorage.getItem('gas_api_url') || GAS_API_URL;
    if (gasUrl) {
        try {
            await fetch(gasUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: type, rowNum: rowNum })
            });
        } catch (err) {
            console.error("傳送按讚失敗:", err);
        }
    }
}

// --- 新增功能：後台儀表板渲染與操作 ---
function renderAdminDashboard() {
    const dashboard = document.getElementById('admin-dashboard');
    if (!dashboard) return;
    
    dashboard.style.display = 'block';
    
    const storedGasUrl = localStorage.getItem('gas_api_url') || GAS_API_URL || '';
    
    let html = `
        <div class="admin-header">
            <h3 style="margin-bottom:10px;">📊 編輯台管理系統</h3>
            <p style="font-size:13px; line-height:1.5; margin-bottom:15px; color:#555;">
                在這裡您可以審核所有投稿。請部署 Google Apps Script 後將「網頁應用程式 URL」填入下方以啟用線上同步功能。
            </p>
            <div class="admin-config">
                <input type="text" id="admin-gas-url" placeholder="請貼上您的 Google Apps Script Web App URL" value="${storedGasUrl}" style="flex:1; padding: 8px;">
                <button class="forms-btn" style="margin: 0; padding: 8px 15px; font-size: 13px;" onclick="saveGasUrl()">儲存設定</button>
            </div>
        </div>
    `;
    
    if (!storedGasUrl) {
        html += `
            <div class="admin-guide">
                <h4>💡 如何啟用線上審核與按讚功能？</h4>
                <ol>
                    <li>在您的 Google 試算表點選「擴充功能」->「Apps Script」。</li>
                    <li>將專案根目錄下的 <code>gas_backend.js</code> 檔案內容覆蓋貼上並儲存。</li>
                    <li>點選右上角「部署」->「新增部署」，選取「網頁應用程式」，設定「執行身分」為「我」，「誰有權限存取」設為「所有人」。</li>
                    <li>部署完成後複製「網頁應用程式 URL」，並貼到上方輸入框中點選儲存。</li>
                </ol>
            </div>
        `;
    }
    
    const list = [...allSubmissionsData].reverse();
    if (list.length === 0) {
        html += `<div style="padding:40px; text-align:center; background:white; border:1px solid var(--aged);">目前沒有任何投稿資料。</div>`;
    } else {
        html += `
            <div class="admin-list">
                ${list.map(d => {
                    const statusText = d.isOk ? '✅ 已發布' : '⏳ 待審核';
                    const statusClass = d.isOk ? 'approved' : 'pending';
                    const actionBtn = d.isOk 
                        ? `<button class="admin-btn reject" onclick="setPostStatus(this, ${d.rowNum}, 'reject')">下架/隱藏</button>`
                        : `<button class="admin-btn approve" onclick="setPostStatus(this, ${d.rowNum}, 'approve')">核准發布</button>`;
                        
                    return `
                        <div class="admin-card">
                            <div class="admin-card-header">
                                <span class="admin-status ${statusClass}">${statusText}</span>
                                <span style="font-size:11px; color:var(--stamp);">📅 ${formatTimestamp(d.time)}</span>
                            </div>
                            <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px;">To: ${d.to} | 👤 ${d.name}</div>
                            <div class="admin-card-msg">${d.msg}</div>
                            <div style="font-size: 11px; color:var(--stamp); margin-bottom: 10px;">🏷️ 標籤：${d.tag || '無'}</div>
                            <div style="font-size: 11px; margin-bottom: 10px; font-weight:600;">👍 讚：${d.likes} | ❤️ 愛心：${d.hearts}</div>
                            <div class="admin-card-actions">
                                ${actionBtn}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    dashboard.innerHTML = html;
}

function saveGasUrl() {
    const url = document.getElementById('admin-gas-url').value.trim();
    localStorage.setItem('gas_api_url', url);
    alert('設定已儲存！');
    renderAdminDashboard();
}

async function setPostStatus(btn, rowNum, action) {
    const gasUrl = localStorage.getItem('gas_api_url') || GAS_API_URL;
    if (!gasUrl) {
        alert("請先在上方設定 Google Apps Script URL 才能變更審核狀態！");
        return;
    }
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "傳送中...";
    
    try {
        // 使用 no-cors 模式確保請求一定能送出（GAS 會執行，但瀏覽器無法讀取回應）
        await fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: action, rowNum: rowNum, pass: PASS_WORD })
        });

        // 等待 GAS 寫入完成後重新抓取資料來驗證結果
        btn.textContent = "驗證中...";
        await new Promise(r => setTimeout(r, 2000));
        await loadSheetData();

        // 確認試算表是否有變化
        const updated = allSubmissionsData.find(d => d.rowNum === rowNum);
        const succeeded = updated && (action === 'approve' ? updated.isOk === true : updated.isOk === false);
        if (succeeded) {
            alert(action === 'approve' ? "✅ 審核成功，已發布！" : "✅ 已下架該投稿！");
        } else {
            alert("⚠️ 請求已送出，但試算表尚未更新。請確認 Apps Script 部署設定是否正確（執行身分：我；存取權：所有人）。");
        }
    } catch (err) {
        console.error("更新審核狀態失敗:", err);
        alert("連線後台失敗，請確認 Apps Script 部署網址是否正確。");
    } finally {
        btn.disabled = false;
        btn.textContent = oldText;
    }
}

setInterval(loadSheetData, 30000);

// 格式化 Google Sheets 傳回的 Date(yyyy,m,d,h,min,s) 字串為易讀格式
function formatTimestamp(timeStr) {
    if (!timeStr) return '';
    const match = timeStr.match(/Date\((\d+),(\d+),(\d+),?(\d+)?,?(\d+)?,?(\d+)?\)/);
    if (match) {
        const y = match[1];
        const m = String(parseInt(match[2]) + 1).padStart(2, '0'); // JavaScript Month 是 0-based
        const d = String(parseInt(match[3])).padStart(2, '0');
        const h = match[4] ? String(parseInt(match[4])).padStart(2, '0') : '00';
        const min = match[5] ? String(parseInt(match[5])).padStart(2, '0') : '00';
        return `${y}-${m}-${d} ${h}:${min}`;
    }
    return timeStr;
}
