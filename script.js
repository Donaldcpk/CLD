class LotterySystem {
    constructor() {
        this.classData = {
            '1A': 31, '1B': 32, '1C': 32, '1D': 33,
            '2A': 28, '2B': 32, '2C': 27, '2D': 27,
            '3A': 27, '3B': 29, '3C': 26, '3D': 26,
            '4A': 28, '4B': 26, '4C': 19, '4D': 18,
            '5A': 28, '5B': 27, '5C': 24, '5D': 18,
            '6A': 26, '6B': 32, '6C': 16, '6D': 16
        };
        
        this.winners = new Set();
        this.currentStage = 1;
        this.currentGrade = null;
        this.selectedClass = null;
        this.winnerStages = new Map();
        this.isMusicPlaying = false;
        
        this.initializeUI();
        this.bindEvents();
        this.loadFromLocalStorage();
        this.initializeReplacementMode();
        this.initializeMusic();
    }

    initializeUI() {
        // 基本控制元素
        this.stageSelect = document.getElementById('stageSelect');
        this.gradeSelect = document.getElementById('gradeSelect');
        
        // 兩種抽獎界面
        this.multiClassDraw = document.getElementById('multiClassDraw');
        this.twoStepDraw = document.getElementById('twoStepDraw');
        
        // 初始化時隱藏所有抽獎界面
        this.multiClassDraw.style.display = 'none';
        this.twoStepDraw.style.display = 'none';
        
        // 獲取中獎名單顯示區域
        this.winnersDisplay = document.getElementById('winners');
        
        // 獲取重置按鈕
        this.resetBtn = document.getElementById('resetBtn');
        
        // 移除多餘的開始抽獎按鈕（如果存在）
        const extraDrawBtn = document.getElementById('drawBtn');
        if (extraDrawBtn) {
            extraDrawBtn.parentElement.removeChild(extraDrawBtn);
        }

        // 獲取抽獎按鈕引用
        this.multiDrawBtn = document.getElementById('multiDrawBtn');
        this.drawClassBtn = document.getElementById('drawClassBtn');
        this.drawNumberBtn = document.getElementById('drawNumberBtn');
    }

    bindEvents() {
        // 階段選擇事件
        this.stageSelect.addEventListener('change', () => {
            const stage = parseInt(this.stageSelect.value);
            this.currentStage = stage;
            this.switchDrawInterface(stage);
        });

        // 年級選擇事件
        this.gradeSelect.addEventListener('change', () => {
            this.currentGrade = parseInt(this.gradeSelect.value);
            if (this.currentGrade) {
                this.updateClassLabels();
                if (this.currentStage === 1 || this.currentStage === 4) {
                    this.multiDrawBtn.disabled = false;
                } else {
                    this.drawClassBtn.disabled = false;
                }
            }
        });

        // 添加抽獎按鈕事件
        this.multiDrawBtn.addEventListener('click', () => {
            this.startMultiClassDraw();
        });

        this.drawClassBtn.addEventListener('click', () => {
            this.startClassDraw();
        });

        this.drawNumberBtn.addEventListener('click', () => {
            this.startNumberDraw();
        });

        // 重置按鈕事件
        this.resetBtn.addEventListener('click', () => this.resetSystem());
    }

    switchDrawInterface(stage) {
        // 根據階段切換界面
        if (stage === 1 || stage === 4) {
            this.multiClassDraw.style.display = 'block';
            this.twoStepDraw.style.display = 'none';
        } else {
            this.multiClassDraw.style.display = 'none';
            this.twoStepDraw.style.display = 'block';
        }
        
        // 重置所有顯示
        this.resetDisplays();
    }

    resetDisplays() {
        // 重置多班級抽獎顯示
        document.querySelectorAll('.wheel-container .number-display').forEach(display => {
            display.textContent = '00';
        });
        
        // 重置兩步驟抽獎顯示
        document.querySelector('.class-display').textContent = '-';
        document.querySelector('.number-selection').style.display = 'none';
        document.querySelector('.number-display').textContent = '--';
        
        this.selectedClass = null;
    }

    async startMultiClassDraw() {
        if (!this.currentGrade) {
            alert('請先選擇年級');
            return;
        }

        // 播放音樂
        if (!this.isMusicPlaying) {
            this.toggleMusic();
        }

        const displays = {};
        ['A', 'B', 'C', 'D'].forEach(className => {
            displays[className] = document.querySelector(`.wheel-container[data-class="${className}"] .number-display`);
        });

        // 同時執行四個班級的數字動畫
        await Promise.all(['A', 'B', 'C', 'D'].map(async className => {
            const fullClassName = `${this.currentGrade}${className}`;
            for (let i = 0; i < 20; i++) {
                displays[className].textContent = 
                    Math.floor(Math.random() * this.classData[fullClassName] + 1)
                        .toString().padStart(2, '0');
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }));

        // 抽取並顯示最終結果
        for (const className of ['A', 'B', 'C', 'D']) {
            const fullClassName = `${this.currentGrade}${className}`;
            const winner = await this.drawWinner(fullClassName);
            if (winner) {
                displays[className].textContent = winner.split('-')[1];
                this.recordWinner(winner);
            }
        }
    }

    async startClassDraw() {
        if (!this.currentGrade) {
            alert('請先選擇年級');
            return;
        }

        // 播放音樂
        if (!this.isMusicPlaying) {
            this.toggleMusic();
        }

        const classDisplay = document.querySelector('.class-display');
        const availableClasses = ['A', 'B', 'C', 'D'];
        this.drawClassBtn.disabled = true;

        try {
            // 班別選擇動畫
            for (let i = 0; i < 20; i++) {
                const randomClass = availableClasses[i % 4];
                classDisplay.textContent = `${this.currentGrade}${randomClass}`;
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 選擇最終班別
            this.selectedClass = availableClasses[Math.floor(Math.random() * availableClasses.length)];
            classDisplay.textContent = `${this.currentGrade}${this.selectedClass}`;

            // 顯示第二步
            document.querySelector('.number-selection').style.display = 'block';
            alert(`已抽中${this.currentGrade}${this.selectedClass}班，請點擊"抽選學號"繼續`);
        } catch (error) {
            console.error('抽選班別時發生錯誤:', error);
            alert('抽選過程發生錯誤，請重試');
        } finally {
            this.drawClassBtn.disabled = false;
        }
    }

    async startNumberDraw() {
        if (!this.selectedClass) {
            alert('請先抽選班別');
            return;
        }

        const numberDisplay = document.querySelector('.number-selection .number-display');
        const fullClassName = `${this.currentGrade}${this.selectedClass}`;

        // 數字選擇動畫
        for (let i = 0; i < 20; i++) {
            numberDisplay.textContent = 
                Math.floor(Math.random() * this.classData[fullClassName] + 1)
                    .toString().padStart(2, '0');
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 抽取並顯示最終結果
        const winner = await this.drawWinner(fullClassName);
        if (winner) {
            numberDisplay.textContent = winner.split('-')[1];
            this.recordWinner(winner);
        }
    }

    async drawWinner(className) {
        const availableNumbers = [];
        const classSize = this.classData[className];

        for (let i = 1; i <= classSize; i++) {
            const studentNumber = `${className}-${i.toString().padStart(2, '0')}`;
            if (!this.winners.has(studentNumber)) {
                availableNumbers.push(studentNumber);
            }
        }

        if (availableNumbers.length === 0) {
            alert(`${className}班已無可抽獎學生`);
            return null;
        }

        return availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    }

    recordWinner(winner) {
        this.winners.add(winner);
        this.winnerStages.set(winner, this.currentStage);
        this.updateWinnersList(winner);
        this.saveToLocalStorage();
    }

    updateClassLabels() {
        // 更新多班級抽獎界面的班別標籤
        document.querySelectorAll('.wheel-container .class-label').forEach(label => {
            const className = label.closest('.wheel-container').dataset.class;
            label.textContent = `${this.currentGrade}${className}班`;
        });

        // 更新兩步驟抽獎界面的班別顯示
        const classDisplay = document.querySelector('.class-display');
        if (classDisplay.textContent !== '-') {
            classDisplay.textContent = `${this.currentGrade}${classDisplay.textContent}`;
        }
    }

    updateWinnersList(winner) {
        const winnerElement = document.createElement('div');
        winnerElement.className = 'winner-item';
        const stageName = this.getStageName(this.currentStage);
        winnerElement.innerHTML = `
            <div class="winner-details">
                <span class="prize-name">${stageName}</span>
                <span class="winner-info">${winner}</span>
            </div>
        `;
        this.winnersDisplay.insertBefore(winnerElement, this.winnersDisplay.firstChild);
    }

    getStageName(stage) {
        const stageNames = {
            1: '三獎',
            2: '二獎',
            3: '大獎',
            4: '60周年特別大獎1',
            5: '60周年特別大獎2'
        };
        return stageNames[stage] || '';
    }

    resetSystem() {
        if (confirm('確定要重置系統嗎？這將清除所有中獎記錄。')) {
            this.winners.clear();
            this.winnerStages.clear();
            this.winnersDisplay.innerHTML = '';
            this.resetDisplays();
            localStorage.removeItem('lotteryState');
        }
    }

    saveToLocalStorage() {
        const state = {
            winners: Array.from(this.winners),
            winnerStages: Array.from(this.winnerStages.entries()),
            currentStage: this.currentStage
        };
        localStorage.setItem('lotteryState', JSON.stringify(state));
    }

    loadFromLocalStorage() {
        const savedState = localStorage.getItem('lotteryState');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.winners = new Set(state.winners);
            this.winnerStages = new Map(state.winnerStages);
            this.currentStage = state.currentStage;
            
            // 恢復中獎名單顯示
            state.winners.reverse().forEach(winner => {
                const stage = this.winnerStages.get(winner);
                const winnerElement = document.createElement('div');
                winnerElement.className = 'winner-item';
                winnerElement.innerHTML = `
                    <div class="winner-details">
                        <span class="prize-name">${this.getStageName(stage)}</span>
                        <span class="winner-info">${winner}</span>
                    </div>
                `;
                this.winnersDisplay.appendChild(winnerElement);
            });
        }
    }

    initializeReplacementMode() {
        this.replacementPanel = document.getElementById('replacementDrawPanel');
        this.replacementStageSelect = document.getElementById('replacementStageSelect');
        this.replacementGradeSelect = document.getElementById('replacementGradeSelect');
        this.replacementClassSelect = document.getElementById('replacementClassSelect');
        this.autoClassBtn = document.getElementById('autoClassBtn');
        this.manualClassBtn = document.getElementById('manualClassBtn');
        this.startReplacementBtn = document.getElementById('startReplacementBtn');
        
        this.bindReplacementEvents();
    }

    bindReplacementEvents() {
        // 切換補抽模式
        document.getElementById('replacementModeBtn').addEventListener('click', () => {
            this.toggleReplacementMode();
        });

        // 抽獎方式選擇
        this.autoClassBtn.addEventListener('click', () => {
            this.setReplacementDrawMethod('auto');
        });

        this.manualClassBtn.addEventListener('click', () => {
            this.setReplacementDrawMethod('manual');
        });

        // 開始補抽
        this.startReplacementBtn.addEventListener('click', () => {
            this.startReplacementDraw();
        });
    }

    toggleReplacementMode() {
        const isHidden = this.replacementPanel.style.display === 'none';
        this.replacementPanel.style.display = isHidden ? 'block' : 'none';
        
        if (isHidden) {
            this.resetReplacementMode();
        }
    }

    setReplacementDrawMethod(method) {
        this.replacementDrawMethod = method;
        this.autoClassBtn.classList.toggle('active', method === 'auto');
        this.manualClassBtn.classList.toggle('active', method === 'manual');
        this.replacementClassSelect.style.display = method === 'manual' ? 'block' : 'none';
    }

    async startReplacementDraw() {
        const stage = this.replacementStageSelect.value;
        const grade = this.replacementGradeSelect.value;
        
        if (!stage || !grade) {
            alert('請選擇獎項和年級');
            return;
        }

        if (this.replacementDrawMethod === 'manual' && !this.replacementClassSelect.value) {
            alert('請選擇班別');
            return;
        }

        try {
            let className;
            if (this.replacementDrawMethod === 'auto') {
                // 系統抽取班別
                className = await this.drawReplacementClass(grade);
            } else {
                // 使用選擇的班別
                className = this.replacementClassSelect.value;
            }

            // 抽取學號
            const winner = await this.drawReplacementNumber(grade + className);
            if (winner) {
                this.displayReplacementResult(winner);
                this.recordWinner(winner, stage);
            }
        } catch (error) {
            alert(error.message);
        }
    }

    async drawReplacementClass(grade) {
        const availableClasses = ['A', 'B', 'C', 'D'];
        const replacementClass = document.getElementById('replacementClass');
        
        // 班別選擇動畫
        for (let i = 0; i < 20; i++) {
            const randomClass = availableClasses[i % 4];
            replacementClass.textContent = `${grade}${randomClass}`;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 選擇最終班別
        const selectedClass = availableClasses[Math.floor(Math.random() * availableClasses.length)];
        replacementClass.textContent = `${grade}${selectedClass}`;
        return selectedClass;
    }

    async drawReplacementNumber(fullClassName) {
        const replacementNumber = document.getElementById('replacementNumber');
        const classSize = this.classData[fullClassName];
        
        // 數字選擇動畫
        for (let i = 0; i < 20; i++) {
            replacementNumber.textContent = 
                Math.floor(Math.random() * classSize + 1)
                    .toString().padStart(2, '0');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 抽取最終號碼
        const winner = await this.drawWinner(fullClassName);
        if (winner) {
            const number = winner.split('-')[1];
            replacementNumber.textContent = number;
            return winner;
        }
        return null;
    }

    displayReplacementResult(winner) {
        const [className, number] = winner.split('-');
        document.getElementById('replacementClass').textContent = className;
        document.getElementById('replacementNumber').textContent = number;
    }

    resetReplacementMode() {
        // 重置所有選擇和顯示
        this.replacementStageSelect.value = '';
        this.replacementGradeSelect.value = '';
        this.replacementClassSelect.value = '';
        this.replacementDrawMethod = null;
        
        // 重置按鈕狀態
        this.autoClassBtn.classList.remove('active');
        this.manualClassBtn.classList.remove('active');
        this.replacementClassSelect.style.display = 'none';
        
        // 重置結果顯示
        document.getElementById('replacementClass').textContent = '-';
        document.getElementById('replacementNumber').textContent = '--';
    }

    initializeMusic() {
        this.bgMusic = document.getElementById('bgMusic');
        this.musicBtn = document.getElementById('musicToggleBtn');
        this.musicIcon = this.musicBtn.querySelector('.music-icon');
        
        // 設置適中的音量
        this.bgMusic.volume = 0.3;
        
        // 綁定音樂控制事件
        this.musicBtn.addEventListener('click', () => this.toggleMusic());
        
        // 處理音樂加載錯誤
        this.bgMusic.addEventListener('error', () => {
            console.error('背景音樂加載失敗');
            this.musicBtn.style.display = 'none';
        });
    }

    toggleMusic() {
        if (this.isMusicPlaying) {
            this.bgMusic.pause();
            this.musicIcon.textContent = '🔇';
            this.musicBtn.classList.remove('playing');
        } else {
            this.bgMusic.play().catch(error => {
                console.error('播放音樂失敗:', error);
            });
            this.musicIcon.textContent = '🔊';
            this.musicBtn.classList.add('playing');
        }
        this.isMusicPlaying = !this.isMusicPlaying;
    }

    enableDrawButtons() {
        if (this.currentGrade) {
            // 根據當前階段啟用相應的按鈕
            if (this.currentStage === 1 || this.currentStage === 4) {
                // 多班級同時抽獎模式
                this.multiDrawBtn.disabled = false;
            } else {
                // 兩步驟抽獎模式
                this.drawClassBtn.disabled = false;
            }
        }
    }
}

// 初始化系統
document.addEventListener('DOMContentLoaded', () => {
    window.lottery = new LotterySystem();
});