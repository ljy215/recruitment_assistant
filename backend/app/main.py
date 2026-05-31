import csv
import hashlib
import io
import json
import re
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .ai_mock import analyze_interview, extract_resume_profile, mask_email, mask_phone, parse_application_resume
from .matching_agent import analyze_candidate_match, summarize_final_report, summarize_interview_recording
from .rag_index import build_job_rag_index
from .storage import get_conn, init_db, row_to_dict, to_json


ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

app = FastAPI(title="AI Recruitment Demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CandidateCreate(BaseModel):
    name: str
    position: str
    phone_masked: str = "待补充"
    email_masked: str = "待补充"
    education: str = "待补充"
    school: str = "待补充"
    work_years: str = "待补充"
    status: str = "待初筛"
    match_score: int = 0
    tags: list[str] = []
    risk_points: list[str] = []
    summary: str = ""
    screening_suggestion: str = ""
    resume_filename: str = ""
    resume_path: str = ""
    resume_text: str = ""
    application_data: dict = {}


class InterviewCreate(BaseModel):
    candidate_id: int
    interviewer: str = ""
    interview_time: str = ""
    transcript: str
    human_score: int
    tags: list[str] = []
    final_result: str = "待定"


class GroupMessageRequest(BaseModel):
    candidate_id: int
    next_action: str = "请相关同学确认下一步安排"


class CandidateAdvanceRequest(BaseModel):
    interviewer: str
    interview_time: str = ""
    note: str = ""


class JobCreate(BaseModel):
    name: str
    department: str = ""
    location: str = ""
    description: str = ""
    responsibilities: str = ""
    requirements: str = ""
    interview_rounds: int = 3
    status: str = "招聘中"


class JobUpdate(BaseModel):
    name: str | None = None
    department: str | None = None
    location: str | None = None
    description: str | None = None
    responsibilities: str | None = None
    requirements: str | None = None
    interview_rounds: int | None = None
    status: str | None = None


DEFAULT_JOBS = [
    {
        "id": "presales-consultant",
        "name": "售前解决方案顾问",
        "department": "解决方案中心",
        "location": "杭州",
        "description": "面向客户需求提供售前解决方案支持。",
        "responsibilities": "负责客户沟通、需求分析、方案撰写与项目推进。",
        "requirements": "要求表达清晰、逻辑完整，具备客户意识和项目协同能力。",
        "interview_rounds": 3,
        "status": "招聘中",
    },
    {
        "id": "frontend-engineer",
        "name": "前端开发工程师",
        "department": "数字化平台部",
        "location": "上海",
        "description": "负责招聘系统和内部数字化平台前端研发。",
        "responsibilities": "负责前端页面开发、组件抽象、接口联调和用户体验优化。",
        "requirements": "要求熟悉 React 或 Vue、组件化开发、工程化构建和接口联调。",
        "interview_rounds": 2,
        "status": "招聘中",
    },
    {
        "id": "data-analyst",
        "name": "数据分析师",
        "department": "业务运营部",
        "location": "北京",
        "description": "负责招聘运营数据分析和业务洞察。",
        "responsibilities": "负责招聘漏斗、候选人标签、转化效率分析和看板建设。",
        "requirements": "要求熟悉 SQL、数据看板、指标拆解和业务洞察。",
        "interview_rounds": 2,
        "status": "招聘中",
    },
]


DEMO_CANDIDATES = [
    ("张三", 88, ["客户沟通", "方案撰写", "项目管理"], "表达清晰，能结合项目说明客户需求分析过程。"),
    ("李四", 84, ["项目经验", "稳定性好", "逻辑清晰"], "逻辑完整，过往项目复杂度较高。"),
    ("王五", 91, ["技术扎实", "数据分析", "落地能力"], "专业能力扎实，能解释系统方案取舍。"),
    ("赵六", 79, ["沟通表达", "执行力", "客户意识"], "沟通顺畅，但行业经验仍需终面确认。"),
    ("陈晨", 86, ["方案能力", "需求分析", "复盘意识"], "能快速拆解客户问题，回答较有结构。"),
    ("刘洋", 76, ["学习能力", "项目协同", "表达稳定"], "基础表现稳定，复杂场景经验略少。"),
    ("周敏", 89, ["业务理解", "推进能力", "沟通强"], "业务理解较好，能主动追问关键约束。"),
    ("孙悦", 73, ["执行力", "文档能力", "配合度"], "表达偏谨慎，关键项目 ownership 需确认。"),
    ("吴迪", 82, ["客户沟通", "售前经验", "抗压能力"], "有售前场景经验，方案深度中等。"),
    ("郑可", 78, ["数据意识", "逻辑表达", "学习能力"], "回答逻辑较清楚，业务深度仍需补充。"),
]

INTERVIEWERS = ["张敏", "王磊", "陈晨", "刘洋"]
INTERVIEW_SLOTS = ["09:30", "10:30", "14:00", "15:30", "16:30"]


@app.on_event("startup")
def startup() -> None:
    init_db()
    seed_default_jobs()
    build_job_rag_index(list_jobs_from_db(include_closed=True))


def read_upload_text(file: UploadFile) -> str:
    raw = file.file.read()
    return extract_upload_text(raw, file.filename or "")


def extract_upload_text(raw: bytes, filename: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(raw))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return raw.decode("utf-8", errors="ignore")
    if suffix in {".docx", ".doc"}:
        try:
            from docx import Document

            document = Document(io.BytesIO(raw))
            return "\n".join(p.text for p in document.paragraphs)
        except Exception:
            return raw.decode("utf-8", errors="ignore")
    return raw.decode("utf-8", errors="ignore")


def save_resume_file(raw: bytes, filename: str) -> str:
    safe_name = re.sub(r"[^0-9A-Za-z._-]+", "_", filename or "resume.pdf").strip("._")
    suffix = Path(safe_name).suffix or ".pdf"
    stem = Path(safe_name).stem or "resume"
    digest = hashlib.sha1(raw).hexdigest()[:10]
    saved_name = f"{int(time.time())}_{digest}_{stem}{suffix}"
    resume_dir = Path("data") / "resumes"
    resume_dir.mkdir(parents=True, exist_ok=True)
    target = resume_dir / saved_name
    target.write_bytes(raw)
    return str(target.as_posix())


def parse_json_form(value: str, default):
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def find_job(position: str) -> dict:
    jobs = list_jobs_from_db(include_closed=True)
    for job in jobs:
        if position in {job["id"], job["name"]}:
            return job
    return jobs[0] if jobs else DEFAULT_JOBS[0]


def slugify_job_id(name: str) -> str:
    base = re.sub(r"[^0-9A-Za-z]+", "-", name).strip("-").lower()
    if len(base) < 3:
        base = f"job-{hashlib.sha1(name.encode('utf-8')).hexdigest()[:8]}"
    candidate = base
    index = 2
    with get_conn() as conn:
        while conn.execute("SELECT 1 FROM jobs WHERE id = ?", (candidate,)).fetchone():
            candidate = f"{base}-{index}"
            index += 1
    return candidate


def seed_default_jobs() -> None:
    with get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
        if count:
            return
        for job in DEFAULT_JOBS:
            conn.execute(
                """
                INSERT INTO jobs (
                    id, name, department, location, description, responsibilities, requirements, interview_rounds, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job["id"],
                    job["name"],
                    job["department"],
                    job["location"],
                    job["description"],
                    job["responsibilities"],
                    job["requirements"],
                    job.get("interview_rounds", 3),
                    job["status"],
                ),
            )
    build_job_rag_index(list_jobs_from_db(include_closed=True))


def list_jobs_from_db(include_closed: bool = False) -> list[dict]:
    query = "SELECT * FROM jobs"
    params = []
    if not include_closed:
        query += " WHERE status = ?"
        params.append("招聘中")
    query += " ORDER BY updated_at DESC, created_at DESC"
    with get_conn() as conn:
        return [row_to_dict(row) for row in conn.execute(query, params).fetchall()]


ROUND_LABELS = ["一", "二", "三", "四", "五"]
ROUND_BY_LABEL = {label: index + 1 for index, label in enumerate(ROUND_LABELS)}


def normalize_interview_rounds(value) -> int:
    try:
        rounds = int(value)
    except (TypeError, ValueError):
        rounds = 3
    return max(1, min(5, rounds))


def get_job_for_position(position: str) -> dict:
    for job in list_jobs_from_db(include_closed=True):
        if job.get("name") == position:
            return job
    return {"name": position, "interview_rounds": 3}


def infer_interview_round(status: str, completed_count: int = 0) -> int:
    for label, round_index in ROUND_BY_LABEL.items():
        if f"{label}面" in (status or ""):
            return round_index
    return normalize_interview_rounds(completed_count + 1)


def interview_feedback_status(current_status: str, total_rounds: int, completed_count: int = 0) -> str:
    current_round = infer_interview_round(current_status, completed_count)
    if current_round >= normalize_interview_rounds(total_rounds):
        return "最终候选"
    return f"{ROUND_LABELS[current_round - 1]}面结束"


def next_business_days(count: int = 5) -> list[date]:
    days = []
    current = date.today()
    while len(days) < count:
        if current.weekday() < 5:
            days.append(current)
        current += timedelta(days=1)
    return days


def deterministic_busy(interviewer: str, day: date, slot: str) -> bool:
    raw = f"{interviewer}-{day.isoformat()}-{slot}"
    return int(hashlib.sha1(raw.encode("utf-8")).hexdigest()[:2], 16) % 7 == 0


def get_interviewer_schedule(interviewer: str) -> dict:
    if interviewer not in INTERVIEWERS:
        raise HTTPException(status_code=404, detail="interviewer not found")
    business_days = next_business_days(5)
    week_start = business_days[0]
    week_end = business_days[-1]
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT interview_time, final_result
            FROM interviews
            WHERE interviewer = ? AND interview_time BETWEEN ? AND ?
            """,
            (
                interviewer,
                f"{week_start.isoformat()} 00:00",
                f"{week_end.isoformat()} 23:59",
            ),
        ).fetchall()
    occupied = {row["interview_time"]: row["final_result"] or "已有面试" for row in rows if row["interview_time"]}
    days = []
    for day in business_days:
        slots = []
        for slot in INTERVIEW_SLOTS:
            value = f"{day.isoformat()} {slot}"
            synthetic_busy = deterministic_busy(interviewer, day, slot)
            is_busy = value in occupied or synthetic_busy
            slots.append(
                {
                    "time": value,
                    "label": slot,
                    "busy": is_busy,
                    "reason": occupied.get(value) or ("部门会议" if synthetic_busy else ""),
                }
            )
        days.append(
            {
                "date": day.isoformat(),
                "weekday": ["周一", "周二", "周三", "周四", "周五"][day.weekday()],
                "slots": slots,
            }
        )
    return {"interviewer": interviewer, "week_start": week_start.isoformat(), "week_end": week_end.isoformat(), "days": days}


def job_to_jd(job: dict) -> str:
    return "\n".join(
        [
            f"岗位名称：{job.get('name', '')}",
            f"岗位概述：{job.get('description', '')}",
            f"岗位职责：{job.get('responsibilities', '')}",
            f"岗位要求：{job.get('requirements', '')}",
        ]
    )


def analyze_resume_with_agent(
    text: str,
    position: str,
    job_description: str = "",
    candidate_info: dict | None = None,
) -> dict:
    profile = extract_resume_profile(text, position)
    jobs = list_jobs_from_db(include_closed=True)
    match_result = analyze_candidate_match(text, position, jobs, job_description, candidate_info)
    return {**profile, **match_result}


@app.get("/api/jobs")
async def list_jobs():
    return list_jobs_from_db()


@app.post("/api/jobs")
async def create_job(payload: JobCreate):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="job name is required")
    job_id = slugify_job_id(payload.name)
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO jobs (
                id, name, department, location, description, responsibilities, requirements, interview_rounds, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                payload.name.strip(),
                payload.department.strip(),
                payload.location.strip(),
                payload.description.strip(),
                payload.responsibilities.strip(),
                payload.requirements.strip(),
                normalize_interview_rounds(payload.interview_rounds),
                payload.status.strip() or "招聘中",
            ),
        )
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        item = row_to_dict(row)
    index = build_job_rag_index(list_jobs_from_db(include_closed=True))
    item["rag_index_built_at"] = index["built_at"]
    item["rag_document_count"] = index["document_count"]
    return item


