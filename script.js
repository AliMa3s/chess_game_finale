document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements ---
    const boardElement = document.getElementById('chess-board');
    const turnIndicator = document.getElementById('turn-indicator');
    const checkIndicator = document.getElementById('check-indicator');
    const botLevelIndicator = document.getElementById('bot-level-indicator');
    const toastContainer = document.getElementById('toast-container');
    const splashScreen = document.getElementById('splash-screen');
    const startGameBtn = document.getElementById('start-game-btn');
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
    const indicatorCheckbox = document.getElementById('toggle-indicators');
    const flipBoardBtn = document.getElementById('flip-board-btn');
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const soundIcon = soundToggleBtn.querySelector('i');
    const promotionModal = document.getElementById('promotion-modal');
    const promotionChoices = promotionModal.querySelector('.promotion-choices');
    const capturedWhiteContainer = document.getElementById('captured-by-white');
    const capturedBlackContainer = document.getElementById('captured-by-black');
    const moveListElement = document.getElementById('move-list');
    const bodyElement = document.body;


    // --- Game State ---
    let gameState = null;
    let board = [];
    let currentPlayer = 'w';
    let selectedSquare = null; // Stores { row, col, element } (element is the piece div)
    let legalMoves = [];
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
        if (gameMode === 'bot' && !gameContainer.classList.contains('hidden') && shouldBotPlay()) {
            scheduleBotMove();
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
    function applyTheme(themeName) {
        bodyElement.className = '';
        if (themeName !== 'default') bodyElement.classList.add(`theme-${themeName}`);
        themeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === themeName));
        localStorage.setItem('chessTheme', themeName);
        renderPromotionModalPieces();
    }
    function applyIndicatorPreference(show) {
        boardContainer.classList.toggle('indicators-hidden', !show);
        localStorage.setItem('showIndicators', show);
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
    }
    function invalidateBotTurn() {
        botTurnToken++;
        clearBotMoveTimeout();
        boardContainer.classList.remove('interaction-disabled');
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
    function chooseBotMove() {
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
    function scheduleBotMove() {
        if (!shouldBotPlay()) return;
        clearBotMoveTimeout();
        const turnToken = ++botTurnToken;
        boardContainer.classList.add('interaction-disabled');
        const thinkingLine = getBotThinkingPhrase();
        const thinkTime = getBotThinkTime();
        showToast(thinkingLine, Math.max(thinkTime + 260, 900));
        botMoveTimeoutId = setTimeout(() => {
            botMoveTimeoutId = null;
            if (turnToken !== botTurnToken) {
                boardContainer.classList.remove('interaction-disabled');
                return;
            }
            if (!shouldBotPlay()) {
                boardContainer.classList.remove('interaction-disabled');
                return;
            }
            const botMove = chooseBotMove();
            if (turnToken !== botTurnToken) {
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
        promotionState.active = false;

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
        recordCurrentPosition();
        playSound('start');
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
                if (i === moveHistory.length - 1) moveSanSpan.classList.add('current-move');
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

    // --- Event Handling ---
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
                const moveDetails = {
                    fromRow: selectedSquare.row, fromCol: selectedSquare.col,
                    toRow: row, toCol: col,
                    piece: board[selectedSquare.row][selectedSquare.col],
                    captured: selectedMove.captured || board[row][col],
                    isEnPassant: !!selectedMove.isEnPassant,
                    isCastling: !!selectedMove.isCastling,
                    castleSide: selectedMove.castleSide || null
                };
                makeMove(moveDetails, { source: 'human' });
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
    startGameBtn.addEventListener('click', () => { splashScreen.classList.add('hidden'); gameContainer.classList.remove('hidden'); setupBoard(); });
    resetGameBtn.addEventListener('click', setupBoard);
    goHomeBtn.addEventListener('click', goToHomeScreen);
    backToHomeBtn.addEventListener('click', goToHomeScreen);
    soundToggleBtn.addEventListener('click', toggleMute);
    flipBoardBtn.addEventListener('click', applyBoardFlip); // Corrected function call
    modeButtons.forEach(button => button.addEventListener('click', () => applyGameMode(button.dataset.mode)));
    if (botDifficultySelect) {
        botDifficultySelect.addEventListener('change', (event) => applyBotDifficulty(event.target.value));
    }
    themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.theme)));
    indicatorCheckbox.addEventListener('change', (event) => { applyIndicatorPreference(event.target.checked); if (selectedSquare) highlightLegalMoves(legalMoves); });
    promotionChoices.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button && promotionState.active && promotionState.callback) {
            const chosenPiece = button.dataset.piece; promotionState.callback(chosenPiece);
        }
    });

    // --- Initial Load ---
    loadPreferences();

}); // End DOMContentLoaded
