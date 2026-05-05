var SHEET_ID = '1HrVHWkav_i-sBEJkLbBarLTxQZI2DQOLXZAYc-D05PM'; 
var PASS_WORD = 'taoyuan2025';
var OK_TAG = 'ok';

var API_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json&tq=" + encodeURIComponent("SELECT *") + "&v=" + new Date().getTime();

var complaintsData = [];

window.onload = function() {
    const dateOpt = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('today-date').textContent = new Date().toLocaleDateString('zh-TW', dateOpt);
    
    // 啟動倒數計時
    updateCountdown();
    setInterval(updateCountdown, 1000);
    
    loadSheetData();
};

// --- 畢業倒數計時功能 ---
function updateCountdown() {
    // 設定畢業日期：2026年6月1日 早上9點
    const targetDate = new Date("June 1, 2026 09:00:00").getTime();
    const now = new Date().getTime();
    const gap = targetDate - now;

    const timerElement = document.getElementById('countdown-timer');
    if (!timerElement) return;

    if (gap <= 0) {
        timerElement.innerHTML = "🎓 畢業快樂！";
        return;
    }

    const second = 1000;
    const minute = second * 60;
    const hour = minute * 60;
    const day = hour * 24;

    const d = Math.floor(gap / day);
    const h = Math.floor((gap % day) / hour);
    const m = Math.floor((gap % hour) / minute);
    const s = Math.floor((gap % minute) / second);

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
        
        complaintsData = rows.map(row => {
            const c = row.c.map(cell => (cell && cell.v !== null) ? String(cell.v) : '');
            const isApproved = c.some(v => v.toLowerCase().trim() === OK_TAG);

            return {
                time: c[0],
                name: c[2] || '匿名',
                to: c[3] || '日常',
                msg: c[4] || '',
                tag: c[5] || '',
                isOk: isApproved
            };
        }).filter(item => item.msg !== "" && item.isOk === true);

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
        wall.innerHTML = `<div style="padding:40px; text-align:center;">目前牆上還沒有通過審核的診斷書...</div>`;
    } else {
        wall.innerHTML = showList.map(d => {
            const isGrad = d.tag.includes('畢業') || d.msg.includes('畢業');
            const cardStyle = isGrad ? 'border: 2px solid var(--red); background: #fffdfd; box-shadow: 4px 4px 0px var(--red);' : '';
            const tagStyle = isGrad ? 'background: var(--red); color: white; padding: 2px 8px; border-radius:3px;' : 'color: var(--red); font-weight:bold;';

            return `
                <div class="complaint-card" style="${cardStyle}">
                    <div class="complaint-cat">To: ${d.to}</div>
                    <div class="complaint-text">${d.msg}</div>
                    <div style="${tagStyle} font-size:12px; margin-bottom:10px; display:inline-block;">${d.tag}</div>
                    <div class="complaint-meta"><span>👤 ${d.name}</span><span>📅 ${d.time}</span></div>
                </div>`;
        }).join('');
    }
    
    if(document.getElementById('home-total')) document.getElementById('home-total').textContent = complaintsData.length;
    
    const sb = document.getElementById('home-sidebar');
    if (sb && complaintsData.length > 0) {
        sb.innerHTML = [...complaintsData].reverse().slice(0, 3).map(d => `
            <div class="complaint-card" style="padding:15px; font-size:13px; border-left-width:3px; margin-bottom:12px;">
                <div style="background:var(--red); color:white; display:inline-block; padding:0 5px; font-size:10px; margin-bottom:5px;">To: ${d.to}</div>
                <p style="color:var(--ink); font-weight:500;">${d.msg.slice(0,30)}...</p>
            </div>`).join('');
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
        document.getElementById('admin-dashboard').innerHTML = `
            <div style="text-align:center; padding:20px; background:white; border:1px solid var(--aged);">
                <h3 style="color:green;">✅ 登入成功</h3>
                <a href="https://docs.google.com/spreadsheets/d/${SHEET_ID}" target="_blank" style="color:var(--red);">點此前往試算表後台</a>
            </div>`;
        document.getElementById('admin-dashboard').style.display = 'block';
    } else { alert('密碼錯誤！'); }
}

setInterval(loadSheetData, 30000);
