import os
import ftplib
import ssl
from pathlib import Path

from cryptography.fernet import Fernet


def _key_file() -> Path:
    """Store credentials' encryption key in writable per-user app data."""
    data_dir = os.getenv("SOCKS_ON_STOCKS_DATA_DIR")
    if data_dir:
        directory = Path(data_dir).expanduser().resolve()
        directory.mkdir(parents=True, exist_ok=True)
        return directory / "secret.key"

    # Supports the existing direct-backend workflow during development.
    return Path("secret.key")

def _get_encryption_key() -> bytes:
    key_file = _key_file()
    if not key_file.exists():
        key = Fernet.generate_key()
        with key_file.open("wb") as f:
            f.write(key)
        key_file.chmod(0o600)
    else:
        with key_file.open("rb") as f:
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
            ftp = ftplib.FTP_TLS()
            ftp.connect(host, port, timeout=10)
            ftp.login(login, password)
            ftp.prot_p()
            is_secure = True
        except (ssl.SSLError, ftplib.error_perm):
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
