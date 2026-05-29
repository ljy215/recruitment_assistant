import re


DEFAULT_NAMES = ["张三", "李四", "王五", "赵六", "陈晨", "刘洋", "周敏", "孙悦", "吴迪", "郑可"]
SECTION_TITLES = {
    "education": ["教育背景", "教育经历", "学习经历"],
    "internship": ["实习经历", "工作经历", "实习经验"],
    "project": ["项目经历", "项目经验"],
    "campus": ["校园经历", "社团经历", "学生工作"],
    "certificate": ["技能证书", "证书", "资格证书"],
    "language": ["语言能力", "语言水平"],
    "award": ["获奖经历", "荣誉奖励", "获奖情况"],
    "self": ["自我评价", "自我描述", "个人评价"],
    "skills": ["相关技能", "专业技能", "技能特长", "技能清单"],
}


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
    first_line_match = re.search(r"^\s*([\u4e00-\u9fa5]{2,4})(?=\s+(?:意向|电话|邮箱|男|女)|\s*$)", normalize_text(text))
    if first_line_match:
        return first_line_match.group(1)
    for name in DEFAULT_NAMES:
        if name in text:
            return name
    return "待补充"


def find_first(patterns: list[str], text: str, default: str = "") -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1).strip()
    return default


def normalize_text(text: str) -> str:
    return re.sub(r"\r\n?", "\n", text or "")


def split_lines(text: str) -> list[str]:
    return [line.strip() for line in normalize_text(text).splitlines() if line.strip()]


def get_section(text: str, key: str) -> str:
    titles = SECTION_TITLES[key]
    all_titles = [title for values in SECTION_TITLES.values() for title in values]
    title_pattern = "|".join(re.escape(title) for title in titles)
    next_pattern = "|".join(re.escape(title) for title in all_titles if title not in titles)
    match = re.search(rf"(?:^|\n)\s*(?:{title_pattern})\s*[:：]?\s*\n(?P<body>.*?)(?=\n\s*(?:{next_pattern})\s*[:：]?\s*\n|$)", normalize_text(text), re.S)
    return match.group("body").strip() if match else ""


def split_entries(section_text: str) -> list[str]:
    lines = split_lines(section_text)
    if not lines:
        return []
    entries: list[list[str]] = []
    current: list[str] = []
    date_pattern = re.compile(r"(?:20\d{2}|19\d{2})[./年-]?\s*(?:\d{1,2})?.{0,8}(?:-|至|—|~).{0,8}(?:20\d{2}|19\d{2}|至今)")
    for line in lines:
        starts_entry = bool(date_pattern.search(line)) or bool(re.match(r"^\d+[.、)]", line))
        if starts_entry and current:
            entries.append(current)
            current = []
        current.append(line)
    if current:
        entries.append(current)
    return ["\n".join(entry) for entry in entries]


def parse_date_range(text: str) -> dict:
    dates = re.findall(r"(20\d{2}|19\d{2})[./年-]?\s*(\d{1,2})?", text)
    result = {"startYear": "", "startMonth": "", "endYear": "", "endMonth": ""}
    if dates:
        result["startYear"] = dates[0][0]
        result["startMonth"] = dates[0][1]
    if len(dates) > 1:
        result["endYear"] = dates[1][0]
        result["endMonth"] = dates[1][1]
    return result


def infer_school(text: str) -> str:
    return find_first([r"([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,30}(?:大学|学院|学校))"], text)


def infer_major(text: str) -> str:
    return find_first([r"(?:专业|专业名称)[:：\s]*([\u4e00-\u9fa5A-Za-z0-9+\- ]{2,30})", r"(软件工程|计算机科学与技术|人工智能|数据科学|市场营销|工商管理)"], text)


def infer_degree(text: str) -> str:
    for degree in ["博士", "硕士", "本科", "大专"]:
        if degree in text:
            return degree
    return ""


def infer_company(text: str) -> str:
    return find_first([r"([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,30}(?:公司|集团|科技|有限公司))"], text)


def infer_entry_title(entry: str) -> str:
    first_line = split_lines(entry)[0] if split_lines(entry) else ""
    title = re.sub(r"^(?:20\d{2}|19\d{2})[./年-]?\s*\d{0,2}\s*(?:-|至|—|~)\s*(?:20\d{2}|19\d{2}|至今)?[./年-]?\s*\d{0,2}\s*", "", first_line)
    title = re.sub(r"^(?:个人项目|团队项目|项目名称|项目)[:：\s]*", "", title).strip()
    return title[:40]


def parse_education_entries(text: str) -> list[dict]:
    section = get_section(text, "education")
    entries = split_entries(section) or ([section] if section else [])
    parsed = []
    for entry in entries:
        if not entry.strip():
            continue
        parsed.append({
            **parse_date_range(entry),
            "school": infer_school(entry),
            "major": infer_major(entry),
            "degree": infer_degree(entry),
            "type": "全日制" if "全日制" in entry else "",
            "ranking": find_first([r"(前\s*\d+%|前\d+%)"], entry),
            "country": "中国" if "中国" in entry or infer_school(entry) else "",
        })
    return parsed