@app.patch("/api/jobs/{job_id}")
async def update_job(job_id: str, payload: JobUpdate):
    values = payload.dict(exclude_unset=True)
    allowed = {"name", "department", "location", "description", "responsibilities", "requirements", "interview_rounds", "status"}
    fields = [field for field in values if field in allowed]
    if not fields:
        raise HTTPException(status_code=400, detail="no valid fields")
    if "name" in values and not str(values["name"]).strip():
        raise HTTPException(status_code=400, detail="job name is required")
    assignments = ", ".join(f"{field} = ?" for field in fields)
    params = [
        normalize_interview_rounds(values[field]) if field == "interview_rounds"
        else str(values[field]).strip() if values[field] is not None else ""
        for field in fields
    ]
    params.append(job_id)
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="job not found")
        conn.execute(
            f"UPDATE jobs SET {assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            params,
        )
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        item = row_to_dict(row)
    index = build_job_rag_index(list_jobs_from_db(include_closed=True))
    item["rag_index_built_at"] = index["built_at"]
    item["rag_document_count"] = index["document_count"]
    return item


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="job not found")
        conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    index = build_job_rag_index(list_jobs_from_db(include_closed=True))
    return {
        "id": job_id,
        "deleted": True,
        "rag_index_built_at": index["built_at"],
        "rag_document_count": index["document_count"],
    }


