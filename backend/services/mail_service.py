import os
import random
from typing import Dict
from datetime import datetime, timedelta

class MailService:
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", self.smtp_username)
        self.code_cache: Dict[str, Dict] = {}
    
    def generate_verification_code(self) -> str:
        return str(random.randint(100000, 999999))
    
    async def send_verification_code(self, to_email: str) -> str:
        code = self.generate_verification_code()
        self.code_cache[to_email] = {
            "code": code,
            "expires_at": datetime.utcnow() + timedelta(minutes=5),
            "attempts": 0
        }
        print(f"Development mode: Verification code for {to_email} is: {code}")
        return code
    
    def verify_code(self, email: str, code: str) -> bool:
        if email not in self.code_cache:
            return False
        
        cached_data = self.code_cache[email]
        
        if datetime.utcnow() > cached_data["expires_at"]:
            del self.code_cache[email]
            return False
        
        if cached_data["attempts"] >= 3:
            del self.code_cache[email]
            return False
        
        if cached_data["code"] == code:
            del self.code_cache[email]
            return True
        else:
            cached_data["attempts"] += 1
            return False

mail_service = MailService()
