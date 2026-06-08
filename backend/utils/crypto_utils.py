from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import base64
import os

SECRET_KEY = os.getenv("SECRET_KEY", "a3f1e78c3b6d4f09b9c2a8d7f60e451234567890abcdef01234567890abcdef")  # Should be 32 chars

def get_key():
    return SECRET_KEY[:32].encode("utf-8")

def get_iv():
    return SECRET_KEY[:16].encode("utf-8")

def encrypt_url(data: str) -> str:
    cipher = AES.new(get_key(), AES.MODE_CBC, get_iv())
    ct_bytes = cipher.encrypt(pad(data.encode("utf-8"), AES.block_size))
    encoded = base64.b64encode(ct_bytes).decode("utf-8")
    return encoded.replace("/", "-").replace("+", "_")

def decrypt_url(encrypted: str) -> str:
    try:
        encrypted = encrypted.replace("-", "/").replace("_", "+")
        ct_bytes = base64.b64decode(encrypted)
        cipher = AES.new(get_key(), AES.MODE_CBC, get_iv())
        pt = unpad(cipher.decrypt(ct_bytes), AES.block_size)
        result = pt.decode("utf-8")
        if result.startswith('"') and result.endswith('"'):
            result = result[1:-1]
        return result
    except Exception:
        return None

def decrypt_dict_fields(data: dict) -> dict:
    """
    Decrypt all string fields in a dictionary using decrypt_url.
    Non-string values are left unchanged.
    """
    result = {}
    for k, v in data.items():
        if isinstance(v, str):
            dec = decrypt_url(v)
            result[k] = dec if dec is not None else v
        else:
            result[k] = v
    return result