@app.get("/api/interviewers")
async def list_interviewers():
    return [{"name": name} for name in INTERVIEWERS]


@app.get("/api/interviewers/{interviewer}/schedule")
async def interviewer_schedule(interviewer: str):
    return get_interviewer_schedule(interviewer)


@app.post("/api/resumes/upload")
async def upload_resume(
    file: UploadFile = File(...),
    position: str = Form(...),
    job_description: str = Form(""),
):
    text = read_upload_text(file)
    parsed = analyze_resume_with_agent(text, position, job_description)
    application_form = parse_application_resume(text, position, job_description)
    return {
        "filename": file.filename,
        "resume_text": text[:3000],
        "parsed": parsed,
        "application_form": application_form,
    }


@app.post("/api/applications")
async def submit_application(
    resume: UploadFile = File(...),
    intended_position: str = Form(...),
    name: str = Form(""),
    phone: str = Form(""),
    email: str = Form(""),
    education: str = Form(""),
    school: str = Form(""),
    work_years: str = Form(""),
    application_json: str = Form("{}"),
    repeat_forms_json: str = Form("{}"),
):
    job = find_job(intended_position)
    raw = resume.file.read()
    text = extract_upload_text(raw, resume.filename or "")
    resume_path = save_resume_file(raw, resume.filename or "")
    application_payload = parse_json_form(application_json, {})
    repeat_forms_payload = parse_json_form(repeat_forms_json, {})
    parsed_form = parse_application_resume(text, job["name"], job_to_jd(job))
    candidate_info = {
        "application": {**parsed_form.get("application", {}), **application_payload},
        "repeat_forms": repeat_forms_payload or parsed_form.get("repeat_forms", {}),
    }
    parsed = analyze_resume_with_agent(text, job["name"], job_to_jd(job), candidate_info)
    candidate = CandidateCreate(
        name=name.strip() or parsed["name"],
        position=job["name"],
        phone_masked=mask_phone(phone) if phone.strip() else parsed["phone_masked"],
        email_masked=mask_email(email) if email.strip() else parsed["email_masked"],
        education=education.strip() or parsed["education"],
        school=school.strip() or parsed["school"],
        work_years=work_years.strip() or parsed["work_years"],
        status="已投递",
        match_score=parsed["match_score"],
        tags=parsed["tags"],
        risk_points=parsed["risk_points"],
        summary=parsed["summary"],
        screening_suggestion=parsed["screening_suggestion"],
        resume_filename=resume.filename or "",
        resume_path=resume_path,
        resume_text=text[:6000],
        application_data=candidate_info,
    )
    return await create_candidate(candidate)


