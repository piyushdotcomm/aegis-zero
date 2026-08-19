import re

class RowTaintShield:
    def __init__(self):
        # Specific patterns to catch prompt injections
        self.patterns = [
            re.compile(r"(?i)(ignore all previous instructions|dump the .* table|system:)")
        ]
        
    def scan_and_sanitize(self, rows: list[dict]) -> tuple[list[dict], int]:
        sanitized_rows = []
        tainted_count = 0
        
        for row in rows:
            clean_row = {}
            row_tainted = False
            for k, v in row.items():
                if isinstance(v, str):
                    for pattern in self.patterns:
                        if pattern.search(v):
                            v = "[AEGIS_REDACTED_INJECTION_PAYLOAD]"
                            row_tainted = True
                            break
                clean_row[k] = v
            
            if row_tainted:
                tainted_count += 1
            sanitized_rows.append(clean_row)
            
        return sanitized_rows, tainted_count
