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
        // 为硬币池中的硬币添加点击事件监听器
            this.initializeCoinPoolClickListeners();
            
            // 确定拿取硬币按钮
            document.getElementById('confirmCoinsButton').addEventListener('click', () => this.confirmCoinSelection());
        
        // 预购牌堆顶部按钮事件委托
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('reserve-deck-button')) {
                const deckType = e.target.dataset.deck;
                this.reserveDeckTopCard(deckType);
            }
            
            // 预购展示卡牌点击事件
            if (e.target.classList.contains('card-item') && e.target.classList.contains('reservable')) {
                const cardId = parseInt(e.target.dataset.cardId);
                this.reserveDisplayCard(cardId);
            }
            
            // 预留展示卡牌按钮事件
            if (e.target.classList.contains('reserve-card-button')) {
                const cardId = parseInt(e.target.dataset.cardId);
                this.reserveDisplayCard(cardId);
            }
            
            // 购买展示卡牌按钮事件
            if (e.target.classList.contains('buy-card-button')) {
                const cardId = parseInt(e.target.dataset.cardId);
                const source = e.target.dataset.source || 'display';
                this.buyCard(cardId, source);
            }
            
            // 购买预购卡牌按钮事件
            if (e.target.classList.contains('buy-reserved-button')) {
                const cardIndexStr = e.target.dataset.cardIndex;
                const cardIndex = parseInt(cardIndexStr);
                const source = e.target.dataset.source || 'reserved';
                
                if (isNaN(cardIndex) || cardIndex < 0) {
                    this.showMessage('无效的卡牌索引', 'error');
                    return;
                }
                
                this.buyCard(cardIndex, source);
            }
        });
        
        // 回车键登录
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        
        document.getElementById('confirmPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleRegister();
        });
    }

    initializeCoinPoolClickListeners() {
        // 初始化选择的硬币数据
        this.selectedCoins = {
            red: 0,
            pink: 0,
            blue: 0,
            yellow: 0,
            black: 0
        };
        
        // 为每种颜色的硬币添加点击事件监听器
        const coinColors = ['red', 'pink', 'blue', 'yellow', 'black'];
        
        coinColors.forEach(color => {
            const coinElement = document.querySelector(`.coin-item .coin-color.${color}`);
            if (coinElement) {
                coinElement.style.cursor = 'pointer';
                coinElement.addEventListener('click', () => this.selectCoinFromPool(color));
            }
            
            // 为选择区域的硬币添加点击事件监听器
            const selectedCoinElement = document.querySelector(`.selected-coin-item[data-color="${color}"] .coin-color`);
            if (selectedCoinElement) {
                selectedCoinElement.addEventListener('click', () => this.returnCoinToPool(color));
            }
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
    
    selectCoinFromPool(color) {
        if (!this.currentRoom || this.currentRoom.game_type !== 'pokemon_game') {
            this.showMessage('只能在宝可梦游戏中拿取硬币', 'error');
            return;
        }

        // 检查硬币池中是否有该颜色的硬币
        const coinCountElement = document.getElementById(`public${color.charAt(0).toUpperCase() + color.slice(1)}Coins`);
        const availableCoins = parseInt(coinCountElement.textContent) || 0;
        
        if (availableCoins <= 0) {
            this.showMessage(`硬币池中没有${this.getCoinColorName(color)}硬币`, 'error');
            return;
        }

        // 检查是否已经选择了太多硬币（最多3个）
        const totalSelected = Object.values(this.selectedCoins).reduce((sum, count) => sum + count, 0);
        if (totalSelected >= 3) {
            this.showMessage('最多只能选择3个硬币', 'error');
            return;
        }

        // 增加选择的硬币数量
        this.selectedCoins[color]++;
        this.updateSelectedCoinsDisplay();
    }

    returnCoinToPool(color) {
        if (this.selectedCoins[color] > 0) {
            this.selectedCoins[color]--;
            this.updateSelectedCoinsDisplay();
        }
    }

    updateSelectedCoinsDisplay() {
        const coinColors = ['red', 'pink', 'blue', 'yellow', 'black'];
        
        coinColors.forEach(color => {
            const selectedItem = document.querySelector(`.selected-coin-item[data-color="${color}"]`);
            const countElement = selectedItem.querySelector('.selected-coin-count');
            
            if (this.selectedCoins[color] > 0) {
                selectedItem.style.display = 'flex';
                countElement.textContent = this.selectedCoins[color];
            } else {
                selectedItem.style.display = 'none';
            }
        });

        // 更新确定按钮状态
        const totalSelected = Object.values(this.selectedCoins).reduce((sum, count) => sum + count, 0);
        const confirmButton = document.getElementById('confirmCoinsButton');
        confirmButton.disabled = totalSelected === 0;
    }

    getCoinColorName(color) {
        const colorNames = {
            'red': '红色',
            'pink': '粉色',
            'blue': '蓝色',
            'yellow': '黄色',
            'black': '黑色'
        };
        return colorNames[color] || color;
    }

    confirmCoinSelection() {
        if (!this.currentRoom || this.currentRoom.game_type !== 'pokemon_game') {
            this.showMessage('只能在宝可梦游戏中拿取硬币', 'error');
            return;
        }

        // 检查是否有选择的硬币
        const totalSelected = Object.values(this.selectedCoins).reduce((sum, count) => sum + count, 0);
        if (totalSelected === 0) {
            this.showMessage('请先选择要拿取的硬币', 'error');
            return;
        }

        // 过滤掉数量为0的硬币
        const filteredCoins = {};
        for (const [color, count] of Object.entries(this.selectedCoins)) {
            if (count > 0) {
                filteredCoins[color] = count;
            }
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
        // 重置选择的硬币数据
        this.selectedCoins = {
            red: 0,
            pink: 0,
            blue: 0,
            yellow: 0,
            black: 0
        };
        
        // 更新显示
        this.updateSelectedCoinsDisplay();
    }
    
    reserveDisplayCard(cardId) {
        if (!this.currentRoom || this.currentRoom.game_type !== 'pokemon_game') {
            this.showMessage('只能在宝可梦游戏中预购卡牌', 'error');
            return;
        }
        
        // 发送预购展示卡牌请求
        this.sendMessage({
            action: "game_action",
            game_action: "reserve_card",
            action_data: {
                type: "display",
                card_id: cardId
            }
        });
    }
    
    reserveDeckTopCard(deckType) {
        if (!this.currentRoom || this.currentRoom.game_type !== 'pokemon_game') {
            this.showMessage('只能在宝可梦游戏中预购卡牌', 'error');
            return;
        }
        
        // 只允许等级1-3卡牌预购
        const allowedDecks = ['level_1', 'level_2', 'level_3'];
        if (!allowedDecks.includes(deckType)) {
            this.showMessage('只能预购等级1-3的卡牌', 'error');
            return;
        }
        
        // 发送预购牌堆顶部卡牌请求
        this.sendMessage({
            action: "game_action",
            game_action: "reserve_card",
            action_data: {
                type: "deck_top",
                deck_type: deckType
            }
        });
    }
    
    buyCard(cardId, source) {
        console.log('DEBUG: buyCard called with cardId:', cardId, 'source:', source);
        
        if (!this.currentRoom || this.currentRoom.game_type !== 'pokemon_game') {
            this.showMessage('只能在宝可梦游戏中购买卡牌', 'error');
            return;
        }
        
        console.log('DEBUG: Current room:', this.currentRoom);
        
        // 发送购买卡牌请求
        const actionData = {
            buy_type: source // 'display' 或 'reserved'
        };
        
        if (source === 'display') {
            actionData.card_id = cardId;
        } else if (source === 'reserved') {
            actionData.card_index = cardId; // 对于预购卡牌，这里应该是索引
        }
        
        console.log('DEBUG: Sending buy card message:', {
            action: "game_action",
            game_action: "buy_card",
            action_data: actionData
        });
        
        this.sendMessage({
            action: "game_action",
            game_action: "buy_card",
            action_data: actionData
        });
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
        const gameStatusElement = document.querySelector('.game-status');
        const playersInfoElement = document.querySelector('.players-info');
        
        if (this.currentRoom.game_type === 'tic_tac_toe' || this.currentRoom.game_type === 'reverse_tic_tac_toe') {
            document.getElementById('ticTacToeBoard').style.display = 'block';
            document.getElementById('pokemonGameBoard').style.display = 'none';
            // 显示game-status和players-info元素
            if (gameStatusElement) gameStatusElement.style.display = 'block';
            if (playersInfoElement) playersInfoElement.style.display = 'flex';
            this.updateTicTacToeBoard();
        } else if (this.currentRoom.game_type === 'pokemon_game') {
            document.getElementById('ticTacToeBoard').style.display = 'none';
            document.getElementById('pokemonGameBoard').style.display = 'block';
            // 隐藏game-status和players-info元素
            if (gameStatusElement) gameStatusElement.style.display = 'none';
            if (playersInfoElement) playersInfoElement.style.display = 'none';
            this.updatePokemonGameBoard();
        } else {
            document.getElementById('ticTacToeBoard').style.display = 'none';
            document.getElementById('pokemonGameBoard').style.display = 'none';
            // 显示game-status和players-info元素
            if (gameStatusElement) gameStatusElement.style.display = 'block';
            if (playersInfoElement) playersInfoElement.style.display = 'flex';
        }
    }
    
    updateGameStatus() {
        const statusText = document.getElementById('gameStatusText');
        const turnIndicator = document.getElementById('currentTurnIndicator');
        const newGameButton = document.getElementById('newGameButton');
        
        if (this.currentRoom.status === 'waiting') {
            const playerCount = this.currentRoom.players.length;
            if (playerCount < 2) {
                statusText.textContent = `等待玩家加入... (${playerCount}/2)`;
                turnIndicator.textContent = '';
                newGameButton.style.display = 'none';
            } else {
                statusText.textContent = '准备就绪，可以开始游戏！';
                turnIndicator.textContent = '';
                newGameButton.style.display = 'block';
                newGameButton.textContent = '开始游戏';
            }
        } else if (this.currentRoom.status === 'playing') {
            statusText.textContent = '游戏进行中';
            const currentPlayer = this.currentRoom.players.find(p => p.id === this.currentRoom.current_player);
            if (currentPlayer) {
                turnIndicator.textContent = `轮到 ${currentPlayer.name}`;
            }
            newGameButton.style.display = 'none';
        } else if (this.currentRoom.status === 'finished') {
            if (this.currentRoom.game_state && this.currentRoom.game_state.winner) {
                const winner = this.currentRoom.players.find(p => 
                    (p === this.currentRoom.players[0] && this.currentRoom.game_state.winner === 'X') ||
                    (p === this.currentRoom.players[1] && this.currentRoom.game_state.winner === 'O')
                );
                
                if (this.currentRoom.game_type === 'reverse_tic_tac_toe') {
                    // 反井格棋：显示获胜者（没有连成线的玩家）
                    statusText.textContent = `游戏结束 - ${winner ? winner.name : '未知玩家'} 获胜！（避免连线成功）`;
                } else if (this.currentRoom.game_type === 'pokemon_game') {
                    // 宝可梦游戏
                    statusText.textContent = `游戏结束 - ${winner ? winner.name : '未知玩家'} 获胜！`;
                } else {
                    // 普通井字棋
                    statusText.textContent = `游戏结束 - ${winner ? winner.name : '未知玩家'} 获胜！`;
                }
            } else if (this.currentRoom.game_state && this.currentRoom.game_state.is_draw) {
                statusText.textContent = '游戏结束 - 平局！';
            } else {
                statusText.textContent = '游戏结束';
            }
            turnIndicator.textContent = '';
            newGameButton.style.display = 'block';
            newGameButton.textContent = '新游戏';
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
        
        // 只在游戏开始后才显示游戏内容
        if (this.currentRoom.status !== 'playing') {
            this.hideGameContent();
            return;
        }
        
        const gameState = this.currentRoom.game_state;
        const publicInfo = gameState.public_info;
        const playerData = gameState.player_data;
        
        // 更新公共硬币池
        if (publicInfo && publicInfo.coins) {
            document.getElementById('publicRedCoins').textContent = publicInfo.coins.red || 0;
            document.getElementById('publicPinkCoins').textContent = publicInfo.coins.pink || 0;
            document.getElementById('publicBlueCoins').textContent = publicInfo.coins.blue || 0;
            document.getElementById('publicYellowCoins').textContent = publicInfo.coins.yellow || 0;
            document.getElementById('publicBlackCoins').textContent = publicInfo.coins.black || 0;
            document.getElementById('publicPurpleCoins').textContent = publicInfo.coins.purple || 0;
        }
        
        // 更新牌堆数量（在level-header的h4标题后面显示）
        if (publicInfo && publicInfo.deck_counts) {
            const deckMappings = [
                { selector: '.card-level-row:nth-child(1) .level-header h4', count: publicInfo.deck_counts.level_1 || 0, name: '等级1卡牌' },
                { selector: '.card-level-row:nth-child(2) .level-header h4', count: publicInfo.deck_counts.level_2 || 0, name: '等级2卡牌' },
                { selector: '.card-level-row:nth-child(3) .level-header h4', count: publicInfo.deck_counts.level_3 || 0, name: '等级3卡牌' },
                { selector: '.rare-cards-section .level-header h4', count: publicInfo.deck_counts.rare || 0, name: '稀有卡牌' },
                { selector: '.phantom-cards-section .level-header h4', count: publicInfo.deck_counts.phantom || 0, name: '幻影卡牌' }
            ];
            
            deckMappings.forEach(mapping => {
                const headerElement = document.querySelector(mapping.selector);
                if (headerElement) {
                    headerElement.textContent = `${mapping.name} (${mapping.count})`;
                }
            });
        }
        
        // 更新展示卡牌
        this.updateDisplayCards(publicInfo);
        
        // 更新玩家硬币和预购区域
        this.updatePlayersInfo(playerData);
        
        // 硬币选择器已移除，不再需要更新最大值
        
        // 更新按钮状态
        this.updateActionButtons();
    }
    
    updateDisplayCards(publicInfo) {
        if (!publicInfo || !publicInfo.display_cards) return;
        
        const deckMappings = {
            'level_1': 'level1DisplayCards',
            'level_2': 'level2DisplayCards', 
            'level_3': 'level3DisplayCards',
            'rare': 'rareDisplayCards',
            'phantom': 'phantomDisplayCards'
        };
        
        const isCurrentPlayerTurn = this.currentRoom.current_player === this.getCurrentPlayerId();
        const isPlaying = this.currentRoom.status === 'playing';
        const canReserve = isCurrentPlayerTurn && isPlaying;
        
        for (const [deckType, elementId] of Object.entries(deckMappings)) {
            const container = document.getElementById(elementId);
            if (!container) continue;
            
            container.innerHTML = '';
            const cards = publicInfo.display_cards[deckType] || [];
            
            cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card-item';
                cardElement.dataset.cardId = card.id;
                
                // 检查是否可以预购（非梦幻、传说卡牌）
                const canReserveCard = canReserve && !['梦幻', '传说'].includes(card.level);
                const canBuyCard = isCurrentPlayerTurn && isPlaying;
                
                if (canReserveCard) {
                    cardElement.classList.add('reservable');
                } else {
                    cardElement.classList.add('not-reservable');
                }
                
                // 构建卡牌成本显示（包含抵扣信息）
                const costDisplay = this.generateCostDisplay(card);
                
                cardElement.innerHTML = `
                    <div class="card-name">${card.name}</div>
                    <div class="card-level">等级: ${card.level}</div>
                    <div class="card-points">分数: ${card.points}</div>
                    ${costDisplay}
                    ${canBuyCard ? `<button class="buy-card-button" data-card-id="${card.id}" data-source="display">购买</button>` : ''}
                    ${canReserveCard ? `<button class="reserve-card-button" data-card-id="${card.id}" data-source="display">预留</button>` : ''}
                `;
                
                container.appendChild(cardElement);
            });
        }
        
        // 更新预购牌堆顶部按钮状态
        document.querySelectorAll('.reserve-deck-button').forEach(button => {
            const deckType = button.dataset.deck;
            // 只允许等级1-3卡牌预购，禁用稀有和幻影卡牌预购
            const allowedDecks = ['level_1', 'level_2', 'level_3'];
            if (allowedDecks.includes(deckType)) {
                button.disabled = !canReserve;
            } else {
                button.disabled = true;
                button.style.display = 'none'; // 隐藏稀有和幻影卡牌的预购按钮
            }
        });
    }
    
    updatePlayersInfo(playerData) {
        if (!playerData) return;
        
        console.log('updatePlayersInfo called with playerData:', playerData);
        
        const players = this.currentRoom.players;
        
        players.forEach((player, index) => {
            const playerIndex = index + 1;
            const data = playerData[player.user_id];
            
            if (!data) return;
            
            console.log(`Player ${playerIndex} (${player.user_id}) data:`, data);
            console.log(`Player ${playerIndex} owned_cards:`, data.owned_cards);
            
            // 更新玩家硬币
            document.getElementById(`p${playerIndex}RedCoins`).textContent = data.coins.red || 0;
            document.getElementById(`p${playerIndex}PinkCoins`).textContent = data.coins.pink || 0;
            document.getElementById(`p${playerIndex}BlueCoins`).textContent = data.coins.blue || 0;
            document.getElementById(`p${playerIndex}YellowCoins`).textContent = data.coins.yellow || 0;
            document.getElementById(`p${playerIndex}BlackCoins`).textContent = data.coins.black || 0;
            document.getElementById(`p${playerIndex}PurpleCoins`).textContent = data.coins.purple || 0;
            
            // 更新预购区域
            const reservedCards = data.reserved_cards || [];
            const reservedCount = reservedCards.length;
            document.getElementById(`p${playerIndex}ReservedCount`).textContent = reservedCount;
            
            const reservedContainer = document.getElementById(`p${playerIndex}ReservedCards`);
            if (reservedContainer) {
                reservedContainer.innerHTML = '';
                
                reservedCards.forEach((reservedCard, index) => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'reserved-card-item';
                    
                    const isCurrentPlayer = player.user_id === this.currentUser.id;
                    const isCurrentPlayerTurn = this.currentRoom.current_player === this.getCurrentPlayerId();
                    const isPlaying = this.currentRoom.status === 'playing';
                    const canBuyCard = isCurrentPlayer && isCurrentPlayerTurn && isPlaying;
                    
                    if (!reservedCard.visible_to_all) {
                        cardElement.classList.add('private');
                        if (isCurrentPlayer) {
                            // 当前玩家可以看到自己的隐私卡牌
                            const card = reservedCard.card;
                            const costDisplay = this.generateCostDisplay(card);
                            
                            cardElement.innerHTML = `
                                <div class="card-name">${card.name} (隐私)</div>
                                ${costDisplay}
                                ${canBuyCard ? `<button class="buy-reserved-button" data-card-index="${index}" data-source="reserved">购买</button>` : ''}
                            `;
                        } else {
                            // 其他玩家看不到隐私卡牌详情
                            cardElement.textContent = '隐藏卡牌';
                        }
                    } else {
                        // 对所有人可见的卡牌
                        const card = reservedCard.card;
                        const costDisplay = isCurrentPlayer ? this.generateCostDisplay(card) : this.generateBasicCostDisplay(card);
                        
                        cardElement.innerHTML = `
                            <div class="card-name">${card.name}</div>
                            ${costDisplay}
                            ${canBuyCard ? `<button class="buy-reserved-button" data-card-index="${index}" data-source="reserved">购买</button>` : ''}
                        `;
                    }
                    
                    reservedContainer.appendChild(cardElement);
                });
            }
            
            // 更新玩家拥有的卡牌区域
            const ownedCards = data.owned_cards || data.cards || [];
            const ownedCount = ownedCards.length;
            const totalPoints = ownedCards.reduce((sum, card) => sum + (card.points || 0), 0);
            
            document.getElementById(`p${playerIndex}OwnedCount`).textContent = ownedCount;
            document.getElementById(`p${playerIndex}Points`).textContent = totalPoints;
            
            const ownedContainer = document.getElementById(`p${playerIndex}OwnedCards`);
            if (ownedContainer) {
                ownedContainer.innerHTML = '';
                
                ownedCards.forEach(card => {
                    const cardElement = document.createElement('div');
                    cardElement.className = 'owned-card';
                    
                    // 设置卡牌奖励颜色的背景
                    const bonusColors = {
                        'red': '#ff4444',
                        'pink': '#ff69b4',
                        'blue': '#4169e1',
                        'yellow': '#ffd700',
                        'black': '#333333'
                    };
                    
                    cardElement.innerHTML = `
                        <div class="card-name">${card.name}</div>
                        <div class="card-level">${card.level}</div>
                        <div class="card-points">${card.points}</div>
                        <div class="card-bonus" style="background-color: ${bonusColors[card.bonus_type] || '#ccc'}">
                            ${card.bonus_type ? card.bonus_type.charAt(0).toUpperCase() : ''}
                        </div>
                    `;
                    
                    ownedContainer.appendChild(cardElement);
                });
            }
        });
    }
    
    updateActionButtons() {
        const isCurrentPlayerTurn = this.currentRoom.current_player === this.getCurrentPlayerId();
        const isPlaying = this.currentRoom.status === 'playing';
        
        // 更新拿取硬币按钮状态
        const takeCoinsButton = document.getElementById('takeCoinsButton');
        if (takeCoinsButton) {
            takeCoinsButton.disabled = !isCurrentPlayerTurn || !isPlaying;
        }
        
        // 更新预购按钮状态
        document.querySelectorAll('.reserve-deck-button').forEach(button => {
            button.disabled = !isCurrentPlayerTurn || !isPlaying;
        });
    }
    
    // 计算当前玩家的卡牌抵扣
    calculatePlayerDiscounts() {
        if (!this.currentRoom || !this.currentRoom.player_data) {
            return {};
        }
        
        const currentPlayerId = this.getCurrentPlayerId();
        const playerData = this.currentRoom.player_data[currentPlayerId];
        
        if (!playerData || !playerData.cards) {
            return {};
        }
        
        const discounts = {};
        const colorMap = {1: "red", 2: "pink", 3: "blue", 4: "yellow", 5: "black"};
        
        playerData.cards.forEach(card => {
            const rewardColorCode = card.reward_color_code;
            const rewardCount = card.reward_count || 0;
            
            if (rewardColorCode && rewardCount > 0 && colorMap[rewardColorCode]) {
                const color = colorMap[rewardColorCode];
                discounts[color] = (discounts[color] || 0) + rewardCount;
            }
        });
        
        return discounts;
    }

    // 计算卡牌的实际成本（考虑抵扣）
    calculateActualCost(card) {
        const originalCost = {
            red: card.need_red || 0,
            pink: card.need_pink || 0,
            blue: card.need_blue || 0,
            yellow: card.need_yellow || 0,
            black: card.need_black || 0,
            master: card.need_master || 0
        };
        
        const discounts = this.calculatePlayerDiscounts();
        const actualCost = {...originalCost};
        const appliedDiscounts = {};
        
        // 应用抵扣
        for (const color in discounts) {
            if (actualCost[color] > 0) {
                const reduction = Math.min(actualCost[color], discounts[color]);
                actualCost[color] -= reduction;
                if (reduction > 0) {
                    appliedDiscounts[color] = reduction;
                }
            }
        }
        
        return {
            originalCost,
            actualCost,
            appliedDiscounts,
            totalDiscount: Object.values(appliedDiscounts).reduce((sum, val) => sum + val, 0)
        };
    }

    // 生成卡牌成本显示文本
    generateCostDisplay(card) {
        const costInfo = this.calculateActualCost(card);
        const { originalCost, actualCost, appliedDiscounts, totalDiscount } = costInfo;
        
        // 原始成本
        const originalParts = [];
        if (originalCost.red > 0) originalParts.push(`红${originalCost.red}`);
        if (originalCost.pink > 0) originalParts.push(`粉${originalCost.pink}`);
        if (originalCost.blue > 0) originalParts.push(`蓝${originalCost.blue}`);
        if (originalCost.yellow > 0) originalParts.push(`黄${originalCost.yellow}`);
        if (originalCost.black > 0) originalParts.push(`黑${originalCost.black}`);
        if (originalCost.master > 0) originalParts.push(`万能${originalCost.master}`);
        
        // 实际成本
        const actualParts = [];
        if (actualCost.red > 0) actualParts.push(`红${actualCost.red}`);
        if (actualCost.pink > 0) actualParts.push(`粉${actualCost.pink}`);
        if (actualCost.blue > 0) actualParts.push(`蓝${actualCost.blue}`);
        if (actualCost.yellow > 0) actualParts.push(`黄${actualCost.yellow}`);
        if (actualCost.black > 0) actualParts.push(`黑${actualCost.black}`);
        if (actualCost.master > 0) actualParts.push(`万能${actualCost.master}`);
        
        // 抵扣信息
        const discountParts = [];
        if (appliedDiscounts.red > 0) discountParts.push(`红-${appliedDiscounts.red}`);
        if (appliedDiscounts.pink > 0) discountParts.push(`粉-${appliedDiscounts.pink}`);
        if (appliedDiscounts.blue > 0) discountParts.push(`蓝-${appliedDiscounts.blue}`);
        if (appliedDiscounts.yellow > 0) discountParts.push(`黄-${appliedDiscounts.yellow}`);
        if (appliedDiscounts.black > 0) discountParts.push(`黑-${appliedDiscounts.black}`);
        
        let costDisplay = '';
        
        if (totalDiscount > 0) {
            const originalText = originalParts.length > 0 ? originalParts.join(' ') : '免费';
            const actualText = actualParts.length > 0 ? actualParts.join(' ') : '免费';
            const discountText = discountParts.join(' ');
            
            costDisplay = `
                <div class="card-cost-original">原价: ${originalText}</div>
                <div class="card-cost-discount">抵扣: ${discountText}</div>
                <div class="card-cost-actual">实付: ${actualText}</div>
            `;
        } else {
            const costText = originalParts.length > 0 ? originalParts.join(' ') : '免费';
            costDisplay = `<div class="card-cost">成本: ${costText}</div>`;
        }
        
        return costDisplay;
    }

    // 生成基础卡牌成本显示文本（不包含抵扣信息）
    generateBasicCostDisplay(card) {
        const costParts = [];
        if (card.need_red > 0) costParts.push(`红${card.need_red}`);
        if (card.need_pink > 0) costParts.push(`粉${card.need_pink}`);
        if (card.need_blue > 0) costParts.push(`蓝${card.need_blue}`);
        if (card.need_yellow > 0) costParts.push(`黄${card.need_yellow}`);
        if (card.need_black > 0) costParts.push(`黑${card.need_black}`);
        if (card.need_master > 0) costParts.push(`万能${card.need_master}`);
        const costText = costParts.length > 0 ? costParts.join(' ') : '免费';
        
        return `<div class="card-cost">成本: ${costText}</div>`;
    }
    
    hideGameContent() {
        // 清空展示卡牌
        ['level1DisplayCards', 'level2DisplayCards', 'level3DisplayCards', 'rareDisplayCards', 'phantomDisplayCards'].forEach(id => {
            const container = document.getElementById(id);
            if (container) container.innerHTML = '';
        });
        
        // 清空玩家信息 - 更新为4个玩家
        ['p1ReservedCards', 'p2ReservedCards', 'p3ReservedCards', 'p4ReservedCards', 
         'p1OwnedCards', 'p2OwnedCards', 'p3OwnedCards', 'p4OwnedCards'].forEach(id => {
            const container = document.getElementById(id);
            if (container) container.innerHTML = '';
        });
        
        // 重置计数器 - 更新为4个玩家
        ['p1OwnedCount', 'p2OwnedCount', 'p3OwnedCount', 'p4OwnedCount',
         'p1Points', 'p2Points', 'p3Points', 'p4Points',
         'p1ReservedCount', 'p2ReservedCount', 'p3ReservedCount', 'p4ReservedCount'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '0';
        });
        
        // 重置玩家硬币显示 - 更新为4个玩家
        ['p1RedCoins', 'p1PinkCoins', 'p1BlueCoins', 'p1YellowCoins', 'p1BlackCoins', 'p1PurpleCoins',
         'p2RedCoins', 'p2PinkCoins', 'p2BlueCoins', 'p2YellowCoins', 'p2BlackCoins', 'p2PurpleCoins',
         'p3RedCoins', 'p3PinkCoins', 'p3BlueCoins', 'p3YellowCoins', 'p3BlackCoins', 'p3PurpleCoins',
         'p4RedCoins', 'p4PinkCoins', 'p4BlueCoins', 'p4YellowCoins', 'p4BlackCoins', 'p4PurpleCoins'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '0';
        });
        
        // 重置硬币显示
        ['publicRedCoins', 'publicPinkCoins', 'publicBlueCoins', 'publicYellowCoins', 'publicBlackCoins', 'publicPurpleCoins'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '0';
        });
        
        // 重置level-header标题
        const headerMappings = [
            { selector: '.card-level-row:nth-child(1) .level-header h4', name: '等级1卡牌' },
            { selector: '.card-level-row:nth-child(2) .level-header h4', name: '等级2卡牌' },
            { selector: '.card-level-row:nth-child(3) .level-header h4', name: '等级3卡牌' },
            { selector: '.rare-cards-section .level-header h4', name: '稀有卡牌' },
            { selector: '.phantom-cards-section .level-header h4', name: '幻影卡牌' }
        ];
        
        headerMappings.forEach(mapping => {
            const headerElement = document.querySelector(mapping.selector);
            if (headerElement) {
                headerElement.textContent = mapping.name;
            }
        });
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