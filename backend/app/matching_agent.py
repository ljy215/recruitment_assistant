import json
import os
import re
from typing import Any

from .rag_index import load_job_rag_index


def load_local_env() -> None:
    env_path = os.path.join(os.getcwd(), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_local_env()

LLM_BASE_URL = os.getenv("RECRUITMENT_LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
LLM_API_KEY = os.getenv("RECRUITMENT_LLM_API_KEY", "")
LLM_MODEL = os.getenv("RECRUITMENT_LLM_MODEL", "deepseek-v4-flash")

SKILL_KEYWORDS = [
    "Python",
    "Java",
    "React",
    "Vue",
    "SQL",
    "RAG",
    "LangChain",
    "LangGraph",
    "Agent",
    "Echarts",
    "数据分析",
    "项目管理",
    "客户沟通",
    "方案撰写",
    "需求分析",
]

SCREENING_PROMPT_TEMPLATE = "\n".join(
    [
        "你是招聘初筛 Agent。你必须基于岗位 RAG 知识库和候选人简历信号做匹配分析，只输出 JSON。",
        "任务步骤：",
        "1. 先判断候选人投递岗位 selected_job 是否匹配。",
        "2. 如果投递岗位匹配，screening_suggestion 以“建议推进：”开头，并说明建议进入下一轮的原因。",
        "3. 如果投递岗位明显不匹配，screening_suggestion 以“岗位不匹配：”开头，并说明缺口。",
        "4. 如果候选人更适合岗位库中的其他岗位，screening_suggestion 以“建议转岗：更适合【岗位名】，”开头，并给出原因。",
        "5. 标签 tags 要短，例如：Python符合要求、项目经历较丰富、学历符合要求、建议转前端开发工程师。",
        "6. 风险点 risk_points 要指出需要 HR 或面试官复核的地方。",
        "输出 JSON 字段：match_score(0-100整数), tags(数组), risk_points(数组), summary, screening_suggestion。",
    ]
)


def find_job_knowledge(position: str, jobs: list[dict[str, Any]], job_description: str = "") -> dict[str, Any]:
    for job in jobs:
        if position in {job.get("id"), job.get("name")}:
            return job
    for job in jobs:
        if position and position in job.get("name", ""):
            return job
    return {
        "id": "custom-position",
        "name": position or "未知岗位",
        "department": "",
        "location": "",
        "description": job_description,
    }


def job_document(job: dict[str, Any]) -> str:
    return "\n".join(
        [
            str(job.get("name", "")),
            str(job.get("department", "")),
            str(job.get("description", "")),
            str(job.get("responsibilities", "")),
            str(job.get("requirements", "")),
        ]
    )


def retrieve_job_knowledge(
    selected_job: dict[str, Any],
    jobs: list[dict[str, Any]],
    candidate: dict[str, Any],
    limit: int = 4,
) -> list[dict[str, Any]]:
    index = load_job_rag_index()
    if index and index.get("documents"):
        jobs_by_id = {job.get("id"): job for job in jobs}
        jobs_by_name = {job.get("name"): job for job in jobs}
        query_terms = {str(item).lower() for item in candidate.get("skills") or []}
        query_text = (
            json.dumps(candidate.get("structured_info") or {}, ensure_ascii=False)
            + "\n"
            + candidate.get("resume_excerpt", "")
        ).lower()
        scored_index: list[tuple[int, dict[str, Any]]] = []
        for document in index["documents"]:
            score = 0
            if document.get("id") == selected_job.get("id") or document.get("name") == selected_job.get("name"):
                score += 100
            tokens = {str(token).lower() for token in document.get("tokens") or []}
            text = str(document.get("text") or "").lower()
            score += len(query_terms & tokens) * 12
            for token in ["ai", "agent", "rag", "python", "react", "vue", "sql", "数据", "客户", "方案"]:
                if token in query_text and token in text:
                    score += 5
            scored_index.append((score, document))
        scored_index.sort(key=lambda item: item[0], reverse=True)
        retrieved_jobs = []
        for _, document in scored_index[:limit]:
            job = jobs_by_id.get(document.get("id")) or jobs_by_name.get(document.get("name"))
            if job:
                retrieved_jobs.append(job)
        if retrieved_jobs:
            return retrieved_jobs

    query_terms = set(candidate.get("skills") or [])
    query_text = json.dumps(candidate.get("structured_info") or {}, ensure_ascii=False) + "\n" + candidate.get("resume_excerpt", "")
    scored: list[tuple[int, dict[str, Any]]] = []
    for job in jobs:
        doc = job_document(job)
        score = 0
        if job.get("id") == selected_job.get("id") or job.get("name") == selected_job.get("name"):
            score += 100
        for term in query_terms:
            if term and term.lower() in doc.lower():
                score += 12
        for token in ["AI", "Agent", "RAG", "Python", "React", "Vue", "SQL", "数据", "客户", "方案"]:
            if token.lower() in query_text.lower() and token.lower() in doc.lower():
                score += 5
        scored.append((score, job))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [job for _, job in scored[:limit]]


def extract_candidate_signals(resume_text: str, candidate_info: dict[str, Any] | None = None) -> dict[str, Any]:
    text = resume_text or ""
    skills = [skill for skill in SKILL_KEYWORDS if skill.lower() in text.lower()]
    degree = next((item for item in ["博士", "硕士", "本科", "大专"] if item in text), "待补充")
    projects = len(re.findall(r"(?:20\d{2}|19\d{2})[./年-]?\s*\d{0,2}\s*(?:-|至|—|~)", text))
    return {
        "degree": degree,
        "skills": skills,
        "project_count": projects,
        "structured_info": candidate_info or {},
        "resume_excerpt": text[:1800],
    }


def normalize_agent_result(payload: dict[str, Any], position: str) -> dict[str, Any]:
    tags = payload.get("tags") or []
    risks = payload.get("risk_points") or []
    try:
        score = int(payload.get("match_score", 0))
    except (TypeError, ValueError):
        score = 0
    score = max(0, min(100, score))
    return {
        "position": position,
        "status": "待初筛",
        "match_score": score,
        "tags": [str(item) for item in tags[:5]] or ["待人工复核"],
        "risk_points": [str(item) for item in risks[:4]] or ["暂无明显风险"],
        "summary": str(payload.get("summary") or "候选人与岗位匹配情况待进一步确认。"),
        "screening_suggestion": str(payload.get("screening_suggestion") or "建议人工复核"),
        "agent_mode": str(payload.get("agent_mode") or "local"),
    }


def local_match_agent(
    resume_text: str,
    position: str,
    jobs: list[dict[str, Any]],
    job_description: str = "",
    candidate_info: dict[str, Any] | None = None,
) -> dict[str, Any]:
    job = find_job_knowledge(position, jobs, job_description)
    candidate = extract_candidate_signals(resume_text, candidate_info)
    retrieved_jobs = retrieve_job_knowledge(job, jobs, candidate)
    combined_job = "\n".join(
        [job_document(item) for item in retrieved_jobs] + [job_description]
    )
    matched_skills = [skill for skill in candidate["skills"] if skill.lower() in combined_job.lower()]
    useful_skills = matched_skills or candidate["skills"][:4]

    score = 58 + len(matched_skills) * 10 + min(12, candidate["project_count"] * 2)
    if candidate["degree"] in {"硕士", "博士"}:
        score += 8
    elif candidate["degree"] == "本科":
        score += 5
    score = min(95, score)

    tags = []
    if useful_skills:
        tags.extend([f"{skill}符合要求" for skill in useful_skills[:3]])
    if candidate["project_count"] >= 2:
        tags.append("项目经历较丰富")
    if candidate["degree"] != "待补充":
        tags.append(f"{candidate['degree']}学历")

    risk_points = []
    if not matched_skills:
        risk_points.append("岗位关键技能需人工复核")
    if candidate["degree"] == "待补充":
        risk_points.append("学历信息待确认")
    if candidate["project_count"] == 0:
        risk_points.append("项目或实习经历待补充")
    if not risk_points:
        risk_points.append("暂无明显风险")

    alternative_jobs = [item for item in retrieved_jobs if item.get("name") != job.get("name")]
    alternative = alternative_jobs[0]["name"] if alternative_jobs else ""
    if score >= 78:
        suggestion = f"建议推进：候选人与{job.get('name', position)}岗位匹配度较高，可进入下一轮。"
    elif alternative:
        suggestion = f"建议转岗：更适合【{alternative}】，投递岗位关键技能仍需复核。"
    else:
        suggestion = "岗位不匹配：候选人与当前岗位关键要求差距较大，建议暂缓推进。"
    summary = (
        f"候选人与{job.get('name', position)}岗位匹配度为{score}分。"
        f"主要依据：{ '、'.join(tags[:3]) if tags else '简历信息有限' }。"
    )
    return normalize_agent_result(
        {
            "match_score": score,
            "tags": tags,
            "risk_points": risk_points,
            "summary": summary,
            "screening_suggestion": suggestion,
            "agent_mode": "local-fallback",
        },
        job.get("name") or position,
    )


def langchain_match_agent(
    resume_text: str,
    position: str,
    jobs: list[dict[str, Any]],
    job_description: str = "",
    candidate_info: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        return None
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI
    except ImportError:
        return None

    job = find_job_knowledge(position, jobs, job_description)
    candidate = extract_candidate_signals(resume_text, candidate_info)
    retrieved_jobs = retrieve_job_knowledge(job, jobs, candidate)
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                SCREENING_PROMPT_TEMPLATE,
            ),
            (
                "human",
                "\n".join(
                    [
                        "候选人投递岗位 selected_job：{selected_job}",
                        "RAG 检索到的岗位知识库 retrieved_jobs：{retrieved_jobs}",
                        "候选人信息：{candidate}",
                    ]
                ),
            ),
        ]
    )
    model = ChatOpenAI(
        model=LLM_MODEL,
        api_key=LLM_API_KEY,
        base_url=LLM_BASE_URL,
        temperature=0.2,
    )
    message = (prompt | model).invoke(
        {
            "selected_job": json.dumps(job, ensure_ascii=False),
            "retrieved_jobs": json.dumps(retrieved_jobs, ensure_ascii=False),
            "candidate": json.dumps(candidate, ensure_ascii=False),
        }
    )
    content = getattr(message, "content", str(message))
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    payload["agent_mode"] = "langchain"
    return normalize_agent_result(payload, job.get("name") or position)


