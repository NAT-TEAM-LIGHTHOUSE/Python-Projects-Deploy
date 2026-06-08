from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import openai
from src.db import OracleDBConnection
import subprocess
import os
import json
import pandas as pd
import numpy as np 
from io import StringIO
import uuid
from datetime import datetime
import sys
from .utils.data_cleaning import clean_table_cells
from src.configure import main_logger, debug_logger, table_context_print, python_code_print, execution_output
from dotenv import load_dotenv
from .utils.session_file_manager import (
    get_session_table_path,
    cleanup_expired_session_files,
    touch_session_file,
)

app = FastAPI()
load_dotenv()
CHAT_MODEL = os.getenv("CHAT_MODEL")
main_logger.info(f"Using chat model from .env: {CHAT_MODEL}")

# Limits to keep prompt size within model context
MAX_TABLE_ROWS_FOR_PROMPT = 200
MAX_TABLE_CHARS_FOR_PROMPT = 30000

class ChatHandler:
    def __init__(self):
        self.chat_history = {}
        self.table_contexts = {}

    def get_session_table_path(self, session_id):
        return os.path.join(f"table_context_{session_id}.csv")

    def clear_session_data(self, session_id):
        table_context_filename = self.get_session_table_path(session_id)
        file_deleted = False

        if os.path.exists(table_context_filename):
            os.remove(table_context_filename)
            file_deleted = True

        self.chat_history.pop(session_id, None)
        self.table_contexts.pop(session_id, None)
        self.table_contexts.pop(f"{session_id}_table_info", None)

        return {
            "session_id": session_id,
            "file_deleted": file_deleted,
            "file_path": table_context_filename
        }

    async def handle_chat(self, request: Request, user_query, session_id, context, table_info, custom_prompt=None, ai_prompt=None):
        ### Cleanup expired session files on each request to prevent accumulation of old files. 
        # This runs in the main thread and should be fast since it only checks file timestamps and deletes old ones. ###
        cleanup_expired_session_files()
        request_time = datetime.now().isoformat()
        # connection = None
        execution_output_str = ""
        execution_error = ""
        unique_filename = None
        table_context_filename = None
        if debug_logger:
            debug_logger.debug(f"--------------------------------------------->Chat request received at {request_time} with session_id: {session_id}")            
        # Log session, question, and answer
        if debug_logger:
            debug_logger.debug(f"Session {session_id}: User asked: {user_query}")
        try:
            data = await request.json()
            if not isinstance(data, dict):
                main_logger.error("Invalid request format. Expected a JSON object.")
                raise HTTPException(status_code=400, detail="Invalid request format. Expected a JSON object.")
            
            user_message = user_query.strip()
            table_context = context
            raw_table_info = table_info
            custom_prompt_for_gpt = custom_prompt.strip() if custom_prompt else None
            ## AI Promt formatting
            raw_ai_prompt = ai_prompt
            if raw_ai_prompt:
                if isinstance(raw_ai_prompt, list):
                    ai_prompt_parts = []
                    for item in raw_ai_prompt:
                        if isinstance(item, dict):
                            ai_prompt_parts.append(json.dumps(item, ensure_ascii=False))
                        else:
                            ai_prompt_parts.append(str(item))
                    ai_prompt_for_gpt = "\n".join(ai_prompt_parts).strip()
                elif isinstance(raw_ai_prompt, dict):
                    ai_prompt_for_gpt = json.dumps(raw_ai_prompt, ensure_ascii=False)
                else:
                    ai_prompt_for_gpt = str(raw_ai_prompt).strip()
            else:
                ai_prompt_for_gpt = None
            
            ### Enforce character limits on prompts to avoid exceeding model context limits
            MAX_AI_PROMPT_CHARS = 8000
            MAX_CUSTOM_PROMPT_CHARS = 4000
            MAX_COMBINED_PROMPT_CHARS = 12000

            if ai_prompt_for_gpt and len(ai_prompt_for_gpt) > MAX_AI_PROMPT_CHARS:
                raise HTTPException(status_code=400, detail="ai_prompt exceeds maximum allowed length of 8000 characters.")

            if custom_prompt_for_gpt and len(custom_prompt_for_gpt) > MAX_CUSTOM_PROMPT_CHARS:
                raise HTTPException(status_code=400, detail="custom_prompt exceeds maximum allowed length of 4000 characters.")

            if len(ai_prompt_for_gpt or "") + len(custom_prompt_for_gpt or "") > MAX_COMBINED_PROMPT_CHARS:
                raise HTTPException(status_code=400, detail="Combined ai_prompt and custom_prompt exceed maximum allowed length of 12000 characters.")

            main_logger.info(f"===== Custom prompt received ======: {custom_prompt_for_gpt}")
            main_logger.info(f"===== AI prompt received ======: {ai_prompt_for_gpt}")

            # Prepare table_info for including in the prompt (stringify JSON/list/dict if needed)
            try:
                if isinstance(raw_table_info, (dict, list)):
                    table_info_str = json.dumps(raw_table_info)
                else:
                    table_info_str = str(raw_table_info)
            except Exception:
                table_info_str = str(raw_table_info)
                
            if not session_id:
                main_logger.error("Session ID is required.")
                raise HTTPException(status_code=400, detail="Session ID is required.")

            table_context_filename = self.get_session_table_path(session_id)

            # Store table_context for the session
            self.table_contexts[session_id] = table_context
            self.table_contexts[f"{session_id}_table_info"] = table_info
            
            # Process the table_context based on its format (list, JSON string, or CSV string)
            if table_context:
                # Determine if table_context is a list, JSON string, or CSV string
                if isinstance(table_context, list):
                    # Convert list to DataFrame
                    if len(table_context) > 1 and isinstance(table_context[0], list):
                        # First list is header, rest are values
                        table_context_df = pd.DataFrame(table_context[1:], columns=table_context[0])
                    else:
                        raise ValueError("Invalid list format for table_context")

                else:
                    try:
                        table_context_data = json.loads(table_context)
                        if isinstance(table_context_data, list):
                            # Convert JSON array to DataFrame
                            if len(table_context_data) > 1 and isinstance(table_context_data[0], list):
                                # First list is header, rest are values
                                table_context_df = pd.DataFrame(table_context_data[1:], columns=table_context_data[0])
                            else:
                                raise ValueError("Invalid JSON format for table_context")
                        else:
                            raise ValueError("Invalid JSON format for table_context")
                    except json.JSONDecodeError:
                        # For table_context is a CSV string
                        try:
                            table_context_df = pd.read_csv(StringIO(table_context), on_bad_lines='skip')
                        except pd.errors.ParserError as e:
                            main_logger.error(f"Error parsing CSV data: {str(e)}")
                            if debug_logger:
                                debug_logger.error(f"Error parsing CSV data: {str(e)}")
                            if debug_logger:
                                debug_logger.error(f"Problematic CSV content: {table_context}")
                            return JSONResponse(content={'message': f"Error parsing CSV data: {str(e)}"}, status_code=400)

                # Clean the table cells and removing any CSS/styles contained within ~{...}
                table_context_df = clean_table_cells(table_context_df)

                # Strip whitespace from column names before saving to CSV
                table_context_df.columns = table_context_df.columns.str.strip()

                # Save full table_context to a CSV file specific to the session
                table_context_df.to_csv(table_context_filename, index=False)

                if debug_logger:
                    debug_logger.debug(f"Saved table context file for session {session_id}: {table_context_filename}")
            else:
                if not os.path.exists(table_context_filename):
                    main_logger.error("No stored dataset found for this session. Please provide valid data.")
                    raise HTTPException(
                        status_code=400,
                        detail="No stored dataset found for this session. Please send table_data first."
                    )

                table_context_df = pd.read_csv(table_context_filename)
                touch_session_file(table_context_filename)
                table_context_df = clean_table_cells(table_context_df)
                table_context_df.columns = table_context_df.columns.str.strip()

                if debug_logger:
                    debug_logger.debug(f"Loaded existing table context file for session {session_id}: {table_context_filename}")

            # Use only a sampled subset of the data in the prompt
            sampled_df = table_context_df.head(MAX_TABLE_ROWS_FOR_PROMPT)
            if len(table_context_df) > MAX_TABLE_ROWS_FOR_PROMPT and debug_logger:
                debug_logger.debug(
                    f"Truncating table context from {len(table_context_df)} to "
                    f"{MAX_TABLE_ROWS_FOR_PROMPT} rows for prompt to avoid token limits."
                )

            table_context = sampled_df.to_csv(index=False)

            # Additional safety: hard cap on character length
            if len(table_context) > MAX_TABLE_CHARS_FOR_PROMPT:
                if debug_logger:
                    debug_logger.debug(
                        f"Truncating table context CSV string from {len(table_context)} to "
                        f"{MAX_TABLE_CHARS_FOR_PROMPT} characters for prompt."
                    )
                table_context = table_context[:MAX_TABLE_CHARS_FOR_PROMPT]

            if table_context_print and debug_logger:
                debug_logger.debug(f"########## Table context ##########: {table_context}")

            with open('prompt_chat.txt', 'r') as file:
                prompt_template = file.read()

            if debug_logger:
                debug_logger.debug(f"Reading prompt_chat.txt file for the prompt")

            if session_id not in self.chat_history:
                self.chat_history[session_id] = []

            prompt = prompt_template.format(
                table_context=table_context,
                table_info=table_info_str,
                session_id=session_id
            )

            messages = [{"role": "system", "content": prompt}]
            
            ######## Include additional AI instructions and custom prompt as separate system messages if provided ########
            if ai_prompt_for_gpt:
                messages.append({
                    "role": "system",
                    "content": (
                        "Additional AI instructions for this request:\n"
                        f"{ai_prompt_for_gpt}"
                    )
                })

            if custom_prompt_for_gpt:
                messages.append({
                    "role": "system",
                    "content": (
                        "Table specific rules, business logic, calculations, "
                        f"and metadata:\n{custom_prompt_for_gpt}"
                    )
                })

            messages += self.chat_history[session_id]
            messages.append({"role": "user", "content": user_message})

            response = openai.ChatCompletion.create(
                model=CHAT_MODEL,
                messages=messages,
                temperature=0.1
            )

            answer = response.choices[0].message['content'].strip()
            self.chat_history[session_id].append({"role": "user", "content": user_message})
            self.chat_history[session_id].append({"role": "assistant", "content": answer})

            if debug_logger:
                debug_logger.debug(f"GPT Answer: {answer}")

            if "```python" in answer and "```" in answer:
                code_start = answer.find("```python") + len("```python")
                code_end = answer.rfind("```")
                python_code = answer[code_start:code_end].strip()

                if python_code_print and debug_logger:
                    debug_logger.debug(f"********** Generated Python code **********: {python_code}")

                unique_filename = f"generated_code_{uuid.uuid4().hex}.py"

                with open(unique_filename, 'w') as code_file:
                    code_file.write(python_code)

                if debug_logger:
                    debug_logger.debug(f"Executing generated Python code with subprocess")
                # result = subprocess.run(['python', unique_filename], capture_output=True, text=True)
                result = subprocess.run([sys.executable, unique_filename], capture_output=True, text=True)

                execution_output_str = result.stdout.strip()
                execution_error = result.stderr.strip()

                if execution_output and debug_logger:
                    debug_logger.debug(f"#### Execution output: {execution_output_str}")
                if execution_error and debug_logger:
                    debug_logger.debug(f"XXXX Execution error: {execution_error}")

                if execution_error:
                    main_logger.error(f"XXXX Execution error: {execution_error}")

                answer += f"\n\nExecution Output:\n{execution_output_str}"
                if execution_error:
                    answer += f"\n\nExecution Error:\n{execution_error}"

            else:
                execution_output_str = answer

            # Log the final response after execution (PO/P or GPT answer)
            main_logger.info(f"Session {session_id}: User asked: {user_query} | Final response: {execution_output_str}")
            if debug_logger:
                debug_logger.debug(f"Session {session_id}: User asked: {user_query} | Final response: {execution_output_str}")
            return JSONResponse(content={'answer': execution_output_str,  'status': 'success'}, status_code=200)

        except Exception as e:
            main_logger.error(f"Error: {str(e)}")
            if debug_logger:
                debug_logger.error(f"Error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

        finally:
            pass
            # if unique_filename and os.path.exists(unique_filename):
            #     os.remove(unique_filename)
            #     if debug_logger:
            #         debug_logger.debug(f"Deleted generated Python code file: {unique_filename}")

