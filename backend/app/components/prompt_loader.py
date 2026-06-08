from pathlib import Path
from typing import Dict, Optional

############# Global Prompt Loader: Loads prompt templates from files in backend/app/prompts #############
class GlobalPromptLoader:
    """
    Loads prompt text files from backend/app/prompts.

    Example:
        prompts = GlobalPromptLoader()
        schema_prompt = prompts.get_prompt("schema_prompt.txt")
        all_prompts = prompts.load_all_prompts()
    """

    def __init__(self, prompt_dir: Optional[str] = None):
        if prompt_dir:
            self.prompt_dir = Path(prompt_dir)
        else:
            self.prompt_dir = Path(__file__).resolve().parents[1] / "prompts"

        if not self.prompt_dir.exists():
            raise FileNotFoundError(f"Prompt directory not found: {self.prompt_dir}")

    def get_prompt(self, file_name: str) -> str:
        prompt_path = self.prompt_dir / file_name

        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

        return prompt_path.read_text(encoding="utf-8").strip()

    def load_all_prompts(self) -> Dict[str, str]:
        prompts = {}

        for file_path in self.prompt_dir.glob("*.txt"):
            prompts[file_path.name] = file_path.read_text(encoding="utf-8").strip()

        return prompts

    def get_prompt_map(self) -> Dict[str, str]:
        """
        Returns prompts with filename stem as key.
        Example:
            schema_prompt.txt -> schema_prompt
        """
        prompts = {}

        for file_path in self.prompt_dir.glob("*.txt"):
            prompts[file_path.stem] = file_path.read_text(encoding="utf-8").strip()

        return prompts
