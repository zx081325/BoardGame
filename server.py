"""
游戏平台服务器
重构后的版本，移除了游戏逻辑，使用模块化的游戏管理器
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
import json
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
import secrets
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
import hashlib
from sqlalchemy.orm import Session
from database import get_db, User, UserSession, init_database
from game_manager import game_manager

app = FastAPI()
security = HTTPBearer()

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有HTTP方法
    allow_headers=["*"],  # 允许所有请求头
)

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

@dataclass
class Player:
    """平台玩家数据类"""
    id: str
    user_id: str
    name: str
    websocket: WebSocket
    session_token: str

class AuthManager:
    """用户认证管理器"""
    
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.secret_key = os.getenv("SECRET_KEY", "your-secret-key-here")
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 30
    
    def hash_password(self, password: str) -> str:
        # bcrypt有72字节的密码长度限制
        # 对于超长密码，先用SHA256哈希，然后再用bcrypt
        if len(password.encode('utf-8')) > 72:
            # 使用SHA256预处理超长密码
            password = hashlib.sha256(password.encode('utf-8')).hexdigest()
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def register_user(self, username: str, password: str, db: Session) -> Dict:
        # 检查用户名是否已存在
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            return {"success": False, "error": "用户名已存在"}
        
        if len(username) < 3 or len(username) > 20:
            return {"success": False, "error": "用户名长度必须在3-20个字符之间"}
        
        if len(password) < 6:
            return {"success": False, "error": "密码长度至少6个字符"}
        
        user_id = str(uuid.uuid4())
        hashed_password = self.hash_password(password)
        
        user = User(
            id=user_id,
            username=username,
            password_hash=hashed_password,
            created_at=datetime.now(timezone.utc),
            last_login=datetime.now(timezone.utc),
            is_online=False
        )
        
        db.add(user)
        db.commit()
        
        return {"success": True, "user_id": user_id}
    
    def login_user(self, username: str, password: str, db: Session) -> Dict:
        user = db.query(User).filter(User.username == username).first()
        if not user or not self.verify_password(password, user.password_hash):
            return {"success": False, "error": "用户名或密码错误"}
        
        # 生成会话令牌
        session_token = secrets.token_urlsafe(32)
        
        # 创建用户会话
        session = UserSession(
            session_token=session_token,
            user_id=user.id,
            created_at=datetime.now(timezone.utc),
            last_activity=datetime.now(timezone.utc),
            is_active=True
        )
        
        db.add(session)
        user.last_login = datetime.now(timezone.utc)
        user.is_online = True
        db.commit()
        
        return {
            "success": True,
            "session_token": session_token,
            "user": {
                "id": user.id,
                "username": user.username
            }
        }
    
    def validate_session(self, session_token: str, db: Session) -> Optional[UserSession]:
        session = db.query(UserSession).filter(
            UserSession.session_token == session_token,
            UserSession.is_active == True
        ).first()
        
        if not session:
            return None
        
        # 检查会话是否过期（30分钟）
        # 确保last_activity是timezone-aware的
        last_activity = session.last_activity
        if last_activity.tzinfo is None:
            last_activity = last_activity.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) - last_activity > timedelta(minutes=30):
            session.is_active = False
            db.commit()
            return None
        
        return session
    
    def logout_user(self, session_token: str, db: Session):
        session = db.query(UserSession).filter(UserSession.session_token == session_token).first()
        if session:
            session.is_active = False
            db.commit()
    
    def get_user(self, user_id: str, db: Session) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()
    
    def get_user_by_session(self, session_token: str, db: Session) -> Optional[User]:
        session = self.validate_session(session_token, db)
        if session:
            return self.get_user(session.user_id, db)
        return None

class PlatformManager:
    """平台管理器 - 处理WebSocket连接和平台级功能"""
    
    def __init__(self):
        self.player_connections: Dict[str, WebSocket] = {}
        self.user_states: Dict[str, Dict] = {}  # 用户状态持久化
        self.session_to_player: Dict[str, str] = {}  # 会话到玩家的映射
    
    def register_player_connection(self, player_id: str, websocket: WebSocket, session_token: str):
        """注册玩家连接"""
        self.player_connections[player_id] = websocket
        self.session_to_player[session_token] = player_id
    
    def unregister_player_connection(self, player_id: str, session_token: str = None):
        """注销玩家连接"""
        if player_id in self.player_connections:
            del self.player_connections[player_id]
        
        if session_token and session_token in self.session_to_player:
            del self.session_to_player[session_token]
    
    def save_user_state(self, user_id: str, room_id: str):
        """保存用户状态"""
        self.user_states[user_id] = {
            "room_id": room_id,
            "last_activity": datetime.now().isoformat()
        }
    
    def get_user_state(self, user_id: str) -> Optional[Dict]:
        """获取用户状态"""
        return self.user_states.get(user_id)
    
    def clear_user_state(self, user_id: str):
        """清除用户状态"""
        if user_id in self.user_states:
            del self.user_states[user_id]
    
    async def broadcast_to_room(self, room_id: str, message: Dict):
        """向房间广播消息"""
        room = game_manager.get_room(room_id)
        if not room:
            return
        
        # 获取房间中的所有玩家连接
        for player in room.players:
            if player.user_id in self.player_connections:
                try:
                    websocket = self.player_connections[player.user_id]
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    print(f"向玩家 {player.user_id} 发送消息失败: {e}")
                    # 移除失效的连接
                    if player.user_id in self.player_connections:
                        del self.player_connections[player.user_id]

# 创建管理器实例
auth_manager = AuthManager()
platform_manager = PlatformManager()

# API 端点
@app.get("/")
async def get_index():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.post("/api/register")
async def register(data: dict, db: Session = Depends(get_db)):
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")
    
    result = auth_manager.register_user(username, password, db)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {"success": True, "message": "注册成功", "user_id": result["user_id"]}

@app.post("/api/login")
async def login(data: dict, db: Session = Depends(get_db)):
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")
    
    result = auth_manager.login_user(username, password, db)
    
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["error"])
    
    return result

@app.post("/api/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    auth_manager.logout_user(credentials.credentials, db)
    return {"message": "登出成功"}

@app.get("/api/games")
async def get_available_games():
    """获取可用的游戏类型"""
    return {"games": game_manager.get_available_games()}



@app.websocket("/ws/{session_token}")
async def websocket_endpoint(websocket: WebSocket, session_token: str):
    await websocket.accept()
    
    # 获取数据库会话
    db = next(get_db())
    
    try:
        # 验证会话
        session = auth_manager.validate_session(session_token, db)
        if not session:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "会话无效或已过期"
            }))
            await websocket.close()
            return
        
        user = auth_manager.get_user_by_session(session_token, db)
        if not user:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "用户不存在"
            }))
            await websocket.close()
            return
        
        current_room_id = None
        
        # 尝试恢复状态
        user_state = platform_manager.get_user_state(user.id)
        if user_state:
            room_id = user_state.get("room_id")
            
            # 检查房间是否仍然存在
            room = game_manager.get_room(room_id)
            if room:
                # 检查玩家是否仍在房间中
                for player in room.players:
                    if player.user_id == user.id:
                        # 更新玩家连接
                        player.websocket = websocket
                        player.session_token = session_token
                        platform_manager.register_player_connection(user.id, websocket, session_token)
                        
                        current_room_id = room_id
                        
                        await websocket.send_text(json.dumps({
                            "type": "reconnected",
                            "room_info": game_manager.get_room_state(room_id),
                            "message": "已恢复游戏状态"
                        }))
                        break
        
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                action = message.get("action")
                
                # 更新会话活动时间
                session.last_activity = datetime.now(timezone.utc)
                db.commit()
                
                if action == "get_games":
                    # 获取可用游戏类型
                    games = game_manager.get_available_games()
                    await websocket.send_text(json.dumps({
                        "type": "games_list",
                        "games": games
                    }))
                
                elif action == "create_room":
                    room_name = message.get("room_name", f"{user.username}的房间")
                    game_type = message.get("game_type", "tic_tac_toe")
                    
                    # 使用游戏管理器创建房间
                    room = game_manager.create_room(game_type, room_name, user.id, user.username)
                    if room:
                        current_room_id = room.room_id
                        
                        # 注册连接（使用user_id作为player_id）
                        platform_manager.register_player_connection(user.id, websocket, session_token)
                        platform_manager.save_user_state(user.id, current_room_id)
                        
                        # 更新数据库中的房间信息
                        session.room_id = current_room_id
                        db.commit()
                        
                        await websocket.send_text(json.dumps({
                            "type": "room_created",
                            "room_id": current_room_id,
                            "room_info": game_manager.get_room_basic_info(current_room_id)
                        }))
                        
                        await platform_manager.broadcast_to_room(current_room_id, {
                            "type": "room_updated",
                            "room_info": game_manager.get_room_basic_info(current_room_id)
                        })
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "无法创建房间"
                        }))
                
                elif action == "join_room":
                    room_id = message.get("room_id")
                    
                    if game_manager.join_room(room_id, user.id, user.username):
                        current_room_id = room_id
                        
                        # 注册连接（使用user_id作为player_id）
                        platform_manager.register_player_connection(user.id, websocket, session_token)
                        platform_manager.save_user_state(user.id, current_room_id)
                        
                        # 更新数据库中的房间信息
                        session.room_id = room_id
                        db.commit()
                        
                        # 根据游戏状态选择返回的信息类型
                        game = game_manager.get_room(room_id)
                        if game and game.status.value == "PLAYING":
                            room_info = game_manager.get_room_state(room_id)
                        else:
                            room_info = game_manager.get_room_basic_info(room_id)
                        
                        await websocket.send_text(json.dumps({
                            "type": "room_joined",
                            "room_id": room_id,
                            "room_info": room_info
                        }))
                        
                        await platform_manager.broadcast_to_room(room_id, {
                            "type": "room_updated",
                            "room_info": room_info
                        })
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "无法加入房间"
                        }))
                
                elif action == "make_move":
                    if current_room_id:
                        move_data = message.get("move_data")
                        result = game_manager.make_move(current_room_id, user.id, move_data)
                        
                        if result and result["success"]:
                            await platform_manager.broadcast_to_room(current_room_id, {
                                "type": "game_updated",
                                "room_info": game_manager.get_room_state(current_room_id)
                            })
                        else:
                            error_msg = result["error"] if result else "移动失败"
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": error_msg
                            }))
                
                elif action == "start_game":
                    if current_room_id:
                        success = game_manager.start_game(current_room_id, user.id)
                        
                        if success:
                            await platform_manager.broadcast_to_room(current_room_id, {
                                "type": "room_updated",
                                "room_info": game_manager.get_room_state(current_room_id)
                            })
                        else:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": "无法开始游戏，只有房主可以开始游戏且需要至少2个玩家"
                            }))
                
                elif action == "leave_room":
                    if current_room_id:
                        print(f"处理离开房间请求: 用户={user.username}, 房间={current_room_id}, 用户ID={user.id}")
                        
                        # 保存房间ID用于后续通知
                        room_id_for_broadcast = current_room_id
                        
                        # 调用游戏管理器的离开房间方法
                        success = game_manager.leave_room(current_room_id, user.id)
                        
                        if success:
                            # 清除平台状态
                            platform_manager.unregister_player_connection(user.id, session_token)
                            platform_manager.clear_user_state(user.id)
                            
                            # 清除数据库中的房间信息
                            session.room_id = None
                            db.commit()
                            
                            # 发送离开房间确认
                            await websocket.send_text(json.dumps({
                                "type": "room_left",
                                "message": "已离开房间"
                            }))
                            
                            # 检查房间是否还存在
                            room = game_manager.get_room(room_id_for_broadcast)
                            if room:
                                # 房间仍存在，通知其他玩家
                                await platform_manager.broadcast_to_room(room_id_for_broadcast, {
                                    "type": "player_left",
                                    "player_name": user.username,
                                    "room_info": game_manager.get_room_state(room_id_for_broadcast),
                                    "message": f"{user.username} 离开了房间"
                                })
                            else:
                                print(f"玩家 {user.username} 离开后，房间 {room_id_for_broadcast} 已自动解散")
                        
                        current_room_id = None
                
                elif action == "get_rooms":
                    rooms = game_manager.get_all_rooms()
                    await websocket.send_text(json.dumps({
                        "type": "rooms_list",
                        "rooms": rooms
                    }))
                
                elif action == "game_action":
                    # 处理游戏特定操作
                    if not current_room_id:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "未在房间中"
                        }))
                        continue
                    
                    game_action = message.get("game_action")
                    action_data = message.get("action_data", {})
                    
                    if not game_action:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "缺少游戏操作类型"
                        }))
                        continue
                    
                    # 调用游戏管理器处理游戏操作
                    result = game_manager.handle_game_action(current_room_id, user.id, game_action, action_data)
                    
                    if result is None:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "游戏操作失败"
                        }))
                    elif result.get("success"):
                        # 操作成功，广播房间状态更新
                        await platform_manager.broadcast_to_room(current_room_id, {
                            "type": "room_updated",
                            "room_info": game_manager.get_room_state(current_room_id),
                            "message": result.get("message", "游戏操作成功")
                        })
                    else:
                        # 操作失败，发送错误信息
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": result.get("message", "游戏操作失败")
                        }))
                
                elif action == "heartbeat":
                    # 心跳检测
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat_response"
                    }))
        
        except WebSocketDisconnect:
            if current_room_id:
                # 不立即移除玩家，保留状态以便重连
                platform_manager.unregister_player_connection(user.id, session_token)
                
                # 通知其他玩家
                await platform_manager.broadcast_to_room(current_room_id, {
                    "type": "player_disconnected",
                    "player_name": user.username,
                    "room_info": game_manager.get_room_state(current_room_id)
                })
        
        except Exception as e:
            print(f"WebSocket error: {e}")
            if current_room_id:
                platform_manager.unregister_player_connection(user.id, session_token)
    
    finally:
        db.close()

if __name__ == "__main__":
    # 初始化数据库
    print("正在初始化数据库...")
    if init_database():
        print("数据库初始化成功！")
    else:
        print("数据库初始化失败，请检查数据库连接配置")
        exit(1)
    
    import uvicorn
    # 使用 "::" 来同时支持IPv4和IPv6
    uvicorn.run(app, host="::", port=50000)