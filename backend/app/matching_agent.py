import json
import os
import re
from typing import Any


LLM_BASE_URL = os.getenv("RECRUITMENT_LLM_BASE_URL", "")
LLM_API_KEY = os.getenv("RECRUITMENT_LLM_API_KEY", "")
LLM_MODEL = os.getenv("RECRUITMENT_LLM_MODEL", "")

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


def extract_candidate_signals(resume_text: str) -> dict[str, Any]:
    text = resume_text or ""
    skills = [skill for skill in SKILL_KEYWORDS if skill.lower() in text.lower()]
    degree = next((item for item in ["博士", "硕士", "本科", "大专"] if item in text), "待补充")
    projects = len(re.findall(r"(?:20\d{2}|19\d{2})[./年-]?\s*\d{0,2}\s*(?:-|至|—|~)", text))
    return {
        "degree": degree,
        "skills": skills,
        "project_count": projects,
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


def local_match_agent(resume_text: str, position: str, jobs: list[dict[str, Any]], job_description: str = "") -> dict[str, Any]:
    job = find_job_knowledge(position, jobs, job_description)
    candidate = extract_candidate_signals(resume_text)
    combined_job = f"{job.get('name', '')}\n{job.get('description', '')}\n{job_description}"
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

    suggestion = "建议进入面试" if score >= 78 else "建议人工复核" if score >= 65 else "暂缓推进"
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


def langchain_match_agent(resume_text: str, position: str, jobs: list[dict[str, Any]], job_description: str = "") -> dict[str, Any] | None:
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        return None
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI
    except ImportError:
        return None

    job = find_job_knowledge(position, jobs, job_description)
    candidate = extract_candidate_signals(resume_text)
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "你是招聘初筛 Agent。你必须基于岗位知识库和候选人简历信号做匹配分析，只输出 JSON。",
            ),
            (
                "human",
                "\n".join(
                    [
                        "岗位知识库：{job}",
                        "候选人信息：{candidate}",
                        "输出字段：match_score(0-100整数), tags(数组), risk_points(数组), summary, screening_suggestion。",
                        "标签要短，例如：Python符合要求、项目经历较丰富、学历符合要求。",
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
            "job": json.dumps(job, ensure_ascii=False),
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


def analyze_candidate_match(resume_text: str, position: str, jobs: list[dict[str, Any]], job_description: str = "") -> dict[str, Any]:
    return (
        langchain_match_agent(resume_text, position, jobs, job_description)
        or local_match_agent(resume_text, position, jobs, job_description)
    )
