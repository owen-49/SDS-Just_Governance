# 方便在别处统一导入 Base 与所有实体
from .base import Base
from .user_auth import User, OAuthAccount, EmailVerifyToken, PasswordResetToken
from .content import Board, Module, Topic, TopicContent
from .progress import UserTopicProgress
from .chat import ChatSession, ChatMessage
from .assessment import Question, QuestionTopic, AssessmentSession, AssessmentItem
from .documents import Document, DocumentChunk
from .survey import OnboardingSurvey, OnboardingSurveyAnswer, OnboardingSurveyOption
from .user_sessions import UserSession

__all__ = [
    "Base",
    "User", "OAuthAccount", "EmailVerifyToken", "PasswordResetToken",
    "Board", "Module", "Topic", "TopicContent",
    "UserTopicProgress",
    "ChatSession", "ChatMessage",
    "Question", "QuestionTopic", "AssessmentSession", "AssessmentItem",
    "Document", "DocumentChunk",
    "OnboardingSurvey", "OnboardingSurveyAnswer", "OnboardingSurveyOption",
]


