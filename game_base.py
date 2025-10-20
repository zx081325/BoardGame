"""
游戏基类和接口定义
定义了游戏系统的统一接口，所有游戏都需要继承这些基类
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

class GameStatus(Enum):
    """游戏状态枚举"""
    WAITING = "waiting"
    PLAYING = "playing"
    FINISHED = "finished"

@dataclass
class GamePlayer:
    """游戏玩家数据类"""
    user_id: str
    name: str
    symbol: Optional[str] = None  # 玩家在游戏中的符号（如X、O）
    
class MoveResult:
    """游戏移动结果"""
    def __init__(self, success: bool, error: str = None, game_state: Dict = None, 
                 game_finished: bool = False, winner: str = None, is_draw: bool = False):
        self.success = success
        self.error = error
        self.game_state = game_state
        self.game_finished = game_finished
        self.winner = winner
        self.is_draw = is_draw

class BaseGame(ABC):
    """游戏基类 - 所有游戏都需要继承此类"""
    
    def __init__(self, room_id: str, room_name: str, max_players: int = 2):
        self.room_id = room_id
        self.room_name = room_name
        self.max_players = max_players
        self.players: List[GamePlayer] = []
        self.status = GameStatus.WAITING
        self.current_player_index = 0
        self.game_state = self._init_game_state()
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
    
    @property
    @abstractmethod
    def game_type(self) -> str:
        """游戏类型标识符"""
        pass
    
    @property
    @abstractmethod
    def game_name(self) -> str:
        """游戏显示名称"""
        pass
    
    @abstractmethod
    def _init_game_state(self) -> Dict:
        """初始化游戏状态"""
        pass
    
    @abstractmethod
    def make_move(self, player_id: str, move_data: Dict) -> MoveResult:
        """执行游戏移动"""
        pass
    
    @abstractmethod
    def is_valid_move(self, player_id: str, move_data: Dict) -> bool:
        """验证移动是否有效"""
        pass
    
    def handle_game_action(self, player_id: str, action: str, action_data: Dict) -> Dict:
        """处理游戏特定操作，子类可以重写此方法"""
        return {
            "success": False,
            "error": f"不支持的操作: {action}"
        }
    
    def add_player(self, player: GamePlayer) -> bool:
        """添加玩家到游戏"""
        if len(self.players) >= self.max_players:
            return False
        
        # 检查玩家是否已存在
        if any(p.user_id == player.user_id for p in self.players):
            return False
        
        self.players.append(player)
        self.last_activity = datetime.now()
        
        # 移除自动开始游戏的逻辑，改为手动开始
        # 房间满员后保持等待状态，等待房主手动开始游戏
        
        return True
    
    def start_game(self, player_id: str) -> bool:
        """开始游戏"""
        # 只有房主（第一个玩家）可以开始游戏
        if not self.players:
            return False
        
        room_owner = self.players[0]
        if room_owner.user_id != player_id:
            return False
        
        # 游戏必须处于等待状态
        if self.status != GameStatus.WAITING:
            return False
        
        # 至少需要2个玩家
        if len(self.players) < 2:
            return False
        
        self.status = GameStatus.PLAYING
        self._assign_player_symbols()
        return True
    
    def remove_player(self, player_id: str) -> bool:
        """移除玩家"""
        original_count = len(self.players)
        self.players = [p for p in self.players if p.user_id != player_id]
        
        # 检查是否成功移除了玩家
        player_removed = len(self.players) < original_count
        
        if not self.players:
            return True  # 房间应该被删除
        
        if player_removed:
            # 重置游戏状态
            self.status = GameStatus.WAITING
            self.game_state = self._init_game_state()
            self.current_player_index = 0
            self.last_activity = datetime.now()
        
        return player_removed
    
    def get_current_player(self) -> Optional[GamePlayer]:
        """获取当前轮到的玩家"""
        if self.status != GameStatus.PLAYING or not self.players:
            return None
        return self.players[self.current_player_index]
    
    def next_player(self):
        """切换到下一个玩家"""
        if self.players:
            self.current_player_index = (self.current_player_index + 1) % len(self.players)
    
    def get_room_info(self) -> Dict:
        """获取房间信息"""
        return {
            "id": self.room_id,
            "name": self.room_name,
            "game_type": self.game_type,
            "game_name": self.game_name,
            "status": self.status.value,
            "players": [
                {
                    "user_id": p.user_id,
                    "name": p.name,
                    "symbol": p.symbol
                } for p in self.players
            ],
            "max_players": self.max_players,
            "current_player": self.get_current_player().user_id if self.get_current_player() else None,
            "game_state": self.game_state
        }
    
    def _assign_player_symbols(self):
        """为玩家分配游戏符号 - 子类可以重写"""
        symbols = self._get_player_symbols()
        for i, player in enumerate(self.players):
            if i < len(symbols):
                player.symbol = symbols[i]
    
    def _get_player_symbols(self) -> List[str]:
        """获取玩家符号列表 - 子类可以重写"""
        return ["Player1", "Player2"]
    
    def reset_game(self):
        """重置游戏状态"""
        self.game_state = self._init_game_state()
        self.status = GameStatus.PLAYING if len(self.players) == self.max_players else GameStatus.WAITING
        self.current_player_index = 0
        self.last_activity = datetime.now()

class GameRegistry:
    """游戏注册表 - 管理所有可用的游戏类型"""
    
    def __init__(self):
        self._games: Dict[str, type] = {}
    
    def register_game(self, game_class: type):
        """注册游戏类"""
        if not issubclass(game_class, BaseGame):
            raise ValueError(f"游戏类 {game_class.__name__} 必须继承 BaseGame")
        
        # 创建临时实例来获取游戏类型
        temp_instance = game_class("temp", "temp")
        game_type = temp_instance.game_type
        
        self._games[game_type] = game_class
        print(f"游戏 '{temp_instance.game_name}' ({game_type}) 已注册")
    
    def create_game(self, game_type: str, room_id: str, room_name: str) -> Optional[BaseGame]:
        """创建游戏实例"""
        if game_type not in self._games:
            return None
        
        game_class = self._games[game_type]
        return game_class(room_id, room_name)
    
    def get_available_games(self) -> List[Dict]:
        """获取所有可用的游戏类型"""
        games = []
        for game_type, game_class in self._games.items():
            temp_instance = game_class("temp", "temp")
            games.append({
                "type": game_type,
                "name": temp_instance.game_name,
                "max_players": temp_instance.max_players
            })
        return games
    
    def is_game_available(self, game_type: str) -> bool:
        """检查游戏类型是否可用"""
        return game_type in self._games
    
    def is_registered(self, game_type: str) -> bool:
        """检查游戏类型是否已注册（别名方法）"""
        return self.is_game_available(game_type)
    
    def get_game_class(self, game_type: str) -> Optional[type]:
        """获取游戏类"""
        return self._games.get(game_type)

# 全局游戏注册表实例
game_registry = GameRegistry()