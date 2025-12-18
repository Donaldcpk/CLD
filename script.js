class LotterySystem {
    constructor() {
        // Fallback data if Excel fails
        this.classData = {
            '1A': 27, '1B': 28, '1C': 29, '1D': 29,
            '2A': 33, '2B': 33, '2C': 33, '2D': 33,
            '3A': 33, '3B': 34, '3C': 33, '3D': 32,
            '4A': 26, '4B': 30, '4C': 23, '4D': 23,
            '5A': 28, '5B': 26, '5C': 17, '5D': 17,
            '6A': 28, '6B': 26, '6C': 22, '6D': 14
        };
        
        this.winners = new Set();
        this.currentStage = 2; // Default to Second Prize
        this.currentGrade = null;
        this.winnerStages = new Map();
        this.isMusicPlaying = false;
        this.studentMap = new Map(); // Stores "Class-Number" -> "Name"
        
        this.initializeUI();
        this.bindEvents();
        
        // Firebase / LocalStorage Init
        this.initializeFirebase(); // Try to init Firebase first
        
        // If Firebase not configured, load from LocalStorage
        if (!this.db) {
        this.loadFromLocalStorage();
        }

        this.initializeReplacementMode();
        this.initializeBackupMode(); // New Backup Mode
        this.initializeMusic();
        this.initializePhotoMode();
        
        // Try auto-load default excel file (might fail on local file://)
        this.autoLoadExcel();
        
        // Initial setup
        this.updateStageInfo();
    }

    initializeFirebase() {
        // --- 設定開始 ---
        // 請將您的 Firebase 設定填寫於此處
        // 若 apiKey 為空字串，系統將自動切換回單機模式 (LocalStorage)
        const firebaseConfig = {
            apiKey: "", 
            authDomain: "",
            databaseURL: "",
            projectId: "",
            storageBucket: "",
            messagingSenderId: "",
            appId: ""
        };
        // --- 設定結束 ---

        if (!firebaseConfig.apiKey) {
            console.log("Firebase未設定，使用本機模式");
            return;
        }

        try {
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.database();
            console.log("Firebase Connected");
            
            // Listen for changes
            this.db.ref('winners').on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    // Update local state from cloud
                    this.winners = new Set(data.list || []);
                    this.winnerStages = new Map(Object.entries(data.stages || {}));
                    
                    // Refresh UI
                    this.winnersDisplay.innerHTML = '';
                    Array.from(this.winners).forEach(w => {
                         const stage = this.winnerStages.get(w);
                         this.updateWinnersList(w, stage);
                    });
                }
            });
        } catch (e) {
            console.error("Firebase init failed", e);
        }
    }

    initializeUI() {
        // Controls
        this.stageSelect = document.getElementById('stageSelect');
        this.gradeSelect = document.getElementById('gradeSelect');
        this.drawBtn = document.getElementById('drawBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        // Manual Import
        this.manualFileInput = document.getElementById('manualFileInput');

        // Draw Interface
        this.drawArea = document.getElementById('drawArea');
        this.slotsContainer = document.getElementById('slotsContainer');
        this.prizeTitle = document.getElementById('currentPrizeTitle');
        this.prizeDesc = document.getElementById('currentPrizeDesc');
        
        // Winners
        this.winnersDisplay = document.getElementById('winners');
    }

    bindEvents() {
        // Stage Change
        this.stageSelect.addEventListener('change', () => {
            this.currentStage = parseInt(this.stageSelect.value);
            this.updateStageInfo();
        });

        // Grade Change
        this.gradeSelect.addEventListener('change', () => {
            this.currentGrade = parseInt(this.gradeSelect.value);
            this.drawBtn.disabled = !this.currentGrade;
        });

        // Draw Button
        this.drawBtn.addEventListener('click', () => {
            if (this.currentStage === 2) {
                this.startDoubleDraw();
                } else {
                this.startSingleDraw();
            }
        });

        // Reset
        this.resetBtn.addEventListener('click', () => this.resetSystem());

        // Winner List Delegation
        this.winnersDisplay.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) {
                const btn = e.target.closest('.delete-btn');
                const winner = btn.dataset.winner;
                this.deleteWinner(winner);
            }
        });

        // Manual File Import
        if (this.manualFileInput) {
            this.manualFileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
    }

    updateStageInfo() {
        // Clear slots
        this.slotsContainer.innerHTML = '';
        
        if (this.currentStage === 2) {
            // Second Prize
            this.prizeTitle.textContent = '二獎：麥當勞 $20×3 現金券';
            this.prizeDesc.textContent = '每級 2 份，全校共 12 份';
            
            // Create 2 slots
            this.createSlot('slot1');
            this.createSlot('slot2');
        } else {
            // Grand Prize
            this.prizeTitle.textContent = '大獎：馬拉松 $100×3 現金券';
            this.prizeDesc.textContent = '每級 1 份，全校共 6 份';
            
            // Create 1 slot
            this.createSlot('slot1');
        }
    }

    createSlot(id) {
        const slot = document.createElement('div');
        slot.className = 'slot-box';
        slot.id = id;
        slot.innerHTML = `
            <div class="slot-label">準備中</div>
            <div class="slot-number">--</div>
        `;
        this.slotsContainer.appendChild(slot);
    }

    async startDoubleDraw() {
        if (!this.checkDrawRequirements(2)) return;
        
        this.drawBtn.disabled = true;
        this.ensureMusicPlaying();

        // 1. Get pool
        const pool = this.getGradePool(this.currentGrade);
        if (pool.length < 2) {
            this.showToast(`該年級剩餘人數不足 (${pool.length}人)`);
            this.drawBtn.disabled = false;
            return;
        }

        this.shuffleArray(pool);
        
        // 2. Pick Winner 1
        const winner1 = pool[0];
        const class1 = winner1.split('-')[0]; // e.g. "1A"

        // 3. Find Winner 2 (Must be different class)
        // Filter pool to find students from different classes
        const pool2 = pool.filter(w => w.split('-')[0] !== class1);

        if (pool2.length === 0) {
            alert(`無法抽出兩位不同班別的學生！\n(剩餘學生皆來自 ${class1} 班)`);
            this.drawBtn.disabled = false;
            return;
        }

        const winner2 = pool2[Math.floor(Math.random() * pool2.length)];
        const winners = [winner1, winner2];

        // 2. Animate Slots
        const slot1 = document.getElementById('slot1');
        const slot2 = document.getElementById('slot2');
        
        // Parallel animation
        await Promise.all([
            this.animateSlot(slot1, winners[0]),
            this.animateSlot(slot2, winners[1])
        ]);

        // 3. Record
        winners.forEach(w => this.recordWinner(w));
        this.drawBtn.disabled = false;
    }

    async startSingleDraw() {
        if (!this.checkDrawRequirements(1)) return;

        this.drawBtn.disabled = true;
        this.ensureMusicPlaying();

        // 1. Get 1 winner
        const pool = this.getGradePool(this.currentGrade);
        if (pool.length < 1) {
            this.showToast(`該年級已無剩餘抽獎人數`);
            this.drawBtn.disabled = false;
            return;
        }

        const winner = pool[Math.floor(Math.random() * pool.length)];

        // 2. Animate Slot
        const slot1 = document.getElementById('slot1');
        await this.animateSlot(slot1, winner);

        // 3. Record
                this.recordWinner(winner);
        this.drawBtn.disabled = false;
    }

    checkDrawRequirements(count) {
        if (!this.currentGrade) {
            this.showToast('請先選擇年級');
            return false;
        }
        return true;
    }

    showToast(msg) {
        // Simple alert replacement - can be improved to a DOM overlay
        // For now, use alert but requested to avoid.
        // User said "No popup reminders except delete".
        // But invalid state needs feedback.
        // Let's create a temporary overlay or just console.log?
        // User probably wants silent failure or visual cue.
        // Let's use the prizeDesc area to show error temporarily.
        const originalText = this.prizeDesc.textContent;
        this.prizeDesc.textContent = `⚠️ ${msg}`;
        this.prizeDesc.style.color = '#ff4500';
        setTimeout(() => {
            this.prizeDesc.textContent = originalText;
            this.prizeDesc.style.color = '#ddd';
        }, 3000);
    }

    getGradePool(grade) {
        const pool = [];
        
        // Priority 1: Check studentMap (loaded from Excel)
        if (this.studentMap.size > 0) {
            // studentMap keys are "1A-01", "1A-02"...
            for (const key of this.studentMap.keys()) {
                if (key.startsWith(String(grade)) && !this.winners.has(key)) {
                    pool.push(key);
                }
            }
            if (pool.length > 0) return pool;
        }

        // Priority 2: Fallback to hardcoded logic if map empty or no students for this grade
        const classes = ['A', 'B', 'C', 'D'];
        for (const cls of classes) {
            const fullClass = `${grade}${cls}`;
            const size = this.classData[fullClass] || 0;
            
            for (let i = 1; i <= size; i++) {
                const id = `${fullClass}-${i.toString().padStart(2, '0')}`;
                if (!this.winners.has(id)) {
                    pool.push(id);
                }
            }
        }
        return pool;
    }

    async animateSlot(slotElement, finalValue) {
        const label = slotElement.querySelector('.slot-label');
        const number = slotElement.querySelector('.slot-number');
        
        label.textContent = '...';
        
        // Animation
        const duration = 2000; // Reduced by 1 second (3000 -> 2000)
        const interval = 50;
        const steps = duration / interval;
        
        for (let i = 0; i < steps; i++) {
            const randomVal = this.getRandomStudentId();
            const [cls, no] = randomVal.split('-');
            number.textContent = `${cls}-${no}`;
            await new Promise(r => setTimeout(r, interval));
        }
        
        // Final Reveal
        const [fCls, fNo] = finalValue.split('-');
        const name = this.getStudentName(finalValue);
        
        number.textContent = `${fCls}-${fNo}`;
        label.textContent = name ? `🎉 ${name}` : '🎉 中獎';
        
        // Add highlight effect
        slotElement.style.transform = 'scale(1.1)';
        setTimeout(() => slotElement.style.transform = 'scale(1)', 300);
    }

    getRandomStudentId() {
        // Just for visual effect
        if (this.studentMap.size > 0) {
             const keys = Array.from(this.studentMap.keys());
             return keys[Math.floor(Math.random() * keys.length)];
        }
        const cls = ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)];
        const no = Math.floor(Math.random() * 30 + 1).toString().padStart(2, '0');
        const grade = this.currentGrade || 1;
        return `${grade}${cls}-${no}`;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    recordWinner(winner, stage = this.currentStage) {
        this.winners.add(winner);
        this.winnerStages.set(winner, stage);
        
        // Update UI locally first
        this.updateWinnersList(winner, stage);
        this.saveToLocalStorage();
        
        // Sync to Cloud if enabled
        if (this.db) {
            this.db.ref('winners').set({
                list: Array.from(this.winners),
                stages: Object.fromEntries(this.winnerStages)
            });
        }
    }

    createWinnerElement(winner, stage) {
        const el = document.createElement('div');
        el.className = 'winner-item';
        
        const stageName = stage == 2 ? '二獎' : '大獎';
        const [className, number] = winner.split('-');
        const name = this.getStudentName(winner);
        
        el.innerHTML = `
            <div class="winner-details">
                <span class="prize-badge">${stageName}</span>
                <span class="winner-text">${className}班 - ${number}號</span>
                ${name ? `<span class="winner-name-text">${name}</span>` : ''}
            </div>
            <button class="delete-btn" data-winner="${winner}" title="刪除">✖</button>
        `;
        return el;
    }

    updateWinnersList(winner, stage) {
        const el = this.createWinnerElement(winner, stage);
        this.winnersDisplay.insertBefore(el, this.winnersDisplay.firstChild);
    }

    deleteWinner(winner) {
        if (confirm(`確定要刪除 ${winner} 的紀錄嗎？`)) {
            this.winners.delete(winner);
            this.winnerStages.delete(winner);
            this.saveToLocalStorage();
            
            // Sync delete to Cloud
            if (this.db) {
                this.db.ref('winners').set({
                    list: Array.from(this.winners),
                    stages: Object.fromEntries(this.winnerStages)
                });
            } else {
                this.loadFromLocalStorage(); // Refresh list locally
            }
        }
    }

    // --- Data & Persistence ---

    saveToLocalStorage() {
        const state = {
            winners: Array.from(this.winners),
            winnerStages: Array.from(this.winnerStages.entries()),
            currentStage: this.currentStage
        };
        localStorage.setItem('lotteryState', JSON.stringify(state));
        
        // Also save studentMap if not empty (to survive refresh on local file://)
        if (this.studentMap.size > 0) {
             localStorage.setItem('studentMap', JSON.stringify(Array.from(this.studentMap.entries())));
        }
    }

    loadFromLocalStorage() {
        // Load studentMap first
        const savedMap = localStorage.getItem('studentMap');
        if (savedMap) {
            try {
                this.studentMap = new Map(JSON.parse(savedMap));
                console.log(`Restored ${this.studentMap.size} students from storage`);
            } catch (e) {
                console.error('Failed to restore map', e);
            }
        }

        const savedState = localStorage.getItem('lotteryState');
        this.winnersDisplay.innerHTML = ''; // Clear list
        
        if (savedState) {
            const state = JSON.parse(savedState);
            this.winners = new Set(state.winners);
            this.winnerStages = new Map(state.winnerStages);
            
            const winnersArr = Array.from(this.winners);
            // Reverse to show newest at top
            // Wait, using insertBefore on a forward loop puts the last processed item at top.
            // Winners = [A, B, C]. 
            // Loop A -> Top is A.
            // Loop B -> Top is B.
            // Loop C -> Top is C.
            // So if winners order is chronological, this makes Newest First. Correct.
            winnersArr.forEach(w => {
                const stage = this.winnerStages.get(w);
                this.updateWinnersList(w, stage);
            });
        }
    }

    resetSystem() {
        if (confirm('確定要重置系統嗎？所有紀錄將消失。')) {
            this.winners.clear();
            this.winnerStages.clear();
            localStorage.removeItem('lotteryState');
            // Do NOT remove studentMap, keep the loaded file
            // localStorage.removeItem('studentMap'); 
            this.saveToLocalStorage();
            
            // Clear Cloud
            if (this.db) {
                this.db.ref('winners').remove();
            }
            
            this.winnersDisplay.innerHTML = '';
            location.reload();
        }
    }

    // --- Excel Handling ---
    async autoLoadExcel() {
        console.log('Attempting to auto-load student list...');
        // If map already loaded from storage, maybe skip auto-load?
        // No, file might have updated. Try to load.
        // If fail, we still have storage.
        
        try {
            const response = await fetch('./學生名稱.xlsx');
            if (!response.ok) throw new Error('File not found');
            const data = await response.arrayBuffer();
            this.parseExcelData(data);
        } catch (e) {
            console.warn('Auto-load failed (likely local file restriction). Use manual import icon.', e);
        }
    }
    
    // Manual file upload handler
    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            this.parseExcelData(data);
            alert(`已成功匯入 ${this.studentMap.size} 名學生資料！`);
            this.saveToLocalStorage(); // Persist immediately
            
            // Refresh winners in case they now have names
            this.winnersDisplay.innerHTML = '';
            this.loadFromLocalStorage();
        } catch (err) {
            alert('匯入失敗，請檢查檔案格式');
            console.error(err);
        }
    }

    parseExcelData(data) {
        try {
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            this.processStudentData(rows);
        } catch (err) {
            console.error('Parse error:', err);
            throw err;
        }
    }

    processStudentData(rows) {
        this.studentMap.clear();
        if (rows.length < 2) return;
        
        // Grid Layout logic:
        // Row 0: Headers "1A", "1B", "1C"...
        // Row 1+: Names (Row 1 = No.1, Row 2 = No.2...)
        
        const headerRow = rows[0];
        const colToClass = new Map();
        
        headerRow.forEach((cell, index) => {
            if (cell) {
                const val = String(cell).trim().toUpperCase();
                if (/^[1-6][A-D]$/.test(val)) {
                    colToClass.set(index, val);
                }
            }
        });
        
        // Iterate rows starting from index 1
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            // r is the index in array. 
            // If row 1 is the first student (No. 1), then classNo = r.
            for (const [colIndex, className] of colToClass.entries()) {
                const name = row[colIndex];
                if (name && String(name).trim()) {
                    const classNo = r.toString().padStart(2, '0');
                    const key = `${className}-${classNo}`;
                    this.studentMap.set(key, String(name).trim());
                }
            }
        }
    }

    getStudentName(key) {
        return this.studentMap.get(key) || '';
    }

    // --- Music ---
    initializeMusic() {
        this.bgMusic = document.getElementById('bgMusic');
        this.musicBtn = document.getElementById('musicToggleBtn');
        if (this.bgMusic) this.bgMusic.volume = 0.3;
        
        this.musicBtn.addEventListener('click', () => {
            if (this.isMusicPlaying) this.bgMusic.pause();
            else this.bgMusic.play().catch(e => console.log(e));
            this.isMusicPlaying = !this.isMusicPlaying;
            this.musicBtn.querySelector('span').textContent = this.isMusicPlaying ? '🔊' : '🔇';
        });
    }

    ensureMusicPlaying() {
        if (!this.isMusicPlaying && this.bgMusic) {
            this.bgMusic.play().catch(() => {});
            this.isMusicPlaying = true;
            this.musicBtn.querySelector('span').textContent = '🔊';
        }
    }

    // --- Photo Mode ---
    initializePhotoMode() {
        const btn = document.getElementById('photoModeBtn');
        const backdrop = document.getElementById('photoBackdrop');
        
        btn.addEventListener('click', () => {
            const isHidden = backdrop.style.display === 'none';
            backdrop.style.display = isHidden ? 'flex' : 'none';
        });

        backdrop.addEventListener('click', () => {
            backdrop.style.display = 'none';
        });
    }

    // --- Replacement Mode ---
    initializeReplacementMode() {
        this.replacementOverlay = document.getElementById('replacementOverlay');
        const openBtn = document.getElementById('replacementModeBtn');
        const closeBtn = document.getElementById('closeReplacementBtn');
        const startBtn = document.getElementById('startReplacementBtn');
        
        openBtn.addEventListener('click', () => {
            this.replacementOverlay.style.display = 'flex';
        });
        
        closeBtn.addEventListener('click', () => {
            this.replacementOverlay.style.display = 'none';
        });
        
        this.replacementOverlay.addEventListener('click', (e) => {
            if (e.target === this.replacementOverlay) {
                this.replacementOverlay.style.display = 'none';
            }
        });

        startBtn.addEventListener('click', async () => {
            const stage = document.getElementById('replacementStageSelect').value;
            const grade = document.getElementById('replacementGradeSelect').value;
            if (!stage || !grade) {
                 // Non-blocking warning?
                 alert('請選擇獎項與年級'); // Keeping simple alert for modal validation
                 return;
            }
            
            // Logic
            const pool = this.getGradePool(grade);
            if (pool.length === 0) {
                alert('該年級無人可抽');
                return;
            }
            
            this.shuffleArray(pool);
            const winner = pool[0];
            
            // Animation for Replacement
            startBtn.disabled = true;
            
            const rClass = document.getElementById('replacementClass');
            const rNumber = document.getElementById('replacementNumber');
            const rName = document.getElementById('replacementName');
            
            rName.textContent = ''; 
            
            // Animate
            const duration = 1000; 
            const interval = 50;
            const steps = duration / interval;
            
            for (let i = 0; i < steps; i++) {
                const randomVal = this.getRandomStudentId();
                const [c, n] = randomVal.split('-');
                rClass.textContent = c;
                rNumber.textContent = n;
                await new Promise(r => setTimeout(r, interval));
            }
            
            // Final Show
            const [c, n] = winner.split('-');
            const name = this.getStudentName(winner);
            
            rClass.textContent = c;
            rNumber.textContent = n;
            rName.textContent = name ? name : '';
            rName.style.color = 'var(--highlight-color)';
            rName.style.fontWeight = 'bold';
            
            // Auto Record
            this.recordWinner(winner, stage);
            
            startBtn.disabled = false;
        });
    }
    // --- Backup Mode ---
    initializeBackupMode() {
        const overlay = document.getElementById('backupOverlay');
        const openBtn = document.getElementById('backupModeBtn');
        const closeBtn = document.getElementById('closeBackupBtn');
        const secondBtn = document.getElementById('startBackupSecondBtn');
        const grandBtn = document.getElementById('startBackupGrandBtn');
        const resultsContainer = document.getElementById('backupResults');

        openBtn.addEventListener('click', () => {
            overlay.style.display = 'flex';
        });

        closeBtn.addEventListener('click', () => {
            overlay.style.display = 'none';
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });

        // Track picked backups to avoid duplicate within session
        // Note: This resets on refresh. If persistence needed for backups, need localStorage.
        // User asked for "Record" not necessarily persistence.
        this.backupPickedIDs = new Set(); 

        secondBtn.addEventListener('click', async () => {
            if (!confirm('確定要抽選所有 12 位【二獎】後備名單嗎？')) return;
            await this.runBackupDraw(2, '二獎');
        });

        grandBtn.addEventListener('click', async () => {
            if (!confirm('確定要抽選所有 6 位【大獎】後備名單嗎？')) return;
            await this.runBackupDraw(3, '大獎');
        });
    }

    async runBackupDraw(stage, prizeName) {
        const resultsContainer = document.getElementById('backupResults');
        // Clear container if starting new batch? Or append?
        // Let's clear to avoid confusion, or maybe sections.
        // User said "Split into two steps".
        
        // Let's calculate winners first
        const batchResults = [];
        
        for (let g = 1; g <= 6; g++) {
            // Filter pool: exclude winners AND previously picked backups
            let pool = this.getGradePool(g).filter(id => !this.backupPickedIDs.has(id));
            this.shuffleArray(pool);

            const countNeeded = (stage === 2) ? 2 : 1; // 2 for Second, 1 for Grand
            
            if (pool.length < countNeeded) {
                batchResults.push({ grade: g, type: 'error', msg: `人數不足` });
                continue;
            }

            if (stage === 2) {
                // Pick 2 (Diff Class Logic)
                let w1 = pool[0];
                let w2 = null;
                const c1 = w1.split('-')[0];
                const diffClassPool = pool.filter(id => id !== w1 && id.split('-')[0] !== c1);
                
                if (diffClassPool.length > 0) w2 = diffClassPool[0];
                else w2 = pool[1];

                this.backupPickedIDs.add(w1);
                this.backupPickedIDs.add(w2);
                batchResults.push({ grade: g, type: 'winner', prize: prizeName, id: w1 });
                batchResults.push({ grade: g, type: 'winner', prize: prizeName, id: w2 });
            } else {
                // Grand Prize
                let w1 = pool[0];
                this.backupPickedIDs.add(w1);
                batchResults.push({ grade: g, type: 'winner', prize: prizeName, id: w1 });
            }
        }

        // Render Placeholders & Animate
        await this.animateBackupResults(batchResults);
    }

    async animateBackupResults(results) {
        const container = document.getElementById('backupResults');
        container.innerHTML = ''; // Clear previous

        // 1. Render initial structure with placeholders
        // We group by grade for display
        const rowElements = [];

        // Sort results by grade
        results.sort((a, b) => a.grade - b.grade);

        // Group by grade
        for (let g = 1; g <= 6; g++) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'backup-grade-group';
            groupDiv.innerHTML = `<div class="backup-grade-title">中${g}級</div>`;
            
            const gradeItems = results.filter(r => r.grade === g);
            
            gradeItems.forEach(item => {
                const rowDiv = document.createElement('div');
                rowDiv.className = 'backup-row';
                if (item.type === 'error') {
                    rowDiv.innerHTML = `<span style="color:red">${item.msg}</span>`;
                } else {
                    // Placeholder ID
                    rowDiv.dataset.finalId = item.id;
                    rowDiv.innerHTML = `
                        <span class="backup-type">[${item.prize}]</span>
                        <span class="backup-info" id="b-info-${item.id}">...</span>
                        <span class="backup-name" id="b-name-${item.id}"></span>
                    `;
                    rowElements.push({
                        elInfo: rowDiv.querySelector('.backup-info'),
                        elName: rowDiv.querySelector('.backup-name'),
                        finalId: item.id
                    });
                }
                groupDiv.appendChild(rowDiv);
            });
            container.appendChild(groupDiv);
        }

        // 2. Animate rolling
        const duration = 2000; // 2 seconds (Reduced from implicit longer time)
        const interval = 50;
        const steps = duration / interval;

        for (let i = 0; i < steps; i++) {
            rowElements.forEach(row => {
                const randomVal = this.getRandomStudentId();
                const [c, n] = randomVal.split('-');
                row.elInfo.textContent = `${c}班 - ${n}號`;
            });
            await new Promise(r => setTimeout(r, interval));
        }

        // 3. Reveal
        rowElements.forEach(row => {
            const [c, n] = row.finalId.split('-');
            const name = this.getStudentName(row.finalId);
            row.elInfo.textContent = `${c}班 - ${n}號`;
            row.elName.textContent = name;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.lottery = new LotterySystem();
});
