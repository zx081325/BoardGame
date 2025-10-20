class GameClient {
    constructor() {
        this.ws = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.playerId = null;
        this.heartbeatInterval = null;
        this.roomRefreshInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        
        this.initializeEventListeners();
        this.checkStoredSession();
    }
    
    initializeEventListeners() {
        // 登录/注册表单切换
        document.getElementById('loginTab').addEventListener('click', () => this.switchTab('login'));
        document.getElementById('registerTab').addEventListener('click', () => this.switchTab('register'));
        
        // 登录/注册按钮
        document.getElementById('loginButton').addEventListener('click', () => this.handleLogin());
        document.getElementById('registerButton').addEventListener('click', () => this.handleRegister());
        
        // 大厅功能
        document.getElementById('createRoomButton').addEventListener('click', () => this.createRoom());
        document.getElementById('joinRoomButton').addEventListener('click', () => this.joinRoomById());
        document.getElementById('refreshRoomsButton').addEventListener('click', () => this.refreshRooms());
        document.getElementById('logoutButton').addEventListener('click', () => this.logout());
        
        // 游戏功能
        document.getElementById('leaveRoomButton').addEventListener('click', () => this.leaveRoom());
        document.getElementById('newGameButton').addEventListener('click', () => this.startNewGame());
        
        // 井字棋棋盘点击事件
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const row = parseInt(e.target.dataset.row);
                const col = parseInt(e.target.dataset.col);
                this.makeMove(row, col);
            });
        });
        
        // 宝可梦游戏拿取硬币按钮
        document.getElementById('takeCoinsButton').addEventListener('click', () => this.takeCoins());
        
        // 回车键登录
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        
        document.getElementById('confirmPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleRegister();
        });
    }
    
    checkStoredSession() {
        const storedToken = localStorage.getItem('sessionToken');
        const storedUser = localStorage.getItem('currentUser');
        
        if (storedToken && storedUser) {
            this.sessionToken = storedToken;
            this.currentUser = JSON.parse(storedUser);
            this.connectWebSocket();
        }
    }
    
    switchTab(tab) {
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.add('active');
            loginForm.classList.remove('active');
        }
    }
    
    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        if (!username || !password) {
            this.showMessage('请输入用户名和密码', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.sessionToken = result.session_token;
                this.currentUser = result.user;
                
                // 保存到本地存储
                localStorage.setItem('sessionToken', this.sessionToken);
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                
                this.showMessage('登录成功！', 'success');
                this.connectWebSocket();
            } else {
                this.showMessage(result.detail || '登录失败', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('网络错误，请重试', 'error');
        }
    }
    
    async handleRegister() {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();
        
        if (!username || !password || !confirmPassword) {
            this.showMessage('请填写所有字段', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showMessage('两次输入的密码不一致', 'error');
            return;
        }
        
        if (username.length < 3 || username.length > 20) {
            this.showMessage('用户名长度必须在3-20个字符之间', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showMessage('密码长度至少6个字符', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showMessage('注册成功！请登录', 'success');
                this.switchTab('login');
                document.getElementById('loginUsername').value = username;
                document.getElementById('registerUsername').value = '';
                document.getElementById('registerPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            } else {
                this.showMessage(result.detail || '注册失败', 'error');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showMessage('网络错误，请重试', 'error');
        }
    }
    
    connectWebSocket() {
        if (!this.sessionToken) {
            this.showLoginScreen();
            return;
        }
        
        this.updateConnectionStatus('connecting');
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${this.sessionToken}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus('connected');
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.showLobbyScreen();
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus('disconnected');
            this.stopHeartbeat();
            this.attemptReconnect();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('disconnected');
        };
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.showMessage('连接失败，请刷新页面重试', 'error');
            this.logout();
            return;
        }
        
        this.reconnectAttempts++;
        this.showMessage(`连接断开，正在重连... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info');
        
        setTimeout(() => {
            this.connectWebSocket();
        }, this.reconnectDelay * this.reconnectAttempts);
    }
    
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendMessage({ action: 'heartbeat' });
            }
        }, 30000); // 每30秒发送一次心跳
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    startRoomRefresh() {
        this.stopRoomRefresh();
        this.roomRefreshInterval = setInterval(() => {
            if (this.currentRoom === null) { // 只在大厅页面刷新
                this.refreshRooms();
            }
        }, 10000); // 每10秒刷新一次
    }

    stopRoomRefresh() {
        if (this.roomRefreshInterval) {
            clearInterval(this.roomRefreshInterval);
            this.roomRefreshInterval = null;
        }
    }
    
    updateConnectionStatus(status) {
        const indicator = document.querySelector('.status-indicator');
        const text = document.querySelector('.status-text');
        
        indicator.className = `status-indicator ${status}`;
        
        switch (status) {
            case 'connected':
                text.textContent = '已连接';
                break;
            case 'connecting':
                text.textContent = '连接中...';
                break;
            case 'disconnected':
                text.textContent = '已断开';
                break;
        }
    }
    
    handleMessage(message) {
        console.log('Received message:', message);
        
        switch (message.type) {
            case 'error':
                this.showMessage(message.message, 'error');
                if (message.message.includes('会话无效')) {
                    this.logout();
                }
                break;
                
            case 'reconnected':
                this.showMessage(message.message, 'success');
                this.currentRoom = message.room_info;
                this.showGameScreen();
                this.updateGameUI();
                break;
                
            case 'room_created':
                this.currentRoom = message.room_info;
                this.showGameScreen();
                this.updateGameUI();
                this.showMessage('房间创建成功！', 'success');
                break;
                
            case 'room_joined':
                this.currentRoom = message.room_info;
                this.showGameScreen();
                this.updateGameUI();
                this.showMessage('成功加入房间！', 'success');
                break;
                
            case 'room_updated':
                this.currentRoom = message.room_info;
                this.updateGameUI();
                break;
                
            case 'game_updated':
                this.currentRoom = message.room_info;
                this.updateGameUI();
                this.checkGameEnd();
                break;
                
            case 'rooms_list':
                this.updateRoomsList(message.rooms);
                break;
                
            case 'player_disconnected':
                this.showMessage(`${message.player_name} 已断开连接`, 'info');
                this.currentRoom = message.room_info;
                this.updateGameUI();
                break;
                
            case 'player_left':
                this.showMessage(message.message || `${message.player_name} 离开了房间`, 'info');
                this.currentRoom = message.room_info;
                this.updateGameUI();
                break;
                
            case 'room_left':
                this.showMessage(message.message || '已离开房间', 'success');
                this.currentRoom = null;
                this.showLobbyScreen();
                this.refreshRooms();
                break;
                
            case 'heartbeat_response':
                // 心跳响应，无需处理
                break;
        }
    }
    
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    createRoom() {
        const roomName = document.getElementById('roomName').value.trim() || `${this.currentUser.username}的房间`;
        const gameType = document.getElementById('gameType').value;
        
        if (!gameType) {
            this.showMessage('请选择游戏类型', 'error');
            return;
        }
        
        this.sendMessage({
            action: 'create_room',
            room_name: roomName,
            game_type: gameType
        });
        
        // 清空输入框
        document.getElementById('roomName').value = '';
        document.getElementById('gameType').value = '';
    }
    
    joinRoomById() {
        const roomId = document.getElementById('roomId').value.trim();
        
        if (!roomId) {
            this.showMessage('请输入房间ID', 'error');
            return;
        }
        
        this.sendMessage({
            action: 'join_room',
            room_id: roomId
        });
        
        // 清空输入框
        document.getElementById('roomId').value = '';
    }
    
    joinRoom(roomId) {
        this.sendMessage({
            action: 'join_room',
            room_id: roomId
        });
    }
    
    leaveRoom() {
        // 如果当前在房间中，向服务器发送离开房间消息
        if (this.currentRoom) {
            this.sendMessage({
                action: 'leave_room'
            });
        } else {
            // 如果没有在房间中，直接清理本地状态
            this.currentRoom = null;
            this.playerId = null;
            this.showLobbyScreen();
            this.refreshRooms();
        }
    }
    
    makeMove(row, col) {
        if (!this.currentRoom || this.currentRoom.status !== 'playing') {
            return;
        }
        
        this.sendMessage({
            action: 'make_move',
            move_data: { row, col }
        });
    }
    
    startNewGame() {
        this.sendMessage({ action: "start_game" });
    }
    
    takeCoins() {
        if (!this.currentRoom || this.currentRoom.game_type !== 'pokemon_game') {
            this.showMessage('只能在宝可梦游戏中拿取硬币', 'error');
            return;
        }
        
        // 获取选择的硬币数量
        const coins = {
            red: parseInt(document.getElementById('selectRed').value) || 0,
            pink: parseInt(document.getElementById('selectPink').value) || 0,
            blue: parseInt(document.getElementById('selectBlue').value) || 0,
            yellow: parseInt(document.getElementById('selectYellow').value) || 0,
            black: parseInt(document.getElementById('selectBlack').value) || 0
        };
        
        // 过滤掉数量为0的硬币
        const filteredCoins = {};
        for (const [color, count] of Object.entries(coins)) {
            if (count > 0) {
                filteredCoins[color] = count;
            }
        }
        
        if (Object.keys(filteredCoins).length === 0) {
            this.showMessage('请选择要拿取的硬币', 'error');
            return;
        }
        
        // 发送拿取硬币请求
        this.sendMessage({
            action: "game_action",
            game_action: "take_coins",
            action_data: {
                coins: filteredCoins
            }
        });
        
        // 清空选择
        this.clearCoinSelection();
    }
    
    clearCoinSelection() {
        document.getElementById('selectRed').value = 0;
        document.getElementById('selectPink').value = 0;
        document.getElementById('selectBlue').value = 0;
        document.getElementById('selectYellow').value = 0;
        document.getElementById('selectBlack').value = 0;
    }
    
    refreshRooms() {
        this.sendMessage({ action: 'get_rooms' });
    }

    async loadGameTypes() {
        try {
            const response = await fetch('/api/games');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('获取到的游戏类型数据:', data);
            
            const gameTypeSelect = document.getElementById('gameType');
            
            // 检查数据结构
            if (!data || !data.games || !Array.isArray(data.games)) {
                throw new Error('无效的游戏类型数据格式');
            }
            
            // 添加游戏类型选项
            data.games.forEach(game => {
                const option = document.createElement('option');
                option.value = game.type;
                option.textContent = game.name;
                if (game.rules && game.rules.description) {
                    option.title = game.rules.description; // 添加游戏描述作为提示
                }
                gameTypeSelect.appendChild(option);
            });
        } catch (error) {
            console.error('加载游戏类型失败:', error);
            this.showMessage('加载游戏类型失败: ' + error.message, 'error');
        }
    }
    
    async logout() {
        try {
            if (this.sessionToken) {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.sessionToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        // 清理本地状态
        this.sessionToken = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.playerId = null;
        
        // 清理本地存储
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('currentUser');
        
        // 关闭WebSocket连接
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.stopHeartbeat();
        this.showLoginScreen();
        this.showMessage('已退出登录', 'info');
    }
    
    showLoginScreen() {
        this.hideAllScreens();
        document.getElementById('loginScreen').classList.add('active');
        this.updateConnectionStatus('disconnected');
    }
    
    showLobbyScreen() {
        this.hideAllScreens();
        document.getElementById('lobbyScreen').classList.add('active');
        document.getElementById('currentUsername').textContent = this.currentUser.username;
        this.refreshRooms();
        this.loadGameTypes();
        this.startRoomRefresh();
    }
    
    showGameScreen() {
        this.hideAllScreens();
        document.getElementById('gameScreen').classList.add('active');
        this.stopRoomRefresh();
    }
    
    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }
    
    updateRoomsList(rooms) {
        const roomsList = document.getElementById('roomsList');
        
        if (rooms.length === 0) {
            roomsList.innerHTML = '<div class="no-rooms">暂无房间，创建一个开始游戏吧！</div>';
            return;
        }
        
        roomsList.innerHTML = rooms.map(room => `
            <div class="room-card" onclick="gameClient.joinRoom('${room.room_id}')">
                <h4>${room.room_name}</h4>
                <div class="room-info">
                    <span class="room-status ${room.status}">${this.getStatusText(room.status)}</span>
                    <span>ID: ${room.room_id}</span>
                </div>
                <div class="room-players">
                    玩家: ${room.players.length}/${room.max_players}
                </div>
                <div class="room-game-type">
                    游戏: ${this.getGameTypeName(room.game_type)}
                </div>
            </div>
        `).join('');
    }
    
    getStatusText(status) {
        switch(status) {
            case 'waiting': return '等待中';
            case 'playing': return '游戏中';
            case 'finished': return '已结束';
            default: return status;
        }
    }
    
    getGameTypeName(gameType) {
        switch(gameType) {
            case 'tic_tac_toe': return '井字棋';
            case 'reverse_tic_tac_toe': return '反井格棋';
            default: return gameType;
        }
    }
    
    updateGameUI() {
        if (!this.currentRoom) return;
        
        // 更新房间信息
        document.getElementById('gameRoomName').textContent = this.currentRoom.room_name;
        document.getElementById('gameRoomId').textContent = `房间ID: ${this.currentRoom.room_id}`;
        
        // 更新玩家信息
        const player1 = document.getElementById('player1');
        const player2 = document.getElementById('player2');
        
        if (this.currentRoom.players.length > 0) {
            const p1 = this.currentRoom.players[0];
            player1.querySelector('.player-name').textContent = p1.name;
            player1.classList.toggle('active', this.currentRoom.current_player === p1.user_id);
        } else {
            player1.querySelector('.player-name').textContent = '等待玩家...';
            player1.classList.remove('active');
        }
        
        if (this.currentRoom.players.length > 1) {
            const p2 = this.currentRoom.players[1];
            player2.querySelector('.player-name').textContent = p2.name;
            player2.classList.toggle('active', this.currentRoom.current_player === p2.user_id);
        } else {
            player2.querySelector('.player-name').textContent = '等待玩家...';
            player2.classList.remove('active');
        }
        
        // 更新游戏状态
        this.updateGameStatus();
        
        // 根据游戏类型显示不同的游戏界面
        if (this.currentRoom.game_type === 'tic_tac_toe' || this.currentRoom.game_type === 'reverse_tic_tac_toe') {
            document.getElementById('ticTacToeBoard').style.display = 'block';
            document.getElementById('pokemonGameBoard').style.display = 'none';
            this.updateTicTacToeBoard();
        } else if (this.currentRoom.game_type === 'pokemon_game') {
            document.getElementById('ticTacToeBoard').style.display = 'none';
            document.getElementById('pokemonGameBoard').style.display = 'block';
            this.updatePokemonGameBoard();
        } else {
            document.getElementById('ticTacToeBoard').style.display = 'none';
            document.getElementById('pokemonGameBoard').style.display = 'none';
        }
    }
    
    updateGameStatus() {
        const statusText = document.getElementById('gameStatusText');
        const turnIndicator = document.getElementById('currentTurnIndicator');
        
        if (this.currentRoom.status === 'waiting') {
            statusText.textContent = '等待玩家加入...';
            turnIndicator.textContent = '';
        } else if (this.currentRoom.status === 'playing') {
            statusText.textContent = '游戏进行中';
            const currentPlayer = this.currentRoom.players.find(p => p.id === this.currentRoom.current_player);
            if (currentPlayer) {
                turnIndicator.textContent = `轮到 ${currentPlayer.name}`;
            }
        } else if (this.currentRoom.status === 'finished') {
            if (this.currentRoom.game_state.winner) {
                const winner = this.currentRoom.players.find(p => 
                    (p === this.currentRoom.players[0] && this.currentRoom.game_state.winner === 'X') ||
                    (p === this.currentRoom.players[1] && this.currentRoom.game_state.winner === 'O')
                );
                
                if (this.currentRoom.game_type === 'reverse_tic_tac_toe') {
                    // 反井格棋：显示获胜者（没有连成线的玩家）
                    statusText.textContent = `游戏结束 - ${winner ? winner.name : '未知玩家'} 获胜！（避免连线成功）`;
                } else {
                    // 普通井字棋
                    statusText.textContent = `游戏结束 - ${winner ? winner.name : '未知玩家'} 获胜！`;
                }
            } else if (this.currentRoom.game_state.is_draw) {
                statusText.textContent = '游戏结束 - 平局！';
            }
            turnIndicator.textContent = '';
            document.getElementById('newGameButton').style.display = 'block';
        }
    }
    
    updateTicTacToeBoard() {
        const board = this.currentRoom.game_state.board;
        const cells = document.querySelectorAll('.cell');
        
        cells.forEach((cell, index) => {
            const row = Math.floor(index / 3);
            const col = index % 3;
            const value = board[row][col];
            
            cell.textContent = value;
            cell.classList.toggle('disabled', 
                value !== '' || 
                this.currentRoom.status !== 'playing' ||
                this.currentRoom.current_player !== this.getCurrentPlayerId()
            );
        });
    }
    
    getCurrentPlayerId() {
        if (!this.currentUser || !this.currentRoom) return null;
        
        const currentPlayer = this.currentRoom.players.find(p => p.user_id === this.currentUser.id);
        return currentPlayer ? currentPlayer.user_id : null;
    }
    
    checkGameEnd() {
        if (this.currentRoom.status === 'finished') {
            if (this.currentRoom.game_state.winner) {
                const winner = this.currentRoom.players.find(p => 
                    (p === this.currentRoom.players[0] && this.currentRoom.game_state.winner === 'X') ||
                    (p === this.currentRoom.players[1] && this.currentRoom.game_state.winner === 'O')
                );
                this.showMessage(`游戏结束！${winner ? winner.name : '未知玩家'} 获胜！`, 'success');
            } else if (this.currentRoom.game_state.is_draw) {
                this.showMessage('游戏结束！平局！', 'info');
            }
        }
    }
    
    updatePokemonGameBoard() {
        if (!this.currentRoom || !this.currentRoom.game_state) return;
        
        const gameState = this.currentRoom.game_state;
        
        // 更新公共硬币池
        if (gameState.coin_pool) {
            document.getElementById('poolRed').textContent = gameState.coin_pool.red || 0;
            document.getElementById('poolPink').textContent = gameState.coin_pool.pink || 0;
            document.getElementById('poolBlue').textContent = gameState.coin_pool.blue || 0;
            document.getElementById('poolYellow').textContent = gameState.coin_pool.yellow || 0;
            document.getElementById('poolBlack').textContent = gameState.coin_pool.black || 0;
        }
        
        // 更新玩家硬币
        const currentPlayer = this.currentRoom.players.find(p => p.user_id === this.currentUser.id);
        if (currentPlayer && gameState.player_coins && gameState.player_coins[currentPlayer.user_id]) {
            const playerCoins = gameState.player_coins[currentPlayer.user_id];
            document.getElementById('playerRed').textContent = playerCoins.red || 0;
            document.getElementById('playerPink').textContent = playerCoins.pink || 0;
            document.getElementById('playerBlue').textContent = playerCoins.blue || 0;
            document.getElementById('playerYellow').textContent = playerCoins.yellow || 0;
            document.getElementById('playerBlack').textContent = playerCoins.black || 0;
        }
        
        // 更新对手硬币（如果有）
        const opponent = this.currentRoom.players.find(p => p.user_id !== this.currentUser.id);
        if (opponent && gameState.player_coins && gameState.player_coins[opponent.user_id]) {
            const opponentCoins = gameState.player_coins[opponent.user_id];
            document.getElementById('opponentRed').textContent = opponentCoins.red || 0;
            document.getElementById('opponentPink').textContent = opponentCoins.pink || 0;
            document.getElementById('opponentBlue').textContent = opponentCoins.blue || 0;
            document.getElementById('opponentYellow').textContent = opponentCoins.yellow || 0;
            document.getElementById('opponentBlack').textContent = opponentCoins.black || 0;
        }
        
        // 更新硬币选择器的最大值
        if (gameState.coin_pool) {
            document.getElementById('selectRed').max = gameState.coin_pool.red || 0;
            document.getElementById('selectPink').max = gameState.coin_pool.pink || 0;
            document.getElementById('selectBlue').max = gameState.coin_pool.blue || 0;
            document.getElementById('selectYellow').max = gameState.coin_pool.yellow || 0;
            document.getElementById('selectBlack').max = gameState.coin_pool.black || 0;
        }
        
        // 更新拿取硬币按钮状态
        const takeCoinsButton = document.getElementById('takeCoinsButton');
        const isCurrentPlayerTurn = this.currentRoom.current_player === this.getCurrentPlayerId();
        const isPlaying = this.currentRoom.status === 'playing';
        
        takeCoinsButton.disabled = !isCurrentPlayerTurn || !isPlaying;
    }
    
    showMessage(message, type = 'info') {
        const toast = document.getElementById('messageToast');
        toast.textContent = message;
        toast.className = `message-toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// 初始化游戏客户端
const gameClient = new GameClient();