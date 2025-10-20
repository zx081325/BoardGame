"""
井字棋游戏实现
继承BaseGame基类，实现井字棋的具体游戏逻辑
"""

from typing import Dict, List, Optional
from game_base import BaseGame, GamePlayer, MoveResult, GameStatus

class TicTacToeGame(BaseGame):
    """井字棋游戏类"""
    
    def __init__(self, room_id: str, room_name: str):
        super().__init__(room_id, room_name, max_players=2)
    
    @property
    def game_type(self) -> str:
        return "tic_tac_toe"
    
    @property
    def game_name(self) -> str:
        return "井字棋"
    
    def _init_game_state(self) -> Dict:
        """初始化井字棋游戏状态"""
        return {
            "board": [["" for _ in range(3)] for _ in range(3)],
            "winner": None,
            "is_draw": False
        }
    
    def _get_player_symbols(self) -> List[str]:
        """井字棋玩家符号"""
        return ["X", "O"]
    
    def make_move(self, player_id: str, move_data: Dict) -> MoveResult:
        """执行井字棋移动"""
        # 验证游戏状态
        if self.status != GameStatus.PLAYING:
            return MoveResult(False, "游戏未开始")
        
        # 验证是否轮到该玩家
        current_player = self.get_current_player()
        if not current_player or current_player.user_id != player_id:
            return MoveResult(False, "不是你的回合")
        
        # 验证移动数据
        if not self.is_valid_move(player_id, move_data):
            return MoveResult(False, "无效的移动")
        
        # 执行移动
        row, col = move_data.get("row"), move_data.get("col")
        player_symbol = current_player.symbol
        
        self.game_state["board"][row][col] = player_symbol
        self.last_activity = datetime.now()
        
        # 检查游戏是否结束
        winner = self._check_winner()
        is_draw = self._is_board_full() and not winner
        
        if winner or is_draw:
            self.status = GameStatus.FINISHED
            self.game_state["winner"] = winner
            self.game_state["is_draw"] = is_draw
            
            return MoveResult(
                success=True,
                game_state=self.game_state,
                game_finished=True,
                winner=winner,
                is_draw=is_draw
            )
        else:
            # 切换到下一个玩家
            self.next_player()
            
            return MoveResult(
                success=True,
                game_state=self.game_state,
                game_finished=False
            )
    
    def is_valid_move(self, player_id: str, move_data: Dict) -> bool:
        """验证井字棋移动是否有效"""
        try:
            row = move_data.get("row")
            col = move_data.get("col")
            
            # 检查坐标是否有效
            if row is None or col is None:
                return False
            
            if not (0 <= row < 3) or not (0 <= col < 3):
                return False
            
            # 检查位置是否已被占用
            if self.game_state["board"][row][col] != "":
                return False
            
            return True
            
        except (TypeError, ValueError):
            return False
    
    def _check_winner(self) -> Optional[str]:
        """检查是否有获胜者"""
        board = self.game_state["board"]
        
        # 检查行
        for row in board:
            if row[0] == row[1] == row[2] != "":
                return row[0]
        
        # 检查列
        for col in range(3):
            if board[0][col] == board[1][col] == board[2][col] != "":
                return board[0][col]
        
        # 检查对角线
        if board[0][0] == board[1][1] == board[2][2] != "":
            return board[0][0]
        if board[0][2] == board[1][1] == board[2][0] != "":
            return board[0][2]
        
        return None
    
    def _is_board_full(self) -> bool:
        """检查棋盘是否已满"""
        return all(cell != "" for row in self.game_state["board"] for cell in row)
    
    def handle_game_action(self, player_id: str, action: str, action_data: Dict) -> Optional[Dict]:
        """处理井字棋游戏特定操作"""
        # 井字棋目前没有特殊操作，所有操作都通过make_move处理
        return {"success": False, "message": f"井字棋不支持操作: {action}"}
    
    def get_game_rules(self) -> Dict:
        """获取游戏规则说明"""
        return {
            "name": self.game_name,
            "description": "两名玩家轮流在3x3的棋盘上放置自己的符号（X或O），率先在横、竖或斜线上连成三个符号的玩家获胜。",
            "max_players": self.max_players,
            "move_format": {
                "action": "make_move",
                "row": "行位置 (0-2)",
                "col": "列位置 (0-2)"
            },
            "symbols": ["X", "O"]
        }

# 导入datetime模块
from datetime import datetime