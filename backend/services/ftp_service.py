import os
import ftplib
import ssl
from cryptography.fernet import Fernet

KEY_FILE = "secret.key"

def _get_encryption_key() -> bytes:
    if not os.path.exists(KEY_FILE):
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as f:
            f.write(key)
    else:
        with open(KEY_FILE, "rb") as f:
            key = f.read()
    return key

_fernet = Fernet(_get_encryption_key())

def encrypt_password(password: str) -> str:
    if not password:
        return ""
    return _fernet.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str) -> str:
    if not encrypted_password:
        return ""
    return _fernet.decrypt(encrypted_password.encode()).decode()

def test_connection(host: str, port: int, login: str, password: str, directory: str) -> tuple[bool, str]:
    try:
        is_secure = False
        try:
            context = ssl._create_unverified_context()
            ftp = ftplib.FTP_TLS(context=context)
            ftp.connect(host, port, timeout=10)
            ftp.login(login, password)
            ftp.prot_p()
            is_secure = True
        except (ssl.SSLError, ftplib.error_perm) as e:
            if "534" in str(e):
                return False, f"FTP Error: {str(e)}"
                
            ftp = ftplib.FTP()
            ftp.connect(host, port, timeout=10)
            ftp.login(login, password)
            
        if directory and directory.strip() not in ["", "/"]:
            ftp.cwd(directory)
            
        ftp.quit()
        
        status_msg = "Connection successful" if is_secure else "Connection successful (Unsecured FTP)"
        return True, status_msg
        
    except ftplib.all_errors as e:
        return False, f"FTP Error: {str(e)}"
    except Exception as e:
        return False, f"Connection failed: {str(e)}"