@app.post("/api/ai/parse-resume")
async def parse_resume(payload: dict):
    text = payload.get("resume_text", "")
    position = payload.get("position", "")
    job_description = payload.get("job_description", "")
    return analyze_resume_with_agent(text, position, job_description)


@app.post("/api/candidates")
async def create_candidate(candidate: CandidateCreate):
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO candidates (
                name, position, phone_masked, email_masked, education, school, work_years,
                status, match_score, tags, risk_points, summary, screening_suggestion,
                resume_filename, resume_path, resume_text, application_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                candidate.name,
                candidate.position,
                candidate.phone_masked,
                candidate.email_masked,
                candidate.education,
                candidate.school,
                candidate.work_years,
                candidate.status,
                candidate.match_score,
                to_json(candidate.tags),
                to_json(candidate.risk_points),
                candidate.summary,
                candidate.screening_suggestion,
                candidate.resume_filename,
                candidate.resume_path,
                candidate.resume_text,
                json.dumps(candidate.application_data or {}, ensure_ascii=False),
            ),
        )
        row = conn.execute("SELECT * FROM candidates WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return row_to_dict(row)


@app.get("/api/candidates")
async def list_candidates(position: Optional[str] = None, status: Optional[str] = None):
    query = "SELECT * FROM candidates WHERE 1=1"
    params = []
    if position:
        query += " AND position = ?"
        params.append(position)
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY updated_at DESC, id DESC"
    with get_conn() as conn:
        return [row_to_dict(row) for row in conn.execute(query, params).fetchall()]


@app.get("/api/candidates/{candidate_id}")
async def get_candidate(candidate_id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="candidate not found")
        interviews = conn.execute(
            "SELECT * FROM interviews WHERE candidate_id = ? ORDER BY created_at DESC",
            (candidate_id,),
        ).fetchall()
        item = row_to_dict(row)
        item["interviews"] = [row_to_dict(interview) for interview in interviews]
        return item


@app.get("/api/candidates/{candidate_id}/resume")
async def get_candidate_resume(candidate_id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT resume_filename, resume_path FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="candidate not found")
        resume_path = row["resume_path"] or ""
        resume_filename = row["resume_filename"] or Path(resume_path).name
    if not resume_path:
        raise HTTPException(status_code=404, detail="resume not found")
    target = (ROOT_DIR / resume_path).resolve()
    resume_root = (ROOT_DIR / "data" / "resumes").resolve()
    if resume_root not in target.parents or not target.exists():
        raise HTTPException(status_code=404, detail="resume not found")
    return FileResponse(
        target,
        media_type="application/pdf" if target.suffix.lower() == ".pdf" else "application/octet-stream",
        filename=resume_filename,
    )


@app.patch("/api/candidates/{candidate_id}")
async def update_candidate(candidate_id: int, payload: dict):
    allowed = {"position", "status", "match_score", "summary", "screening_suggestion"}
    fields = [key for key in payload if key in allowed]
    if not fields:
        raise HTTPException(status_code=400, detail="no valid fields")
    assignments = ", ".join(f"{field} = ?" for field in fields)
    values = [payload[field] for field in fields]
    values.append(candidate_id)
    with get_conn() as conn:
        conn.execute(
            f"UPDATE candidates SET {assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values,
        )
        row = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        return row_to_dict(row)


def next_candidate_status(current: str, total_rounds: int = 3) -> str:
    total_rounds = normalize_interview_rounds(total_rounds)
    for label, round_index in ROUND_BY_LABEL.items():
        if current == f"{label}面结束":
            next_round = round_index + 1
            return f"{ROUND_LABELS[next_round - 1]}面待安排" if next_round <= total_rounds else "最终候选"
        if current == f"{label}面待安排":
            return f"{label}面中"
        if current == f"{label}面中":
            next_round = round_index + 1
            return f"{ROUND_LABELS[next_round - 1]}面待安排" if next_round <= total_rounds else "最终候选"
    transitions = {
        "已投递": "一面待安排",
        "待初筛": "一面待安排",
        "待定": "一面待安排",
    }
    return transitions.get(current, "一面待安排")


@app.post("/api/candidates/{candidate_id}/advance")
async def advance_candidate(candidate_id: int, payload: CandidateAdvanceRequest):
    if not payload.interviewer.strip():
        raise HTTPException(status_code=400, detail="interviewer is required")
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="candidate not found")
        candidate = row_to_dict(row)
        job = get_job_for_position(candidate["position"])
        next_status = next_candidate_status(candidate["status"], job.get("interview_rounds", 3))
        interview_time = payload.interview_time.strip()
        if not interview_time:
            raise HTTPException(status_code=400, detail="interview_time is required")
        schedule = get_interviewer_schedule(payload.interviewer.strip())
        available_slots = {
            slot["time"]
            for day in schedule["days"]
            for slot in day["slots"]
            if not slot["busy"]
        }
        if interview_time not in available_slots:
            raise HTTPException(status_code=400, detail="selected slot is not available")
        transcript = payload.note.strip() or f"流程推进：{candidate['status']} -> {next_status}；面试官：{payload.interviewer.strip()}；时间：{interview_time}"
        cursor = conn.execute(
            """
            INSERT INTO interviews (
                candidate_id, interviewer, interview_time, transcript, ai_summary, strengths,
                risks, human_score, ai_suggestion, final_result, reason_category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                candidate_id,
                payload.interviewer.strip(),
                interview_time,
                transcript,
                f"已推进至{next_status}，面试官为{payload.interviewer.strip()}，面试时间为{interview_time}。",
                to_json([]),
                to_json([]),
                0,
                "待面试反馈",
                next_status,
                "流程推进",
            ),
        )
        conn.execute(
            "UPDATE candidates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (next_status, candidate_id),
        )
        updated = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        item = row_to_dict(updated)
        item["advance_record_id"] = cursor.lastrowid
        return item


@app.post("/api/ai/analyze-interview")
async def ai_analyze_interview(payload: InterviewCreate):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM candidates WHERE id = ?", (payload.candidate_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="candidate not found")
        candidate = row_to_dict(row)
    return analyze_interview(payload.transcript, payload.human_score, candidate["position"])


@app.post("/api/interviews/recording-summary")
async def recording_summary(
    candidate_id: int = Form(...),
    file: UploadFile = File(...),
):
    raw = file.file.read()
    suffix = Path(file.filename or "").suffix.lower()
    transcript = ""
    if suffix in {".txt", ".md", ".json", ".csv"} or (file.content_type or "").startswith("text/"):
        transcript = raw.decode("utf-8", errors="ignore")
    elif suffix in {".docx", ".pdf"}:
        transcript = extract_upload_text(raw, file.filename or "")
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="candidate not found")
        candidate = row_to_dict(row)
    summary = summarize_interview_recording(transcript, candidate)
    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "transcript": transcript[:3000],
        "summary": summary,
    }


@app.post("/api/interviews")
async def create_interview(payload: InterviewCreate):
    with get_conn() as conn:
        candidate_row = conn.execute("SELECT * FROM candidates WHERE id = ?", (payload.candidate_id,)).fetchone()
        if not candidate_row:
            raise HTTPException(status_code=404, detail="candidate not found")
        candidate = row_to_dict(candidate_row)
        if "面中" not in candidate["status"]:
            raise HTTPException(status_code=400, detail="only interviewing candidates can submit interview feedback")
        completed_count = conn.execute(
            "SELECT COUNT(*) FROM interviews WHERE candidate_id = ? AND reason_category != ?",
            (payload.candidate_id, "流程推进"),
        ).fetchone()[0]
        job = get_job_for_position(candidate["position"])
        next_status = interview_feedback_status(candidate["status"], job.get("interview_rounds", 3), completed_count)
        ai_result = analyze_interview(payload.transcript, payload.human_score, candidate["position"])
        interviewer_tags = [tag.strip() for tag in payload.tags if tag.strip()]
        cursor = conn.execute(
            """
            INSERT INTO interviews (
                candidate_id, interviewer, interview_time, transcript, ai_summary, strengths,
                risks, human_score, ai_suggestion, final_result, reason_category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.candidate_id,
                payload.interviewer,
                payload.interview_time,
                payload.transcript,
                ai_result["ai_summary"],
                to_json(interviewer_tags or ai_result["strengths"]),
                to_json(ai_result["risks"]),
                payload.human_score,
                ai_result["ai_suggestion"],
                next_status,
                ai_result["reason_category"],
            ),
        )
        conn.execute(
            "UPDATE candidates SET status = ?, match_score = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (next_status, payload.human_score, to_json(interviewer_tags or candidate["tags"]), payload.candidate_id),
        )
        row = conn.execute("SELECT * FROM interviews WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return row_to_dict(row)


@app.get("/api/dashboard/summary")
async def dashboard_summary():
    with get_conn() as conn:
        candidates = [row_to_dict(row) for row in conn.execute("SELECT * FROM candidates").fetchall()]
        interviews = [row_to_dict(row) for row in conn.execute("SELECT * FROM interviews").fetchall()]

    total = len(candidates)
    by_status = {}
    by_position = {}
    tag_counts = {}
    reason_counts = {}
    for candidate in candidates:
        by_status[candidate["status"]] = by_status.get(candidate["status"], 0) + 1
        by_position[candidate["position"]] = by_position.get(candidate["position"], 0) + 1
        for tag in candidate["tags"]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    for interview in interviews:
        reason = interview.get("reason_category") or "待确认"
        reason_counts[reason] = reason_counts.get(reason, 0) + 1

    return {
        "total_candidates": total,
        "average_score": round(sum(c["match_score"] for c in candidates) / total, 1) if total else 0,
        "by_status": by_status,
        "by_position": by_position,
        "tag_counts": tag_counts,
        "reason_counts": reason_counts,
    }


@app.get("/api/reports/position/{position}", response_class=PlainTextResponse)
async def position_report(position: str):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT c.*, i.ai_summary, i.human_score, i.ai_suggestion, i.final_result, i.transcript
            FROM candidates c
            LEFT JOIN interviews i ON i.id = (
                SELECT MAX(id) FROM interviews WHERE candidate_id = c.id
            )
            WHERE c.position = ?
              AND c.status IN ('终面结束', '最终候选', '终面候选')
            ORDER BY COALESCE(i.human_score, c.match_score) DESC
            """,
            (position,),
        ).fetchall()
    candidates = []
    for row in rows:
        item = row_to_dict(row)
        candidates.append(
            {
                "name": item.get("name"),
                "status": item.get("status"),
                "score": item.get("human_score") or item.get("match_score") or 0,
                "tags": item.get("tags", [])[:4],
                "interview_summary": item.get("ai_summary") or item.get("transcript") or item.get("summary") or "",
                "suggestion": item.get("ai_suggestion") or item.get("screening_suggestion") or "",
            }
        )
    return summarize_final_report(position, candidates, 300)


@app.post("/api/messages/group-copy")
async def group_copy_message(payload: GroupMessageRequest):
    candidate = await get_candidate(payload.candidate_id)
    latest = candidate["interviews"][0] if candidate["interviews"] else {}
    content = "\n".join(
        [
            "【招聘状态同步】",
            f"岗位：{candidate['position']}",
            f"候选人：{candidate['name']}",
            f"当前状态：{candidate['status']}",
            f"评分：{latest.get('human_score') or candidate['match_score']}",
            f"摘要：{latest.get('ai_summary') or candidate.get('summary') or '待补充'}",
            f"下一步：{payload.next_action}",
        ]
    )
    return {"content": content}


@app.post("/api/demo/seed")
async def seed_demo_data():
    position = "售前解决方案顾问"
    with get_conn() as conn:
        conn.execute("DELETE FROM interviews")
        conn.execute("DELETE FROM candidates")
        for name, score, tags, interview_summary in DEMO_CANDIDATES:
            parsed = {
                "name": name,
                "position": position,
                "phone_masked": "138****0000",
                "email_masked": f"{name}***@example.com",
                "education": "本科",
                "school": "示例大学",
                "work_years": "3年",
                "status": "终面候选" if score >= 85 else "待定",
                "match_score": score - 3,
                "tags": tags,
                "risk_points": ["暂无明显风险"] if score >= 82 else ["部分能力仍需复核"],
                "summary": f"{name}与{position}岗位匹配度较高。",
                "screening_suggestion": "建议进入终面",
            }
            cursor = conn.execute(
                """
                INSERT INTO candidates (
                    name, position, phone_masked, email_masked, education, school, work_years,
                    status, match_score, tags, risk_points, summary, screening_suggestion
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    parsed["name"],
                    parsed["position"],
                    parsed["phone_masked"],
                    parsed["email_masked"],
                    parsed["education"],
                    parsed["school"],
                    parsed["work_years"],
                    parsed["status"],
                    parsed["match_score"],
                    to_json(parsed["tags"]),
                    to_json(parsed["risk_points"]),
                    parsed["summary"],
                    parsed["screening_suggestion"],
                ),
            )
            ai_result = analyze_interview(interview_summary, score, position)
            conn.execute(
                """
                INSERT INTO interviews (
                    candidate_id, interviewer, interview_time, transcript, ai_summary, strengths,
                    risks, human_score, ai_suggestion, final_result, reason_category
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    cursor.lastrowid,
                    "示例面试官",
                    "2026-05-28",
                    interview_summary,
                    ai_result["ai_summary"],
                    to_json(ai_result["strengths"]),
                    to_json(ai_result["risks"]),
                    score,
                    ai_result["ai_suggestion"],
                    parsed["status"],
                    ai_result["reason_category"],
                ),
            )
    return {"message": "demo data seeded", "count": len(DEMO_CANDIDATES), "position": position}


@app.get("/api/export/candidates")
async def export_candidates():
    with get_conn() as conn:
        rows = [row_to_dict(row) for row in conn.execute("SELECT * FROM candidates ORDER BY id").fetchall()]

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["姓名", "岗位", "学历", "学校", "工作年限", "状态", "匹配度", "标签"])
    for row in rows:
        writer.writerow(
            [
                row["name"],
                row["position"],
                row["education"],
                row["school"],
                row["work_years"],
                row["status"],
                row["match_score"],
                "、".join(row["tags"]),
            ]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=candidates.csv"},
    )


if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


@app.get("/", include_in_schema=False)
@app.get("/apply", include_in_schema=False)
@app.get("/interviewer", include_in_schema=False)
async def frontend_app():
    index_path = FRONTEND_DIST / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="frontend is not built")
    return FileResponse(index_path)
