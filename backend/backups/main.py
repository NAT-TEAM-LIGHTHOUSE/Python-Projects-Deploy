from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import openai
import os
import logging
import dotenv
from fastapi.responses import JSONResponse, HTMLResponse, Response
from src.chat import ChatHandler 
from src.suggestion import SuggestionHandler 
from src.previous_query import PreviousQueryHandler 
from src.configure import main_logger, debug_logger, load_config
from datetime import datetime
from src.crypto_utils import decrypt_url,decrypt_dict_fields
import json
import urllib
from starlette.middleware.sessions import SessionMiddleware
from src.check_health import get_status_data, get_version_data, smart_response
from .app_version import get_app_version
from pydantic import BaseModel, field_validator,validator, root_validator
from typing import Optional, Dict, Any
## FOR GLOBAL SERVICE
from global_service.global_service_pkg_config import *
from global_service.global_service_pkg_config import log_debug_request
from global_service_fastapi_pkg.debug_log_flag_manager import enable_debug_logs, disable_debug_logs
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

app = FastAPI()

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.mount("/api/agentai/table_gpt/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Then add SessionMiddleware
app.add_middleware(
    SessionMiddleware,
    secret_key="your-very-secret-key"
)

# Load environment 
dotenv.load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')
load_config()

# Custom log collector for GLOBAL SERVICE
class RequestLogCollector(logging.Handler):
    def __init__(self):
        super().__init__()
        self.logs = []
        self.counter = 1
    def emit(self, record):
        msg = self.format(record)
        numbered_msg = f"{self.counter} {msg}"
        self.logs.append(numbered_msg)
        self.counter += 1
        
log_collector = RequestLogCollector()
formatter = logging.Formatter('%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
log_collector.setFormatter(formatter)
step_logger = StepLogger()
app_version = get_app_version()

######################################### DEBUG LOGS GLOBAL SERVICE ENDPOINTS ##########################################
class DebugLogFlagRequest(BaseModel):
    save_debug_logs: bool
    debug_active_by: Optional[str] = None
    debug_end_by: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    app_code: str = "L-PYA100"  # Default app code

class SessionDeleteRequest(BaseModel):
    user_ref_no: str

@app.post("/api/agentai/table_gpt/set_debug_log_flag")
async def set_debug_log_flag(data: DebugLogFlagRequest):
    if data.save_debug_logs:
        result = enable_debug_logs(data.debug_active_by)
    else:
        result = disable_debug_logs(
            debug_active_by=data.debug_active_by,
            debug_end_by=data.debug_end_by,
            start_time=data.start_time,
            end_time=data.end_time,
            app_code=data.app_code  # Use the configured app code
        )
    return result

@app.get("/api/agentai/table_gpt/debug_log_status")
async def get_debug_log_status():
    return {
        "debug_flag": getattr(config, "SAVE_DEBUG_LOGS", False),
        "start_by": getattr(config, "debug_active_by", None),
        "start_time": getattr(config, "start_time", None),
        "end_time": getattr(config, "end_time", None),
        "end_by": getattr(config, "debug_end_by", None),
        "app_code": getattr(config, "APP_CODE", None)
    }
#################################### END DEBUG LOGS GLOBAL SERVICE ENDPOINTS ##################################

# Initialize handlers 
chat_handler = ChatHandler()  
suggestion_handler = SuggestionHandler()
previous_query_handler = PreviousQueryHandler()  

# Configure logging
logging.basicConfig(level=logging.DEBUG)

#### TABLE GPT ENDPOINTS #######
# UI Route
@app.get("/api/agentai/table_gpt", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Sample CSV file endpoint
@app.get("/api/agentai/table_gpt/sample/{filename}")
async def get_sample_file(filename: str):
    try:
        file_path = os.path.join("csv_files", filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Sample file not found")
        # Read as bytes and try several encodings to handle files saved in different charsets
        with open(file_path, 'rb') as f:
            raw = f.read()

        content = None
        # Try common encodings in order of preference
        for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
            try:
                content = raw.decode(enc)
                main_logger.debug(f"Loaded sample file '{filename}' using encoding: {enc}")
                break
            except Exception:
                continue

        if content is None:
            raise Exception("Unable to decode sample file with tried encodings")

        return Response(content=content, media_type="text/csv")
    except Exception as e:
        main_logger.error(f"Error loading sample file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading sample file: {str(e)}")

### Chat Endpoint ###
@app.post("/api/agentai/table_gpt/chat")
async def chat(request: Request):
    # Attach log collector GLOBAL SERVICE
    main_logger.addHandler(log_collector)
    if debug_logger:
        debug_logger.addHandler(log_collector)
    log_collector.logs.clear()
    collected_logs = None
    step_logger.log("Chat endpoint called")
    payload_request_status_code = "Success (200 OK)"
    payload_response_status_msg = None

    request_time = datetime.now().isoformat()
    request_data = await request.json()
    payload_identifier = request_data.get("payload_identifier", {})
    payload_data = request_data.get("payload_data", {})
    callback_url = request_data.get("callback_url", None)

    # Handle both encrypted and plain JSON (if needed)
    if isinstance(request_data, str):
        decrypted = decrypt_url(request_data)
        if decrypted:
            try:
                request_data = json.loads(decrypted)
                payload_identifier = request_data.get("payload_identifier", {})
                payload_data = request_data.get("payload_data", {})
            except Exception:
                pass

    main_logger.info(f"-------------->Chat request received at {request_time} with data: {request_data}")
    step_logger.log(f"Chat request received at {request_time} with User Query: {payload_data.get('user_query')[:200]}")
    try:
        user_query = payload_data.get('user_query')
        session_id = payload_identifier.get('user_ref_no')
        context = payload_data.get('table_data')
        table_info = payload_data.get('table_context')
        custom_prompt = payload_data.get('custom_prompt')
        ai_prompt = payload_data.get('aiInputData')
        result = await chat_handler.handle_chat(request, user_query, session_id, context, table_info, custom_prompt, ai_prompt)

        # Extract actual response body for logging
        if isinstance(result, JSONResponse):
            response_body_str = result.body.decode()  # Get the actual JSON string
        else:
            response_body_str = json.dumps(result)
        step_logger.log(f"Chat response generated: {response_body_str[:2000]}")  # Log first 2000 chars only

        # GLOBAL SERVICE LOGS
        step_logger.log(f"Chat response generated")
        payload_request_status_code = "Success (200 OK)"
        payload_response_status_msg = "Success (200 OK)"
        log_request(
            request, step_logger, request_body=json.dumps(request_data), response_body=response_body_str, log_type="INFO", app_version=app_version,
            payload_request_status_code=payload_request_status_code,
            payload_response_status_msg=payload_response_status_msg
        )
        collected_logs = '\n'.join(log_collector.logs)
        log_debug_request(request, request_body=json.dumps(request_data), response_body=response_body_str, debug_logs=collected_logs)
        return result

    except Exception as e:
        main_logger.error(f"Error: {str(e)}")
        if debug_logger:
            debug_logger.error(f"Error: {str(e)}")
            
        # GLOBAL SERVICE LOGS 
        step_logger.log("chat response generated (error)")
        payload_request_status_code = "Failure (400 Bad Request)"
        payload_response_status_msg = "Failure (400 Bad Request)"
        log_request(
            request, step_logger, request_body=json.dumps(request_data), log_type="INFO", app_version=app_version,
            payload_request_status_code=payload_request_status_code,
            payload_response_status_msg=payload_response_status_msg
        )
        collected_logs = '\n'.join(log_collector.logs)
        log_debug_request(request, request_body=json.dumps(request_data), debug_logs=collected_logs)
        
        return JSONResponse(
            content={'answer': "Sorry, there was an error processing your request.", 'error': str(e), 'status': 'error'},
            status_code=500
        )

#### Session Delete Endpoint ####
@app.post("/api/agentai/table_gpt/session/delete")
async def delete_session_data(data: SessionDeleteRequest):
    try:
        result = chat_handler.clear_session_data(data.user_ref_no)

        if result["file_deleted"]:
            message = "Session data deleted successfully."
        else:
            message = "Session cleared from memory. No stored file was found."
            
        main_logger.info(f"Session delete request processed for---> \nuser_ref_no: {data.user_ref_no}\nfile_deleted: {result['file_deleted']}")       

        return JSONResponse(
            content={
                "status": "success",
                "message": message,
                "user_ref_no": result["session_id"],
                "file_deleted": result["file_deleted"],
                "file_path": result["file_path"]
            },
            status_code=200
        )
    except Exception as e:
        main_logger.error(f"Error deleting session data: {str(e)}")
        if debug_logger:
            debug_logger.error(f"Error deleting session data: {str(e)}")
        return JSONResponse(
            content={"status": "error", "message": f"Failed to delete session data: {str(e)}"},
            status_code=500
        )

### Suggestions Endpoint ###   
@app.post("/api/agentai/table_gpt/suggestions")
async def suggestions(request: Request):
    # Attach log collector GLOBAL SERVICE
    main_logger.addHandler(log_collector)
    if debug_logger:
        debug_logger.addHandler(log_collector)
    log_collector.logs.clear()
    collected_logs = None
    step_logger.log("Suggestions endpoint called")
    payload_request_status_code = "Success (200 OK)"
    payload_response_status_msg = None
    
    request_time = datetime.now().isoformat()
    request_data = await request.json()
    payload_data = request_data.get("payload_data", {})
    payload_identifier = request_data.get("payload_identifier", {})
    # Handle both encrypted and plain JSON
    if isinstance(request_data, str):
        decrypted = decrypt_url(request_data)
        if decrypted:
            try:
                request_data = json.loads(decrypted)
            except Exception:
                pass
    main_logger.info(f"----------------->Suggestions request received at {request_time} ")
    step_logger.log(f"Suggestions request received at {request_time}  with data: {payload_identifier}")
    try:
        context = payload_data.get('table_data')
        table_context = payload_data.get('table_context')
        suggestions = await suggestion_handler.handle_suggestions(context, request, table_context, payload_data)
        
        # Extract actual response body for logging
        if isinstance(suggestions, JSONResponse):
            response_body_str = suggestions.body.decode()  # Get the actual JSON string
        else:
            response_body_str = json.dumps(suggestions)
        step_logger.log(f"Suggestions response: {response_body_str}")
        
        # GLOBAL SERVICE LOGS
        step_logger.log(f"Chat response generated")
        payload_request_status_code = "Success (200 OK)"
        payload_response_status_msg = "Success (200 OK)"
        log_request(
            request, step_logger, request_body=json.dumps(request_data), response_body=response_body_str, log_type="INFO", app_version=app_version,
            payload_request_status_code=payload_request_status_code,
            payload_response_status_msg=payload_response_status_msg
        )
        collected_logs = '\n'.join(log_collector.logs)
        log_debug_request(request, request_body=json.dumps(request_data), response_body=response_body_str, debug_logs=collected_logs)
        
        return suggestions
    except Exception as e:
        main_logger.error(f"Error: {str(e)}")
        if debug_logger:
            debug_logger.error(f"Error: {str(e)}")
            
        # GLOBAL SERVICE LOGS 
        step_logger.log("chat response generated (error)")
        payload_request_status_code = "Failure (400 Bad Request)"
        payload_response_status_msg = "Failure (400 Bad Request)"
        log_request(
            request, step_logger, request_body=json.dumps(request_data), log_type="INFO", app_version=app_version,
            payload_request_status_code=payload_request_status_code,
            payload_response_status_msg=payload_response_status_msg
        )
        collected_logs = '\n'.join(log_collector.logs)
        log_debug_request(request, request_body=json.dumps(request_data), debug_logs=collected_logs)
        
        return JSONResponse(content={'answer': "Sorry, there was an error processing your request.", 'error': str(e), 'status': 'error'}, status_code=500)  

## Health check and version endpoints
@app.get("/api/agentai/table_gpt/status")
async def health_check(request: Request):
    return await smart_response(request, get_status_data())

@app.get("/api/agentai/table_gpt/version")
async def version(request: Request):
    return await smart_response(request, get_version_data())


