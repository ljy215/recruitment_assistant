import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as echarts from "echarts";
import {
  API_ORIGIN,
  createInterview,
  createJob,
  dashboardSummary,
  groupCopyMessage,
  listJobs,
  listCandidates,
  positionReport,
  seedDemoData,
  submitApplication,
  uploadResume,
} from "./api";
import "./styles.css";

const DEFAULT_JD = "负责客户沟通、需求分析、方案撰写与项目推进，要求表达清晰、逻辑完整。";
const APPLY_SECTIONS = [
  ["apply-info", "申请信息"],
  ["upload", "上传"],
  ["personal", "个人信息"],
  ["education", "教育背景"],
  ["internship", "实习经历"],
  ["project", "项目经历"],
  ["campus", "校园经历"],
  ["certificates", "技能证书"],
  ["language", "语言能力"],
  ["awards", "获奖经历"],
  ["self", "自我描述"],
  ["extra", "更新说明"],
  ["agreement", "授权文本"],
];
const EMPTY_REPEAT = {
  education: {
    startYear: "",
    startMonth: "",
    endYear: "",
    endMonth: "",
    school: "",
    major: "",
    degree: "",
    type: "",
    ranking: "",
    country: "",
  },
  internship: {
    startYear: "",
    startMonth: "",
    endYear: "",
    endMonth: "",
    company: "",
    role: "",
    desc: "",
  },
  project: {
    startYear: "",
    startMonth: "",
    endYear: "",
    endMonth: "",
    name: "",
    role: "",
    desc: "",
  },
  campus: {
    startYear: "",
    startMonth: "",
    endYear: "",
    endMonth: "",
    role: "",
    desc: "",
  },
  certificate: {
    date: "",
    name: "",
    no: "",
    org: "",
  },
  language: {
    type: "",
    listen: "",
    read: "",
  },
  award: {
    year: "",
    month: "",
    name: "",
    level: "",
    org: "",
  },
};