def parse_experience_entries(text: str, key: str) -> list[dict]:
    section = get_section(text, key)
    entries = split_entries(section)
    parsed = []
    for entry in entries:
        if key == "project":
            name = find_first([r"(?:项目名称)[:：\s]*([^\n，,]{2,40})"], entry) or infer_entry_title(entry)
            role = find_first([r"(?:项目角色|角色|职责)[:：\s]*([^\n，,]{2,30})"], entry)
            parsed.append({**parse_date_range(entry), "name": name, "role": role, "desc": entry[:500]})
        elif key == "campus":
            role = find_first([r"(?:职务|职位|担任)[:：\s]*([^\n，,]{2,30})"], entry)
            parsed.append({**parse_date_range(entry), "role": role, "desc": entry[:500]})
        else:
            company = infer_company(entry)
            role = find_first([r"(?:职位|岗位|职务)[:：\s]*([^\n，,]{2,30})"], entry)
            parsed.append({**parse_date_range(entry), "company": company, "role": role, "desc": entry[:500]})
    return parsed


def parse_certificates(text: str) -> list[dict]:
    section = get_section(text, "certificate")
    entries = split_entries(section) or split_lines(section)
    return [
        {
            "date": find_first([r"((?:20\d{2}|19\d{2})[./年-]?\s*\d{0,2})"], entry),
            "name": find_first([r"(?:证书名称|证书)[:：\s]*([^\n，,]{2,40})"], entry, entry[:40]),
            "no": find_first([r"(?:编号|证书编号)[:：\s]*([A-Za-z0-9-]{3,40})"], entry),
            "org": find_first([r"(?:机构|发证机构)[:：\s]*([^\n，,]{2,40})"], entry),
        }
        for entry in entries if entry.strip()
    ]


def parse_languages(text: str) -> list[dict]:
    section = get_section(text, "language")
    source = section or text
    languages = []
    for lang in ["英语", "日语", "法语", "德语"]:
        if lang in source:
            languages.append({"type": lang, "listen": "熟练" if "熟练" in source else "", "read": "熟练" if "熟练" in source else ""})
    if "CET-6" in source:
        languages.append({"type": "英语 CET-6", "listen": "熟练", "read": "熟练"})
    elif "CET-4" in source:
        languages.append({"type": "英语 CET-4", "listen": "熟练", "read": "熟练"})
    return languages


def parse_awards(text: str) -> list[dict]:
    section = get_section(text, "award")
    entries = split_entries(section) or split_lines(section)
    parsed = []
    for entry in entries:
        dates = parse_date_range(entry)
        parsed.append({
            "year": dates["startYear"],
            "month": dates["startMonth"],
            "name": find_first([r"(?:奖项名称|奖项|获得)[:：\s]*([^\n，,]{2,40})"], entry, entry[:40]),
            "level": find_first([r"(国家级|省级|市级|校级|院级)"], entry),
            "org": find_first([r"(?:颁奖单位|颁发单位)[:：\s]*([^\n，,]{2,40})"], entry),
        })
    return [item for item in parsed if item["name"]]


def parse_application_resume(text: str, position: str, job_description: str) -> dict:
    base = extract_resume_info(text, position, job_description)
    plain = normalize_text(text)
    email = find_first([r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})"], plain)
    phone = find_first([r"(1[3-9]\d{9})"], plain)
    gender = find_first([r"(?:性别)[:：\s]*(男|女)", r"\b(男|女)\b"], plain)
    education_entries = parse_education_entries(plain)
    if not education_entries and (base["school"] != "待补充" or base["education"] != "待补充"):
        education_entries = [{
            "startYear": "",
            "startMonth": "",
            "endYear": "",
            "endMonth": "",
            "school": "" if base["school"] == "待补充" else base["school"],
            "major": infer_major(plain),
            "degree": "" if base["education"] == "待补充" else base["education"],
            "type": "",
            "ranking": "",
            "country": "中国" if base["school"] != "待补充" else "",
        }]

    return {
        "application": {
            "name": "" if base["name"] == "待补充" else base["name"],
            "phone": phone,
            "email": email,
            "gender": gender,
            "education": "" if base["education"] == "待补充" else base["education"],
            "school": "" if base["school"] == "待补充" else base["school"],
            "work_years": "" if base["work_years"] == "待补充" else base["work_years"],
            "major": infer_major(plain),
            "english_level": "CET-6" if "CET-6" in plain else "CET-4" if "CET-4" in plain else "",
            "self_review": get_section(plain, "self")[:1000],
        },
        "repeat_forms": {
            "education": education_entries,
            "internship": parse_experience_entries(plain, "internship"),
            "project": parse_experience_entries(plain, "project"),
            "campus": parse_experience_entries(plain, "campus"),
            "certificate": parse_certificates(plain),
            "language": parse_languages(plain),
            "award": parse_awards(plain),
        },
    }


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
