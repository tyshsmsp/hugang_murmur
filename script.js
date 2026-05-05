:root {
    --ink: #1a1008;
    --paper: #f5efe0;
    --paper-dark: #e8dfc8;
    --aged: #c8b89a;
    --red: #8b1a1a;
    --gold: #b8860b;
    --stamp: #6b3a2a;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    background: #d4c9b0;
    background-image: repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(0,0,0,0.03) 28px, rgba(0,0,0,0.03) 29px);
    font-family: 'Noto Serif TC', serif;
    color: var(--ink);
    min-height: 100vh;
}
body::before {
    content: ''; position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 1000; opacity: 0.6;
}
.newspaper { max-width: 1100px; margin: 40px auto; background: var(--paper); box-shadow: 0 0 60px rgba(0,0,0,0.35); }
.masthead { border-bottom: 4px double var(--ink); text-align: center; }
.masthead-top { border-bottom: 1px solid var(--ink); padding: 8px 20px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
.edition-badge { background: var(--red); color: white; padding: 2px 10px; font-family: 'Special Elite', monospace; }
.masthead-main { font-size: clamp(52px, 8vw, 90px); font-weight: 900; line-height: 0.9; padding: 20px 0; }
nav { background: var(--ink); display: flex; justify-content: center; border-bottom: 3px solid var(--red); position: sticky; top: 0; z-index: 100; }
nav button { background: none; border: none; color: var(--paper); padding: 12px 22px; cursor: pointer; font-family: 'Noto Serif TC'; transition: 0.3s; }
nav button:hover, nav button.active { background: var(--red); }

/* 佈局與內容 */
.content { padding: 40px; min-height: 600px; }
.page { display: none; }
.page.active { display: block; }
.section-head { display: flex; align-items: center; gap: 12px; margin-bottom: 30px; }
.section-head::before, .section-head::after { content: ''; flex: 1; height: 2px; background: var(--ink); }
.front-page { display: grid; grid-template-columns: 2.5fr 1fr; gap: 30px; }
.main-story { border-right: 1px solid var(--aged); padding-right: 30px; }

/* 專欄看板樣式 */
.special-column { background: #fff; border: 2px solid var(--red); padding: 25px; margin-bottom: 25px; position: relative; box-shadow: 5px 5px 0px var(--red); }
.column-badge { position: absolute; top: -12px; right: 20px; background: var(--ink); color: white; padding: 2px 12px; font-family: 'Special Elite'; font-size: 14px; }
.column-footer { margin-top: 15px; font-size: 13px; color: var(--stamp); border-top: 1px dashed var(--aged); padding-top: 10px; }

/* 倒數計時容器 */
.countdown-container { background: var(--ink); color: var(--paper); padding: 18px; margin-bottom: 20px; text-align: center; border-radius: 2px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
#countdown-timer { font-size: 22px; font-family: 'Special Elite'; color: var(--gold); letter-spacing: 1px; font-weight: bold; }

/* 碎碎念卡片 */
.complaint-card { background: white; border: 1px solid var(--aged); padding: 20px; margin-bottom: 20px; border-left: 5px solid var(--red); transition: 0.3s; }
.complaint-card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
.complaint-cat { 
    display: inline-block; 
    font-size: 11px; 
    background: var(--ink); /* 深色背景 */
    color: var(--paper);    /* 淺色文字，加強對比 */
    padding: 2px 10px; 
    font-family: 'Special Elite'; 
    margin-bottom: 12px; 
    letter-spacing: 1px;
}
.complaint-text { font-size: 16px; line-height: 1.8; margin-bottom: 15px; white-space: pre-wrap; color: #111; }
.complaint-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--stamp); border-top: 1px solid #eee; padding-top: 10px; }

/* 統計與按鈕 */
.stat-box { margin: 20px 0; padding: 15px; border-top: 1px solid var(--aged); border-bottom: 1px solid var(--aged); text-align: center; }
.stat-num { font-size: 48px; font-weight: 900; color: var(--red); font-family: 'Special Elite'; }
.forms-btn { display: inline-block; background: var(--red); color: white; padding: 14px 35px; text-decoration: none; font-weight: bold; margin-top: 20px; transition: 0.3s; border: none; cursor: pointer; }
.forms-btn:hover { background: var(--ink); transform: scale(1.05); }

@media (max-width: 768px) {
    .front-page { grid-template-columns: 1fr; }
    .main-story { border-right: none; padding-right: 0; }
    .newspaper { margin: 0; }
}
