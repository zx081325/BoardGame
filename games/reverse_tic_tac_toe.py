"""
反井格棋游戏实现
继承BaseGame基类，实现反井格棋的具体游戏逻辑
规则：谁连成3个谁输（与传统井字棋相反）
"""

from typing import Dict, List, Optional
from game_base import BaseGame, GamePlayer, MoveResult, GameStatus
from datetime import datetime

class ReverseTicTacToeGame(BaseGame):
    """反井格棋游戏类"""
    
    def __init__(self, room_id: str, room_name: str):
        super().__init__(room_id, room_name, max_players=2)
    
    @property
    def game_type(self) -> str:
        return "reverse_tic_tac_toe"
    
    @property
    def game_name(self) -> str:
        return "反井格棋"
    
    def _init_game_state(self) -> Dict:
        """初始化反井格棋游戏状态"""
        return {
            "board": [["" for _ in range(3)] for _ in range(3)],
            "loser": None,  # 反井格棋中记录的是输家
            "is_draw": False
        }
    
    def _get_player_symbols(self) -> List[str]:
        """反井格棋玩家符号"""
        return ["X", "O"]
    
    def make_move(self, player_id: str, move_data: Dict) -> MoveResult:
        """执行反井格棋移动"""
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
        loser = self._check_loser()  # 在反井格棋中检查输家
        is_draw = self._is_board_full() and not loser
        
        if loser or is_draw:
            self.status = GameStatus.FINISHED
            self.game_state["loser"] = loser
            self.game_state["is_draw"] = is_draw
            
            # 在反井格棋中，获胜者是没有连成线的玩家
            winner = None
            if loser and not is_draw:
                # 找到获胜者（不是输家的另一个玩家）
                for player in self.players:
                    if player.symbol != loser:
                        winner = player.symbol
                        break
            
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
        """验证反井格棋移动是否有效"""
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
    
    def _check_loser(self) -> Optional[str]:
        """检查是否有输家（连成3个的玩家）"""
        board = self.game_state["board"]
        
        # 检查行
        for row in board:
            if row[0] == row[1] == row[2] != "":
                return row[0]  # 返回连成线的符号（输家）
        
        # 检查列
        for col in range(3):
            if board[0][col] == board[1][col] == board[2][col] != "":
                return board[0][col]  # 返回连成线的符号（输家）
        
        # 检查对角线
        if board[0][0] == board[1][1] == board[2][2] != "":
            return board[0][0]  # 返回连成线的符号（输家）
        if board[0][2] == board[1][1] == board[2][0] != "":
            return board[0][2]  # 返回连成线的符号（输家）
        
        return None
    
    def _is_board_full(self) -> bool:
        """检查棋盘是否已满"""
        return all(cell != "" for row in self.game_state["board"] for cell in row)
    
    def handle_game_action(self, player_id: str, action: str, action_data: Dict) -> Optional[Dict]:
        """处理反向井字棋游戏特定操作"""
        # 反向井字棋目前没有特殊操作，所有操作都通过make_move处理
        return {"success": False, "message": f"反向井字棋不支持操作: {action}"}
    
    def get_game_rules(self) -> Dict:
        """获取游戏规则说明"""
        return {
            "name": self.game_name,
            "description": "两名玩家轮流在3x3的棋盘上放置自己的符号（X或O），率先在横、竖或斜线上连成三个符号的玩家败北！目标是避免连成线。",
            "max_players": self.max_players,
            "move_format": {
                "action": "make_move",
                "row": "行位置 (0-2)",
                "col": "列位置 (0-2)"
            },
            "symbols": ["X", "O"],
            "special_rules": "反井格棋规则：谁连成3个谁输！"
        }