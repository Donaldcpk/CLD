// Firebase Configuration Template
// 如需啟用多人即時同步功能，請將此檔案內容填入 script.js 開頭的 firebaseConfig 區塊

/*
步驟：
1. 前往 https://console.firebase.google.com/
2. 新增專案 (Project) -> 關閉 Google Analytics -> 建立專案
3. 進入專案 -> 點擊 Web 圖示 (</>) -> 註冊應用程式 (App)
4. 複製生成的 firebaseConfig 內容
5. 回到 script.js，找到 initializeFirebase() 函數，將設定貼上
6. 在 Firebase Console -> Build -> Realtime Database -> Create Database
7. 選擇位置 (US/Singapore皆可) -> Start in Test Mode (測試模式) -> Enable
8. 完成！
*/

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

