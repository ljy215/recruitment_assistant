import re


DEFAULT_NAMES = ["张三", "李四", "王五", "赵六", "陈晨", "刘洋", "周敏", "孙悦", "吴迪", "郑可"]


def mask_phone(text: str) -> str:
    match = re.search(r"1[3-9]\d{9}", text)
    if not match:
        return "待补充"
    phone = match.group(0)
    return f"{phone[:3]}****{phone[-4:]}"


def mask_email(text: str) -> str:
    match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
    if not match:
        return "待补充"
    email = match.group(0)
    name, domain = email.split("@", 1)
    return f"{name[:2]}***@{domain}"


def infer_name(text: str) -> str:
    name_match = re.search(r"(?:姓名|候选人)[:：\s]*([\u4e00-\u9fa5]{2,4})", text)
    if name_match:
        return name_match.group(1)
    for name in DEFAULT_NAMES:
        if name in text:
            return name
    return "待补充"


def extract_resume_info(text: str, position: str, job_description: str) -> dict:
    combined = f"{text}\n{job_description}"
    skills = []
    skill_map = ["Python", "Java", "React", "Vue", "项目管理", "客户沟通", "数据分析", "方案撰写", "销售", "SQL"]
    for skill in skill_map:
        if skill.lower() in combined.lower():
            skills.append(skill)

    if not skills:
        skills = ["沟通表达", "学习能力"]

    work_years = "待补充"
    year_match = re.search(r"(\d+)\s*年", text)
    if year_match:
        work_years = f"{year_match.group(1)}年"

    education = "待补充"
    for level in ["博士", "硕士", "本科", "大专"]:
        if level in text:
            education = level
            break

    school = "待补充"
    school_match = re.search(r"([\u4e00-\u9fa5]{2,20}(?:大学|学院))", text)
    if school_match:
        school = school_match.group(1)

    match_score = min(95, 65 + len(skills) * 5)
    tags = skills[:3]
    risk_points = []
    if education == "待补充":
        risk_points.append("学历信息待确认")
    if work_years == "待补充":
        risk_points.append("工作年限待确认")
    if not risk_points:
        risk_points.append("暂无明显风险")

    return {
        "name": infer_name(text),
        "position": position,
        "phone_masked": mask_phone(text),
        "email_masked": mask_email(text),
        "education": education,
        "school": school,
        "work_years": work_years,
        "status": "待初筛",
        "match_score": match_score,
        "tags": tags,
        "risk_points": risk_points,
        "summary": f"候选人与{position}岗位具备一定匹配度，重点能力为{ '、'.join(tags) }。",
        "screening_suggestion": "建议进入面试" if match_score >= 75 else "建议人工复核",
    }


def analyze_interview(transcript: str, human_score: int, position: str) -> dict:
    text = transcript.strip()
    summary = text[:60] + ("..." if len(text) > 60 else "")
    strengths = []
    if any(word in text for word in ["清晰", "逻辑", "表达", "沟通"]):
        strengths.append("沟通表达清晰")
    if any(word in text for word in ["项目", "落地", "经验", "负责"]):
        strengths.append("项目经验可验证")
    if any(word in text for word in ["技术", "系统", "架构", "数据"]):
        strengths.append("专业能力匹配")
    if not strengths:
        strengths.append("基础表现稳定")

    risks = []
    if any(word in text for word in ["不足", "欠缺", "一般", "不熟"]):
        risks.append("部分能力仍需复核")
    if human_score < 70:
        risks.append("人工评分偏低")
    if not risks:
        risks.append("暂无明显风险")

    ai_suggestion = "优先推进" if human_score >= 85 else "可进入终面" if human_score >= 75 else "待定"
    if human_score < 65:
        ai_suggestion = "不建议推进"

    return {
        "ai_summary": f"{position}面试表现：{summary or '纪要较短，建议补充面试记录。'}",
        "strengths": strengths[:3],
        "risks": risks[:2],
        "ai_suggestion": ai_suggestion,
        "reason_category": "能力匹配" if human_score >= 75 else "能力待确认",
    }
