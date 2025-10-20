from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

# 数据库配置 - 使用SQLite作为默认数据库
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:123456@fwq.zx081325.fun:3306/board_game_platform")

# 创建数据库引擎
engine = create_engine(DATABASE_URL, echo=True)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基类
Base = declarative_base()

class User(Base):
    """用户表模型"""
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_online = Column(Boolean, default=False, nullable=False)

class UserSession(Base):
    """用户会话表模型"""
    __tablename__ = "user_sessions"
    
    session_token = Column(String(255), primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_activity = Column(DateTime, default=datetime.utcnow, nullable=False)
    room_id = Column(String(36), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """创建所有表"""
    Base.metadata.create_all(bind=engine)

def init_database():
    """初始化数据库"""
    try:
        create_tables()
        print("数据库表创建成功！")
        return True
    except Exception as e:
        print(f"数据库初始化失败: {e}")
        return False