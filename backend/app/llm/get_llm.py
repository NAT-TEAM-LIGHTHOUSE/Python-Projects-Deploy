import os
from .llm_service import get_groq_llm, get_openai_llm, get_anthropic_llm, get_local_llm
from dotenv import load_dotenv
from utils.logger import get_logger

logger = get_logger("llm.get_llm")

### LLM SERVICE
class GlobalLLM:
    """
    GlobalLLM provides unified access to LLMs based on config.
    """
    def __init__(self, llm_service=None, model=None):
        load_dotenv(override=True)  # Load environment variables from .env file
        logger.info(f"[LLM] Active LLM from environment: {os.getenv('ACTIVE_LLM')}")

        self.default_llm_service = llm_service.lower() if llm_service else None
        self.default_model = model
        self.active_llm = os.getenv("ACTIVE_LLM", "all").lower()
        self.factories = {
            "groq": get_groq_llm,
            "openai": get_openai_llm,
            "anthropic": get_anthropic_llm,
            "local": get_local_llm,
        }
        self.priority_order = ["openai", "anthropic", "groq", "local"]
        self.llms = {}
        if self.active_llm in ("all", "groq"):
            self.llms["groq"] = get_groq_llm()
        if self.active_llm in ("all", "openai"):
            self.llms["openai"] = get_openai_llm()
        if self.active_llm in ("all", "anthropic"):
            self.llms["anthropic"] = get_anthropic_llm()
        if self.active_llm in ("all", "local"):
            self.llms["local"] = get_local_llm()

    def _normalize_service_name(self, llm_service=None):
        selected = llm_service or self.default_llm_service
        if not selected:
            return None

        selected = selected.lower().strip()
        if selected not in self.factories:
            raise ValueError(
                f"Unsupported llm_service '{selected}'. Use one of: {', '.join(self.factories.keys())}."
            )
        return selected

    def _get_client(self, llm_service=None, model=None):
        selected_service = self._normalize_service_name(llm_service)
        selected_model = model or self.default_model

        if selected_service:
            if selected_model is None and selected_service in self.llms:
                return selected_service, self.llms[selected_service]
            return selected_service, self.factories[selected_service](model=selected_model)

        for service_name in self.priority_order:
            if service_name in self.llms:
                return service_name, self.llms[service_name]

        raise RuntimeError("No active LLM configured.")

    def call_groq(self, messages, model=None, **kwargs):
        try:
            _, client = self._get_client(llm_service="groq", model=model)
            logger.info("[LLM] Using Groq LLM for analysis.")
            return client.invoke(messages, **kwargs)
        except Exception as e:
            return f"Groq API error: {e}"

    def call_openai(self, messages, model=None, **kwargs):
        try:
            _, client = self._get_client(llm_service="openai", model=model)
            logger.info("[LLM] Using OpenAI LLM for analysis.")
            return client.invoke(messages, **kwargs)
        except Exception as e:
            return f"OpenAI API error: {e}"

    def call_anthropic(self, messages, model=None, **kwargs):
        try:
            _, client = self._get_client(llm_service="anthropic", model=model)
            logger.info("[LLM] Using Anthropic LLM for analysis.")
            return client.invoke(messages, **kwargs)
        except Exception as e:
            return f"Anthropic API error: {e}"

    def call_local(self, messages, model=None, **kwargs):
        try:
            _, client = self._get_client(llm_service="local", model=model)
            logger.info("[LLM] Using Local LLM for analysis.")
            return client.invoke(messages, **kwargs)
        except Exception as e:
            return f"Local LLM error: {e}"


    def get_response(self, messages, llm_service=None, model=None, **kwargs):
        """
        Unified method to get response content from the active LLM.
        Prioritizes: OpenAI > Anthropic > Groq > Local.
        """
        try:
            selected_service, client = self._get_client(llm_service=llm_service, model=model)
        except Exception as e:
            return f"Error: {e}"

        try:
            logger.info(f"[LLM] Using {selected_service} LLM for analysis.")
            response = client.invoke(messages, **kwargs)
        except Exception as e:
            return f"{selected_service.capitalize()} API error: {e}"

        if selected_service == "local":
            return response

        if hasattr(response, "content"):
            return response.content

        if response is None:
            return "Error: No active LLM configured."
        return str(response)

















# if __name__ == "__main__":
#     llm = GlobalLLM()
#     test_messages = [
#         {"role": "system", "content": "You are a helpful assistant."},
#         {"role": "user", "content": "what the capital of France?"}
#     ]

#     if "groq" in llm.llms:
#         response = llm.call_groq(test_messages)
#         print(f"Groq Response: {response}")
#     if "openai" in llm.llms:
#         response = llm.call_openai(test_messages)
#         print(f"OpenAI Response: {response}")
#     if "anthropic" in llm.llms:
#         response = llm.call_anthropic(test_messages)
#         print(f"Anthropic Response: {response}")
#     if "local" in llm.llms:
#         response = llm.call_local(test_messages)
#         print(f"Local Response: {response}")
