import os 
from configparser import ConfigParser
import json
from fastapi import Request
from fastapi.responses import HTMLResponse, JSONResponse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load config.properties from project root
config = ConfigParser()
config.read(os.path.join(BASE_DIR, 'config.properties'))

def get_config_value(section, key, default=""):
    try:
        return config.get(section, key).strip('"')
    except Exception:
        return default

def get_timestamp():
    from datetime import datetime
    # Return timestamp in 'DD-MM-YYYY HH:MM:SS' format (local time)
    return datetime.now().strftime('%d-%m-%Y %H:%M:%S')

def get_status_data():
    return {
        "project_name": "Global Service",
        "status": "Application is up and running",
        "timestamp": get_timestamp(),
    }

def get_version_data():
    return {
        "project_name": "Global Service",
        "dev_version": get_config_value("DEV VERSION", "DEV_VERSION"),
        "dev_timestamp": get_config_value("DEV VERSION", "DEV_TIMESTAMP"),
    }

async def smart_response(request: Request, data: dict):
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        # Status HTML
        if "status" in data:
            html = f"""
            <html>
                <head>
                    <title>Application Status</title>
                    <style>
                        body {{
                            display: flex;
                            justify-content: center;
                            PADDING-TOP: 100PX;
                            height: 100vh;
                            margin: 0;
                            background: #f8f9fa;
                        }}
                        .container {{
                            background: #fff;
                            padding: 40px 60px;
                            border-radius: 16px;
                            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                            text-align: center;    
                            height: fit-content;
                        }}
                        h1 {{
                            font-size: 2.5rem;
                            font-weight: bold;
                            margin-bottom: 16px; 
                        }}
                        .main-status {{
                            font-size: 2rem;
                            font-weight: 800;
                            color: #1975d3;
                            margin-bottom: 18px;
                        }}
                        .project-name {{
                            font-size: 1.3rem;
                            font-weight: 700;
                            color: #444;
                            margin-bottom: 10px;
                        }}
                        ul {{
                            list-style: none;
                            padding: 0;
                        }}
                        li {{
                            font-size: 1.2rem;
                            font-weight: 700;
                            color: #333;
                            margin: 10px 0;
                        }}
                        .status-label {{
                            font-size: 1.1rem;
                            font-weight: 600;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Application Status</h1>
                        <div class="main-status">{data.get('project_name', 'The application')} is up and running</div>
                        <ul>
                            <li><b>Status:</b> <span class="status-label">UP</span></li>
                            <li><b>Timestamp:</b> {data.get('timestamp')}</li>
                        </ul>
                    </div>
                </body>
            </html>
            """
            return HTMLResponse(content=html)
        # Version HTML
        if "dev_version" in data:
            html = f"""
            <html>
                <head>
                    <title>Application Version Info</title>
                    <style>
                        body {{
                            display: flex;
                            justify-content: center;
                            padding-top: 100px;
                            height: 100vh;
                            margin: 0;
                            background: #f8f9fa;
                        }}
                        .container {{
                            background: #fff;
                            padding: 40px 60px;
                            border-radius: 16px;
                            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                            text-align: center;
                            height: fit-content;
                        }}
                        .project-name {{
                            font-size: 1.3rem;
                            font-weight: 700;
                            color: #444;
                            margin-bottom: 10px;
                        }}
                        h1 {{
                            font-size: 2.5rem;
                            font-weight: bold;
                            margin-bottom: 16px;
                        }}
                        h4 {{
                            font-size: 1.3rem;
                            font-weight: bold;
                            color: #007bff;
                            margin-bottom: 24px;
                        }}
                        ul {{
                            list-style: none;
                            padding: 0;
                        }}
                        li {{
                            font-size: 1.2rem;
                            font-weight: bold;
                            margin: 12px 0;
                        }}
                        b {{
                            color: #333;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Application Version Info</h1>
                        <h4>{data.get('project_name', 'The application')} is running in Development Mode</h4>
                        <ul>
                            <li><b>Development Version:</b> {data.get('dev_version')}</li>
                            <li><b>Timestamp:</b> {data.get('dev_timestamp')}</li>
                        </ul>
                    </div>
                </body>
            </html>
            """
            return HTMLResponse(content=html)
        # Fallback: Pretty JSON as HTML
        pretty = json.dumps(data, indent=2)
        return HTMLResponse(content=f"<pre>{pretty}</pre>")
    # Default: JSON response
    return JSONResponse(content=data)
