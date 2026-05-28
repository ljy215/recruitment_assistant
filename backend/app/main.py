import csv
import io
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel

from .ai_mock import analyze_interview, extract_resume_info
from .storage import get_conn, init_db, row_to_dict, to_json


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


class InterviewCreate(BaseModel):
    candidate_id: int
    interviewer: str = ""
    interview_time: str = ""
    transcript: str
    human_score: int
    final_result: str = "待定"


class GroupMessageRequest(BaseModel):
    candidate_id: int
    next_action: str = "请相关同学确认下一步安排"


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


@app.on_event("startup")
def startup() -> None:
    init_db()


def read_upload_text(file: UploadFile) -> str:
    raw = file.file.read()
    suffix = Path(file.filename or "").suffix.lower()
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


@app.post("/api/resumes/upload")
async def upload_resume(
    file: UploadFile = File(...),
    position: str = Form(...),
    job_description: str = Form(""),
):
    text = read_upload_text(file)
    parsed = extract_resume_info(text, position, job_description)
    return {"filename": file.filename, "resume_text": text[:3000], "parsed": parsed}


@app.post("/api/ai/parse-resume")
async def parse_resume(payload: dict):
    text = payload.get("resume_text", "")
    position = payload.get("position", "")
    job_description = payload.get("job_description", "")
    return extract_resume_info(text, position, job_description)


@app.post("/api/candidates")
async def create_candidate(candidate: CandidateCreate):
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO candidates (
                name, position, phone_masked, email_masked, education, school, work_years,
                status, match_score, tags, risk_points, summary, screening_suggestion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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


@app.patch("/api/candidates/{candidate_id}")
async def update_candidate(candidate_id: int, payload: dict):
    allowed = {"status", "match_score", "summary", "screening_suggestion"}
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


@app.post("/api/ai/analyze-interview")
async def ai_analyze_interview(payload: InterviewCreate):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM candidates WHERE id = ?", (payload.candidate_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="candidate not found")
        candidate = row_to_dict(row)
    return analyze_interview(payload.transcript, payload.human_score, candidate["position"])


@app.post("/api/interviews")
async def create_interview(payload: InterviewCreate):
    with get_conn() as conn:
        candidate_row = conn.execute("SELECT * FROM candidates WHERE id = ?", (payload.candidate_id,)).fetchone()
        if not candidate_row:
            raise HTTPException(status_code=404, detail="candidate not found")
        candidate = row_to_dict(candidate_row)
        ai_result = analyze_interview(payload.transcript, payload.human_score, candidate["position"])
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
                to_json(ai_result["strengths"]),
                to_json(ai_result["risks"]),
                payload.human_score,
                ai_result["ai_suggestion"],
                payload.final_result,
                ai_result["reason_category"],
            ),
        )
        conn.execute(
            "UPDATE candidates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (payload.final_result, payload.candidate_id),
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
            SELECT c.*, i.ai_summary, i.human_score, i.ai_suggestion, i.final_result
            FROM candidates c
            LEFT JOIN interviews i ON i.id = (
                SELECT MAX(id) FROM interviews WHERE candidate_id = c.id
            )
            WHERE c.position = ?
            ORDER BY COALESCE(i.human_score, c.match_score) DESC
            LIMIT 10
            """,
            (position,),
        ).fetchall()
    lines = [
        f"# {position}最终候选人筛选报告",
        "",
        "| 排名 | 姓名 | 核心背景 | 面试表现摘要 | 优势标签 | 风险点 | 综合评分 | 建议 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for index, row in enumerate(rows, start=1):
        item = row_to_dict(row)
        score = item.get("human_score") or item.get("match_score") or 0
        background = f"{item.get('education') or '待补充'}，{item.get('work_years') or '待补充'}"
        summary = item.get("ai_summary") or item.get("summary") or "待补充面试记录"
        lines.append(
            f"| {index} | {item['name']} | {background} | {summary[:32]} | "
            f"{'、'.join(item['tags'][:3])} | {'、'.join(item['risk_points'][:2])} | "
            f"{score} | {item.get('ai_suggestion') or item.get('screening_suggestion') or '待定'} |"
        )
    return "\n".join(lines)


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