def analyze_candidate_match(
    resume_text: str,
    position: str,
    jobs: list[dict[str, Any]],
    job_description: str = "",
    candidate_info: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return (
        langchain_match_agent(resume_text, position, jobs, job_description, candidate_info)
        or local_match_agent(resume_text, position, jobs, job_description, candidate_info)
    )


def compact_text(text: str, limit: int = 300) -> str:
    compact = re.sub(r"\s+", " ", text or "").strip()
    return compact[:limit]


def local_final_report(position: str, candidates: list[dict[str, Any]], limit: int = 300) -> str:
    if not candidates:
        return f"{position}暂无终面结束候选人。"
    parts = [f"{position}终面报告：共{len(candidates)}人。"]
    for item in candidates[:5]:
        tags = "、".join(item.get("tags", [])[:2]) or "表现待补充"
        score = item.get("human_score") or item.get("match_score") or 0
        summary = item.get("ai_summary") or item.get("summary") or ""
        parts.append(f"{item.get('name')}({score}分)：{tags}，{summary[:28]}")
    return compact_text(" ".join(parts), limit)


def summarize_final_report(position: str, candidates: list[dict[str, Any]], limit: int = 300) -> str:
    if not candidates:
        return f"{position}暂无终面结束候选人。"
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        return local_final_report(position, candidates, limit)
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI
    except ImportError:
        return local_final_report(position, candidates, limit)

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "你是HR终面报告助手。请基于候选人终面信息生成中文Markdown简报，必须简洁、只保留关键信息，总字数不超过300字。不要编造信息。",
            ),
            (
                "human",
                "岗位：{position}\n候选人终面信息：{candidates}\n输出结构：标题、候选人要点、整体建议。",
            ),
        ]
    )
    model = ChatOpenAI(
        model=LLM_MODEL,
        api_key=LLM_API_KEY,
        base_url=LLM_BASE_URL,
        temperature=0.2,
    )
    try:
        message = (prompt | model).invoke(
            {
                "position": position,
                "candidates": json.dumps(candidates, ensure_ascii=False),
            }
        )
    except Exception:
        return local_final_report(position, candidates, limit)
    return compact_text(getattr(message, "content", str(message)), limit)


