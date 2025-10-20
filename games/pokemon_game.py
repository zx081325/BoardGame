"""
宝可梦游戏实现
继承BaseGame基类，实现宝可梦游戏的框架逻辑
支持4人游戏，轮流行动
"""

from typing import Dict, List, Optional
from game_base import BaseGame, GamePlayer, MoveResult, GameStatus
from datetime import datetime
import random
import json
import os

class PokemonGame(BaseGame):
    """宝可梦游戏类"""
    
    def __init__(self, room_id: str, room_name: str):
        self.card_data = self._load_card_data()
        super().__init__(room_id, room_name, max_players=4)
    
    def _load_card_data(self) -> Dict:
        """加载卡牌配置数据"""
        try:
            config_path = os.path.join(os.path.dirname(__file__), 'config', 'pokemon_cards.json')
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"加载卡牌数据失败: {e}")
            return {"pokemon_cards": []}
    
    @property
    def game_type(self) -> str:
        return "pokemon_game"
    
    @property
    def game_name(self) -> str:
        return "宝可梦"
    
    def _init_game_state(self) -> Dict:
        """初始化宝可梦游戏状态"""
        public_info = self._init_public_info()
        
        # 从public_info中提取牌堆数据并移到private_data
        card_decks = public_info.pop("_card_decks")
        
        return {
            "turn_count": 0,
            "current_phase": "waiting",  # waiting, playing, finished
            "player_data": {},  # 每个玩家的游戏数据
            "public_info": public_info,  # 公共信息
            "private_data": {"card_decks": card_decks},  # 私有数据，不暴露给用户
            "winner": None,
            "is_draw": False,
            "last_action": None,
            "action_history": []
        }
    
    def _init_public_info(self) -> Dict:
        """初始化公共信息（卡牌堆和硬币）"""
        # 按等级分类卡牌
        cards = self.card_data.get("pokemon_cards", [])
        level_cards = {
            "level_1": [card for card in cards if card["level"] == "低级"],
            "level_2": [card for card in cards if card["level"] == "中级"], 
            "level_3": [card for card in cards if card["level"] == "高级"],
            "rare": [card for card in cards if card["level"] == "稀有"],
            "phantom": [card for card in cards if card["level"] == "传说"]
        }
        
        # 洗牌并创建卡牌堆
        for level in level_cards:
            random.shuffle(level_cards[level])
        
        # 初始化硬币数量
        coins = {
            "red": 7,      # 红色硬币
            "pink": 7,     # 粉色硬币
            "blue": 7,     # 蓝色硬币
            "yellow": 7,   # 黄色硬币
            "black": 7,    # 黑色硬币
            "purple": 5    # 紫色硬币（万能硬币）
        }
        
        # 创建卡牌堆状态
        card_decks = {
            "level_1": {
                "name": "等级1牌堆",
                "cards": level_cards["level_1"],
                "count": len(level_cards["level_1"])
            },
            "level_2": {
                "name": "等级2牌堆", 
                "cards": level_cards["level_2"],
                "count": len(level_cards["level_2"])
            },
            "level_3": {
                "name": "等级3牌堆",
                "cards": level_cards["level_3"],
                "count": len(level_cards["level_3"])
            },
            "rare": {
                "name": "稀有牌堆",
                "cards": level_cards["rare"],
                "count": len(level_cards["rare"])
            },
            "phantom": {
                "name": "梦幻牌堆",
                "cards": level_cards["phantom"],
                "count": len(level_cards["phantom"])
            }
        }
        
        # 创建场上展示区（每种卡牌堆顶部的展示卡牌）
        display_cards = {
            "level_1": self._get_display_cards("level_1", card_decks, 4),
            "level_2": self._get_display_cards("level_2", card_decks, 4),
            "level_3": self._get_display_cards("level_3", card_decks, 4),
            "rare": self._get_display_cards("rare", card_decks, 1),
            "phantom": self._get_display_cards("phantom", card_decks, 1)
        }
        
        # 获取牌堆剩余数量（_get_display_cards已经更新了count）
        deck_counts = {
            "level_1": card_decks["level_1"]["count"],
            "level_2": card_decks["level_2"]["count"],
            "level_3": card_decks["level_3"]["count"],
            "rare": card_decks["rare"]["count"],
            "phantom": card_decks["phantom"]["count"]
        }
        
        return {
            "coins": coins,
            "display_cards": display_cards,
            "deck_counts": deck_counts,
            "_card_decks": card_decks  # 临时存储，稍后移到private_data
        }
    
    def _get_display_cards(self, deck_type: str, card_decks: Dict, count: int) -> List[Dict]:
        """从指定卡牌堆顶部获取展示卡牌并从牌堆中移除"""
        deck = card_decks.get(deck_type, {})
        cards = deck.get("cards", [])
        
        display_cards = []
        actual_count = min(count, len(cards))
        
        # 从牌堆顶部取出指定数量的卡牌
        for i in range(actual_count):
            if len(cards) > 0:
                card = cards.pop(0)  # 从牌堆顶部移除卡牌
                display_cards.append(card)
        
        # 更新牌堆数量
        deck["count"] = len(cards)
        
        return display_cards
    
    def _draw_card_from_deck(self, deck_type: str) -> Optional[Dict]:
        """从指定卡牌堆抽取一张卡牌"""
        public_info = self.game_state["public_info"]
        card_decks = self.game_state["private_data"]["card_decks"]
        deck = card_decks.get(deck_type)
        
        if not deck or deck["count"] <= 0:
            return None
        
        # 从卡牌堆中取出一张卡牌
        card = deck["cards"].pop(0)
        deck["count"] -= 1
        
        # 更新展示区
        display_count = 4 if deck_type in ["level_1", "level_2", "level_3"] else 1
        public_info["display_cards"][deck_type] = self._get_display_cards(
            deck_type, card_decks, display_count
        )
        
        return card
    
    def _take_coins(self, coin_type: str, count: int) -> bool:
        """从公共区域拿取硬币"""
        public_info = self.game_state["public_info"]
        coins = public_info["coins"]
        
        if coins.get(coin_type, 0) >= count:
            coins[coin_type] -= count
            return True
        return False
    
    def get_public_info(self) -> Dict:
        """获取公共信息"""
        return self.game_state.get("public_info", {})
    
    def get_room_info(self) -> Dict:
        """获取房间信息（重写基类方法以包含宝可梦游戏特有信息）"""
        base_info = super().get_room_info()
        
        # 添加玩家详细信息，包括预购卡牌（只显示对所有人可见的）
        if self.status == GameStatus.PLAYING:
            player_details = {}
            for player in self.players:
                player_data = self.game_state["player_data"].get(player.user_id, {})
                
                # 过滤预购卡牌，只显示对所有人可见的
                visible_reserved_cards = []
                for reserved_card in player_data.get("reserved_cards", []):
                    if reserved_card.get("visible_to_all", False):
                        visible_reserved_cards.append(reserved_card)
                    else:
                        # 隐私卡牌只显示占位信息
                        visible_reserved_cards.append({
                            "card": {
                                "id": "hidden",
                                "name": "隐藏卡牌"
                            },
                            "visible_to_all": False
                        })
                
                player_details[player.user_id] = {
                    "cards": player_data.get("cards", []),
                    "reserved_cards": visible_reserved_cards,
                    "coins": player_data.get("coins", {})
                }
            base_info["player_details"] = player_details
        
        return base_info
    
    def draw_card(self, deck_type: str) -> Optional[Dict]:
        """从指定卡牌堆抽取一张卡牌（公共方法）"""
        return self._draw_card_from_deck(deck_type)
    
    def take_coins(self, coin_requests: Dict[str, int]) -> bool:
        """获取硬币（公共方法）"""
        # 检查是否有足够的硬币
        public_info = self.game_state["public_info"]
        coins = public_info["coins"]
        
        for coin_type, count in coin_requests.items():
            if coins.get(coin_type, 0) < count:
                return False
        
        # 扣除硬币
        for coin_type, count in coin_requests.items():
            coins[coin_type] -= count
        
        return True
    
    def _get_player_symbols(self) -> List[str]:
        """宝可梦游戏玩家符号/标识"""
        return ["🔴", "🔵", "🟢", "🟡"]  # 红、蓝、绿、黄四种颜色
    
    def add_player(self, player: GamePlayer) -> bool:
        """添加玩家到游戏"""
        if not super().add_player(player):
            return False
        
        # 初始化玩家数据
        self.game_state["player_data"][player.user_id] = {
            "symbol": player.symbol,
            "position": len(self.players) - 1,  # 玩家位置 0-3
            "score": 0,
            "status": "active",
            "last_action_time": datetime.now().isoformat()
        }
        
        return True
    
    def start_game(self, player_id: str) -> bool:
        """开始游戏 - 重写基类方法"""
        # 只有房主（第一个玩家）可以开始游戏
        if not self.players:
            return False
        
        room_owner = self.players[0]
        if room_owner.user_id != player_id:
            return False
        
        # 如果游戏已经在进行中，返回成功（因为宝可梦游戏会自动开始）
        if self.status == GameStatus.PLAYING:
            return True
        
        # 游戏必须处于等待状态
        if self.status != GameStatus.WAITING:
            return False
        
        # 至少需要2个玩家
        if len(self.players) < 2:
            return False
        
        self._start_game()
        return True

    def _start_game(self):
        """开始游戏"""
        self.status = GameStatus.PLAYING
        self.game_state["current_phase"] = "playing"
        self.current_player_index = 0
        self._assign_player_symbols()
        self._init_player_resources()
        self._init_game_board()
    
    def _init_player_resources(self):
        """为每个玩家初始化资源（卡牌和钱币）"""
        for player in self.players:
            # 初始化玩家数据结构
            self.game_state["player_data"][player.user_id] = {
                "cards": [],  # 初始化玩家卡牌列表（空）
                "reserved_cards": [],  # 预购卡牌列表，每张卡牌包含可见性信息
                "coins": {    # 初始化玩家钱币列表（全为0）
                    "red": 0,
                    "pink": 0,
                    "blue": 0,
                    "yellow": 0,
                    "black": 0,
                    "purple": 0
                }
            }
    
    def _init_game_board(self):
        """初始化游戏板"""
        # 这里可以根据具体游戏规则来设计游戏板
        self.game_state["game_board"] = {
            "size": 10,  # 10x10的游戏板
            "tiles": {},  # 游戏板格子状态
            "special_locations": [],  # 特殊位置
            "items": {}  # 道具位置
        }
    
    def make_move(self, player_id: str, move_data: Dict) -> MoveResult:
        """执行宝可梦游戏移动"""
        # 验证游戏状态
        if self.status != GameStatus.PLAYING:
            return MoveResult(False, "游戏未开始或已结束")
        
        # 验证是否轮到该玩家
        current_player = self.get_current_player()
        if not current_player or current_player.user_id != player_id:
            return MoveResult(False, "不是你的回合")
        
        # 验证移动数据
        if not self.is_valid_move(player_id, move_data):
            return MoveResult(False, "无效的移动")
        
        # 执行移动
        action_type = move_data.get("action", "")
        success = self._execute_action(player_id, action_type, move_data)
        
        if not success:
            return MoveResult(False, "移动执行失败")
        
        # 更新游戏状态
        self.game_state["turn_count"] += 1
        self.game_state["last_action"] = {
            "player_id": player_id,
            "action": action_type,
            "data": move_data,
            "timestamp": datetime.now().isoformat()
        }
        self.game_state["action_history"].append(self.game_state["last_action"])
        
        # 检查游戏是否结束
        winner = self._check_winner()
        is_draw = self._check_draw()
        
        if winner or is_draw:
            self.status = GameStatus.FINISHED
            self.game_state["current_phase"] = "finished"
            self.game_state["winner"] = winner
            self.game_state["is_draw"] = is_draw
            
            return MoveResult(
                success=True,
                game_state=self.game_state,
                game_finished=True,
                winner=winner,
                is_draw=is_draw
            )
        
        # 切换到下一个玩家
        self.next_player()
        
        return MoveResult(
            success=True,
            game_state=self.game_state,
            game_finished=False
        )
    
    def is_valid_move(self, player_id: str, move_data: Dict) -> bool:
        """验证移动是否有效"""
        if not move_data:
            return False
        
        action = move_data.get("action", "")
        if not action:
            return False
        
        # 基础动作验证
        valid_actions = ["move", "attack", "use_item", "pass", "special"]
        if action not in valid_actions:
            return False
        
        # 根据不同动作类型进行具体验证
        if action == "move":
            return self._validate_move_action(player_id, move_data)
        elif action == "attack":
            return self._validate_attack_action(player_id, move_data)
        elif action == "use_item":
            return self._validate_item_action(player_id, move_data)
        elif action == "pass":
            return True  # 跳过回合总是有效的
        elif action == "special":
            return self._validate_special_action(player_id, move_data)
        
        return False
    
    def handle_game_action(self, player_id: str, action: str, action_data: Dict) -> Optional[Dict]:
        """处理宝可梦游戏特定操作"""
        if action == "take_coins":
            return self._handle_take_coins(player_id, action_data)
        elif action == "reserve_card":
            return self._handle_reserve_card(player_id, action_data)
        else:
            return {"success": False, "message": f"不支持的操作: {action}"}
    
    def _handle_take_coins(self, player_id: str, action_data: Dict) -> Dict:
        """处理拿取硬币操作"""
        try:
            print(f"DEBUG: _handle_take_coins called with player_id={player_id}, action_data={action_data}")
            print(f"DEBUG: Game status={self.status}, Players count={len(self.players)}")
            print(f"DEBUG: Current player index={self.current_player_index}")
            
            # 检查游戏状态
            if self.status != GameStatus.PLAYING:
                return {"success": False, "message": "游戏未开始"}
            
            # 检查玩家列表是否为空
            if not self.players:
                return {"success": False, "message": "没有玩家在游戏中"}
            
            # 检查当前玩家索引是否有效
            current_player_index = self.current_player_index
            if current_player_index >= len(self.players):
                return {"success": False, "message": "当前玩家索引无效"}
            
            # 检查是否是当前玩家的回合
            if self.players[current_player_index].user_id != player_id:
                return {"success": False, "message": "不是你的回合"}
        except Exception as e:
            print(f"DEBUG: Exception in _handle_take_coins initial checks: {e}")
            return {"success": False, "message": f"处理拿取硬币时出错: {e}"}
        
        # 获取要拿取的硬币
        coins_to_take = action_data.get("coins", {})
        if not coins_to_take:
            return {"success": False, "message": "未指定要拿取的硬币"}
        
        # 验证硬币拿取规则
        validation_result = self._validate_coin_taking(coins_to_take)
        if not validation_result["valid"]:
            return {"success": False, "message": validation_result["message"]}
        
        # 检查硬币库存是否足够
        current_coins = self.game_state["public_info"]["coins"]
        for color, count in coins_to_take.items():
            if current_coins[color] < count:
                return {"success": False, "message": f"{color}硬币库存不足"}
        
        # 执行硬币拿取
        # 从公共硬币池中扣除
        for color, count in coins_to_take.items():
            current_coins[color] -= count
        
        # 添加到玩家硬币中
        player_coins = self.game_state["player_data"][player_id]["coins"]
        for color, count in coins_to_take.items():
            player_coins[color] += count
        
        # 切换到下一个玩家
        self.current_player_index = (current_player_index + 1) % len(self.players)
        self.game_state["turn_count"] += 1
        
        # 记录操作
        self.game_state["last_action"] = {
            "player_id": player_id,
            "action": "take_coins",
            "coins": coins_to_take
        }
        
        return {
            "success": True, 
            "message": f"成功拿取硬币: {', '.join([f'{color}x{count}' for color, count in coins_to_take.items()])}"
        }
    
    def _validate_coin_taking(self, coins_to_take: Dict) -> Dict:
        """验证硬币拿取规则"""
        # 可拿取的颜色（紫色除外）
        valid_colors = {"red", "pink", "blue", "yellow", "black"}
        
        # 检查颜色是否有效
        for color in coins_to_take.keys():
            if color not in valid_colors:
                return {"valid": False, "message": f"不能拿取{color}硬币"}
        
        # 检查数量
        total_coins = sum(coins_to_take.values())
        unique_colors = len(coins_to_take)
        
        if total_coins == 0:
            return {"valid": False, "message": "必须拿取至少一个硬币"}
        
        # 获取当前硬币库存
        current_coins = self.game_state["public_info"]["coins"]
        
        # 计算可用颜色（库存>0的颜色，除了紫色）
        available_colors = [color for color in valid_colors if current_coins[color] > 0]
        
        # 规则1: 拿取2个相同颜色硬币 - 要求该种颜色硬币>4个
        if unique_colors == 1 and total_coins == 2:
            color = list(coins_to_take.keys())[0]
            if current_coins[color] <= 4:
                return {"valid": False, "message": f"{color}硬币库存不足5个，不能拿取2个同色硬币"}
            return {"valid": True, "message": ""}
        
        # 规则2: 拿取2个不同颜色硬币 - 只剩两种颜色时
        elif unique_colors == 2 and total_coins == 2:
            # 检查每种颜色只能拿1个
            for count in coins_to_take.values():
                if count != 1:
                    return {"valid": False, "message": "拿取2个不同颜色硬币时，每种颜色只能拿1个"}
            
            # 检查是否只剩两种颜色
            if len(available_colors) != 2:
                return {"valid": False, "message": "只有当硬币库存只剩两种颜色时才能拿取2个不同颜色硬币"}
            
            return {"valid": True, "message": ""}
        
        # 规则3: 拿取1个硬币 - 只剩一种颜色且该颜色硬币<4个
        elif unique_colors == 1 and total_coins == 1:
            color = list(coins_to_take.keys())[0]
            
            # 检查是否只剩一种颜色
            if len(available_colors) != 1:
                return {"valid": False, "message": "只有当硬币库存只剩一种颜色时才能拿取1个硬币"}
            
            # 检查该颜色硬币是否<4个
            if current_coins[color] >= 4:
                return {"valid": False, "message": f"{color}硬币库存>=4个，不能只拿取1个硬币"}
            
            return {"valid": True, "message": ""}
        
        # 规则4: 拿取3个不同颜色的硬币（原有规则保留）
        elif unique_colors == 3 and total_coins == 3:
            # 每种颜色只能拿1个
            for count in coins_to_take.values():
                if count != 1:
                    return {"valid": False, "message": "拿取3个不同颜色硬币时，每种颜色只能拿1个"}
            return {"valid": True, "message": ""}
        
        else:
            return {"valid": False, "message": "硬币拿取规则：可拿取3个不同颜色硬币、2个同色硬币（该色>4个）、2个不同色硬币（只剩2色时）或1个硬币（只剩1色且<4个）"}
    
    def _execute_action(self, player_id: str, action_type: str, move_data: Dict) -> bool:
        """执行具体的游戏动作"""
        try:
            if action_type == "move":
                return self._execute_move(player_id, move_data)
            elif action_type == "attack":
                return self._execute_attack(player_id, move_data)
            elif action_type == "use_item":
                return self._execute_use_item(player_id, move_data)
            elif action_type == "pass":
                return True  # 跳过回合
            elif action_type == "special":
                return self._execute_special(player_id, move_data)
            
            return False
        except Exception as e:
            print(f"执行动作时出错: {e}")
            return False
    
    def _check_winner(self) -> Optional[str]:
        """检查是否有获胜者"""
        # TODO: 实现具体的获胜条件检查
        # 这里可以根据具体游戏规则来判断获胜条件
        # 例如：积分最高、完成特定任务、击败所有对手等
        
        # 示例：如果游戏进行了50回合，积分最高的玩家获胜
        if self.game_state["turn_count"] >= 50:
            max_score = -1
            winner_symbol = None
            
            for player_id, data in self.game_state["player_data"].items():
                if data["score"] > max_score:
                    max_score = data["score"]
                    winner_symbol = data["symbol"]
            
            return winner_symbol
        
        return None
    
    
    def get_game_rules(self) -> Dict:
        """获取游戏规则说明"""
        return {
            "name": "宝可梦",
            "description": "4人轮流行动的宝可梦对战游戏",
            "max_players": 4,
            "rules": [
                "游戏支持4名玩家同时进行",
                "玩家轮流进行行动, 先得到20分的玩家获胜",
            ],
            "actions": [
                "take_coins - 拿取硬币",
                "reserve_card - 预购卡牌"
            ]
        }
    
    def _handle_reserve_card(self, player_id: str, action_data: Dict) -> Dict:
        """处理预购卡牌操作"""
        try:
            # 检查游戏状态
            if self.status != GameStatus.PLAYING:
                return {"success": False, "message": "游戏未开始"}
            
            # 检查是否是当前玩家的回合
            current_player = self.get_current_player()
            if not current_player or current_player.user_id != player_id:
                return {"success": False, "message": "不是你的回合"}
            
            # 获取预购类型和目标
            reserve_type = action_data.get("type")  # "display" 或 "deck_top"
            
            if not reserve_type:
                return {"success": False, "message": "缺少预购类型参数"}
            
            # 根据预购类型获取相应的目标参数
            if reserve_type == "display":
                target = action_data.get("card_id")  # 展示卡牌的ID
                if target is None:
                    return {"success": False, "message": "缺少卡牌ID参数"}
            elif reserve_type == "deck_top":
                target = action_data.get("deck_type")  # 牌堆类型
                if not target:
                    return {"success": False, "message": "缺少牌堆类型参数"}
            else:
                return {"success": False, "message": "无效的预购类型"}
            
            # 检查预购区域是否已满
            player_data = self.game_state["player_data"][player_id]
            if len(player_data["reserved_cards"]) >= 3:
                return {"success": False, "message": "预购区域已满（最多3张卡牌）"}
            
            # 检查紫色硬币是否足够
            public_coins = self.game_state["public_info"]["coins"]
            if public_coins["purple"] <= 0:
                return {"success": False, "message": "没有紫色硬币可获得"}
            
            if reserve_type == "display":
                return self._reserve_display_card(player_id, target)
            else:  # reserve_type == "deck_top"
                return self._reserve_deck_top_card(player_id, target)
                
        except Exception as e:
            return {"success": False, "message": f"预购卡牌时出错: {e}"}
    
    def _reserve_display_card(self, player_id: str, card_id: int) -> Dict:
        """预购场上展示的卡牌"""
        try:
            # 查找目标卡牌
            target_card = None
            target_deck_type = None
            target_index = None
            
            display_cards = self.game_state["public_info"]["display_cards"]
            for deck_type, cards in display_cards.items():
                for i, card in enumerate(cards):
                    if card.get("id") == card_id:
                        target_card = card
                        target_deck_type = deck_type
                        target_index = i
                        break
                if target_card:
                    break
            
            if not target_card:
                return {"success": False, "message": "未找到指定的卡牌"}
            
            # 检查是否为梦幻或传说卡牌（不能预购）
            if target_card.get("level") in ["梦幻", "传说"]:
                return {"success": False, "message": "不能预购梦幻或传说卡牌"}
            
            # 执行预购
            # 1. 从展示区移除卡牌
            display_cards[target_deck_type].pop(target_index)
            
            # 2. 从对应牌堆补充新卡牌到展示区
            self._refill_display_card(target_deck_type)
            
            # 3. 将卡牌添加到玩家预购区域（展示卡牌对所有人可见）
            player_data = self.game_state["player_data"][player_id]
            reserved_card = {
                "card": target_card,
                "visible_to_all": True  # 从展示区预购的卡牌对所有人可见
            }
            player_data["reserved_cards"].append(reserved_card)
            
            # 4. 给玩家一个紫色硬币
            player_data["coins"]["purple"] += 1
            self.game_state["public_info"]["coins"]["purple"] -= 1
            
            # 5. 切换到下一个玩家
            self.next_player()
            self.game_state["turn_count"] += 1
            
            # 记录操作
            self.game_state["last_action"] = {
                "player_id": player_id,
                "action": "reserve_display_card",
                "card": target_card
            }
            
            return {
                "success": True,
                "message": f"成功预购卡牌: {target_card.get('name', '未知卡牌')}，获得1个紫色硬币"
            }
            
        except Exception as e:
            return {"success": False, "message": f"预购展示卡牌时出错: {e}"}
    
    def _reserve_deck_top_card(self, player_id: str, deck_type: str) -> Dict:
        """预购牌堆顶部的卡牌"""
        try:
            # 检查牌堆类型是否有效
            valid_deck_types = ["level_1", "level_2", "level_3", "rare"]
            if deck_type not in valid_deck_types:
                return {"success": False, "message": "无效的牌堆类型"}
            
            # 检查牌堆是否还有卡牌
            card_decks = self.game_state["private_data"]["card_decks"]
            deck = card_decks.get(deck_type)
            if not deck or len(deck["cards"]) == 0:
                return {"success": False, "message": f"{deck.get('name', '牌堆')}已空"}
            
            # 获取牌堆顶部卡牌
            top_card = deck["cards"][0]
            
            # 检查是否为梦幻或传说卡牌（不能预购）
            if top_card.get("level") in ["梦幻", "传说"]:
                return {"success": False, "message": "不能预购梦幻或传说卡牌"}
            
            # 执行预购
            # 1. 从牌堆移除顶部卡牌
            deck["cards"].pop(0)
            deck["count"] -= 1
            self.game_state["public_info"]["deck_counts"][deck_type] -= 1
            
            # 2. 将卡牌添加到玩家预购区域（牌堆顶部卡牌只有自己可见）
            player_data = self.game_state["player_data"][player_id]
            reserved_card = {
                "card": top_card,
                "visible_to_all": False  # 从牌堆顶部预购的卡牌只有自己可见
            }
            player_data["reserved_cards"].append(reserved_card)
            
            # 3. 给玩家一个紫色硬币
            player_data["coins"]["purple"] += 1
            self.game_state["public_info"]["coins"]["purple"] -= 1
            
            # 4. 切换到下一个玩家
            self.next_player()
            self.game_state["turn_count"] += 1
            
            # 记录操作（不暴露卡牌信息）
            self.game_state["last_action"] = {
                "player_id": player_id,
                "action": "reserve_deck_top_card",
                "deck_type": deck_type
            }
            
            return {
                "success": True,
                "message": f"成功预购{deck.get('name', '牌堆')}顶部卡牌，获得1个紫色硬币"
            }
            
        except Exception as e:
            return {"success": False, "message": f"预购牌堆顶部卡牌时出错: {e}"}
    
    def _refill_display_card(self, deck_type: str):
        """为展示区补充新卡牌"""
        try:
            card_decks = self.game_state["private_data"]["card_decks"]
            deck = card_decks.get(deck_type)
            
            if deck and len(deck["cards"]) > 0:
                # 从牌堆顶部取一张卡牌补充到展示区
                new_card = deck["cards"].pop(0)
                deck["count"] -= 1
                self.game_state["public_info"]["deck_counts"][deck_type] -= 1
                self.game_state["public_info"]["display_cards"][deck_type].append(new_card)
                
        except Exception as e:
            print(f"补充展示卡牌时出错: {e}")
    
    def get_player_view(self, player_id: str) -> Dict:
        """获取玩家视角的游戏状态（包含隐私信息）"""
        try:
            # 获取基础游戏状态
            base_state = self.get_public_info()
            
            # 添加玩家特定的隐私信息
            if player_id in self.game_state["player_data"]:
                player_data = self.game_state["player_data"][player_id]
                
                # 为玩家显示完整的预购卡牌信息（包括隐私卡牌）
                base_state["player_reserved_cards"] = player_data["reserved_cards"]
                
                # 为其他玩家隐藏隐私卡牌的详细信息
                other_players_reserved = {}
                for other_player_id, other_data in self.game_state["player_data"].items():
                    if other_player_id != player_id:
                        # 只显示对所有人可见的卡牌信息
                        visible_cards = []
                        for reserved_card in other_data["reserved_cards"]:
                            if reserved_card.get("visible_to_all", False):
                                # 对所有人可见的卡牌显示完整信息
                                visible_cards.append(reserved_card)
                            else:
                                # 隐私卡牌只显示基本信息
                                visible_cards.append({
                                    "card": {
                                        "id": "hidden",
                                        "name": "隐藏卡牌"
                                    },
                                    "visible_to_all": False
                                })
                        other_players_reserved[other_player_id] = visible_cards
                
                base_state["other_players_reserved"] = other_players_reserved
            
            return base_state
            
        except Exception as e:
            print(f"获取玩家视角时出错: {e}")
            return self.get_public_info()