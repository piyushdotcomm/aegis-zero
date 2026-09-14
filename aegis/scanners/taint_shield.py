import re


class RowTaintShield:
    def __init__(self):
        self.patterns = [
            re.compile(r"(?i)\b(ignore\s+(all\s+)?previous\s+instructions)\b"),
            re.compile(r"(?i)\b(dump\s+the\s+\S+\s+table)\b"),
            re.compile(r"(?i)\b(dump\s+(all\s+)?(the\s+)?\S+\s+table)\b"),
            re.compile(r"(?i)\b(system\s*:\s*)"),
            re.compile(r"(?i)\b(disregard\s+(all\s+)?(prior|above)\s+(instructions|rules))\b"),
            re.compile(r"(?i)\b(you\s+are\s+now\s+in\s+(developer|debug|admin)\s+mode)\b"),
            re.compile(r"(?i)\b(forget\s+(everything|all)\s+(above|before|previous))\b"),
            re.compile(r"(?i)\b(override\s+(previous|prior|all)\s+(instructions|rules|constraints))\b"),
            re.compile(r"(?i)\b(reveal\s+(your|the)\s+(system\s+)?(prompt|instructions))\b"),
            re.compile(r"(?i)\b(act\s+as\s+(a\s+)?root|sudo\s+mode)\b"),
            re.compile(r"(?i)\b(output\s+(all\s+|the\s+)+(data|records|rows|table))\b"),
            re.compile(r"(?i)\b(do\s+not\s+filter|bypass\s+(the\s+)?(security|filter|auth))\b"),
            re.compile(r"(?i)<\s*/?\s*(system|instruction|prompt)\s*>"),
            re.compile(r"(?i)\[\s*INST\s*\]"),
            re.compile(r"(?i)```\s*(system|instruction)"),
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
