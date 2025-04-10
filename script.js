document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements ---
    const boardElement = document.getElementById('chess-board');
    const turnIndicator = document.getElementById('turn-indicator');
    const checkIndicator = document.getElementById('check-indicator');
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
    const themeButtons = document.querySelectorAll('.theme-btn');
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
    let currentMoveNumber = 1;
    let lastMove = null; // Stores { fromRow, fromCol, toRow, toCol }


    // --- Constants ---
    const pieceValues = { K: 1000, Q: 9, R: 5, B: 3, N: 3, P: 1 };
    const pieceSVGs = { // Ensure these paths match your files
        wP: 'assets/pieces/white_pawn.svg', wR: 'assets/pieces/white_rook.svg', wN: 'assets/pieces/white_knight.svg',
        wB: 'assets/pieces/white_bishop.svg', wQ: 'assets/pieces/white_queen.svg', wK: 'assets/pieces/white_king.svg',
        bP: 'assets/pieces/black_pawn.svg', bR: 'assets/pieces/black_rook.svg', bN: 'assets/pieces/black_knight.svg',
        bB: 'assets/pieces/black_bishop.svg', bQ: 'assets/pieces/black_queen.svg', bK: 'assets/pieces/black_king.svg',
    };
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1']; // Rank 1 is row 7

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
        const savedTheme = localStorage.getItem('chessTheme') || 'default';
        applyTheme(savedTheme);
        const savedIndicatorPref = localStorage.getItem('showIndicators') !== 'false';
        indicatorCheckbox.checked = savedIndicatorPref;
        applyIndicatorPreference(savedIndicatorPref);
        loadSoundPreference();
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

    // --- Navigation ---
    function goToHomeScreen() {
        gameContainer.classList.add('hidden'); splashScreen.classList.remove('hidden');
        gameOverMessage.classList.add('hidden'); promotionModal.classList.add('hidden');
        boardContainer.classList.remove('interaction-disabled');
        gameIsOver = false; selectedSquare = null; legalMoves = [];
    }

    // --- Initialization ---
    function setupBoard() {
        board = [
            ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'], ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
            Array(8).fill(null), Array(8).fill(null), Array(8).fill(null), Array(8).fill(null),
            ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'], ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
        ];
        whiteKingPos = { row: 7, col: 4 }; blackKingPos = { row: 0, col: 4 };
        currentPlayer = 'w'; selectedSquare = null; legalMoves = []; gameIsOver = false;
        capturedWhitePieces = []; capturedBlackPieces = []; moveHistory = []; currentMoveNumber = 1;
        lastMove = null; promotionState.active = false;

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
        playSound('start');
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
                const indicatorClass = board[move.row][move.col] ? 'legal-capture-indicator' : 'legal-move-indicator';
                moveSquare.classList.add(indicatorClass);
            }
        });
    }

    // --- Event Handling ---
    function handleSquareClick(event) {
        if (gameIsOver || promotionState.active) return;

        const squareElement = event.currentTarget;
        const row = parseInt(squareElement.dataset.row);
        const col = parseInt(squareElement.dataset.col);
        const clickedPiece = board[row][col];
        const clickedPieceColor = clickedPiece ? clickedPiece[0] : null;

        if (selectedSquare) { // A piece is already selected
            const isValidMove = legalMoves.some(move => move.row === row && move.col === col);
            if (isValidMove) { // Clicked on a legal move square
                const moveDetails = {
                    fromRow: selectedSquare.row, fromCol: selectedSquare.col,
                    toRow: row, toCol: col,
                    piece: board[selectedSquare.row][selectedSquare.col],
                    captured: board[row][col]
                };
                makeMove(moveDetails);
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
    function makeMove(moveDetails) {
        // Update board state
        board[moveDetails.toRow][moveDetails.toCol] = moveDetails.piece;
        board[moveDetails.fromRow][moveDetails.fromCol] = null;
        // Update King pos
        if (moveDetails.piece === 'wK') whiteKingPos = { row: moveDetails.toRow, col: moveDetails.toCol };
        if (moveDetails.piece === 'bK') blackKingPos = { row: moveDetails.toRow, col: moveDetails.toCol };
        // Handle captures
        if (moveDetails.captured) {
            if (moveDetails.captured[0] === 'w') capturedWhitePieces.push(moveDetails.captured);
            else capturedBlackPieces.push(moveDetails.captured);
            renderCapturedPieces(); playSound('capture');
        } else { playSound('move'); }

        // Check for Pawn Promotion
        const promotionRank = moveDetails.piece[0] === 'w' ? 0 : 7;
        if (moveDetails.piece[1] === 'P' && moveDetails.toRow === promotionRank) {
             // Update last move state *before* initiating promotion
             lastMove = { fromRow: moveDetails.fromRow, fromCol: moveDetails.fromCol, toRow: moveDetails.toRow, toCol: moveDetails.toCol };
             // Don't render here, let initiatePromotion handle showing modal over existing state
             initiatePromotion(moveDetails.toRow, moveDetails.toCol, moveDetails.piece[0], moveDetails);
        } else {
            finalizeMove(moveDetails); // Directly finalize non-promoting moves
        }
    }

    function initiatePromotion(row, col, color, originalMoveDetails) {
        promotionState = {
            active: true, row: row, col: col, color: color,
            callback: (promotedPieceType) => {
                board[row][col] = color + promotedPieceType; playSound('promote');
                originalMoveDetails.promotion = promotedPieceType; // Update details for SAN
                promotionModal.classList.add('hidden'); promotionState.active = false;
                finalizeMove(originalMoveDetails); // Resume game flow
            }
        };
        renderPromotionModalPieces();
        promotionModal.classList.remove('hidden');
        console.log('Promotion initiated for', color, 'at', row, col);
    }

    function finalizeMove(moveDetails) {
          // --- FIX: Clear previous last move highlights FIRST ---
          if (lastMove) {
              const prevFromSquare = boardElement.querySelector(`.square[data-row='${lastMove.fromRow}'][data-col='${lastMove.fromCol}']`);
              const prevToSquare = boardElement.querySelector(`.square[data-row='${lastMove.toRow}'][data-col='${lastMove.toCol}']`);
              if (prevFromSquare) prevFromSquare.classList.remove('last-move-from');
              if (prevToSquare) prevToSquare.classList.remove('last-move-to');
          }

          // Update lastMove state *before* rendering
          lastMove = { fromRow: moveDetails.fromRow, fromCol: moveDetails.fromCol, toRow: moveDetails.toRow, toCol: moveDetails.toCol };

          // Store Move for History
          const moveDataForHistory = { ...moveDetails, turn: currentPlayer, moveNumber: currentMoveNumber };
          moveDataForHistory.san = moveToSAN(moveDataForHistory);
          moveHistory.push(moveDataForHistory);

          // Switch Player & Clear Selections
          switchPlayer();
          clearHighlights(); // Clears .selected, .legal-* indicators
          selectedSquare = null; legalMoves = [];

          // Render Board (Applies new lastMove highlight via lastMove state)
          renderBoard();

          // Check Game Status (updates check indicator, SAN suffix, game over state)
          checkGameStatus();

          // Update History Display (shows final SAN)
          renderMoveHistory();

          // Increment Move Number
          if (currentPlayer === 'w') { currentMoveNumber++; }
      }

    function switchPlayer() { currentPlayer = currentPlayer === 'w' ? 'b' : 'w'; updateTurnIndicator(); }
    function updateTurnIndicator() { turnIndicator.textContent = `${currentPlayer === 'w' ? 'White' : 'Black'}'s Turn`; }

    // --- Move Calculation & Validation (Keep ALL helper functions: calculateLegalMoves, isValid, etc.) ---
    function calculateLegalMoves(row, col) {
        const piece = board[row][col]; if (!piece) return [];
        const color = piece[0]; const type = piece[1]; let potentialMoves = [];
        switch (type) { case 'P': potentialMoves = getPawnMoves(row, col, color); break; case 'R': potentialMoves = getRookMoves(row, col, color); break; case 'N': potentialMoves = getKnightMoves(row, col, color); break; case 'B': potentialMoves = getBishopMoves(row, col, color); break; case 'Q': potentialMoves = getQueenMoves(row, col, color); break; case 'K': potentialMoves = getKingMoves(row, col, color); break; }
        const legalMovesResult = potentialMoves.filter(move => {
            const originalDestPiece = board[move.row][move.col]; const movingPiece = board[row][col];
            board[move.row][move.col] = movingPiece; board[row][col] = null;
            let originalKingPos = null; let kingMoved = false;
            if (type === 'K') { kingMoved = true; originalKingPos = color === 'w' ? { ...whiteKingPos } : { ...blackKingPos }; if(color === 'w') whiteKingPos = { row: move.row, col: move.col }; else blackKingPos = { row: move.row, col: move.col }; }
            const check = isInCheck(color);
            board[row][col] = movingPiece; board[move.row][move.col] = originalDestPiece;
             if (kingMoved && originalKingPos) { if(color === 'w') whiteKingPos = originalKingPos; else blackKingPos = originalKingPos; }
            return !check;
        }); return legalMovesResult;
     }
    function isValid(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
    function getPieceColor(r, c) { if (!isValid(r, c) || !board[r][c]) return null; return board[r][c][0]; }
    function addMoveIfValid(moves, r, c, targetR, targetC, color) { if (isValid(targetR, targetC)) { const targetPiece = board[targetR][targetC]; const targetColor = targetPiece ? targetPiece[0] : null; if (targetColor !== color) { moves.push({ row: targetR, col: targetC }); } return targetColor === null; } return false; }
    function getPawnMoves(r, c, color) { const moves = []; const direction = color === 'w' ? -1 : 1; const startRow = color === 'w' ? 6 : 1; const oneForwardR = r + direction; if (isValid(oneForwardR, c) && !board[oneForwardR][c]) { moves.push({ row: oneForwardR, col: c }); const twoForwardR = r + 2 * direction; if (r === startRow && isValid(twoForwardR, c) && !board[twoForwardR][c]) { moves.push({ row: twoForwardR, col: c }); } } const captureOffsets = [-1, 1]; captureOffsets.forEach(offset => { const targetC = c + offset; const targetR = r + direction; if (isValid(targetR, targetC) && board[targetR][targetC] && getPieceColor(targetR, targetC) !== color) { moves.push({ row: targetR, col: targetC }); } }); /* TODO: Add En Passant */ return moves; }
    function getSlidingMoves(r, c, color, directions) { const moves = []; directions.forEach(([dr, dc]) => { for (let i = 1; ; i++) { const targetR = r + i * dr; const targetC = c + i * dc; if (!isValid(targetR, targetC)) break; const targetPiece = board[targetR][targetC]; const targetColor = targetPiece ? targetPiece[0] : null; if (targetColor === color) break; moves.push({ row: targetR, col: targetC }); if (targetColor !== null) break; } }); return moves; }
    function getRookMoves(r, c, color) { return getSlidingMoves(r, c, color, [[-1, 0], [1, 0], [0, -1], [0, 1]]); }
    function getBishopMoves(r, c, color) { return getSlidingMoves(r, c, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]]); }
    function getQueenMoves(r, c, color) { return [...getRookMoves(r, c, color), ...getBishopMoves(r, c, color)]; }
    function getKnightMoves(r, c, color) { const moves = []; const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]; offsets.forEach(([dr, dc]) => { const targetR = r + dr; const targetC = c + dc; if (isValid(targetR, targetC)) { const targetColor = getPieceColor(targetR, targetC); if (targetColor !== color) { moves.push({ row: targetR, col: targetC }); } } }); return moves; }
    function getKingMoves(r, c, color) { const moves = []; for (let dr = -1; dr <= 1; dr++) { for (let dc = -1; dc <= 1; dc++) { if (dr === 0 && dc === 0) continue; const targetR = r + dr; const targetC = c + dc; if (isValid(targetR, targetC)) { const targetColor = getPieceColor(targetR, targetC); if (targetColor !== color) { moves.push({ row: targetR, col: targetC }); } } } } /* TODO: Add Castling */ return moves; }
    function isSquareAttacked(r, c, attackerColor) { for (let row = 0; row < 8; row++) { for (let col = 0; col < 8; col++) { const piece = board[row][col]; if (piece && piece[0] === attackerColor) { const potentialMoves = getPotentialMovesForPiece(row, col, attackerColor); if (potentialMoves.some(move => move.row === r && move.col === c)) { return true; } } } } return false; }
    function getPotentialMovesForPiece(r, c, color) { const piece = board[r][c]; if (!piece || piece[0] !== color) return []; const type = piece[1]; switch (type) { case 'P': const attackMoves = []; const direction = color === 'w' ? -1 : 1; const attackOffsets = [-1, 1]; attackOffsets.forEach(offset => { const targetC = c + offset; const targetR = r + direction; if (isValid(targetR, targetC)) { attackMoves.push({ row: targetR, col: targetC }); } }); return attackMoves; case 'R': return getSlidingMoves(r, c, color, [[-1, 0], [1, 0], [0, -1], [0, 1]]); case 'N': return getKnightMoves(r, c, color); case 'B': return getSlidingMoves(r, c, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]]); case 'Q': return getQueenMoves(r, c, color); case 'K': const kingAttackMoves = []; for (let dr = -1; dr <= 1; dr++) { for (let dc = -1; dc <= 1; dc++) { if (dr === 0 && dc === 0) continue; if (isValid(r + dr, c + dc)) { kingAttackMoves.push({row: r + dr, col: c + dc}) } } } return kingAttackMoves; default: return []; } }
    function isInCheck(playerColor) { const kingPos = playerColor === 'w' ? whiteKingPos : blackKingPos; const opponentColor = playerColor === 'w' ? 'b' : 'w'; return isSquareAttacked(kingPos.row, kingPos.col, opponentColor); }
    function getAllLegalMoves(playerColor) { let allMoves = []; for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { const piece = board[r][c]; if (piece && piece[0] === playerColor) { const moves = calculateLegalMoves(r, c); allMoves.push(...moves); } } } return allMoves; }

    // --- SAN Conversion ---
    function getAlgebraicSquare(row, col) { if (row < 0 || row > 7 || col < 0 || col > 7) return "??"; return files[col] + ranks[row]; }
    function moveToSAN(moveData) {
        const { fromRow, fromCol, toRow, toCol, piece, captured, promotion } = moveData;
        if (!piece) return "InvalidMove"; const pieceType = piece[1]; let san = '';
        if (pieceType === 'P') { if (captured) { san += files[fromCol] + 'x'; } san += getAlgebraicSquare(toRow, toCol); if (promotion) { san += '=' + promotion; } }
        else { san += pieceType; /* TODO: Add disambiguation */ if (captured) { san += 'x'; } san += getAlgebraicSquare(toRow, toCol); }
        return san;
    }

    // --- Check/Checkmate/Stalemate Logic ---
    function checkGameStatus() {
        const possibleMoves = getAllLegalMoves(currentPlayer);
        let endMessage = ''; let isCheck = false; let isCheckmate = false; let isStalemate = false;
        if (possibleMoves.length === 0) {
            gameIsOver = true;
            if (isInCheck(currentPlayer)) { isCheckmate = true; endMessage = `${currentPlayer === 'w' ? 'Black' : 'White'} wins by Checkmate!`; playSound('end'); }
            else { isStalemate = true; endMessage = `Stalemate! It's a draw.`; playSound('end'); }
            winnerMessage.textContent = endMessage; gameOverMessage.classList.remove('hidden');
            boardContainer.classList.add('interaction-disabled'); checkIndicator.textContent = '';
            // Clear last move highlight visually on game end
             if (lastMove) { // Check if lastMove exists before trying to query
                 const fromSq = boardElement.querySelector(`.square[data-row='${lastMove.fromRow}'][data-col='${lastMove.fromCol}']`);
                 const toSq = boardElement.querySelector(`.square[data-row='${lastMove.toRow}'][data-col='${lastMove.toCol}']`);
                 if(fromSq) fromSq.classList.remove('last-move-from');
                 if(toSq) toSq.classList.remove('last-move-to');
             }
             lastMove = null; // Clear state too
        } else {
            gameIsOver = false; isCheck = isInCheck(currentPlayer);
            if (isCheck) { playSound('check'); }
            highlightKingInCheck();
            gameOverMessage.classList.add('hidden'); boardContainer.classList.remove('interaction-disabled');
        }
        // Update SAN suffix for the *last* move in history
        if (moveHistory.length > 0) {
            const lastRecordedMove = moveHistory[moveHistory.length - 1];
            // Check if the status applies to the *move just made* by the previous player
            if (lastRecordedMove.turn !== currentPlayer || gameIsOver) {
                let sanChanged = false; const currentSan = lastRecordedMove.san;
                let newSan = currentSan.replace(/[+#]$/, ''); // Remove existing suffix first
                if (isCheckmate) { if (!currentSan.endsWith('#')) { newSan += '#'; sanChanged = true; } }
                else if (isCheck) { if (!currentSan.endsWith('+')) { newSan += '+'; sanChanged = true; } }
                else if (currentSan.match(/[+#]$/)) { sanChanged = true; } // Remove if no longer check/mate
                if (sanChanged) {
                    lastRecordedMove.san = newSan;
                    // Don't re-render history here, finalizeMove handles it
                }
            }
        }
    }

    // --- UI Interaction & Event Listeners ---
    startGameBtn.addEventListener('click', () => { splashScreen.classList.add('hidden'); gameContainer.classList.remove('hidden'); setupBoard(); });
    resetGameBtn.addEventListener('click', setupBoard);
    goHomeBtn.addEventListener('click', goToHomeScreen);
    backToHomeBtn.addEventListener('click', goToHomeScreen);
    soundToggleBtn.addEventListener('click', toggleMute);
    flipBoardBtn.addEventListener('click', applyBoardFlip); // Corrected function call
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