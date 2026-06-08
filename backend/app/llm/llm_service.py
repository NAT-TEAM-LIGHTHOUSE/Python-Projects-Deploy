import os
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_anthropic import ChatAnthropic
from dotenv import load_dotenv
from openai import api_key
import requests

load_dotenv()

### LLM SERVICE ####
### Get OpenAI LLM Response
def get_openai_llm(model=None):
	"""
	Returns a ChatOpenAI instance using model and key from environment variables.
	`ChatOpenAI` will automatically use the `OPENAI_API_KEY` environment variable.
	Env vars:
		OPENAI_API_KEY
		OPENAI_MODEL (default: 'gpt-4o-mini')
	"""
	api_key = os.getenv("OPENAI_API_KEY")
	if not api_key:
		raise ValueError("OPENAI_API_KEY not set in environment.")
	model = model or os.getenv("OPENAI_MODEL")
	return ChatOpenAI(api_key=api_key, model=model, max_retries=3)

### Get Groq LLM Response
def get_groq_llm(model=None):
	"""
	Returns a ChatGroq instance using model and key from environment variables.
	Env vars:
		GROQ_API_KEY
		GROQ_MODEL (default: 'mixtral-8x7b-32768')
	"""
	api_key = os.getenv("GROQ_API_KEY")
	model = model or os.getenv("GROQ_MODEL")
	if not api_key:
		raise ValueError("GROQ_API_KEY not set in environment.")
	return ChatGroq(api_key=api_key, model=model)

### Get Anthropic [Claude] LLM Response
def get_anthropic_llm(model=None):
	"""
	Returns a ChatAnthropic instance using model and key from environment variables.
	Env vars:
		CLAUDE_API_KEY
		CLAUDE_MODEL (default: 'claude-2')
	"""
	api_key = os.getenv("CLAUDE_API_KEY")
	model = model or os.getenv("CLAUDE_MODEL")
	if not api_key:
		raise ValueError("CLAUDE_API_KEY not set in environment.")
	return ChatAnthropic(api_key=api_key, model=model)

### GET LOCAL LLM RESPONSE
class LocalLLM:
	def __init__(self, model=None, api_url=None):
		self.api_url = api_url or os.getenv("LOCAL_MODEL_LINK")
		self.model = model or os.getenv("LOCAL_MODEL")
		if not self.api_url:
			raise ValueError("LOCAL_MODEL_LINK not set in environment.")
		if not self.model:
			raise ValueError("LOCAL_MODEL not set in environment.")

	def invoke(self, messages, **kwargs):
		payload = {
			"model": self.model,
			"messages": messages,
			"stream": False
		}
		payload.update(kwargs)
		response = requests.post(self.api_url, json=payload)
		response.raise_for_status()
		data = response.json()
		return data.get("message", {}).get("content", data)

def get_local_llm(model=None, api_url=None):
	return LocalLLM(model=model, api_url=api_url)
    
