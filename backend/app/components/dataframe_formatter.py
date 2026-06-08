import pandas as pd
from typing import Any, Optional
import json
from io import StringIO

### Helper function to convert various table data formats into a DataFrame, with error handling and fallbacks
def to_dataframe(table_data: Any) -> Optional[pd.DataFrame]:
    if table_data is None:
        return None

    if isinstance(table_data, pd.DataFrame):
        return table_data.copy()

    if isinstance(table_data, list):
        if len(table_data) > 1 and isinstance(table_data[0], list):
            return pd.DataFrame(table_data[1:], columns=table_data[0])
        return pd.DataFrame(table_data)

    if isinstance(table_data, str):
        stripped = table_data.strip()
        if not stripped:
            return None

        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                if len(parsed) > 1 and isinstance(parsed[0], list):
                    return pd.DataFrame(parsed[1:], columns=parsed[0])
                return pd.DataFrame(parsed)
        except json.JSONDecodeError:
            pass

        return pd.read_csv(StringIO(stripped), on_bad_lines="skip")

    return None