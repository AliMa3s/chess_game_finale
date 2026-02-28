document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements ---
    const boardElement = document.getElementById('chess-board');
    const turnIndicator = document.getElementById('turn-indicator');
    const checkIndicator = document.getElementById('check-indicator');
    const botLevelIndicator = document.getElementById('bot-level-indicator');
    const toastContainer = document.getElementById('toast-container');
    const splashScreen = document.getElementById('splash-screen');
    const startGameBtn = document.getElementById('start-game-btn');
    const openAppearanceBtn = document.getElementById('open-appearance-btn');
    const appearanceModal = document.getElementById('appearance-modal');
    const closeAppearanceBtn = document.getElementById('close-appearance-btn');
    const appearanceModalBackdrop = appearanceModal ? appearanceModal.querySelector('.appearance-modal-backdrop') : null;
    const gameContainer = document.getElementById('game-container');
    const gameOverMessage = document.getElementById('game-over-message');
    const winnerMessage = document.getElementById('winner-message');
    const resetGameBtn = document.getElementById('reset-game-btn');
    const goHomeBtn = document.getElementById('go-home-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const boardContainer = document.getElementById('board-container');
    const boardAreaWrapper = document.querySelector('.board-area-wrapper'); // Wrapper for coord flip
    const themeButtons = document.querySelectorAll('.theme-btn[data-theme]');
    const modeButtons = document.querySelectorAll('.mode-btn[data-mode]');
    const difficultySetting = document.getElementById('difficulty-setting');
    const botDifficultySelect = document.getElementById('bot-difficulty');
    const timeControlSelect = document.getElementById('time-control');
    const themeSelect = document.getElementById('theme-select');
    const indicatorCheckbox = document.getElementById('toggle-indicators');
    const flipBoardBtn = document.getElementById('flip-board-btn');
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const soundIcon = soundToggleBtn.querySelector('i');
    const promotionModal = document.getElementById('promotion-modal');
    const promotionChoices = promotionModal.querySelector('.promotion-choices');
    const capturedWhiteContainer = document.getElementById('captured-by-white');
    const capturedBlackContainer = document.getElementById('captured-by-black');
    const whiteClockElement = document.getElementById('white-clock');
    const blackClockElement = document.getElementById('black-clock');
    const moveListElement = document.getElementById('move-list');
    const bodyElement = document.body;


    // --- Game State ---
    let gameState = null;
    let board = [];
    let currentPlayer = 'w';
    let selectedSquare = null; // Stores { row, col, element } (element is the piece div)
    let legalMoves = [];
    let dragSource = null;
    let gameIsOver = false;
    let whiteKingPos = { row: 7, col: 4 };
    let blackKingPos = { row: 0, col: 4 };
    let isBoardFlipped = false;
    let isMuted = false;
    let promotionState = { active: false, row: null, col: null, color: null, callback: null };
    let capturedWhitePieces = [];
    let capturedBlackPieces = [];
    let moveHistory = [];
    let lastMove = null; // Stores { fromRow, fromCol, toRow, toCol }
    let gameMode = 'local'; // local | bot
    let botDifficulty = 'easy'; // easy | medium | hard | expert
    let botMoveTimeoutId = null;
    let botTurnToken = 0;
    let positionRepetitionCounts = {};
    let lastBotToastText = '';
    let timeControl = 'none';
    let whiteTimeMs = 0;
    let blackTimeMs = 0;
    let clockIntervalId = null;
    let clockRunningColor = null;
    let clockLastTickAt = 0;
    let gameEndedByTimeout = false;
    let pendingTimeoutWinner = null;
    let botWorker = null;
    let botWorkerRequestId = 0;
    const botWorkerPending = new Map();
    let positionTimeline = [];
    let timelineIndex = 0;


    // --- Constants ---
    const pieceValues = { K: 1000, Q: 9, R: 5, B: 3, N: 3, P: 1 };
    const botColor = 'b';
    const pieceSVGs = { // Ensure these paths match your files
        wP: 'assets/pieces/white_pawn.svg', wR: 'assets/pieces/white_rook.svg', wN: 'assets/pieces/white_knight.svg',
        wB: 'assets/pieces/white_bishop.svg', wQ: 'assets/pieces/white_queen.svg', wK: 'assets/pieces/white_king.svg',
        bP: 'assets/pieces/black_pawn.svg', bR: 'assets/pieces/black_rook.svg', bN: 'assets/pieces/black_knight.svg',
        bB: 'assets/pieces/black_bishop.svg', bQ: 'assets/pieces/black_queen.svg', bK: 'assets/pieces/black_king.svg',
    };
    const difficultyLabels = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
    const botPhraseProfiles = {
        easy: {
            leads: ['Okay', 'Hmm', 'Nice move'],
            actions: ['let me try something', 'I might have an idea', 'checking a simple line']
        },
        medium: {
            leads: ['I see', 'Interesting', 'Good pressure'],
            actions: ['I am calculating', 'let me improve this', 'searching for a clean move']
        },
        hard: {
            leads: ['Wow', 'Tricky position', 'I see your plan'],
            actions: ['running deep lines', 'tightening the position', 'looking for the strongest continuation']
        },
        expert: {
            leads: ['No mistakes now', 'Deep line incoming', 'Sharp position'],
            actions: ['calculating forcing lines', 'hunting tactical resources', 'playing only top candidates']
        }
    };
    const phaseHints = {
        opening: ['opening shape looks fresh', 'development matters here', 'this opening can turn sharp'],
        middlegame: ['center tension is real', 'piece activity is everything', 'one move can swing this'],
        endgame: ['king activity is critical now', 'endgame precision time', 'small details decide this']
    };
    const botMoodPhrases = {
        easy: ['Bot mood: Easy and playful', 'Bot mood: Easy, just vibing'],
        medium: ['Bot mood: Medium and focused', 'Bot mood: Medium, reading the board'],
        hard: ['Bot mood: Hard and serious', 'Bot mood: Hard, no free moves'],
        expert: ['Bot mood: Expert, full calculate mode', 'Bot mood: Expert, razor sharp']
    };
    const timeControlOptions = {
        none: { label: 'No Clock', initialMs: 0 },
        'blitz-3': { label: 'Blitz 3|0', initialMs: 3 * 60 * 1000 },
        'rapid-10': { label: 'Rapid 10|0', initialMs: 10 * 60 * 1000 },
        'rapid-15': { label: 'Rapid 15|0', initialMs: 15 * 60 * 1000 }
    };
    function ensureChessLogicLoaded() {
        if (!window.ChessLogic) {
            throw new Error('ChessLogic is required but not loaded.');
        }
    }

    function syncStateRefs() {
        if (!gameState) return;
        board = gameState.board;
        currentPlayer = gameState.currentPlayer;
        whiteKingPos = gameState.whiteKingPos;
        blackKingPos = gameState.blackKingPos;
        positionRepetitionCounts = gameState.positionRepetitionCounts;
    }

    function initBotWorker() {
        if (typeof Worker === 'undefined') return;
        if (botWorker) return;
        try {
            botWorker = new Worker('bot-worker.js');
            botWorker.onmessage = (event) => {
                const data = event.data || {};
                const requestId = data.requestId;
                if (!botWorkerPending.has(requestId)) return;
                const pending = botWorkerPending.get(requestId);
                botWorkerPending.delete(requestId);
                pending.resolve(data);
            };
            botWorker.onerror = () => {
                botWorkerPending.forEach(pending => pending.reject(new Error('Bot worker failed.')));
                botWorkerPending.clear();
                if (botWorker) {
                    botWorker.terminate();
                    botWorker = null;
                }
            };
        } catch (error) {
            botWorker = null;
        }
    }

    function terminateBotWorker() {
        if (botWorker) {
            botWorker.terminate();
            botWorker = null;
        }
        botWorkerPending.forEach(pending => pending.reject(new Error('Bot worker terminated.')));
        botWorkerPending.clear();
    }

    function isClockEnabled() {
        return timeControl !== 'none' && timeControlOptions[timeControl];
    }

    function formatClock(ms) {
        const safeMs = Math.max(0, ms | 0);
        const totalSeconds = Math.floor(safeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function renderClocks() {
        if (!whiteClockElement || !blackClockElement) return;
        const enabled = isClockEnabled();
        whiteClockElement.classList.toggle('option-hidden', !enabled);
        blackClockElement.classList.toggle('option-hidden', !enabled);
        if (!enabled) return;

        whiteClockElement.textContent = formatClock(whiteTimeMs);
        blackClockElement.textContent = formatClock(blackTimeMs);
        whiteClockElement.classList.toggle('active', clockRunningColor === 'w' && !gameIsOver);
        blackClockElement.classList.toggle('active', clockRunningColor === 'b' && !gameIsOver);
        whiteClockElement.classList.toggle('low-time', whiteTimeMs <= 30000);
        blackClockElement.classList.toggle('low-time', blackTimeMs <= 30000);
    }

    function stopClock() {
        if (clockIntervalId !== null) {
            clearInterval(clockIntervalId);
            clockIntervalId = null;
        }
        clockRunningColor = null;
        clockLastTickAt = 0;
        renderClocks();
    }

    function handleClockTimeout(loserColor) {
        if (gameIsOver) return;
        stopClock();
        gameEndedByTimeout = true;
        pendingTimeoutWinner = loserColor === 'w' ? 'b' : 'w';
        checkGameStatus(true);
    }

    function tickClock() {
        if (!isClockEnabled() || gameIsOver || promotionState.active || !clockRunningColor) return;
        const now = Date.now();
        const delta = Math.max(0, now - clockLastTickAt);
        clockLastTickAt = now;

        if (clockRunningColor === 'w') whiteTimeMs -= delta;
        else blackTimeMs -= delta;

        if (whiteTimeMs <= 0) {
            whiteTimeMs = 0;
            renderClocks();
            handleClockTimeout('w');
            return;
        }
        if (blackTimeMs <= 0) {
            blackTimeMs = 0;
            renderClocks();
            handleClockTimeout('b');
            return;
        }
        renderClocks();
    }

    function startClockForCurrentPlayer() {
        stopClock();
        if (!isClockEnabled() || gameIsOver || promotionState.active) return;
        clockRunningColor = currentPlayer;
        clockLastTickAt = Date.now();
        clockIntervalId = setInterval(tickClock, 200);
        renderClocks();
    }

    function initializeClocksForNewGame() {
        gameEndedByTimeout = false;
        pendingTimeoutWinner = null;
        const option = timeControlOptions[timeControl] || timeControlOptions.none;
        whiteTimeMs = option.initialMs;
        blackTimeMs = option.initialMs;
        stopClock();
        renderClocks();
    }

    function createTimelineSnapshot() {
        return {
            gameState: window.ChessLogic.createStateSnapshot(gameState),
            capturedWhitePieces: capturedWhitePieces.slice(),
            capturedBlackPieces: capturedBlackPieces.slice(),
            moveHistory: moveHistory.map(move => ({ ...move })),
            lastMove: lastMove ? { ...lastMove } : null,
            whiteTimeMs,
            blackTimeMs,
            gameEndedByTimeout,
            pendingTimeoutWinner
        };
    }

    function pushTimelineSnapshot() {
        if (!gameState) return;
        if (timelineIndex < positionTimeline.length - 1) {
            positionTimeline = positionTimeline.slice(0, timelineIndex + 1);
        }
        positionTimeline.push(createTimelineSnapshot());
        timelineIndex = positionTimeline.length - 1;
    }

    function restoreFromTimelineSnapshot(snapshot) {
        if (!snapshot || !gameState) return;
        window.ChessLogic.restoreStateSnapshot(gameState, snapshot.gameState);
        syncStateRefs();
        capturedWhitePieces = snapshot.capturedWhitePieces.slice();
        capturedBlackPieces = snapshot.capturedBlackPieces.slice();
        moveHistory = snapshot.moveHistory.map(move => ({ ...move }));
        lastMove = snapshot.lastMove ? { ...snapshot.lastMove } : null;
        whiteTimeMs = snapshot.whiteTimeMs;
        blackTimeMs = snapshot.blackTimeMs;
        gameEndedByTimeout = !!snapshot.gameEndedByTimeout;
        pendingTimeoutWinner = snapshot.pendingTimeoutWinner || null;
        selectedSquare = null;
        legalMoves = [];
        invalidateBotTurn();
        updateTurnIndicator();
        renderCapturedPieces();
        renderMoveHistory();
        renderBoard();
        checkGameStatus();
        if (!gameIsOver) startClockForCurrentPlayer();
        if (shouldBotPlay()) scheduleBotMove();
    }

    function jumpToPly(plyIndex) {
        if (plyIndex < 0 || plyIndex >= positionTimeline.length) return;
        timelineIndex = plyIndex;
        restoreFromTimelineSnapshot(positionTimeline[plyIndex]);
    }

    // --- Audio Setup ---
    const sounds = {
        move: new Audio('assets/sounds/move.mp3'), capture: new Audio('assets/sounds/capture.mp3'),
        check: new Audio('assets/sounds/check.mp3'), select: new Audio('assets/sounds/select.mp3'),
        promote: new Audio('assets/sounds/promote.mp3'), start: new Audio('assets/sounds/game-start.mp3'),
        end: new Audio('assets/sounds/game-end.mp3'),
    };
    function playSound(soundName) {
        if (!isMuted && sounds[soundName]) {
            sounds[soundName].currentTime = 0;
            sounds[soundName].play().catch(e => console.error("Audio play failed:", e));
        }
    }
    function toggleMute() {
        isMuted = !isMuted;
        soundIcon.className = isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
        localStorage.setItem('chessMuted', isMuted);
    }
    function loadSoundPreference() {
        isMuted = localStorage.getItem('chessMuted') === 'true';
        soundIcon.className = isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
    }

    // --- Preferences ---
    function loadPreferences() {
        const savedMode = localStorage.getItem('chessGameMode') || 'local';
        applyGameMode(savedMode);
        const savedDifficulty = localStorage.getItem('chessBotDifficulty') || 'easy';
        applyBotDifficulty(savedDifficulty);
        const savedTimeControl = localStorage.getItem('chessTimeControl') || 'none';
        applyTimeControl(savedTimeControl);
        const savedTheme = localStorage.getItem('chessTheme') || 'default';
        applyTheme(savedTheme);
        const savedIndicatorPref = localStorage.getItem('showIndicators') !== 'false';
        indicatorCheckbox.checked = savedIndicatorPref;
        applyIndicatorPreference(savedIndicatorPref);
        loadSoundPreference();
    }
    function applyGameMode(modeName) {
        gameMode = modeName === 'bot' ? 'bot' : 'local';
        modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === gameMode));
        difficultySetting.classList.toggle('option-hidden', gameMode !== 'bot');
        invalidateBotTurn();
        if (!gameContainer.classList.contains('hidden') && !gameIsOver) {
            startClockForCurrentPlayer();
            if (shouldBotPlay()) {
                scheduleBotMove();
            }
        }
        updateBotLevelIndicator();
        localStorage.setItem('chessGameMode', gameMode);
    }
    function applyBotDifficulty(level) {
        const allowedLevels = ['easy', 'medium', 'hard', 'expert'];
        botDifficulty = allowedLevels.includes(level) ? level : 'easy';
        if (botDifficultySelect) botDifficultySelect.value = botDifficulty;
        updateBotLevelIndicator();
        if (gameMode === 'bot') {
            showToast(getBotMoodPhrase(), 900);
        }
        localStorage.setItem('chessBotDifficulty', botDifficulty);
    }
    function applyTimeControl(controlName) {
        timeControl = timeControlOptions[controlName] ? controlName : 'none';
        if (timeControlSelect) timeControlSelect.value = timeControl;
        localStorage.setItem('chessTimeControl', timeControl);
        if (!gameContainer.classList.contains('hidden') && moveHistory.length === 0 && !gameIsOver) {
            initializeClocksForNewGame();
            startClockForCurrentPlayer();
            return;
        }
        renderClocks();
    }
    function applyTheme(themeName) {
        bodyElement.className = '';
        if (themeName !== 'default') bodyElement.classList.add(`theme-${themeName}`);
        themeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === themeName));
        if (themeSelect) themeSelect.value = themeName;
        localStorage.setItem('chessTheme', themeName);
        renderPromotionModalPieces();
    }
    function applyIndicatorPreference(show) {
        boardContainer.classList.toggle('indicators-hidden', !show);
        localStorage.setItem('showIndicators', show);
    }
    function openAppearanceModal() {
        if (!appearanceModal) return;
        appearanceModal.classList.remove('hidden');
    }
    function closeAppearanceModal() {
        if (!appearanceModal) return;
        appearanceModal.classList.add('hidden');
    }
    function applyBoardFlip() {
        isBoardFlipped = !isBoardFlipped;
        boardAreaWrapper.classList.toggle('flipped', isBoardFlipped); // Flip coordinates
        renderBoard(); // Render board (will handle its internal flip class)
        renderCapturedPieces();
        renderMoveHistory();
    }
    function updateBotLevelIndicator() {
        if (!botLevelIndicator) return;
        if (gameMode !== 'bot') {
            botLevelIndicator.textContent = '';
            botLevelIndicator.classList.add('option-hidden');
            return;
        }
        const levelLabel = difficultyLabels[botDifficulty] || difficultyLabels.easy;
        botLevelIndicator.textContent = `Bot ${levelLabel}`;
        botLevelIndicator.classList.remove('option-hidden');
    }
    function showToast(message, durationMs = 1200) {
        if (!toastContainer || !message) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toastContainer.appendChild(toast);

        const fadeDelay = Math.max(260, durationMs);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 180);
        }, fadeDelay);
    }
    function pickRandom(list) {
        if (!Array.isArray(list) || list.length === 0) return '';
        return list[Math.floor(Math.random() * list.length)] || '';
    }
    function pickRandomDifferent(list, previousValue) {
        if (!Array.isArray(list) || list.length === 0) return '';
        if (list.length === 1) return list[0];
        let candidate = pickRandom(list);
        let guard = 0;
        while (candidate === previousValue && guard < 8) {
            candidate = pickRandom(list);
            guard++;
        }
        return candidate;
    }
    function getGamePhaseKey() {
        const moveCount = moveHistory.length;
        const capturedCount = capturedWhitePieces.length + capturedBlackPieces.length;
        if (moveCount < 10 && capturedCount < 4) return 'opening';
        if (moveCount < 36) return 'middlegame';
        return 'endgame';
    }
    function getBotMoodPhrase() {
        const moodList = botMoodPhrases[botDifficulty] || botMoodPhrases.easy;
        return pickRandom(moodList) || `Bot mood: ${difficultyLabels[botDifficulty] || 'Easy'}`;
    }
    function getBotThinkingPhrase() {
        const profile = botPhraseProfiles[botDifficulty] || botPhraseProfiles.easy;
        const phase = getGamePhaseKey();
        const lead = pickRandom(profile.leads);
        const action = pickRandom(profile.actions);
        const phaseHint = pickRandom(phaseHints[phase] || phaseHints.middlegame);
        const variants = [
            `${lead}. ${action}.`,
            `${lead}... ${action}.`,
            `${lead}. ${phaseHint}.`,
            `${action}. ${phaseHint}.`
        ];
        const message = pickRandomDifferent(variants, lastBotToastText);
        lastBotToastText = message;
        return message || 'Thinking...';
    }
    function shouldBotPlay() {
        return gameMode === 'bot' && currentPlayer === botColor && !gameIsOver && !promotionState.active;
    }
    function getBotThinkTime() {
        if (window.ChessBotAI && typeof window.ChessBotAI.getThinkTime === 'function') {
            return window.ChessBotAI.getThinkTime(botDifficulty);
        }
        return 250;
    }
    function clearBotMoveTimeout() {
        if (botMoveTimeoutId !== null) {
            clearTimeout(botMoveTimeoutId);
            botMoveTimeoutId = null;
        }
        botWorkerPending.forEach(pending => pending.reject(new Error('Bot move cancelled.')));
        botWorkerPending.clear();
    }
    function invalidateBotTurn() {
        botTurnToken++;
        clearBotMoveTimeout();
        boardContainer.classList.remove('interaction-disabled');
        stopClock();
    }
    function recordCurrentPosition() {
        if (!gameState) return;
        window.ChessLogic.recordCurrentPosition(gameState);
        syncStateRefs();
    }
    function createStateSnapshot() {
        if (!gameState) return null;
        return window.ChessLogic.createStateSnapshot(gameState);
    }
    function restoreStateSnapshot(snapshot) {
        if (!gameState || !snapshot) return;
        window.ChessLogic.restoreStateSnapshot(gameState, snapshot);
        syncStateRefs();
    }
    function applySimulatedMove(move) {
        if (!gameState) return;
        window.ChessLogic.applyMove(gameState, move, {
            switchPlayer: true,
            recordPosition: false
        });
        syncStateRefs();
    }
    function getAllLegalMovesWithContext(playerColor) {
        if (!gameState) return [];
        return window.ChessLogic.getAllLegalMovesWithContext(gameState, playerColor);
    }
    function getBotRepetitionCounts() {
        const normalized = {};
        const source = positionRepetitionCounts || {};
        for (const [fullKey, seen] of Object.entries(source)) {
            const parts = fullKey.split('|');
            if (parts.length < 4) continue;
            const side = parts[0];
            const rows = parts.slice(3).join('|');
            const simpleKey = `${side}|${rows}`;
            normalized[simpleKey] = (normalized[simpleKey] || 0) + seen;
        }
        return normalized;
    }
    function chooseBotMoveMainThread() {
        const legalMoves = getAllLegalMovesWithContext(botColor);
        if (!legalMoves.length) return null;
        if (!window.ChessBotAI || typeof window.ChessBotAI.chooseMove !== 'function') {
            return legalMoves[Math.floor(Math.random() * legalMoves.length)];
        }
        return window.ChessBotAI.chooseMove({
            difficulty: botDifficulty,
            botColor: botColor,
            repetitionCounts: getBotRepetitionCounts(),
            adapters: {
                getAllLegalMovesWithContext,
                isInCheck,
                getBoardState: () => board,
                getKingPositions: () => ({
                    white: { ...whiteKingPos },
                    black: { ...blackKingPos }
                }),
                createStateSnapshot,
                restoreStateSnapshot,
                applySimulatedMove
            }
        });
    }
    function requestBotMoveFromWorker() {
        if (!botWorker || !gameState || !shouldBotPlay()) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            const requestId = ++botWorkerRequestId;
            botWorkerPending.set(requestId, { resolve, reject });
            botWorker.postMessage({
                requestId,
                difficulty: botDifficulty,
                botColor: botColor,
                repetitionCounts: getBotRepetitionCounts(),
                stateSnapshot: window.ChessLogic.createStateSnapshot(gameState)
            });
        });
    }
    async function chooseBotMoveAsync() {
        if (!shouldBotPlay()) return null;
        const legalMoves = getAllLegalMovesWithContext(botColor);
        if (!legalMoves.length) return null;
        if (!botWorker) return chooseBotMoveMainThread();
        try {
            const response = await requestBotMoveFromWorker();
            if (!shouldBotPlay()) return null;
            if (!response || response.error) return chooseBotMoveMainThread();
            return response.move || null;
        } catch (error) {
            if (!shouldBotPlay()) return null;
            return chooseBotMoveMainThread();
        }
    }
    function scheduleBotMove() {
        if (!shouldBotPlay()) return;
        clearBotMoveTimeout();
        const turnToken = ++botTurnToken;
        boardContainer.classList.add('interaction-disabled');
        const thinkingLine = getBotThinkingPhrase();
        const thinkTime = getBotThinkTime();
        showToast(thinkingLine, Math.max(thinkTime + 260, 900));
        botMoveTimeoutId = setTimeout(async () => {
            botMoveTimeoutId = null;
            if (turnToken !== botTurnToken) {
                boardContainer.classList.remove('interaction-disabled');
                return;
            }
            if (!shouldBotPlay()) {
                boardContainer.classList.remove('interaction-disabled');
                return;
            }
            const botMove = await chooseBotMoveAsync();
            if (turnToken !== botTurnToken) {
                boardContainer.classList.remove('interaction-disabled');
                return;
            }
            if (!shouldBotPlay()) {
                boardContainer.classList.remove('interaction-disabled');
                return;
            }
            if (!botMove) {
                checkGameStatus();
                boardContainer.classList.remove('interaction-disabled');
                return;
            }
            makeMove(botMove, { source: 'bot' });
            if (!gameIsOver && !shouldBotPlay()) {
                boardContainer.classList.remove('interaction-disabled');
            }
        }, thinkTime);
    }

    // --- Navigation ---
    function goToHomeScreen() {
        invalidateBotTurn();
        gameContainer.classList.add('hidden'); splashScreen.classList.remove('hidden');
        gameOverMessage.classList.add('hidden'); promotionModal.classList.add('hidden');
        gameIsOver = false; selectedSquare = null; legalMoves = [];
        gameEndedByTimeout = false;
        pendingTimeoutWinner = null;
        renderClocks();
    }

    // --- Initialization ---
    function setupBoard() {
        invalidateBotTurn();
        ensureChessLogicLoaded();
        gameState = window.ChessLogic.createInitialState();
        syncStateRefs();

        selectedSquare = null;
        legalMoves = [];
        gameIsOver = false;
        capturedWhitePieces = [];
        capturedBlackPieces = [];
        moveHistory = [];
        lastMove = null;
        positionTimeline = [];
        timelineIndex = 0;
        promotionState.active = false;
        gameEndedByTimeout = false;
        pendingTimeoutWinner = null;

        updateTurnIndicator();
        clearHighlights(); // Clears selected/legal moves state and styles
        // Clear last move state (visuals cleared in renderBoard)
        lastMove = null;
        boardAreaWrapper.classList.toggle('flipped', isBoardFlipped); // Sync coordinate flip state

        renderBoard(); // Initial render (will clear old highlights visually)
        renderCapturedPieces(); renderMoveHistory(); renderPromotionModalPieces();

        checkIndicator.textContent = '';
        gameOverMessage.classList.add('hidden'); promotionModal.classList.add('hidden');
        boardContainer.classList.remove('interaction-disabled');
        updateBotLevelIndicator();
        initializeClocksForNewGame();
        recordCurrentPosition();
        pushTimelineSnapshot();
        playSound('start');
        startClockForCurrentPlayer();
        if (shouldBotPlay()) scheduleBotMove();
    }

    // --- Rendering Functions ---
    function renderBoard() {
        // --- No need to clear highlights here anymore ---

        boardElement.innerHTML = ''; // Clear board visually

        // Set CSS variables for piece images
        for (const pieceCode in pieceSVGs) {
            document.documentElement.style.setProperty(`--${pieceCode}`, `url('${pieceSVGs[pieceCode]}')`);
        }

        // Apply board flip class directly for visual rotation
        boardElement.classList.toggle('flipped', isBoardFlipped);

        const rowStart = 0; const rowEnd = 8; const rowIncr = 1;
        const colStart = 0; const colEnd = 8; const colIncr = 1;

        for (let r = rowStart; r < rowEnd; r += rowIncr) {
            for (let c = colStart; c < colEnd; c += colIncr) {
                const square = document.createElement('div');
                square.classList.add('square');
                const actualRow = r; const actualCol = c;
                square.classList.add((actualRow + actualCol) % 2 === 0 ? 'light' : 'dark');
                square.dataset.row = actualRow; square.dataset.col = actualCol;
                square.addEventListener('dragover', handleSquareDragOver);
                square.addEventListener('drop', handleSquareDrop);

                // Apply current last move highlights based on lastMove state
                if (lastMove) {
                    if (actualRow === lastMove.fromRow && actualCol === lastMove.fromCol) {
                        square.classList.add('last-move-from');
                    }
                    if (actualRow === lastMove.toRow && actualCol === lastMove.toCol) {
                        square.classList.add('last-move-to');
                    }
                }

                const pieceCode = board[actualRow][actualCol];
                if (pieceCode) {
                    const pieceElement = document.createElement('div');
                    pieceElement.classList.add('piece', pieceCode);
                    pieceElement.draggable = !gameIsOver && !promotionState.active;
                    pieceElement.addEventListener('dragstart', handlePieceDragStart);
                    pieceElement.addEventListener('dragend', handlePieceDragEnd);
                    square.appendChild(pieceElement);

                    // Apply animation only to the piece on the destination square
                    if (lastMove && actualRow === lastMove.toRow && actualCol === lastMove.toCol) {
                        pieceElement.classList.add('piece-pop-in');
                        setTimeout(() => {
                            const currentPiece = square.querySelector('.piece');
                            if (currentPiece) currentPiece.classList.remove('piece-pop-in');
                        }, 250);
                    }
                }
                square.addEventListener('click', handleSquareClick);
                boardElement.appendChild(square);
            }
        }

        // Reapply selection/legal move highlights based on current state
        if (selectedSquare) {
            highlightSelectedSquare(selectedSquare.row, selectedSquare.col);
            highlightLegalMoves(legalMoves);
        }
        highlightKingInCheck(); // Ensure check highlight is correct
    }

    function renderCapturedPieces() {
        capturedWhiteContainer.innerHTML = ''; capturedBlackContainer.innerHTML = '';
        const renderList = (list, container) => {
            list.sort((a, b) => (pieceValues[a[1]] || 0) - (pieceValues[b[1]] || 0));
            list.forEach(pieceCode => {
                const icon = document.createElement('div');
                icon.className = `captured-piece-icon ${pieceCode}`;
                icon.style.backgroundImage = `var(--${pieceCode})`;
                container.appendChild(icon);
            });
        };
        renderList(capturedWhitePieces, capturedBlackContainer); // Black captures white
        renderList(capturedBlackPieces, capturedWhiteContainer); // White captures black
    }

    function renderMoveHistory() {
        moveListElement.innerHTML = ''; let movePair = null;
        for (let i = 0; i < moveHistory.length; i++) {
            const move = moveHistory[i]; const moveIndex = Math.floor(i / 2);
            const isWhiteMove = i % 2 === 0;
            if (isWhiteMove) {
                movePair = document.createElement('li');
                const moveNumSpan = document.createElement('span');
                moveNumSpan.textContent = `${moveIndex + 1}.`;
                movePair.appendChild(moveNumSpan); moveListElement.appendChild(movePair);
            }
            if (movePair) {
                const moveSanSpan = document.createElement('span');
                moveSanSpan.textContent = move.san;
                moveSanSpan.dataset.ply = String(i + 1);
                moveSanSpan.classList.add('move-entry');
                if (i + 1 === timelineIndex) moveSanSpan.classList.add('current-move');
                movePair.appendChild(moveSanSpan);
            }
        }
        moveListElement.scrollTop = moveListElement.scrollHeight;
    }

    function renderPromotionModalPieces() {
        const color = promotionState.color || currentPlayer;
        promotionChoices.querySelectorAll('button').forEach(btn => {
            const pieceType = btn.dataset.piece; const pieceCode = color + pieceType;
            const pieceDiv = btn.querySelector('.piece');
             if (pieceDiv && pieceSVGs[pieceCode]) { pieceDiv.style.backgroundImage = `url('${pieceSVGs[pieceCode]}')`; }
             else if (pieceDiv) { pieceDiv.style.backgroundImage = 'none'; }
        });
    }

    function highlightKingInCheck() {
        document.querySelectorAll('.check-highlight').forEach(el => el.classList.remove('check-highlight'));
        if (!gameIsOver && isInCheck(currentPlayer)) {
            const kingPos = currentPlayer === 'w' ? whiteKingPos : blackKingPos;
            const kingSquare = boardElement.querySelector(`.square[data-row='${kingPos.row}'][data-col='${kingPos.col}']`);
            if (kingSquare) kingSquare.classList.add('check-highlight');
            checkIndicator.textContent = 'Check!';
        } else { checkIndicator.textContent = ''; }
    }

    // --- Highlighting Logic ---
    function clearHighlights() { // Clears selection and legal move indicators ONLY
        dragSource = null;
        if (selectedSquare && selectedSquare.element) {
             selectedSquare.element.classList.remove('selected'); // Remove style from piece
        }
        boardElement.querySelectorAll('.legal-move-indicator, .legal-capture-indicator').forEach(el => {
            el.classList.remove('legal-move-indicator', 'legal-capture-indicator');
        });
        // Does NOT clear last move highlight
    }
    function highlightSelectedSquare(row, col) {
         const squareElement = boardElement.querySelector(`.square[data-row='${row}'][data-col='${col}']`);
         const pieceElement = squareElement ? squareElement.querySelector('.piece') : null;
         if (pieceElement) {
             pieceElement.classList.add('selected'); // Apply style to piece
             // Update element reference in state IF the selectedSquare object exists
             if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                selectedSquare.element = pieceElement;
             }
         } else if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
             selectedSquare.element = null; // Clear element ref if piece not found
         }
    }
    function highlightLegalMoves(moves) {
         moves.forEach(move => {
            const moveSquare = boardElement.querySelector(`.square[data-row='${move.row}'][data-col='${move.col}']`);
            if (moveSquare) {
                const indicatorClass = (move.captured || move.isEnPassant || board[move.row][move.col])
                    ? 'legal-capture-indicator'
                    : 'legal-move-indicator';
                moveSquare.classList.add(indicatorClass);
            }
        });
    }

    function tryMoveFromTo(fromRow, fromCol, toRow, toCol) {
        const piece = board[fromRow][fromCol];
        if (!piece || piece[0] !== currentPlayer) return false;
        const moves = calculateLegalMoves(fromRow, fromCol);
        const selectedMove = moves.find(move => move.row === toRow && move.col === toCol);
        if (!selectedMove) return false;
        const moveDetails = {
            fromRow,
            fromCol,
            toRow,
            toCol,
            piece,
            captured: selectedMove.captured || board[toRow][toCol],
            isEnPassant: !!selectedMove.isEnPassant,
            isCastling: !!selectedMove.isCastling,
            castleSide: selectedMove.castleSide || null
        };
        makeMove(moveDetails, { source: 'human' });
        return true;
    }

    // --- Event Handling ---
    function handlePieceDragStart(event) {
        if (gameIsOver || promotionState.active || shouldBotPlay()) {
            event.preventDefault();
            return;
        }
        const pieceEl = event.currentTarget;
        const square = pieceEl.parentElement;
        if (!square) return;
        const fromRow = Number(square.dataset.row);
        const fromCol = Number(square.dataset.col);
        const piece = board[fromRow][fromCol];
        if (!piece || piece[0] !== currentPlayer) {
            event.preventDefault();
            return;
        }
        dragSource = { row: fromRow, col: fromCol };
        selectPiece(fromRow, fromCol);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `${fromRow},${fromCol}`);
        }
    }
    function handlePieceDragEnd() {
        dragSource = null;
    }
    function handleSquareDragOver(event) {
        if (!dragSource || gameIsOver || promotionState.active || shouldBotPlay()) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }
    function handleSquareDrop(event) {
        if (!dragSource || gameIsOver || promotionState.active || shouldBotPlay()) return;
        event.preventDefault();
        const targetSquare = event.currentTarget;
        const toRow = Number(targetSquare.dataset.row);
        const toCol = Number(targetSquare.dataset.col);
        const moved = tryMoveFromTo(dragSource.row, dragSource.col, toRow, toCol);
        if (!moved) {
            clearHighlights();
            selectedSquare = null;
            legalMoves = [];
        }
        dragSource = null;
    }

    function handleSquareClick(event) {
        if (gameIsOver || promotionState.active || shouldBotPlay()) return;

        const squareElement = event.currentTarget;
        const row = parseInt(squareElement.dataset.row);
        const col = parseInt(squareElement.dataset.col);
        const clickedPiece = board[row][col];
        const clickedPieceColor = clickedPiece ? clickedPiece[0] : null;

        if (selectedSquare) { // A piece is already selected
            const selectedMove = legalMoves.find(move => move.row === row && move.col === col);
            if (selectedMove) { // Clicked on a legal move square
                tryMoveFromTo(selectedSquare.row, selectedSquare.col, row, col);
            } else if (clickedPieceColor === currentPlayer && (row !== selectedSquare.row || col !== selectedSquare.col)) {
                // Clicked on a different piece of the same color - switch selection
                selectPiece(row, col); playSound('select');
            } else {
                // Clicked on an invalid square, opponent's piece, or the same selected piece again - deselect
                clearHighlights(); selectedSquare = null; legalMoves = [];
            }
        } else if (clickedPieceColor === currentPlayer) { // No piece selected, clicked on own piece
            selectPiece(row, col); playSound('select');
        }
    }

    function selectPiece(row, col) {
        clearHighlights(); // Clear previous selection style
        selectedSquare = { row, col, element: null }; // Store coords, reset element ref
        legalMoves = calculateLegalMoves(row, col);
        highlightSelectedSquare(row, col); // Applies style and stores element ref in selectedSquare.element
        highlightLegalMoves(legalMoves);
    }

    // --- Game Logic ---
    function makeMove(moveDetails, options = {}) {
        if (!gameState) return;
        const source = options.source || 'human';
        if (source === 'bot' && !shouldBotPlay()) return;
        if (source !== 'bot' && shouldBotPlay()) return;

        const movingPiece = board[moveDetails.fromRow][moveDetails.fromCol];
        if (!movingPiece) return;

        const promotionRank = movingPiece[0] === 'w' ? 0 : 7;
        const isPromotionMove = movingPiece[1] === 'P' && moveDetails.toRow === promotionRank;
        if (isPromotionMove && !moveDetails.promotionChoice) {
            initiatePromotion(moveDetails.toRow, moveDetails.toCol, movingPiece[0], moveDetails);
            return;
        }

        finalizeMove(moveDetails);
    }

    function initiatePromotion(row, col, color, originalMoveDetails) {
        promotionState = {
            active: true, row: row, col: col, color: color,
            callback: (promotedPieceType) => {
                originalMoveDetails.promotionChoice = promotedPieceType;
                promotionModal.classList.add('hidden'); promotionState.active = false;
                finalizeMove(originalMoveDetails); // Resume game flow
            }
        };
        renderPromotionModalPieces();
        promotionModal.classList.remove('hidden');
    }

    function finalizeMove(moveDetails) {
        if (!gameState) return;

        if (lastMove) {
            const prevFromSquare = boardElement.querySelector(`.square[data-row='${lastMove.fromRow}'][data-col='${lastMove.fromCol}']`);
            const prevToSquare = boardElement.querySelector(`.square[data-row='${lastMove.toRow}'][data-col='${lastMove.toCol}']`);
            if (prevFromSquare) prevFromSquare.classList.remove('last-move-from');
            if (prevToSquare) prevToSquare.classList.remove('last-move-to');
        }

        const stateBeforeMove = window.ChessLogic.createStateSnapshot(gameState);
        const moveResult = window.ChessLogic.applyMove(gameState, moveDetails, {
            switchPlayer: true,
            recordPosition: true
        });
        if (!moveResult) return;

        syncStateRefs();
        lastMove = {
            fromRow: moveResult.fromRow,
            fromCol: moveResult.fromCol,
            toRow: moveResult.toRow,
            toCol: moveResult.toCol
        };

        if (moveResult.captured) {
            if (moveResult.captured[0] === 'w') capturedWhitePieces.push(moveResult.captured);
            else capturedBlackPieces.push(moveResult.captured);
            renderCapturedPieces();
        }

        if (moveResult.promotion) playSound('promote');
        else if (moveResult.captured) playSound('capture');
        else playSound('move');

        const moveDataForHistory = { ...moveResult };
        moveDataForHistory.san = window.ChessLogic.moveToSAN(stateBeforeMove, moveResult, gameState);
        moveHistory.push(moveDataForHistory);

        updateTurnIndicator();
        clearHighlights();
        selectedSquare = null;
        legalMoves = [];
        renderBoard();
        checkGameStatus();
        renderMoveHistory();
        pushTimelineSnapshot();
        startClockForCurrentPlayer();

        if (shouldBotPlay()) {
            scheduleBotMove();
        }
    }

    function updateTurnIndicator() { turnIndicator.textContent = `${currentPlayer === 'w' ? 'White' : 'Black'}'s Turn`; }

    // --- Move Calculation & Validation ---
    function calculateLegalMoves(row, col) {
        if (!gameState) return [];
        return window.ChessLogic.calculateLegalMoves(gameState, row, col);
    }
    function isInCheck(playerColor) {
        if (!gameState) return false;
        return window.ChessLogic.isInCheck(gameState, playerColor);
    }
    function getAllLegalMoves(playerColor) {
        if (!gameState) return [];
        return window.ChessLogic.getAllLegalMovesWithContext(gameState, playerColor);
    }

    // --- Check/Checkmate/Stalemate/Draw Logic ---
    function checkGameStatus() {
        if (!gameState) return;
        if (gameEndedByTimeout && pendingTimeoutWinner) {
            gameIsOver = true;
            winnerMessage.textContent = `${pendingTimeoutWinner === 'w' ? 'White' : 'Black'} wins on time!`;
            gameOverMessage.classList.remove('hidden');
            boardContainer.classList.add('interaction-disabled');
            checkIndicator.textContent = '';
            lastMove = null;
            stopClock();
            playSound('end');
            return;
        }
        const status = window.ChessLogic.getGameStatus(gameState);

        if (status.isGameOver) {
            gameIsOver = true;
            let endMessage = '';
            if (status.reason === 'checkmate') {
                endMessage = `${status.winner === 'w' ? 'White' : 'Black'} wins by Checkmate!`;
            } else if (status.reason === 'stalemate') {
                endMessage = `Stalemate! It's a draw.`;
            } else if (status.reason === 'threefold') {
                endMessage = `Draw by threefold repetition.`;
            } else if (status.reason === 'fifty-move') {
                endMessage = `Draw by the 50-move rule.`;
            } else if (status.reason === 'insufficient-material') {
                endMessage = `Draw by insufficient material.`;
            } else {
                endMessage = `Game drawn.`;
            }

            winnerMessage.textContent = endMessage;
            gameOverMessage.classList.remove('hidden');
            boardContainer.classList.add('interaction-disabled');
            checkIndicator.textContent = '';

            if (lastMove) {
                const fromSq = boardElement.querySelector(`.square[data-row='${lastMove.fromRow}'][data-col='${lastMove.fromCol}']`);
                const toSq = boardElement.querySelector(`.square[data-row='${lastMove.toRow}'][data-col='${lastMove.toCol}']`);
                if (fromSq) fromSq.classList.remove('last-move-from');
                if (toSq) toSq.classList.remove('last-move-to');
            }
            lastMove = null;
            stopClock();
            playSound('end');
            return;
        }

        gameIsOver = false;
        if (status.isCheck) playSound('check');
        highlightKingInCheck();
        gameOverMessage.classList.add('hidden');
        boardContainer.classList.remove('interaction-disabled');
    }

    // --- UI Interaction & Event Listeners ---
    startGameBtn.addEventListener('click', () => {
        closeAppearanceModal();
        splashScreen.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        setupBoard();
    });
    if (openAppearanceBtn) {
        openAppearanceBtn.addEventListener('click', openAppearanceModal);
    }
    if (closeAppearanceBtn) {
        closeAppearanceBtn.addEventListener('click', closeAppearanceModal);
    }
    if (appearanceModalBackdrop) {
        appearanceModalBackdrop.addEventListener('click', closeAppearanceModal);
    }
    resetGameBtn.addEventListener('click', setupBoard);
    goHomeBtn.addEventListener('click', goToHomeScreen);
    backToHomeBtn.addEventListener('click', goToHomeScreen);
    soundToggleBtn.addEventListener('click', toggleMute);
    flipBoardBtn.addEventListener('click', applyBoardFlip); // Corrected function call
    modeButtons.forEach(button => button.addEventListener('click', () => applyGameMode(button.dataset.mode)));
    if (botDifficultySelect) {
        botDifficultySelect.addEventListener('change', (event) => applyBotDifficulty(event.target.value));
    }
    if (timeControlSelect) {
        timeControlSelect.addEventListener('change', (event) => applyTimeControl(event.target.value));
    }
    if (themeSelect) {
        themeSelect.addEventListener('change', (event) => applyTheme(event.target.value));
    }
    themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.theme)));
    indicatorCheckbox.addEventListener('change', (event) => { applyIndicatorPreference(event.target.checked); if (selectedSquare) highlightLegalMoves(legalMoves); });
    moveListElement.addEventListener('click', (event) => {
        const target = event.target.closest('.move-entry');
        if (!target || promotionState.active) return;
        const ply = Number(target.dataset.ply);
        if (!Number.isInteger(ply)) return;
        jumpToPly(ply);
    });
    promotionChoices.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button && promotionState.active && promotionState.callback) {
            const chosenPiece = button.dataset.piece; promotionState.callback(chosenPiece);
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && appearanceModal && !appearanceModal.classList.contains('hidden')) {
            closeAppearanceModal();
        }
    });

    // --- Initial Load ---
    initBotWorker();
    window.addEventListener('beforeunload', terminateBotWorker);
    loadPreferences();

}); // End DOMContentLoaded