def local_interview_recording_summary(transcript: str, candidate: dict[str, Any], limit: int = 500) -> str:
    text = compact_text(transcript, limit)
    if not text:
        return "录音已上传，但当前未识别出可用文字内容。请面试官补充关键问答后保存。"
    return compact_text(
        f"{candidate.get('name', '候选人')}面试纪要：{text}。建议重点复核表达逻辑、岗位匹配度和项目细节。",
        limit,
    )


def summarize_interview_recording(transcript: str, candidate: dict[str, Any], limit: int = 500) -> str:
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        return local_interview_recording_summary(transcript, candidate, limit)
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI
    except ImportError:
        return local_interview_recording_summary(transcript, candidate, limit)

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "你是面试纪要助手。请把录音转写/会议纪要精炼成中文面试反馈，保留关键问答、岗位匹配、风险点和建议，不超过500字。",
            ),
            (
                "human",
                "候选人信息：{candidate}\n录音转写或纪要：{transcript}",
            ),
        ]
    )
    model = ChatOpenAI(
        model=LLM_MODEL,
        api_key=LLM_API_KEY,
        base_url=LLM_BASE_URL,
        temperature=0.2,
    )
    try:
        message = (prompt | model).invoke(
            {
                "candidate": json.dumps(candidate, ensure_ascii=False),
                "transcript": transcript,
            }
        )
    except Exception:
        return local_interview_recording_summary(transcript, candidate, limit)
    return compact_text(getattr(message, "content", str(message)), limit)
