import configparser
import os

def get_app_version():
    config_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "config.properties"
    )

    print(f"[DEBUG] get_app_version: Looking for config at {config_path}")

    if not os.path.exists(config_path):
        print(f"[WARNING] get_app_version: config.properties not found at {config_path}")
        return "Unknown"

    config = configparser.ConfigParser()
    config.read(config_path)

    try:
        return config.get("APP VERSION", "APP_VERSION").strip('"').strip("'")
    except Exception as e:
        print(f"[WARNING] get_app_version: Exception {e}")
        return "Unknown"
    
# if __name__ == "__main__":
#     print(f"[DEBUG] get_app_version returned: {get_app_version()}")