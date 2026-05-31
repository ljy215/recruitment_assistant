import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from .storage import DATA_DIR


JOB_RAG_INDEX_PATH = DATA_DIR / "job_rag_index.json"


def job_to_document(job: dict[str, Any]) -> str:
    return "\n".join(
        [
            f"岗位名称：{job.get('name', '')}",
            f"所属部门：{job.get('department', '')}",
            f"工作地点：{job.get('location', '')}",
            f"岗位概述：{job.get('description', '')}",
            f"岗位职责：{job.get('responsibilities', '')}",
            f"岗位要求：{job.get('requirements', '')}",
            f"面试轮次：{job.get('interview_rounds', 3)}",
            f"招聘状态：{job.get('status', '')}",
        ]
    )


def tokenize(text: str) -> list[str]:
    normalized = text.lower()
    latin_tokens = re.findall(r"[a-z0-9+#.]+", normalized)
    chinese_terms = re.findall(r"[\u4e00-\u9fff]{2,}", text)
    return sorted(set(latin_tokens + chinese_terms))


def build_job_rag_index(jobs: list[dict[str, Any]]) -> dict[str, Any]:
    DATA_DIR.mkdir(exist_ok=True)
    documents = []
    for job in jobs:
        text = job_to_document(job)
        documents.append(
            {
                "id": job.get("id"),
                "name": job.get("name"),
                "status": job.get("status"),
                "interview_rounds": job.get("interview_rounds", 3),
                "text": text,
                "tokens": tokenize(text),
            }
        )
    index = {
        "type": "job-rag-index",
        "built_at": datetime.now().isoformat(timespec="seconds"),
        "document_count": len(documents),
        "documents": documents,
    }
    JOB_RAG_INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    return index


def load_job_rag_index() -> dict[str, Any] | None:
    if not JOB_RAG_INDEX_PATH.exists():
        return None
    try:
        return json.loads(JOB_RAG_INDEX_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
