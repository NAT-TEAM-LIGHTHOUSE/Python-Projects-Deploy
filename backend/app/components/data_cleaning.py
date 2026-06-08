import re
import pandas as pd 

############## ClEAN THE DATA CELL HAVING STYLES(CSS) COMMING IN THE REQUEST 
# Clean formatting tokens like ~{...} from all cells before saving
def clean_table_cells(df_in):
    try:
        df_clean = (
            df_in
            .where(pd.notnull(df_in), '')
            .astype(str)
            .apply(lambda col: col.map(lambda v: re.sub(r'~\{[\s\S]*?\}', '', v).strip()))
        )
        return df_clean
    except Exception as e:
        print("clean_table_cells error:", repr(e))
        return df_in