function Chart({ title, data }) {
  const chartId = useMemo(() => `chart-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    const el = document.getElementById(chartId);
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption({
      title: { text: title, textStyle: { fontSize: 14 } },
      tooltip: {},
      xAxis: { type: "category", data: Object.keys(data || {}) },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: Object.values(data || {}), itemStyle: { color: "#2563eb" } }],
      grid: { left: 36, right: 18, top: 46, bottom: 36 },
    });
    return () => chart.dispose();
  }, [chartId, data, title]);

  return <div className="chart" id={chartId} />;
}

function App() {
  const isApplyEntry = window.location.pathname === "/apply";
  const [tab, setTab] = useState("jobs");
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applicationResume, setApplicationResume] = useState(null);
  const [applicationParsed, setApplicationParsed] = useState(null);
  const [candidateFilter, setCandidateFilter] = useState("");
  const [jobForm, setJobForm] = useState({
    name: "",
    department: "",
    location: "",
    description: "",
    responsibilities: "",
    requirements: "",
  });
  const [application, setApplication] = useState({
    intended_position: "售前解决方案顾问",
    intended_city: "",
    name: "",
    english_name: "",
    phone: "",
    email: "",
    id_number: "",
    gender: "",
    birth: "",
    nationality: "",
    native_place: "",
    education: "",
    school: "",
    work_years: "",
    graduation_year: "",
    graduation_month: "",
    english_level: "",
    has_family_employee: "",
    accepts_transfer: "",
    edu_start_year: "",
    edu_start_month: "",
    edu_end_year: "",
    edu_end_month: "",
    major: "",
    education_type: "",
    ranking: "",
    school_country: "",
    internship_start_year: "",
    internship_start_month: "",
    internship_end_year: "",
    internship_end_month: "",
    internship_company: "",
    internship_role: "",
    internship_desc: "",
    project_start_year: "",
    project_start_month: "",
    project_end_year: "",
    project_end_month: "",
    project_name: "",
    project_role: "",
    project_desc: "",
    campus_start_year: "",
    campus_start_month: "",
    campus_end_year: "",
    campus_end_month: "",
    campus_role: "",
    campus_desc: "",
    certificate_date: "",
    certificate_name: "",
    certificate_no: "",
    certificate_org: "",
    language_type: "",
    language_listen: "",
    language_read: "",
    award_year: "",
    award_month: "",
    award_name: "",
    award_level: "",
    award_org: "",
    self_review: "",
    sync_resume: true,
    agreed: false,
  });
  const [repeatForms, setRepeatForms] = useState({
    education: [{ ...EMPTY_REPEAT.education }],
    internship: [],
    project: [],
    campus: [],
    certificate: [],
    language: [],
    award: [],
  });
  const [selectedId, setSelectedId] = useState("");
  const [transcript, setTranscript] = useState("候选人表达清晰，能结合项目经验说明客户需求分析和方案落地过程。技术细节回答较完整。");
  const [score, setScore] = useState(88);
  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh(positionOverride = candidateFilter) {
    const items = await listCandidates(positionOverride);
    setCandidates(items);
    if (items[0] && !items.some((item) => String(item.id) === selectedId)) {
      setSelectedId(String(items[0].id));
    }
    setDashboard(await dashboardSummary());
    return items;
  }

  useEffect(() => {
    listJobs()
      .then((items) => {
        setJobs(items);
        if (items[0]) {
          setApplication((current) => ({ ...current, intended_position: items[0].name }));
        }
      })
      .then(() => refresh())
      .catch((error) => setNotice(error.message));
  }, []);

  useEffect(() => {
    refresh().catch((error) => setNotice(error.message));
  }, [candidateFilter]);

  function getJobByName(name) {
    return jobs.find((job) => job.name === name) || jobs[0] || { name, description: DEFAULT_JD };
  }

  function jobKnowledgeText(job) {
    return [job.description, job.responsibilities, job.requirements].filter(Boolean).join("\n");
  }

  function updateJobForm(key, value) {
    setJobForm((current) => ({ ...current, [key]: value }));
  }

  function updateApplication(key, value) {
    setApplication((current) => ({ ...current, [key]: value }));
  }

  function addRepeat(type) {
    setRepeatForms((current) => ({
      ...current,
      [type]: [...current[type], { ...EMPTY_REPEAT[type] }],
    }));
  }

  function removeRepeat(type, index) {
    setRepeatForms((current) => {
      if (type === "education" && current[type].length === 1) {
        return { ...current, [type]: [{ ...EMPTY_REPEAT[type] }] };
      }
      return { ...current, [type]: current[type].filter((_, itemIndex) => itemIndex !== index) };
    });
  }

  function updateRepeat(type, index, key, value) {
    setRepeatForms((current) => ({
      ...current,
      [type]: current[type].map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      )),
    }));
  }

  function isFilled(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function mergeWhenEmpty(current, parsedValues = {}) {
    return Object.fromEntries(
      Object.entries(parsedValues).map(([key, value]) => [key, isFilled(current[key]) ? current[key] : value])
    );
  }

  function normalizeRepeatItems(type, items = []) {
    const template = EMPTY_REPEAT[type];
    return items
      .filter((item) => item && Object.values(item).some(isFilled))
      .map((item) => ({ ...template, ...item }));
  }

  function hasRepeatContent(items = []) {
    return items.some((item) => Object.values(item).some(isFilled));
  }

  async function handleCreateJob(event) {
    event.preventDefault();
    if (!jobForm.name.trim()) return setNotice("请填写岗位名称");
    await createJob(jobForm);
    const items = await listJobs();
    setJobs(items);
    setJobForm({
      name: "",
      department: "",
      location: "",
      description: "",
      responsibilities: "",
      requirements: "",
    });
    setNotice("岗位已新增，可在投递页选择该岗位");
  }

  async function handleInterview(event) {
    event.preventDefault();
    if (!selectedId) return setNotice("请先选择候选人");
    await createInterview({
      candidate_id: Number(selectedId),
      transcript,
      human_score: Number(score),
      final_result: Number(score) >= 85 ? "终面候选" : Number(score) >= 75 ? "待定" : "不通过",
    });
    await refresh();
    setNotice("面试记录已保存");
  }

  async function handleReport() {
    const selected = candidates.find((item) => String(item.id) === selectedId) || candidates[0];
    if (!selected) return setNotice("暂无候选人");
    setReport(await positionReport(selected.position));
  }

  async function handleMessage() {
    if (!selectedId) return setNotice("请先选择候选人");
    const result = await groupCopyMessage(selectedId, "请用人部门确认是否推进下一轮");
    setMessage(result.content);
    await navigator.clipboard?.writeText(result.content);
    setNotice("群同步文案已生成，支持复制到企业微信群");
  }

  async function handleSeedDemo() {
    const result = await seedDemoData();
    const items = await refresh();
    if (items[0]) setSelectedId(String(items[0].id));
    setReport(await positionReport(result.position));
    setTab("report");
    setNotice("已生成 10 名候选人演示数据和岗位汇总报告");
  }

  async function handleApplicationResume(fileValue) {
    setApplicationResume(fileValue);
    setApplicationParsed(null);
    if (!fileValue) return;
    const selectedJob = getJobByName(application.intended_position);
    const result = await uploadResume(fileValue, selectedJob.name, jobKnowledgeText(selectedJob));
    const applicationForm = result.application_form || {};
    const parsedApplication = applicationForm.application || {};
    const parsedRepeats = applicationForm.repeat_forms || {};
    setApplicationParsed(result.parsed);
    setApplication((current) => ({
      ...current,
      ...mergeWhenEmpty(current, {
        name: parsedApplication.name || result.parsed.name,
        phone: parsedApplication.phone,
        email: parsedApplication.email,
        gender: parsedApplication.gender,
        education: parsedApplication.education || result.parsed.education,
        school: parsedApplication.school || result.parsed.school,
        work_years: parsedApplication.work_years || result.parsed.work_years,
        major: parsedApplication.major,
        english_level: parsedApplication.english_level,
        self_review: parsedApplication.self_review,
      }),
    }));
    setRepeatForms((current) => ({
      ...current,
      education: normalizeRepeatItems("education", parsedRepeats.education).length
        ? normalizeRepeatItems("education", parsedRepeats.education)
        : current.education.map((item, index) => (
            index === 0
              ? {
                  ...item,
                  school: item.school || result.parsed.school,
                  degree: item.degree || result.parsed.education,
                }
              : item
          )),
      internship: hasRepeatContent(current.internship)
        ? current.internship
        : normalizeRepeatItems("internship", parsedRepeats.internship),
      project: hasRepeatContent(current.project)
        ? current.project
        : normalizeRepeatItems("project", parsedRepeats.project),
      campus: hasRepeatContent(current.campus)
        ? current.campus
        : normalizeRepeatItems("campus", parsedRepeats.campus),
      certificate: hasRepeatContent(current.certificate)
        ? current.certificate
        : normalizeRepeatItems("certificate", parsedRepeats.certificate),
      language: hasRepeatContent(current.language)
        ? current.language
        : normalizeRepeatItems("language", parsedRepeats.language),
      award: hasRepeatContent(current.award)
        ? current.award
        : normalizeRepeatItems("award", parsedRepeats.award),
    }));
    setNotice("PDF 简历已解析，请确认申请信息后投递");
  }

  async function handleApplicationSubmit(event) {
    event.preventDefault();
    if (!applicationResume) return setNotice("请上传 PDF 简历");
    if (!application.name.trim()) return setNotice("请填写姓名");
    if (!application.phone.trim()) return setNotice("请填写手机号");
    if (!application.email.trim()) return setNotice("请填写邮箱");
    if (!application.intended_city.trim()) return setNotice("请选择意向工作城市");
    const firstEducation = repeatForms.education[0] || {};
    if (!firstEducation.school.trim()) return setNotice("请填写教育背景中的学校名称");
    if (!firstEducation.major.trim()) return setNotice("请填写教育背景中的专业名称");
    if (!firstEducation.degree.trim()) return setNotice("请选择教育背景中的学历");
    if (!application.agreed) return setNotice("请先阅读并同意隐私协议和招聘隐私政策");
    const created = await submitApplication({
      ...application,
      resume: applicationResume,
      application,
      repeatForms,
    });
    setSelectedId(String(created.id));
    setCandidateFilter("");
    await refresh("");
    setNotice("投递成功，候选人页面已更新");
    setApplicationResume(null);
    setApplicationParsed(null);
    setNotice("投递成功，HR 后台候选人页面已更新");
  }

  if (isApplyEntry) {
    return (
      <main className="apply-page">
        <section className="content">
          {notice && <div className="notice">{notice}</div>}
          <div className="apply-shell">
            <form onSubmit={handleApplicationSubmit} className="apply-form moka-form">
              <div className="apply-main">
                <div className="form-column">
                  <section id="apply-info" className="moka-section">
                    <h3>申请信息</h3>
                    <div className="form-grid">
                      <label>
                        意向岗位 <em>*</em>
                        <select
                          value={application.intended_position}
                          onChange={(event) => {
                            const selectedJob = getJobByName(event.target.value);
                            setApplication((current) => ({ ...current, intended_position: selectedJob.name }));
                          }}
                        >
                          {jobs.map((job) => (
                            <option value={job.name} key={job.id}>{job.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        意向工作城市 <em>*</em>
                        <select value={application.intended_city} onChange={(event) => updateApplication("intended_city", event.target.value)}>
                          <option value="">选择意向工作城市</option>
                          <option>杭州</option>
                          <option>上海</option>
                          <option>北京</option>
                          <option>重庆</option>
                        </select>
                      </label>
                    </div>
                  </section>

                  <section id="upload" className="moka-section">
                    <h3>上传</h3>
                    <label className="upload-block">
                      上传简历 <em>*</em>
                      <input type="file" accept=".pdf" onChange={(event) => handleApplicationResume(event.target.files?.[0])} />
                      <span className="upload-name">{applicationResume?.name || "请选择 PDF 简历"}</span>
                    </label>
                    <p className="hint">支持 pdf 格式。上传附件后，会自动解析、填充申请表信息。</p>
                    <label className="upload-block muted">
                      上传附件
                      <input type="file" />
                      <span className="upload-name">上传</span>
                    </label>
                    <p className="hint">支持文档、图片、压缩包、视频、音频等格式文件。上传单个文件容量不超过 300 MB。</p>
                  </section>

                  <section id="personal" className="moka-section">
                    <h3>个人信息</h3>
                    <div className="form-grid">
                      <label>姓名 <em>*</em><input value={application.name} onChange={(e) => updateApplication("name", e.target.value)} /></label>
                      <label>英文名<input placeholder="英文名" value={application.english_name} onChange={(e) => updateApplication("english_name", e.target.value)} /></label>
                      <label className="phone-row">手机号码 <em>*</em><div className="phone-input"><select defaultValue="+86"><option>+86</option></select><input value={application.phone} onChange={(e) => updateApplication("phone", e.target.value)} /></div></label>
                      <label>邮箱 <em>*</em><input value={application.email} onChange={(e) => updateApplication("email", e.target.value)} /></label>
                      <label>证件号码 <em>*</em><input placeholder="身份证" value={application.id_number} onChange={(e) => updateApplication("id_number", e.target.value)} /></label>
                      <label>性别 <em>*</em><select value={application.gender} onChange={(e) => updateApplication("gender", e.target.value)}><option value="">请选择</option><option>男</option><option>女</option></select></label>
                      <label>出生日期（年龄）<input placeholder="2000-02（26岁）" value={application.birth} onChange={(e) => updateApplication("birth", e.target.value)} /></label>
                      <label>国家/地区<input placeholder="请输入国家/地区" value={application.nationality} onChange={(e) => updateApplication("nationality", e.target.value)} /></label>
                      <label>籍贯<select value={application.native_place} onChange={(e) => updateApplication("native_place", e.target.value)}><option value="">请输入籍贯</option><option>中国</option></select></label>
                      <label>最高学历 <em>*</em><select value={application.education} onChange={(e) => updateApplication("education", e.target.value)}><option value="">请选择</option><option>大专</option><option>本科</option><option>硕士</option><option>博士</option></select></label>
                      <label>毕业时间 <em>*</em><div className="split-row"><select value={application.graduation_year} onChange={(e) => updateApplication("graduation_year", e.target.value)}><option value="">年</option><option>2026</option><option>2027</option></select><select value={application.graduation_month} onChange={(e) => updateApplication("graduation_month", e.target.value)}><option value="">月</option><option>6</option><option>7</option></select></div></label>
                      <label>英语水平 <em>*</em><select value={application.english_level} onChange={(e) => updateApplication("english_level", e.target.value)}><option value="">请选择</option><option>CET-4</option><option>CET-6</option><option>IELTS</option><option>TOEFL</option></select></label>
                      <label>是否有亲属在吉利控股集团任职 <em>*</em><select value={application.has_family_employee} onChange={(e) => updateApplication("has_family_employee", e.target.value)}><option value="">请选择</option><option>否</option><option>是</option></select></label>
                      <label>是否服从调配<select value={application.accepts_transfer} onChange={(e) => updateApplication("accepts_transfer", e.target.value)}><option value="">请选择</option><option>是</option><option>否</option></select></label>
                    </div>
                  </section>

                  <section id="education" className="moka-section">
                    <div className="section-title"><h3>教育背景</h3><button type="button" onClick={() => addRepeat("education")}>+ 添加</button></div>
                    {repeatForms.education.map((item, index) => (
                      <div className="repeat-card" key={`education-${index}`}>
                        <button className="delete-row" type="button" onClick={() => removeRepeat("education", index)}>删除本条</button>
                        <div className="form-grid">
                          <label>就读时间 <em>*</em><div className="date-range"><select value={item.startYear} onChange={(e) => updateRepeat("education", index, "startYear", e.target.value)}><option value="">年</option><option>2019</option><option>2020</option><option>2024</option></select><select value={item.startMonth} onChange={(e) => updateRepeat("education", index, "startMonth", e.target.value)}><option value="">月</option><option>6</option><option>9</option></select><span>-</span><select value={item.endYear} onChange={(e) => updateRepeat("education", index, "endYear", e.target.value)}><option value="">年</option><option>2023</option><option>2027</option></select><select value={item.endMonth} onChange={(e) => updateRepeat("education", index, "endMonth", e.target.value)}><option value="">月</option><option>6</option><option>7</option></select></div></label>
                          <label>学校名称 <em>*</em><input value={item.school} onChange={(e) => updateRepeat("education", index, "school", e.target.value)} /></label>
                          <label>专业名称 <em>*</em><input value={item.major} onChange={(e) => updateRepeat("education", index, "major", e.target.value)} /></label>
                          <label>学历 <em>*</em><select value={item.degree} onChange={(e) => updateRepeat("education", index, "degree", e.target.value)}><option value="">请选择</option><option>本科</option><option>硕士</option></select></label>
                          <label>学历类型 <em>*</em><select value={item.type} onChange={(e) => updateRepeat("education", index, "type", e.target.value)}><option value="">请选择</option><option>全日制</option><option>非全日制</option></select></label>
                          <label>成绩排名 <em>*</em><select value={item.ranking} onChange={(e) => updateRepeat("education", index, "ranking", e.target.value)}><option value="">请选择</option><option>前10%</option><option>前30%</option><option>前50%</option></select></label>
                          <label>学校所在 国家/地区 <em>*</em><select value={item.country} onChange={(e) => updateRepeat("education", index, "country", e.target.value)}><option value="">请选择</option><option>中国</option><option>海外</option></select></label>
                        </div>
                      </div>
                    ))}
                  </section>

                  <section id="internship" className="moka-section">
                    <div className="section-title"><h3>实习经历</h3><button type="button" onClick={() => addRepeat("internship")}>+ 添加</button></div>
                    {repeatForms.internship.map((item, index) => (
                      <div className="repeat-card" key={`internship-${index}`}>
                        <button className="delete-row" type="button" onClick={() => removeRepeat("internship", index)}>删除本条</button>
                        <div className="form-grid">
                          <label>起止时间<div className="date-range"><select value={item.startYear} onChange={(e) => updateRepeat("internship", index, "startYear", e.target.value)}><option value="">年</option><option>2024</option><option>2025</option></select><select value={item.startMonth} onChange={(e) => updateRepeat("internship", index, "startMonth", e.target.value)}><option value="">月</option><option>1</option><option>7</option></select><span>-</span><select value={item.endYear} onChange={(e) => updateRepeat("internship", index, "endYear", e.target.value)}><option value="">年</option><option>2025</option><option>2026</option></select><select value={item.endMonth} onChange={(e) => updateRepeat("internship", index, "endMonth", e.target.value)}><option value="">月</option><option>6</option><option>12</option></select></div></label>
                          <label>公司名称<input placeholder="公司名称" value={item.company} onChange={(e) => updateRepeat("internship", index, "company", e.target.value)} /></label>
                          <label>职位名称<input placeholder="职位名称" value={item.role} onChange={(e) => updateRepeat("internship", index, "role", e.target.value)} /></label>
                          <label className="wide-field">工作职责<textarea placeholder="内容" value={item.desc} onChange={(e) => updateRepeat("internship", index, "desc", e.target.value)} /></label>
                        </div>
                      </div>
                    ))}
                    {repeatForms.internship.length === 0 && <p className="optional-empty">可选填写，点击“+ 添加”补充实习经历。</p>}
                  </section>

                  <section id="project" className="moka-section">
                    <div className="section-title"><h3>项目经历</h3><button type="button" onClick={() => addRepeat("project")}>+ 添加</button></div>
                    {repeatForms.project.map((item, index) => (
                      <div className="repeat-card" key={`project-${index}`}>
                        <button className="delete-row" type="button" onClick={() => removeRepeat("project", index)}>删除本条</button>
                        <div className="form-grid">
                          <label>项目时间<div className="date-range"><select value={item.startYear} onChange={(e) => updateRepeat("project", index, "startYear", e.target.value)}><option value="">年</option><option>2024</option><option>2025</option></select><select value={item.startMonth} onChange={(e) => updateRepeat("project", index, "startMonth", e.target.value)}><option value="">月</option><option>1</option><option>9</option></select><span>-</span><select value={item.endYear} onChange={(e) => updateRepeat("project", index, "endYear", e.target.value)}><option value="">年</option><option>2025</option><option>2026</option></select><select value={item.endMonth} onChange={(e) => updateRepeat("project", index, "endMonth", e.target.value)}><option value="">月</option><option>6</option><option>12</option></select></div></label>
                          <label>项目名称<input placeholder="项目名称" value={item.name} onChange={(e) => updateRepeat("project", index, "name", e.target.value)} /></label>
                          <label>项目角色<input placeholder="项目角色" value={item.role} onChange={(e) => updateRepeat("project", index, "role", e.target.value)} /></label>
                          <label className="wide-field">项目经历信息<textarea placeholder="请填写项目背景、职责、成果等" value={item.desc} onChange={(e) => updateRepeat("project", index, "desc", e.target.value)} /></label>
                        </div>
                      </div>
                    ))}
                    {repeatForms.project.length === 0 && <p className="optional-empty">可选填写，点击“+ 添加”补充项目经历。</p>}
                  </section>

                  <section id="campus" className="moka-section">
                    <div className="section-title"><h3>校园经历</h3><button type="button" onClick={() => addRepeat("campus")}>+ 添加</button></div>
                    {repeatForms.campus.map((item, index) => (
                      <div className="repeat-card" key={`campus-${index}`}>
                        <button className="delete-row" type="button" onClick={() => removeRepeat("campus", index)}>删除本条</button>
                        <div className="form-grid">
                          <label>开始时间<div className="split-row"><select value={item.startYear} onChange={(e) => updateRepeat("campus", index, "startYear", e.target.value)}><option value="">年</option><option>2023</option><option>2024</option></select><select value={item.startMonth} onChange={(e) => updateRepeat("campus", index, "startMonth", e.target.value)}><option value="">月</option><option>3</option><option>9</option></select></div></label>
                          <label>结束时间<div className="split-row"><select value={item.endYear} onChange={(e) => updateRepeat("campus", index, "endYear", e.target.value)}><option value="">年</option><option>2025</option><option>2026</option></select><select value={item.endMonth} onChange={(e) => updateRepeat("campus", index, "endMonth", e.target.value)}><option value="">月</option><option>6</option><option>12</option></select></div></label>
                          <label>校内任职职务<input placeholder="校内任职职务" value={item.role} onChange={(e) => updateRepeat("campus", index, "role", e.target.value)} /></label>
                          <label className="wide-field">校园经历信息<textarea value={item.desc} onChange={(e) => updateRepeat("campus", index, "desc", e.target.value)} /></label>
                        </div>
                        <p className="hint">建议不超过4000字</p>
                      </div>
                    ))}
                    {repeatForms.campus.length === 0 && <p className="optional-empty">可选填写，点击“+ 添加”补充校园经历。</p>}
                  </section>

                  <section id="certificates" className="moka-section">
                    <div className="section-title"><h3>技能证书</h3><button type="button" onClick={() => addRepeat("certificate")}>+ 添加</button></div>
                    {repeatForms.certificate.map((item, index) => (
                      <div className="repeat-card" key={`certificate-${index}`}>
                        <button className="delete-row" type="button" onClick={() => removeRepeat("certificate", index)}>删除本条</button>
                        <div className="form-grid">
                          <label>发证日期<input placeholder="日期（年月日）" value={item.date} onChange={(e) => updateRepeat("certificate", index, "date", e.target.value)} /></label>
                          <label>证书名称<input placeholder="证书名称" value={item.name} onChange={(e) => updateRepeat("certificate", index, "name", e.target.value)} /></label>
                          <label>证书编号<input placeholder="证书编号" value={item.no} onChange={(e) => updateRepeat("certificate", index, "no", e.target.value)} /></label>
                          <label>发证机构<input placeholder="发证机构" value={item.org} onChange={(e) => updateRepeat("certificate", index, "org", e.target.value)} /></label>
                        </div>
                      </div>
                    ))}
                    {repeatForms.certificate.length === 0 && <p className="optional-empty">可选填写，点击“+ 添加”补充技能证书。</p>}
                  </section>

                  <section id="language" className="moka-section">
                    <div className="section-title"><h3>语言能力</h3><button type="button" onClick={() => addRepeat("language")}>+ 添加</button></div>
                    {repeatForms.language.map((item, index) => (
                      <div className="repeat-card" key={`language-${index}`}>
                        <button className="delete-row" type="button" onClick={() => removeRepeat("language", index)}>删除本条</button>
                        <div className="form-grid">
                          <label>语言类型<input placeholder="语言类型" value={item.type} onChange={(e) => updateRepeat("language", index, "type", e.target.value)} /></label>
                          <label>听说<select value={item.listen} onChange={(e) => updateRepeat("language", index, "listen", e.target.value)}><option value="">请选择</option><option>一般</option><option>熟练</option><option>精通</option></select></label>
                          <label>读写<select value={item.read} onChange={(e) => updateRepeat("language", index, "read", e.target.value)}><option value="">请选择</option><option>一般</option><option>熟练</option><option>精通</option></select></label>
                        </div>
                      </div>
                    ))}
                    {repeatForms.language.length === 0 && <p className="optional-empty">可选填写，点击“+ 添加”补充语言能力。</p>}
                  </section>

                  <section id="awards" className="moka-section">
                    <div className="section-title"><h3>获奖经历</h3><button type="button" onClick={() => addRepeat("award")}>+ 添加</button></div>
                    {repeatForms.award.map((item, index) => (
                      <div className="repeat-card" key={`award-${index}`}>
                        <button className="delete-row" type="button" onClick={() => removeRepeat("award", index)}>删除本条</button>
                        <div className="form-grid">
                          <label>获奖时间<div className="split-row"><select value={item.year} onChange={(e) => updateRepeat("award", index, "year", e.target.value)}><option value="">年</option><option>2023</option><option>2024</option></select><select value={item.month} onChange={(e) => updateRepeat("award", index, "month", e.target.value)}><option value="">月</option><option>5</option><option>12</option></select></div></label>
                          <label>奖项名称<input placeholder="奖项名称" value={item.name} onChange={(e) => updateRepeat("award", index, "name", e.target.value)} /></label>
                          <label>奖项级别<select value={item.level} onChange={(e) => updateRepeat("award", index, "level", e.target.value)}><option value="">请选择</option><option>校级</option><option>省级</option><option>国家级</option></select></label>
                          <label>颁奖单位<input placeholder="颁奖单位" value={item.org} onChange={(e) => updateRepeat("award", index, "org", e.target.value)} /></label>
                        </div>
                      </div>
                    ))}
                    {repeatForms.award.length === 0 && <p className="optional-empty">可选填写，点击“+ 添加”补充获奖经历。</p>}
                  </section>

                  <section id="self" className="moka-section">
                    <h3>自我描述</h3>
                    <label className="wide-field">自我评价<textarea value={application.self_review} onChange={(e) => updateApplication("self_review", e.target.value)} /></label>
                    <p className="hint">建议不超过1000字</p>
                  </section>

                  <section id="extra" className="moka-section">
                    <h3>更新说明</h3>
                    <label className="check-line"><input type="checkbox" checked={application.sync_resume} onChange={(e) => updateApplication("sync_resume", e.target.checked)} /> 同步更新在线简历</label>
                  </section>

                  <section id="agreement" className="moka-section">
                    <h3>授权文本</h3>
                    <label className="check-line"><input type="checkbox" checked={application.agreed} onChange={(e) => updateApplication("agreed", e.target.checked)} /> 我已阅读并同意《隐私协议》和《招聘隐私政策》</label>
                  </section>

                  <footer className="apply-footer">
                    <button type="submit">投递</button>
                  </footer>
                </div>

                <nav className="apply-toc">
                  {APPLY_SECTIONS.map(([id, label], index) => (
                    <a href={`#${id}`} className={index === 0 ? "active" : ""} key={id}>{label}</a>
                  ))}
                </nav>
              </div>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <aside>
        <h1>AI 招聘提效</h1>
        {["jobs", "candidates", "interview", "dashboard", "report"].map((key) => (
          <button className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)}>
            {({ jobs: "岗位管理", candidates: "候选人", interview: "面试反馈", dashboard: "数据看板", report: "报告同步" })[key]}
          </button>
        ))}
      </aside>

      <section className="content">
        {notice && <div className="notice">{notice}</div>}

        {tab === "jobs" && (
          <div className="panel">
            <h2>岗位管理</h2>
            <form onSubmit={handleCreateJob} className="grid">
              <label>
                岗位名称
                <input value={jobForm.name} onChange={(e) => updateJobForm("name", e.target.value)} placeholder="例如：AI 应用工程师" />
              </label>
              <label>
                所属部门
                <input value={jobForm.department} onChange={(e) => updateJobForm("department", e.target.value)} placeholder="例如：AI 平台部" />
              </label>
              <label>
                工作地点
                <input value={jobForm.location} onChange={(e) => updateJobForm("location", e.target.value)} placeholder="例如：杭州" />
              </label>
              <label>
                岗位概述
                <input value={jobForm.description} onChange={(e) => updateJobForm("description", e.target.value)} placeholder="一句话说明岗位定位" />
              </label>
              <label className="wide">
                岗位职责
                <textarea value={jobForm.responsibilities} onChange={(e) => updateJobForm("responsibilities", e.target.value)} placeholder="填写该岗位日常负责事项、产出和协作对象" />
              </label>
              <label className="wide">
                岗位要求
                <textarea value={jobForm.requirements} onChange={(e) => updateJobForm("requirements", e.target.value)} placeholder="填写技能、经验、学历、能力等要求" />
              </label>
              <button type="submit">新增岗位</button>
            </form>
            <table>
              <thead>
                <tr><th>岗位</th><th>部门</th><th>地点</th><th>状态</th><th>岗位要求</th></tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.name}</td>
                    <td>{job.department || "待补充"}</td>
                    <td>{job.location || "待补充"}</td>
                    <td>{job.status}</td>
                    <td>{job.requirements || job.description || "待补充"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "candidates" && (
          <div className="panel">
            <h2>候选人列表</h2>
            <div className="actions">
              <label className="inline-filter">
                在招岗位
                <select value={candidateFilter} onChange={(event) => setCandidateFilter(event.target.value)}>
                  <option value="">全部岗位</option>
                  {jobs.map((job) => (
                    <option value={job.name} key={job.id}>{job.name}</option>
                  ))}
                </select>
              </label>
              <button onClick={() => window.open(`${API_ORIGIN}/api/export/candidates`, "_blank")}>
                导出 CSV
              </button>
            </div>
            <table>
              <thead>
                <tr><th>姓名</th><th>岗位</th><th>状态</th><th>评分</th><th>标签</th></tr>
              </thead>
              <tbody>
                {candidates.map((item) => (
                  <tr key={item.id} onClick={() => setSelectedId(String(item.id))} className={String(item.id) === selectedId ? "selected" : ""}>
                    <td>{item.name}</td>
                    <td>{item.position}</td>
                    <td>{item.status}</td>
                    <td>{item.match_score}</td>
                    <td>{item.tags.join("、")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "interview" && (
          <div className="panel">
            <h2>面试反馈</h2>
            <form onSubmit={handleInterview} className="grid">
              <label>
                候选人
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {candidates.map((item) => <option value={item.id} key={item.id}>{item.name} - {item.position}</option>)}
                </select>
              </label>
              <label>
                面试官评分
                <input type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} />
              </label>
              <label className="wide">
                腾讯会议纪要
                <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} />
              </label>
              <button type="submit">保存面试分析</button>
            </form>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="panel">
            <h2>数据看板</h2>
            <div className="metrics">
              <strong>候选人总数：{dashboard?.total_candidates ?? 0}</strong>
              <strong>平均匹配分：{dashboard?.average_score ?? 0}</strong>
            </div>
            <div className="charts">
              <Chart title="状态分布" data={dashboard?.by_status || {}} />
              <Chart title="岗位分布" data={dashboard?.by_position || {}} />
              <Chart title="标签分布" data={dashboard?.tag_counts || {}} />
              <Chart title="原因统计" data={dashboard?.reason_counts || {}} />
            </div>
          </div>
        )}

        {tab === "report" && (
          <div className="panel">
            <h2>岗位报告与群同步</h2>
            <div className="actions">
              <button onClick={handleSeedDemo}>生成 10 人演示数据</button>
              <button onClick={handleReport}>生成岗位 Markdown 报告</button>
              <button onClick={handleMessage}>生成群同步文案</button>
            </div>
            {report && <textarea className="output" value={report} readOnly />}
            {message && <textarea className="output small" value={message} readOnly />}
          </div>
        )}
      </section>
    </main>
  );
}

const rootEl = document.getElementById("root");
window.__AI_RECRUITMENT_ROOT__ ||= createRoot(rootEl);
window.__AI_RECRUITMENT_ROOT__.render(<App />);
