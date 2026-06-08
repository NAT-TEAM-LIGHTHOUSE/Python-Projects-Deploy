import logging
from fastapi.responses import JSONResponse
from utils.configure import main_logger, debug_logger
from utils.crypto_utils import decrypt_url
# from app.llm.get_llm import GlobalLLM
import csv
import io
import json
from pathlib import Path
from typing import Any, List
import random
from dotenv import load_dotenv

load_dotenv()

# # Initialize GlobalLLM for unified access with Groq model
# llm = GlobalLLM(llm_service="groq", model="llama-3.3-70b-versatile")


#################### Suggestion Endpoint ##########################
class SuggestionHandler:
    def _normalize_questions(self, questions_data: Any) -> List[str]:
        """Return question strings from supported JSON formats."""
        if isinstance(questions_data, list):
            return [question.strip() for question in questions_data if isinstance(question, str) and question.strip()]

        if isinstance(questions_data, dict):
            questions = []
            for key, value in questions_data.items():
                if isinstance(key, str) and key.startswith("question") and isinstance(value, str) and value.strip():
                    questions.append(value.strip())
            return questions

        return []

    def _load_bot_questions(self, bot_id: str) -> List[str]:
        """Load questions from a JSON file for a specific bot."""
        if not bot_id:
            return []

        # Determine the directory path based on bot_id
        # bot_id format: "view_bi_sale_contract__view_bi_sale_contract" -> use stem as directory/file
        base_dir = Path(__file__).resolve().parents[1] / "TableGpt_Plus"
        bot_dir = bot_id.split("__")[0]  # Get the directory name
        csv_stem = bot_id.split("__")[-1]  # Get the file stem
        questions_path = base_dir / bot_dir / f"{csv_stem}_ques.json"

        if not questions_path.exists():
            return []

        try:
            questions_data = json.loads(questions_path.read_text(encoding="utf-8"))
            return self._normalize_questions(questions_data)
        except Exception as e:
            main_logger.warning(f"Could not load questions from {questions_path}: {e}")
            return []

    async def handle_suggestions(self, context, table_context, request, payload_data, payload_identifier=None):
        try:
            context = context or payload_data.get("table_data", "")
            table_name = table_context or payload_data.get("table_context", "")
            bot_id = (payload_data.get("table_gpt_bot_id") or 
                      payload_data.get("table_gpt_bot", {}).get("bot_id", "") or
                      (payload_identifier or {}).get("table_gpt_bot_id", ""))

            # Try to load questions from bot-specific JSON file
            bot_questions = self._load_bot_questions(bot_id)
            if bot_questions:
                # Get pagination parameters
                offset = int(payload_data.get("suggestion_offset", 0))
                limit = int(payload_data.get("suggestion_limit", 6))

                # Return random questions with pagination
                available = bot_questions[offset:]
                if not available:
                    # Reset offset if we've gone through all questions
                    available = bot_questions
                    offset = 0

                selected = random.sample(available, min(limit, len(available)))
                return JSONResponse(
                    content={
                        'message': "Suggestions generated successfully",
                        'data': selected,
                        'offset': offset,
                        'limit': limit,
                        'total': len(bot_questions),
                        'has_more': offset + limit < len(bot_questions)
                    },
                    status_code=200
                )

            # Debug: No bot questions found
            main_logger.info(f"No bot questions found for bot_id: '{bot_id}'")
            if not bot_id:
                main_logger.warning("bot_id is empty in payload_data")

            # Limit to first 10 rows if context is CSV string
            max_rows = 5
            max_chars = 1000
            limited_context = ""

            if isinstance(context, str) and context.strip():
                try:
                    reader = csv.reader(io.StringIO(context))
                    rows = [row for idx, row in enumerate(reader) if idx < max_rows]
                    output = io.StringIO()
                    writer = csv.writer(output)
                    writer.writerows(rows)
                    limited_context = output.getvalue()
                    print(f"**********Limited context:\n{limited_context}")
                except Exception as e:
                    main_logger.warning(f"Could not parse CSV for limiting rows: {e}")
                    limited_context = context[:max_chars]  # fallback to first 1000 chars
            elif isinstance(context, list):
                # If context is a list of rows, take first 10 rows and join as CSV
                rows = context[:max_rows]
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerows(rows)
                limited_context = output.getvalue()
                print(f"##########Limited context:\n{limited_context}")
            else:
                # Fallback: just take first 1000 characters
                limited_context = str(context)[:max_chars]
                print(f"*$$$$$$$$$$Limited context:\n{limited_context}")

            if not limited_context:
                main_logger.error("Suggestion context is required.")
                return JSONResponse(
                    content={"message": "Context is required.", "error": True},
                    status_code=400,
                )

            # # Generate suggestions using GlobalLLM
            # prompt = f"""
            # Based on the provided context and table name, generate structured suggestions.
            # Table Name:
            # {table_name}
            # Context:
            # {limited_context}

            # Categories:
            # ### 1. Totals and Aggregations
            # ### 2. Averages and Statistics
            # ### 3. Maximum and Minimum
            # ### 4. Trends and Patterns
            # ### 5. Predictions and Insights
            # ### 6. Business Questions based on the data

            # Do not add questions that are related to graphs or charts.
            # Do not add hyphens '-' before the questions. Just give the questions without any numbering or bullet points.

            # Provide concise questions under each category, and do not repeat the same type of question again and again but give 10 questions without showing the number.
            # """
            
            # messages = [{"role": "user", "content": prompt}]
            # response = llm.get_response(messages)
            # raw_suggestions = response.strip().split("\n") if isinstance(response, str) else str(response).strip().split("\n")

            # suggestions = []
            
            # # Process the suggestions to separate questions
            # for line in raw_suggestions:
            #     line = line.strip()
            #     if line and not line.startswith("###"):  # Non-empty lines that are not headers are treated as questions
            #         suggestions.append(line)
            suggestions = []
            if debug_logger:
                debug_logger.debug(f"Suggestions (no bot questions): {suggestions}")

            main_logger.info("Suggestions generated successfully.")
            return JSONResponse(content={'message': "Suggestions generated successfully", 'data': suggestions}, status_code=200)

        except Exception as e:
            main_logger.error(f"Error generating suggestions: {e}")
            if debug_logger:
                debug_logger.error(f"Error generating suggestions: {e}")
            return JSONResponse(content={'message': "Error processing suggestions.", 'error': str(e)}, status_code=500)


