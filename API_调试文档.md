# 宝可梦游戏 API 接口文档

## 服务器信息
- **基础URL**: `http://127.0.0.1:8080`
- **WebSocket URL**: `ws://127.0.0.1:8080/ws/{session_token}`

## 安全说明
为了保证游戏的公平性和趣味性，服务器采用以下安全措施：
- **牌堆详情隐藏**: 牌堆中的具体卡牌信息不会暴露给用户，只提供牌堆剩余数量
- **预购卡牌可见性控制**: 从牌堆顶部预购的卡牌只有预购者可见，其他玩家只能看到"隐藏卡牌"占位符
- **私有数据保护**: 敏感的游戏数据（如牌堆内容）存储在服务器私有区域，不会通过API暴露

## 目录
1. [HTTP REST API](#http-rest-api)
2. [WebSocket 实时通信 API](#websocket-实时通信-api)
3. [宝可梦游戏专用接口](#宝可梦游戏专用接口)
4. [游戏流程说明](#游戏流程说明)
5. [错误码说明](#错误码说明)

---

## HTTP REST API

### 1. 用户注册
**接口**: `POST /api/register`

**请求体**:
```json
{
  "username": "player1",
  "password": "123456"
}
```

**成功响应**:
```json
{
  "success": true,
  "message": "注册成功",
  "user": {
    "id": "user_123",
    "username": "player1"
  }
}
```

**失败响应**:
```json
{
  "success": false,
  "message": "用户名已存在"
}
```

---

### 2. 用户登录
**接口**: `POST /api/login`

**请求体**:
```json
{
  "username": "player1",
  "password": "123456"
}
```

**成功响应**:
```json
{
  "success": true,
  "message": "登录成功",
  "session_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "user_123",
    "username": "player1"
  }
}
```

**失败响应**:
```json
{
  "success": false,
  "message": "用户名或密码错误"
}
```

---

### 3. 用户登出
**接口**: `POST /api/logout`

**请求头**:
```
Authorization: Bearer {session_token}
```

**成功响应**:
```json
{
  "success": true,
  "message": "登出成功"
}
```

---

### 4. 获取可用游戏列表
**接口**: `GET /api/games`

**成功响应**:
```json
{
  "games": [
    {
      "type": "tic_tac_toe",
      "name": "井字棋",
      "max_players": 2,
      "rules": {
        "description": "经典井字棋游戏",
        "objective": "率先连成三子者获胜"
      }
    },
    {
      "type": "reverse_tic_tac_toe", 
      "name": "反向井字棋",
      "max_players": 2,
      "rules": {
        "description": "反向井字棋游戏",
        "objective": "避免连成三子"
      }
    },
    {
      "type": "pokemon_game",
      "name": "宝可梦",
      "max_players": 4,
      "rules": {
        "description": "宝可梦卡牌收集游戏",
        "objective": "收集宝可梦卡牌，获得最高分数"
      }
    }
  ]
}
```

---

### 5. 获取首页
**接口**: `GET /`

**响应**: 返回HTML页面

---

## WebSocket 实时通信 API

### 连接建立
**URL**: `ws://127.0.0.1:8080/ws/{session_token}`

连接成功后，服务器会发送欢迎消息：
```json
{
  "type": "welcome",
  "message": "WebSocket连接已建立",
  "user": {
    "id": "user_123",
    "username": "player1"
  }
}
```

### 基础消息格式
所有WebSocket消息都遵循以下格式：

**客户端发送**:
```json
{
  "action": "action_name",
  "data": {}
}
```

**服务器响应**:
```json
{
  "type": "response_type",
  "data": {},
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1. 创建房间
**客户端发送**:
```json
{
  "action": "create_room",
  "room_name": "我的宝可梦房间",
  "game_type": "pokemon_game"
}
```

**服务器响应**:
```json
{
  "type": "room_created",
  "room": {
    "id": "room_123",
    "name": "我的宝可梦房间",
    "game_type": "pokemon_game",
    "status": "waiting",
    "players": [
      {
        "user_id": "user_123",
        "username": "player1",
        "symbol": "🔴",
        "is_ready": false
      }
    ],
    "max_players": 4,
    "current_player": null
  }
}
```

### 2. 加入房间
**客户端发送**:
```json
{
  "action": "join_room",
  "room_id": "room_123"
}
```

**服务器响应**:
```json
{
  "type": "room_joined",
  "room": {
    "id": "room_123",
    "name": "我的宝可梦房间",
    "game_type": "pokemon_game",
    "status": "waiting",
    "players": [
      {
        "user_id": "user_123",
        "username": "player1",
        "symbol": "🔴",
        "is_ready": false
      },
      {
        "user_id": "user_456",
        "username": "player2",
        "symbol": "🔵",
        "is_ready": false
      }
    ],
    "max_players": 4,
    "current_player": null
  }
}
```

### 3. 开始游戏
**客户端发送**:
```json
{
  "action": "start_game"
}
```

**服务器响应**:
```json
{
  "type": "game_started",
  "room": {
    "id": "room_123",
    "status": "playing",
    "current_player": "user_123",
    "game_state": {
      "turn_count": 0,
      "current_phase": "playing",
      "public_info": {
        "coins": {
          "red": 7,
          "pink": 7,
          "blue": 7,
          "yellow": 7,
          "black": 7,
          "purple": 5
        },
        "display_cards": {
          "level_1": [...],
          "level_2": [...],
          "level_3": [...],
          "rare": [...],
          "phantom": [...]
        },
        "deck_counts": {
          "level_1": 36,
          "level_2": 26,
          "level_3": 16,
          "rare": 4,
          "phantom": 4
        }
      },
      "player_data": {
        "user_123": {
          "symbol": "🔴",
          "position": 0,
          "score": 0,
          "cards": [],
          "coins": {
            "red": 0,
            "pink": 0,
            "blue": 0,
            "yellow": 0,
            "black": 0,
            "purple": 0
          }
        }
      }
    }
  }
}
```

### 4. 获取房间列表
**客户端发送**:
```json
{
  "action": "rooms_list"
}
```

**服务器响应**:
```json
{
  "type": "rooms_list",
  "rooms": [
    {
      "id": "room_123",
      "name": "我的宝可梦房间",
      "game_type": "pokemon_game",
      "status": "waiting",
      "player_count": 2,
      "max_players": 4
    }
  ]
}
```

### 5. 离开房间
**客户端发送**:
```json
{
  "action": "leave_room"
}
```

**服务器响应**:
```json
{
  "type": "room_left",
  "message": "已离开房间"
}
```

### 6. 心跳检测
**客户端发送**:
```json
{
  "action": "heartbeat"
}
```

**服务器响应**:
```json
{
  "type": "heartbeat",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## 宝可梦游戏专用接口

### 1. 拿取硬币操作
**客户端发送**:
```json
{
  "action": "game_action",
  "game_action": "take_coins",
  "action_data": {
    "coins": {
      "red": 1,
      "blue": 1,
      "yellow": 1
    }
  }
}
```

**成功响应**:
```json
{
  "type": "game_action_result",
  "success": true,
  "message": "成功拿取硬币: red x1, blue x1, yellow x1",
  "room_updated": {
    "current_player": "user_456",
    "game_state": {
      "turn_count": 1,
      "public_info": {
        "coins": {
          "red": 6,
          "pink": 7,
          "blue": 6,
          "yellow": 6,
          "black": 7,
          "purple": 5
        }
      },
      "player_data": {
        "user_123": {
          "coins": {
            "red": 1,
            "pink": 0,
            "blue": 1,
            "yellow": 1,
            "black": 0,
            "purple": 0
          }
        }
      }
    }
  }
}
```

**失败响应**:
```json
{
  "type": "game_action_result",
  "success": false,
  "message": "只能拿取3个不同颜色的硬币或2个同色硬币"
}
```

### 2. 预购卡牌操作

#### 预购展示卡牌
**客户端发送**:
```json
{
  "action": "game_action",
  "game_action": "reserve_card",
  "action_data": {
    "type": "display",
    "card_id": 123
  }
}
```

#### 预购牌堆顶部卡牌
**客户端发送**:
```json
{
  "action": "game_action",
  "game_action": "reserve_card",
  "action_data": {
    "type": "deck_top",
    "target": "level_1"
  }
}
```

**成功响应**:
```json
{
  "type": "game_action_result",
  "success": true,
  "message": "成功预购卡牌: 皮卡丘",
  "room_updated": {
    "current_player": "user_456",
    "game_state": {
      "public_info": {
        "coins": {
          "purple": 4
        }
      },
      "player_data": {
        "user_123": {
          "coins": {
            "purple": 1
          },
          "reserved_cards": [
            {
              "card": {
                "id": 123,
                "name": "皮卡丘",
                "level": "1级",
                "cost": {"red": 2, "blue": 1}
              },
              "visible_to_all": true
            }
          ]
        }
      }
    }
  }
}
```

**失败响应**:
```json
{
  "type": "game_action_result",
  "success": false,
  "message": "预购区域已满，最多只能预购3张卡牌"
}
```

### 3. 预购规则说明

#### 预购限制
- 每个玩家最多可预购3张卡牌
- 不能预购梦幻、传说等级的卡牌
- 每次预购会获得1个紫色硬币（如果还有）

#### 预购类型
1. **预购展示卡牌**: 预购场上公开展示的卡牌
2. **预购牌堆顶部**: 预购指定牌堆的顶部卡牌（隐私卡牌，只有预购者能看到）

#### 可见性机制
- 从展示区预购的卡牌：`visible_to_all: true`，所有玩家都能看到完整卡牌信息
- 从牌堆顶部预购的卡牌：`visible_to_all: false`，只有预购者能看到完整信息，其他玩家只能看到"隐藏卡牌"占位符

### 3. 结束回合操作
**客户端发送**:
```json
{
  "action": "game_action",
  "game_action": "end_turn",
  "action_data": {}
}
```

**成功响应**:
```json
{
  "type": "game_action_result",
  "success": true,
  "message": "回合结束，轮到 玩家名 行动",
  "room_updated": {
    "current_player": "user_456",
    "game_state": {
      "turn_count": 2,
      "last_action": {
        "player_id": "user_123",
        "action": "end_turn",
        "turn_count": 2
      }
    }
  }
}
```

**失败响应**:
```json
{
  "type": "game_action_result",
  "success": false,
  "message": "不是你的回合"
}
```

#### 回合结束规则
- 只有当前回合的玩家才能结束回合
- 结束回合后会自动切换到下一个玩家
- 回合计数会自动增加
- 拿取硬币、预购卡牌、购买卡牌等操作不会自动结束回合，需要手动调用结束回合接口

### 4. 硬币拿取规则

#### 规则1: 拿取3个不同颜色的硬币
- 必须选择3种不同颜色
- 每种颜色只能拿取1个
- 不能拿取紫色硬币

**示例**:
```json
{
  "coins": {
    "red": 1,
    "blue": 1,
    "yellow": 1
  }
}
```

#### 规则2: 拿取2个同色硬币
- 只能选择1种颜色
- 拿取2个该颜色的硬币
- 不能拿取紫色硬币

**示例**:
```json
{
  "coins": {
    "red": 2
  }
}
```

### 3. 游戏状态更新通知
当游戏状态发生变化时，服务器会向房间内所有玩家广播更新：

```json
{
  "type": "room_updated",
  "room": {
    "id": "room_123",
    "status": "playing",
    "current_player": "user_456",
    "game_state": {
      "turn_count": 1,
      "current_phase": "playing",
      "public_info": {
        "coins": {
          "red": 6,
          "pink": 7,
          "blue": 6,
          "yellow": 6,
          "black": 7,
          "purple": 5
        },
        "display_cards": {
          "level_1": [...],
          "level_2": [...],
          "level_3": [...],
          "rare": [...],
          "phantom": [...]
        },
        "deck_counts": {
          "level_1": 36,
          "level_2": 26,
          "level_3": 16,
          "rare": 4,
          "phantom": 4
        }
      },
      "player_data": {
        "user_123": {
          "symbol": "🔴",
          "position": 0,
          "score": 0,
          "cards": [],
          "coins": {
            "red": 1,
            "pink": 0,
            "blue": 1,
            "yellow": 1,
            "black": 0,
            "purple": 0
          }
        },
        "user_456": {
          "symbol": "🔵",
          "position": 1,
          "score": 0,
          "cards": [],
          "coins": {
            "red": 0,
            "pink": 0,
            "blue": 0,
            "yellow": 0,
            "black": 0,
            "purple": 0
          }
        }
      },
      "last_action": {
        "player_id": "user_123",
        "action": "take_coins",
        "coins": {
          "red": 1,
          "blue": 1,
          "yellow": 1
        }
      }
    }
  }
}
```

---

## 游戏流程说明

### 1. 游戏初始化
1. 创建房间并选择"宝可梦"游戏类型
2. 等待2-4名玩家加入
3. 房主开始游戏
4. 系统初始化：
   - 硬币池：红、粉、蓝、黄、黑各7个，紫色5个
   - 卡牌堆：按等级分类并洗牌
   - 展示区：每个等级显示对应数量的卡牌
   - 玩家资源：每人0硬币，0卡牌

### 2. 回合流程
1. 轮到当前玩家行动
2. 玩家可以选择以下操作之一：
   - **拿取硬币**: 按规则拿取硬币
   - **预购卡牌**: 预购展示卡牌或牌堆顶部卡牌
3. 验证操作合法性
4. 执行操作并更新游戏状态
5. 切换到下一个玩家

### 3. 硬币拿取规则详解
- **目标**: 收集硬币用于购买宝可梦卡牌
- **限制**: 每回合只能拿取一次硬币
- **规则**:
  - 方式1：拿取3个不同颜色的硬币（红、粉、蓝、黄、黑中选3种，各1个）
  - 方式2：拿取2个同色硬币（红、粉、蓝、黄、黑中选1种，拿2个）
  - 紫色硬币为万能硬币，不能通过拿取获得

### 4. 卡牌系统
- **等级分类**:
  - 低级卡牌：展示4张
  - 中级卡牌：展示4张
  - 高级卡牌：展示4张
  - 稀有卡牌：展示1张
  - 传说卡牌：展示1张

- **卡牌属性**:
  - `id`: 卡牌唯一标识
  - `name`: 宝可梦名称
  - `points`: 分数值
  - `level`: 等级（低级/中级/高级/稀有/传说）
  - `need_*`: 购买所需的各色硬币数量
  - `reward_*`: 购买后获得的奖励
  - `can_evolve`: 是否可进化
  - `evolve_*`: 进化相关信息

---

## 错误码说明

### WebSocket连接错误
- `1000`: 正常关闭
- `1001`: 端点离开
- `1002`: 协议错误
- `1003`: 不支持的数据类型
- `1006`: 异常关闭
- `1011`: 服务器错误

### 游戏操作错误
- `GAME_NOT_STARTED`: 游戏未开始
- `NOT_YOUR_TURN`: 不是你的回合
- `INVALID_ACTION`: 无效的操作
- `INSUFFICIENT_COINS`: 硬币不足
- `INVALID_COIN_COMBINATION`: 无效的硬币组合
- `ROOM_FULL`: 房间已满
- `ROOM_NOT_FOUND`: 房间不存在
- `PERMISSION_DENIED`: 权限不足

### HTTP状态码
- `200`: 请求成功
- `400`: 请求参数错误
- `401`: 未授权
- `403`: 禁止访问
- `404`: 资源不存在
- `500`: 服务器内部错误

---

## 调试建议

### 1. 使用WebSocket调试工具
推荐使用浏览器开发者工具或专门的WebSocket客户端进行调试。

### 2. 常见调试场景

#### 测试拿取硬币功能
```javascript
// 连接WebSocket
const ws = new WebSocket('ws://127.0.0.1:8080/ws/your_session_token');

// 拿取3个不同颜色硬币
ws.send(JSON.stringify({
  action: "game_action",
  game_action: "take_coins",
  action_data: {
    coins: {
      red: 1,
      blue: 1,
      yellow: 1
    }
  }
}));

// 拿取2个同色硬币
ws.send(JSON.stringify({
  action: "game_action",
  game_action: "take_coins",
  action_data: {
    coins: {
      red: 2
    }
  }
}));
```

#### 测试预购卡牌功能
```javascript
// 预购展示卡牌
ws.send(JSON.stringify({
  action: "game_action",
  game_action: "reserve_card",
  action_data: {
    type: "display",
    card_id: 123
  }
}));

// 预购牌堆顶部卡牌
ws.send(JSON.stringify({
  action: "game_action",
  game_action: "reserve_card",
  action_data: {
    type: "deck_top",
    target: "level_1"
  }
}));

// 预购不同等级的牌堆顶部
ws.send(JSON.stringify({
  action: "game_action",
  game_action: "reserve_card",
  action_data: {
    type: "deck_top",
    target: "level_2"  // 可选: level_1, level_2, level_3, rare
  }
}));
```

### 3. 日志监控
服务器会在控制台输出详细的操作日志，包括：
- 玩家连接/断开
- 房间创建/销毁
- 游戏操作执行
- 错误信息

---

## 版本信息
- **当前版本**: v1.1.0
- **最后更新**: 2025-01-20
- **支持的游戏**: 井字棋、反向井字棋、宝可梦
- **主要功能**: 用户管理、房间管理、实时游戏、硬币拿取、卡牌预购

---

## 联系信息
如有问题或建议，请联系开发团队。