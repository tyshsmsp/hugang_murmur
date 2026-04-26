var SHEET_ID = '1HrVHWkav_i-sBEJkLbBarLTxQZI2DQOLXZAYc-D05PM'; 
var PASS_WORD = 'hugangmurmursmsp';
var OK_TAG = 'ok';

var API_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json&tq=" + encodeURIComponent("SELECT *") + "&v=" + new Date().getTime();

var complaintsData = [];
var nowFilter = '全部';

window.onload = function() {
    document.getElementById('today-date').textContent = new Date().toLocaleDateString('zh-TW');
    loadSheetData();
};

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

    const showList = complaintsData.filter(d => {
        if (nowFilter === '全部') return true;
        return d.to.includes(nowFilter) || d.tag.includes(nowFilter);
    }).reverse();

    if (showList.length === 0) {
        wall.innerHTML = `<div class="empty-state" style="padding:40px; text-align:center;">目前牆上還沒有通過審核的診斷書</div>`;
    } else {
        wall.innerHTML = showList.map(d => `
            <div class="complaint-card">
                <div class="complaint-cat">🎯 診斷對象：${d.to}</div>
                <div class="complaint-text">${d.msg}</div>
                <div style="color:var(--red); font-size:12px; margin-bottom:10px;">${d.tag}</div>
                <div class="complaint-meta"><span>👤 ${d.name}</span><span>📅 ${d.time}</span></div>
            </div>`).join('');
    }
    
    document.getElementById('home-total').textContent = complaintsData.length;
    
    // 更新側邊欄 (前三筆)
    const sb = document.getElementById('home-sidebar');
    if (sb && complaintsData.length > 0) {
        sb.innerHTML = [...complaintsData].reverse().slice(0, 3).map(d => `
            <div class="complaint-card" style="padding:10px; font-size:13px; border-left-width:3px;">
                <strong>To: ${d.to}</strong><br>${d.msg.slice(0,25)}...
            </div>`).join('');
    }
}

function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    
    const btns = document.querySelectorAll('nav button');
    const idxMap = { 'home': 0, 'browse': 1, 'submit': 2, 'admin': 3 };
    if (btns[idxMap[name]]) btns[idxMap[name]].classList.add('active');
    
    if (name === 'browse') refreshUI();
}

function adminLogin() {
    if (document.getElementById('admin-pass').value === PASS_WORD) {
        document.getElementById('admin-login-box').style.display = 'none';
        document.getElementById('admin-dashboard').innerHTML = `<div style="text-align:center; padding:20px;">✅ 登入成功，請去試算表填寫 ${OK_TAG}</div>`;
        document.getElementById('admin-dashboard').style.display = 'block';
    } else { alert('密碼錯誤！'); }
}

setInterval(loadSheetData, 30000);
