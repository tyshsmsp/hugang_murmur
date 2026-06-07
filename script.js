@@ -66,6 +66,19 @@
             // 試算表實際列號 = gviz 索引 + 2（+1 指標頭列，+1 因為 GAS 從 1 開始計）
             const rowNum = rIdx + 2;
 
+            let likes = parseInt(c[8]) || 0;
+            let hearts = parseInt(c[9]) || 0;
+
+            // 樂觀更新自動校正：如果本地有按讚/愛心紀錄，但 Sheets 讚數仍為 0，則強制顯示為 1
+            const likedList = JSON.parse(localStorage.getItem('liked_posts') || '[]');
+            const heartedList = JSON.parse(localStorage.getItem('hearted_posts') || '[]');
+            if (likedList.includes(rowNum) && likes < 1) {
+                likes = 1;
+            }
+            if (heartedList.includes(rowNum) && hearts < 1) {
+                hearts = 1;
+            }
+
             return {
                 time: c[0],
                 rowNum: rowNum,
@@ -73,8 +73,8 @@
                 msg: c[4] || '',
                 tag: c[5] || '',
                 isOk: isApproved,
-                likes: parseInt(c[8]) || 0,
-                hearts: parseInt(c[9]) || 0
+                likes: likes,
+                hearts: hearts
             };
         }).filter(item => item.msg !== "");
 
@@ -115,10 +115,10 @@
                     </div>
                     
                     <div class="reactions-bar">
-                        <button class="reaction-btn ${isLiked ? 'active' : ''}" onclick="handleReaction(${d.rowNum}, 'like')">
+                        <button class="reaction-btn ${isLiked ? 'active' : ''}" ${isLiked ? 'disabled' : ''} onclick="handleReaction(${d.rowNum}, 'like')">
                             👍 <span class="reaction-count">${d.likes}</span>
                         </button>
-                        <button class="reaction-btn ${isHearted ? 'active' : ''}" onclick="handleReaction(${d.rowNum}, 'heart')">
+                        <button class="reaction-btn ${isHearted ? 'active' : ''}" ${isHearted ? 'disabled' : ''} onclick="handleReaction(${d.rowNum}, 'heart')">
                             ❤️ <span class="reaction-count">${d.hearts}</span>
                         </button>
                     </div>
