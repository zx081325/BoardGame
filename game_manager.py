"""
游戏管理器
负责游戏类型的注册、房间管理和游戏调度
"""

from typing import Dict, List, Optional, Type
from game_base import BaseGame, GameRegistry
from games.tic_tac_toe import TicTacToeGame
from games.reverse_tic_tac_toe import ReverseTicTacToeGame
from games.pokemon_game import PokemonGame
import uuid
import random

class GameManager:
    """游戏管理器类"""
    
    def __init__(self):
        self.rooms: Dict[str, BaseGame] = {}
        self.registry = GameRegistry()
        self._register_default_games()
    
    def _register_default_games(self):
        """注册默认游戏类型"""
        self.registry.register_game(TicTacToeGame)
        self.registry.register_game(ReverseTicTacToeGame)
        self.registry.register_game(PokemonGame)
    
    def get_available_games(self) -> List[Dict]:
        """获取可用的游戏类型列表"""
        games = []
        for game_type, game_class in self.registry._games.items():
            # 创建临时实例获取游戏信息
            temp_game = game_class("temp", "temp")
            games.append({
                "type": game_type,
                "name": temp_game.game_name,
                "max_players": temp_game.max_players,
                "rules": temp_game.get_game_rules()
            })
        return games
    
    def create_room(self, game_type: str, room_name: str, creator_id: str, creator_name: str = None) -> Optional[BaseGame]:
        """创建游戏房间"""
        if not self.registry.is_registered(game_type):
            return None
        
        room_id = str(random.randint(100000, 999999))
        game_class = self.registry.get_game_class(game_type)
        
        # 创建游戏实例
        game = game_class(room_id, room_name)
        
        # 创建GamePlayer对象并添加创建者为第一个玩家
        from game_base import GamePlayer
        player = GamePlayer(
            user_id=creator_id,
            name=creator_name or f"Player_{creator_id[:8]}"
        )
        
        if game.add_player(player):
            self.rooms[room_id] = game
            return game
        
        return None
    
    def get_room(self, room_id: str) -> Optional[BaseGame]:
        """获取指定房间"""
        return self.rooms.get(room_id)
    
    def get_all_rooms(self) -> List[Dict]:
        """获取所有房间信息"""
        rooms = []
        for room_id, game in self.rooms.items():
            rooms.append({
                "room_id": room_id,
                "room_name": game.room_name,
                "game_type": game.game_type,
                "game_name": game.game_name,
                "status": game.status.value,
                "players": [
                    {
                        "user_id": player.user_id,
                        "name": player.name,
                        "is_current": game.get_current_player() and game.get_current_player().user_id == player.user_id
                    } for player in game.players
                ],
                "current_players": len(game.players),
                "max_players": game.max_players,
                "created_at": game.created_at.isoformat(),
                "last_activity": game.last_activity.isoformat()
            })
        return rooms
    
    def join_room(self, room_id: str, player_id: str, player_name: str = None) -> bool:
        """加入房间"""
        game = self.get_room(room_id)
        if not game:
            return False
        
        # 创建新玩家
        from game_base import GamePlayer
        player = GamePlayer(
            user_id=player_id,
            name=player_name or f"Player_{player_id[:8]}"
        )
        
        return game.add_player(player)
    
    def leave_room(self, room_id: str, player_id: str) -> bool:
        """离开房间"""
        game = self.get_room(room_id)
        if not game:
            return False
        
        success = game.remove_player(player_id)
        
        # 如果房间没有玩家了，删除房间
        if success and len(game.players) == 0:
            del self.rooms[room_id]
        
        return success
    
    def make_move(self, room_id: str, player_id: str, move_data: Dict) -> Optional[Dict]:
        """在指定房间执行游戏移动"""
        game = self.get_room(room_id)
        if not game:
            return None
        
        result = game.make_move(player_id, move_data)
        
        if result.success:
            return {
                "success": True,
                "game_state": result.game_state,
                "game_finished": result.game_finished,
                "winner": result.winner,
                "is_draw": result.is_draw,
                "current_player": game.get_current_player().user_id if game.get_current_player() else None
            }
        else:
            return {
                "success": False,
                "error": result.error_message
            }
    
    def start_game(self, room_id: str, player_id: str) -> bool:
        """手动开始游戏"""
        game = self.get_room(room_id)
        if not game:
            return False
        
        return game.start_game(player_id)
    
    def handle_game_action(self, room_id: str, player_id: str, action: str, action_data: Dict) -> Optional[Dict]:
        """处理游戏特定操作"""
        game = self.get_room(room_id)
        if not game:
            return None
        
        return game.handle_game_action(player_id, action, action_data)
    
    def get_room_basic_info(self, room_id: str) -> Optional[Dict]:
        """获取房间基本信息（不包含游戏状态详情）"""
        game = self.get_room(room_id)
        if not game:
            return None
        
        return {
            "room_id": room_id,
            "room_name": game.room_name,
            "game_type": game.game_type,
            "game_name": game.game_name,
            "status": game.status.value,
            "players": [
                {
                    "user_id": player.user_id,
                    "name": player.name,
                    "symbol": player.symbol,
                    "is_current": False  # 创建时还没开始游戏，没有当前玩家
                }
                for player in game.players
            ],
            "current_player": None,  # 创建时还没开始游戏
            "current_players": len(game.players),
            "max_players": game.max_players,
            "created_at": game.created_at.isoformat(),
            "last_activity": game.last_activity.isoformat()
        }
    
    def get_room_state(self, room_id: str) -> Optional[Dict]:
        """获取房间完整状态"""
        game = self.get_room(room_id)
        if not game:
            return None
        
        # 创建过滤后的游戏状态，排除私有数据
        filtered_game_state = {}
        if game.game_state:
            for key, value in game.game_state.items():
                if key != "private_data":  # 排除私有数据
                    filtered_game_state[key] = value
        
        return {
            "room_id": room_id,
            "room_name": game.room_name,
            "game_type": game.game_type,
            "game_name": game.game_name,
            "status": game.status.value,
            "game_state": filtered_game_state,
            "players": [
                {
                    "user_id": player.user_id,
                    "name": player.name,
                    "symbol": player.symbol,
                    "is_current": game.get_current_player() and game.get_current_player().user_id == player.user_id
                }
                for player in game.players
            ],
            "current_player": game.get_current_player().user_id if game.get_current_player() else None,
            "current_players": len(game.players),
            "max_players": game.max_players,
            "created_at": game.created_at.isoformat(),
            "last_activity": game.last_activity.isoformat()
        }
    
    def cleanup_inactive_rooms(self, inactive_minutes: int = 30):
        """清理不活跃的房间"""
        from datetime import datetime, timedelta
        
        cutoff_time = datetime.now() - timedelta(minutes=inactive_minutes)
        inactive_rooms = [
            room_id for room_id, game in self.rooms.items()
            if game.last_activity < cutoff_time
        ]
        
        for room_id in inactive_rooms:
            del self.rooms[room_id]
        
        return len(inactive_rooms)
    
    def get_player_rooms(self, player_id: str) -> List[Dict]:
        """获取玩家参与的所有房间"""
        player_rooms = []
        for room_id, game in self.rooms.items():
            if any(player.user_id == player_id for player in game.players):
                player_rooms.append({
                    "room_id": room_id,
                    "room_name": game.room_name,
                    "game_type": game.game_type,
                    "game_name": game.game_name,
                    "status": game.status.value
                })
        return player_rooms

# 创建全局游戏管理器实例
game_manager = GameManager()