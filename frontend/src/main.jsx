import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as echarts from "echarts";
import {
  API_ORIGIN,
  advanceCandidate,
  createInterview,
  createJob,
  deleteJob,
  dashboardSummary,
  getCandidate,
  interviewerSchedule,
  listInterviewers,
  listJobs,
  listCandidates,
  positionReport,
  seedDemoData,
  submitApplication,
  summarizeRecording,
  updateCandidate,
  updateJob,
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
const DEFAULT_INTERVIEWERS = ["张敏", "王磊", "陈晨", "刘洋"];

function isInterviewingStatus(status = "") {
  return String(status).includes("面中");
}

const APPLICATION_LABELS = {
  name: "姓名",
  phone: "电话",
  email: "邮箱",
  gender: "性别",
  education: "最高学历",
  school: "学校",
  work_years: "工作年限",
  major: "专业",
  english_level: "英语水平",
  self_review: "自我评价",
};

const EXPERIENCE_LABELS = {
  education: "教育背景",
  internship: "实习经历",
  project: "项目经历",
  campus: "校园经历",
  certificate: "技能证书",
  language: "语言能力",
  award: "获奖经历",
};

const FIELD_LABELS = {
  startYear: "开始年",
  startMonth: "开始月",
  endYear: "结束年",
  endMonth: "结束月",
  school: "学校",
  major: "专业",
  degree: "学历",
  type: "类型",
  ranking: "排名",
  country: "国家/地区",
  company: "公司",
  role: "角色",
  desc: "描述",
  name: "名称",
  date: "日期",
  no: "编号",
  org: "机构",
  listen: "听说能力",
  read: "读写能力",
  level: "级别",
};

function formatPeriod(item = {}) {
  const start = [item.startYear, item.startMonth].filter(Boolean).join(".");
  const end = [item.endYear, item.endMonth].filter(Boolean).join(".");
  if (start || end) return `${start || "待补充"} - ${end || "至今"}`;
  return item.date || [item.year, item.month].filter(Boolean).join(".") || "";
}

function renderValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("、");
  if (value && typeof value === "object") return Object.values(value).filter(Boolean).join(" / ");
  return value || "";
}

function StructuredResume({ detail }) {
  const applicationData = detail?.application_data || {};
  const application = applicationData.application || applicationData || {};
  const repeatForms = applicationData.repeat_forms || applicationData.repeatForms || {};
  const filledApplication = Object.entries(APPLICATION_LABELS)
    .map(([key, label]) => [label, renderValue(application[key])])
    .filter(([, value]) => value);
  const hasStructured = filledApplication.length || Object.values(repeatForms).some((items) => Array.isArray(items) && items.length);

  if (!hasStructured) {
    return (
      <div className="resume-text-card">
        <h3>简历文本</h3>
        <p>{detail.resume_text || "暂无简历文本。"}</p>
      </div>
    );
  }

  return (
    <div className="structured-resume">
      <section className="resume-section">
        <h3>申请信息</h3>
        <div className="info-list">
          {filledApplication.map(([label, value]) => (
            <div className="info-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>
      {Object.entries(EXPERIENCE_LABELS).map(([key, title]) => {
        const items = Array.isArray(repeatForms[key]) ? repeatForms[key].filter((item) => Object.values(item || {}).some(Boolean)) : [];
        if (!items.length) return null;
        return (
          <section className="resume-section" key={key}>
            <h3>{title}</h3>
            <div className="timeline-list">
              {items.map((item, index) => {
                const heading = item.school || item.company || item.name || item.role || `${title} ${index + 1}`;
                const sub = item.major || item.degree || item.type || item.level || item.org || "";
                const period = formatPeriod(item);
                const details = Object.entries(item)
                  .filter(([field, value]) => !["school", "company", "name", "role", "major", "degree", "type", "level", "org", "startYear", "startMonth", "endYear", "endMonth", "year", "month", "date"].includes(field) && renderValue(value))
                  .map(([field, value]) => [FIELD_LABELS[field] || field, renderValue(value)]);
                return (
                  <article className="timeline-item" key={`${key}-${index}`}>
                    <div>
                      <strong>{heading}</strong>
                      {sub && <span>{sub}</span>}
                    </div>
                    {period && <em>{period}</em>}
                    {details.map(([label, value]) => (
                      <p key={label}><b>{label}：</b>{value}</p>
                    ))}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

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

function InterviewerPage() {
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [score, setScore] = useState(88);
  const [tags, setTags] = useState("");
  const [transcript, setTranscript] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);

  async function refreshInterviews() {
    const items = (await listCandidates()).filter((item) => isInterviewingStatus(item.status));
    setCandidates(items);
    setSelectedId((current) => (items.some((item) => String(item.id) === current) ? current : String(items[0]?.id || "")));
    return items;
  }

  useEffect(() => {
    refreshInterviews().catch((error) => setNotice(error.message));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    getCandidate(selectedId)
      .then((item) => {
        setDetail(item);
        const draft = JSON.parse(localStorage.getItem(`interview-draft-${item.id}`) || "{}");
        setScore(draft.score ?? item.match_score ?? 88);
        setTags(draft.tags ?? (item.tags || []).join("、"));
        setTranscript(draft.transcript ?? item.interviews?.[0]?.transcript ?? "");
      })
      .catch((error) => setNotice(error.message));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    localStorage.setItem(`interview-draft-${selectedId}`, JSON.stringify({ score, tags, transcript }));
  }, [score, selectedId, tags, transcript]);

  async function handleRecording(file) {
    if (!file || !selectedId) return;
    setUploading(true);
    try {
      const result = await summarizeRecording(selectedId, file);
      setTranscript(result.summary || result.transcript || "");
      setNotice("录音/纪要已解析并精炼");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!detail) return setNotice("请先选择面试候选人");
    const tagItems = tags.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean);
    const result = await createInterview({
      candidate_id: Number(detail.id),
      interviewer: "面试官",
      transcript,
      human_score: Number(score),
      tags: tagItems,
    });
    localStorage.setItem(`interview-draft-${detail.id}`, JSON.stringify({ score, tags, transcript, saved: true }));
    setNotice(`面试反馈已保存，候选人状态更新为${result.final_result}`);
    await refreshInterviews();
  }

  const resumeUrl = detail?.resume_available || detail?.resume_path ? `${API_ORIGIN}/api/candidates/${detail.id}/resume` : "";

  return (
    <main className="interviewer-page">
      <section className="interviewer-shell">
        <header className="interviewer-header">
          <div>
            <h1>面试官工作台</h1>
            <p>查看候选人信息、简历预览、录音精炼并提交面试反馈。</p>
          </div>
          <a href="/">返回 HR 后台</a>
        </header>
        {notice && <div className="notice">{notice}</div>}
        <div className="interviewer-layout">
          <section className="interviewer-card">
            <h2>面试人员</h2>
            <div className="interviewer-list">
              {candidates.map((item) => (
                <button
                  type="button"
                  className={String(item.id) === selectedId ? "active" : ""}
                  onClick={() => setSelectedId(String(item.id))}
                  key={item.id}
                >
                  <strong>{item.name}</strong>
                  <span>{item.position} · {item.status}</span>
                </button>
              ))}
              {!candidates.length && <p className="empty-note">暂无面试中的候选人。</p>}
            </div>
          </section>

          <section className="interviewer-card resume-preview">
            <h2>候选人信息与简历预览</h2>
            {detail ? (
              <>
                <div className="profile-grid">
                  <span>姓名<strong>{detail.name}</strong></span>
                  <span>岗位<strong>{detail.position}</strong></span>
                  <span>学历<strong>{detail.education || "待补充"}</strong></span>
                  <span>学校<strong>{detail.school || "待补充"}</strong></span>
                  <span>状态<strong>{detail.status}</strong></span>
                  <span>当前评分<strong>{detail.match_score}</strong></span>
                </div>
                {resumeUrl ? (
                  <div className="resume-download-panel">
                    <strong>{detail.resume_filename || "候选人简历.pdf"}</strong>
                    <a href={resumeUrl} target="_blank" rel="noreferrer" download>
                      下载简历 PDF
                    </a>
                  </div>
                ) : (
                  <p className="empty-note">暂无可下载的 PDF 简历。</p>
                )}
              </>
            ) : (
              <p className="empty-note">请选择面试人员。</p>
            )}
          </section>

          {detail && (
            <form className="interviewer-card interviewer-feedback" onSubmit={handleSubmit}>
              <h2>面试反馈</h2>
              <label>
                上传录音/纪要
                <input type="file" accept="audio/*,.txt,.md,.docx,.pdf" onChange={(event) => handleRecording(event.target.files?.[0])} />
              </label>
              {uploading && <p className="hint">正在解析并精炼...</p>}
              <label>
                面试评分
                <input type="number" min="0" max="100" value={score} onChange={(event) => setScore(event.target.value)} />
              </label>
              <label>
                添加标签
                <textarea value={tags} onChange={(event) => setTags(event.target.value)} placeholder="例如：表达清晰、项目经验匹配、风险需复核" />
              </label>
              <label>
                精炼纪要
                <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="上传录音/纪要后自动填充，也可手动填写。" />
              </label>
              <button type="submit">保存并结束本轮面试</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function App() {
  const isApplyEntry = window.location.pathname === "/apply";
  const isInterviewerEntry = window.location.pathname === "/interviewer";
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
    interview_rounds: 3,
    status: "招聘中",
  });
  const [editingJobId, setEditingJobId] = useState("");
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
  const [interviewTags, setInterviewTags] = useState("表达清晰、技术扎实、项目经验匹配");
  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState("");
  const [reportPosition, setReportPosition] = useState("");
  const [notice, setNotice] = useState("");
  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState(null);
  const [interviewers, setInterviewers] = useState(DEFAULT_INTERVIEWERS);
  const [schedule, setSchedule] = useState(null);
  const [advanceForm, setAdvanceForm] = useState({ interviewer: DEFAULT_INTERVIEWERS[0], interview_time: "", note: "" });
  const [transferForm, setTransferForm] = useState({ job_id: "", note: "" });
  const [candidateColumnWidths, setCandidateColumnWidths] = useState({
    name: 120,
    position: 170,
    status: 110,
    score: 80,
    tags: 260,
    suggestion: 380,
    action: 170,
  });

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
          setReportPosition((current) => current || items[0].name);
        }
      })
      .then(() => refresh())
      .catch((error) => setNotice(error.message));
  }, []);

  useEffect(() => {
    listInterviewers()
      .then((items) => {
        const names = items.map((item) => item.name);
        if (names.length) {
          setInterviewers(names);
          setAdvanceForm((current) => ({ ...current, interviewer: current.interviewer || names[0] }));
        }
      })
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

  const interviewCandidates = useMemo(
    () => candidates.filter((item) => isInterviewingStatus(item.status)),
    [candidates]
  );
  const selectedInterviewCandidate = interviewCandidates.find((item) => String(item.id) === selectedId) || interviewCandidates[0];

  function startColumnResize(key, event, direction = 1) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = candidateColumnWidths[key];
    function onMove(moveEvent) {
      const minWidth = key === "action" ? 120 : 72;
      const nextWidth = Math.max(minWidth, startWidth + (moveEvent.clientX - startX) * direction);
      setCandidateColumnWidths((current) => ({ ...current, [key]: nextWidth }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function ResizableTh({ columnKey, children, className = "" }) {
    const isAction = columnKey === "action";
    const resizeFromLeft = isAction || columnKey === "suggestion";
    return (
      <th className={`resizable-th ${className}`} style={{ width: candidateColumnWidths[columnKey] }}>
        <span>{children}</span>
        <i
          className={`resize-handle ${resizeFromLeft ? "resize-handle-left" : ""}`}
          onMouseDown={(event) => startColumnResize(columnKey, event, resizeFromLeft ? -1 : 1)}
        />
      </th>
    );
  }

  async function handleCreateJob(event) {
    event.preventDefault();
    if (!jobForm.name.trim()) return setNotice("请填写岗位名称");
    const saved = editingJobId ? await updateJob(editingJobId, jobForm) : await createJob(jobForm);
    const items = await listJobs();
    setJobs(items);
    setJobForm({
      name: "",
      department: "",
      location: "",
      description: "",
      responsibilities: "",
      requirements: "",
      interview_rounds: 3,
      status: "招聘中",
    });
    setEditingJobId("");
    setNotice(`岗位已${editingJobId ? "更新" : "新增"}，RAG 知识库已构建（${saved.rag_document_count || items.length} 个岗位文档）`);
  }

  function startEditJob(job) {
    setEditingJobId(job.id);
    setJobForm({
      name: job.name || "",
      department: job.department || "",
      location: job.location || "",
      description: job.description || "",
      responsibilities: job.responsibilities || "",
      requirements: job.requirements || "",
      interview_rounds: job.interview_rounds || 3,
      status: job.status || "招聘中",
    });
    setNotice(`正在编辑岗位：${job.name}`);
  }

  function cancelEditJob() {
    setEditingJobId("");
    setJobForm({
      name: "",
      department: "",
      location: "",
      description: "",
      responsibilities: "",
      requirements: "",
      interview_rounds: 3,
      status: "招聘中",
    });
  }

  async function handleDeleteJob(job) {
    if (!window.confirm(`确认删除岗位「${job.name}」吗？删除后会同步更新 RAG 知识库。`)) return;
    const result = await deleteJob(job.id);
    const items = await listJobs();
    setJobs(items);
    if (editingJobId === job.id) cancelEditJob();
    setNotice(`岗位已删除，RAG 知识库已构建（${result.rag_document_count || items.length} 个岗位文档）`);
  }

  async function handleInterview(event) {
    event.preventDefault();
    if (!selectedInterviewCandidate) return setNotice("只有一面中、二面中、三面中的候选人才可以填写面试反馈");
    const tags = interviewTags.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean);
    const result = await createInterview({
      candidate_id: Number(selectedInterviewCandidate.id),
      transcript,
      human_score: Number(score),
      tags,
    });
    await refresh();
    setNotice(`面试反馈已保存，候选人评分和标签已更新，状态为${result.final_result}`);
  }

  async function handleReport() {
    if (!reportPosition) return setNotice("请先选择岗位");
    const content = await positionReport(reportPosition);
    setReport(content);
    setNotice("岗位终面报告已生成");
  }

  function nextStatusLabel(status, position = "") {
    const roundLabels = ["一", "二", "三", "四", "五"];
    const totalRounds = Number(getJobByName(position)?.interview_rounds || 3);
    for (let index = 0; index < roundLabels.length; index += 1) {
      const label = roundLabels[index];
      if (status === `${label}面结束` || status === `${label}面中`) {
        return index + 1 >= totalRounds ? "成为最终候选" : `进入${roundLabels[index + 1]}面`;
      }
      if (status === `${label}面待安排`) return `开始${label}面`;
    }
    const transitions = {
      已投递: "进入一面",
      待初筛: "进入一面",
      待定: "进入一面",
    };
    return transitions[status] || "进入一面";
  }

  function openAdvanceModal(candidate) {
    setAdvanceTarget(candidate);
    setActionMenuOpenId(null);
    const interviewer = interviewers[0] || DEFAULT_INTERVIEWERS[0];
    setAdvanceForm({
      interviewer,
      interview_time: "",
      note: `${candidate.name} 当前状态为${candidate.status}，下一步：${nextStatusLabel(candidate.status, candidate.position)}。`,
    });
  }

  function toggleActionMenu(candidateId, event) {
    event.stopPropagation();
    setActionMenuOpenId((current) => (current === candidateId ? null : candidateId));
  }

  function openTransferModal(candidate, event) {
    event.stopPropagation();
    const targetJob = jobs.find((job) => job.name !== candidate.position) || jobs[0];
    setActionMenuOpenId(null);
    setTransferTarget(candidate);
    setTransferForm({
      job_id: targetJob?.id || "",
      note: targetJob ? `建议推送至${targetJob.department || "其他部门"}的${targetJob.name}。` : "",
    });
  }

  async function handleCandidateStatusAction(candidate, status, event) {
    event.stopPropagation();
    setActionMenuOpenId(null);
    const updated = await updateCandidate(candidate.id, { status });
    setSelectedId(String(updated.id));
    await refresh();
    setNotice(`${updated.name} 状态已更新为${status}`);
  }

  async function handleTransferSubmit(event) {
    event.preventDefault();
    if (!transferTarget) return;
    const targetJob = jobs.find((job) => job.id === transferForm.job_id);
    if (!targetJob) return setNotice("请选择要推送的目标部门/岗位");
    const suggestion = [
      `推送至其他部门：建议推送至${targetJob.department || "其他部门"} - ${targetJob.name}。`,
      transferForm.note,
    ].filter(Boolean).join(" ");
    const updated = await updateCandidate(transferTarget.id, {
      position: targetJob.name,
      status: "推送至其他部门",
      screening_suggestion: suggestion,
    });
    setTransferTarget(null);
    setSelectedId(String(updated.id));
    await refresh("");
    setNotice(`${updated.name} 已推送至${targetJob.department || "其他部门"} - ${targetJob.name}`);
  }

  useEffect(() => {
    if (!advanceTarget || !advanceForm.interviewer) return;
    interviewerSchedule(advanceForm.interviewer)
      .then((data) => {
        setSchedule(data);
        setAdvanceForm((current) => {
          const stillAvailable = data.days.some((day) => day.slots.some((slot) => slot.time === current.interview_time && !slot.busy));
          return stillAvailable ? current : { ...current, interview_time: "" };
        });
      })
      .catch((error) => setNotice(error.message));
  }, [advanceTarget, advanceForm.interviewer]);

  async function handleAdvanceSubmit(event) {
    event.preventDefault();
    if (!advanceTarget) return;
    if (!advanceForm.interviewer.trim()) return setNotice("请选择面试官");
    if (!advanceForm.interview_time) return setNotice("请选择一个空闲面试时间");
    const updated = await advanceCandidate(advanceTarget.id, advanceForm);
    setAdvanceTarget(null);
    setSelectedId(String(updated.id));
    await refresh();
    setNotice(`${updated.name} 已推进至 ${updated.status}`);
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

  if (isInterviewerEntry) {
    return <InterviewerPage />;
  }

  return (
    <main>
      <aside>
        <h1>AI 招聘提效</h1>
        {["jobs", "candidates", "interview", "dashboard", "report"].map((key) => (
          <button className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)}>
            {({ jobs: "岗位管理", candidates: "候选人", interview: "面试反馈", dashboard: "数据看板", report: "报告生成" })[key]}
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
              <label>
                招聘状态
                <select value={jobForm.status} onChange={(e) => updateJobForm("status", e.target.value)}>
                  <option>招聘中</option>
                  <option>暂停招聘</option>
                  <option>已关闭</option>
                </select>
              </label>
              <label>
                面试轮次
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={jobForm.interview_rounds}
                  onChange={(e) => updateJobForm("interview_rounds", Number(e.target.value))}
                />
              </label>
              <label className="wide">
                岗位职责
                <textarea value={jobForm.responsibilities} onChange={(e) => updateJobForm("responsibilities", e.target.value)} placeholder="填写该岗位日常负责事项、产出和协作对象" />
              </label>
              <label className="wide">
                岗位要求
                <textarea value={jobForm.requirements} onChange={(e) => updateJobForm("requirements", e.target.value)} placeholder="填写技能、经验、学历、能力等要求" />
              </label>
              <div className="form-actions">
                <button type="submit">{editingJobId ? "保存更新" : "新增岗位"}</button>
                {editingJobId && <button type="button" className="secondary" onClick={cancelEditJob}>取消编辑</button>}
              </div>
            </form>
            <table>
              <thead>
                <tr><th>岗位</th><th>部门</th><th>地点</th><th>轮次</th><th>状态</th><th>岗位要求</th><th>操作</th></tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.name}</td>
                    <td>{job.department || "待补充"}</td>
                    <td>{job.location || "待补充"}</td>
                    <td>{job.interview_rounds || 3} 轮</td>
                    <td>{job.status}</td>
                    <td>{job.requirements || job.description || "待补充"}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" onClick={() => startEditJob(job)}>编辑</button>
                        <button type="button" className="secondary danger" onClick={() => handleDeleteJob(job)}>删除</button>
                      </div>
                    </td>
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
            <div className="table-scroll">
              <table className="candidate-table">
                <colgroup>
                  {["name", "position", "status", "score", "tags", "suggestion", "action"].map((key) => (
                    <col key={key} style={{ width: candidateColumnWidths[key] }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <ResizableTh columnKey="name">姓名</ResizableTh>
                    <ResizableTh columnKey="position">岗位</ResizableTh>
                    <ResizableTh columnKey="status">状态</ResizableTh>
                    <ResizableTh columnKey="score">评分</ResizableTh>
                    <ResizableTh columnKey="tags">标签</ResizableTh>
                    <ResizableTh columnKey="suggestion">AI 初筛建议</ResizableTh>
                    <ResizableTh columnKey="action" className="sticky-action">操作</ResizableTh>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((item) => (
                    <tr key={item.id} onClick={() => setSelectedId(String(item.id))} className={String(item.id) === selectedId ? "selected" : ""}>
                      <td>{item.name}</td>
                      <td>{item.position}</td>
                      <td>{item.status}</td>
                      <td>{item.match_score}</td>
                      <td>{item.tags.join("、")}</td>
                      <td className="suggestion-cell">{item.screening_suggestion || "待 AI 初筛"}</td>
                      <td className={`action-cell sticky-action ${actionMenuOpenId === item.id ? "menu-open" : ""}`}>
                        <div className="split-action">
                          <button type="button" className="split-action-main" onClick={(event) => { event.stopPropagation(); openAdvanceModal(item); }}>
                            推进下一步
                          </button>
                          <button
                            type="button"
                            className="split-action-arrow"
                            aria-label={`${item.name} 更多操作`}
                            onClick={(event) => toggleActionMenu(item.id, event)}
                          >
                            ▾
                          </button>
                          {actionMenuOpenId === item.id && (
                            <div className="split-action-menu">
                              <button type="button" onClick={(event) => openTransferModal(item, event)}>推送至其他部门</button>
                              <button type="button" onClick={(event) => handleCandidateStatusAction(item, "流程结束", event)}>流程结束</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "interview" && (
          <div className="panel interview-panel">
            <h2>面试反馈</h2>
            <div className="interview-workbench">
              <div className="interview-list">
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
                </div>
                <div className="table-scroll">
                  <table className="interview-table">
                    <thead>
                      <tr><th>姓名</th><th>岗位</th><th>状态</th><th>当前评分</th><th>标签</th></tr>
                    </thead>
                    <tbody>
                      {interviewCandidates.map((item) => (
                        <tr key={item.id} onClick={() => setSelectedId(String(item.id))} className={String(item.id) === selectedId ? "selected" : ""}>
                          <td>{item.name}</td>
                          <td>{item.position}</td>
                          <td>{item.status}</td>
                          <td>{item.match_score}</td>
                          <td>{item.tags.join("、") || "待填写"}</td>
                        </tr>
                      ))}
                      {!interviewCandidates.length && (
                        <tr>
                          <td colSpan="5" className="empty-cell">暂无面试中的候选人，请先在候选人页推进到一面中、二面中或三面中。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {selectedInterviewCandidate && (
                <form onSubmit={handleInterview} className="interview-form">
                  <div className="form-summary">
                    <span>当前候选人</span>
                    <strong>{`${selectedInterviewCandidate.name} - ${selectedInterviewCandidate.position}`}</strong>
                  </div>
                  <label>
                    候选人
                    <select value={String(selectedInterviewCandidate.id)} onChange={(e) => setSelectedId(e.target.value)}>
                      {interviewCandidates.map((item) => <option value={item.id} key={item.id}>{item.name} - {item.position}</option>)}
                    </select>
                  </label>
                  <label>
                    面试官评分
                    <input type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} />
                  </label>
                  <label>
                    面试官标签
                    <textarea
                      value={interviewTags}
                      onChange={(e) => setInterviewTags(e.target.value)}
                      placeholder="例如：表达清晰、技术扎实、项目经验匹配"
                    />
                  </label>
                  <label>
                    腾讯会议纪要
                    <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} />
                  </label>
                  <button type="submit">保存面试反馈</button>
                </form>
              )}
            </div>
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
            <h2>岗位终面报告</h2>
            <div className="actions">
              <label className="inline-filter">
                选择岗位
                <select value={reportPosition} onChange={(event) => setReportPosition(event.target.value)}>
                  {jobs.map((job) => (
                    <option value={job.name} key={job.id}>{job.name}</option>
                  ))}
                </select>
              </label>
              <button onClick={handleReport}>生成报告</button>
            </div>
            {report && <textarea className="output" value={report} readOnly />}
          </div>
        )}
      </section>
      {advanceTarget && (
        <div className="modal-backdrop" onClick={() => setAdvanceTarget(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>推进下一步</h2>
            <p className="modal-copy">
              {advanceTarget.name} 当前状态为 <strong>{advanceTarget.status}</strong>，下一步将{nextStatusLabel(advanceTarget.status, advanceTarget.position)}。
            </p>
            <form onSubmit={handleAdvanceSubmit} className="grid">
              <label>
                选择面试官
                <select value={advanceForm.interviewer} onChange={(event) => setAdvanceForm((current) => ({ ...current, interviewer: event.target.value, interview_time: "" }))}>
                  {interviewers.map((item) => <option value={item} key={item}>{item}</option>)}
                </select>
              </label>
              <div className="wide schedule-board">
                <div className="schedule-head">
                  <strong>{advanceForm.interviewer} 本周排班</strong>
                  <span>{schedule ? `${schedule.week_start} 至 ${schedule.week_end}` : "加载中"}</span>
                </div>
                <div className="schedule-grid">
                  {schedule?.days.map((day) => (
                    <div className="schedule-day" key={day.date}>
                      <strong>{day.weekday}</strong>
                      <span>{day.date.slice(5)}</span>
                      {day.slots.map((slot) => (
                        <button
                          type="button"
                          className={`slot ${slot.busy ? "busy" : ""} ${advanceForm.interview_time === slot.time ? "selected" : ""}`}
                          disabled={slot.busy}
                          onClick={() => setAdvanceForm((current) => ({ ...current, interview_time: slot.time }))}
                          title={slot.reason || "空闲"}
                          key={slot.time}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="schedule-tip">
                  {advanceForm.interview_time ? `已选择：${advanceForm.interview_time}` : "请选择一个空闲时间安排面试。灰色为已占用。"}
                </p>
              </div>
              <label className="wide">
                备注
                <textarea value={advanceForm.note} onChange={(event) => setAdvanceForm((current) => ({ ...current, note: event.target.value }))} />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setAdvanceTarget(null)}>取消</button>
                <button type="submit">确认推进</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {transferTarget && (
        <div className="modal-backdrop" onClick={() => setTransferTarget(null)}>
          <div className="modal small-modal" onClick={(event) => event.stopPropagation()}>
            <h2>推送至其他部门</h2>
            <p className="modal-copy">
              {transferTarget.name} 当前投递岗位为 <strong>{transferTarget.position}</strong>，请选择要推送的目标部门/岗位。
            </p>
            <form onSubmit={handleTransferSubmit} className="grid">
              <label className="wide">
                目标部门/岗位
                <select
                  value={transferForm.job_id}
                  onChange={(event) => {
                    const targetJob = jobs.find((job) => job.id === event.target.value);
                    setTransferForm((current) => ({
                      ...current,
                      job_id: event.target.value,
                      note: targetJob ? `建议推送至${targetJob.department || "其他部门"}的${targetJob.name}。` : current.note,
                    }));
                  }}
                >
                  <option value="">请选择目标部门/岗位</option>
                  {jobs.map((job) => (
                    <option value={job.id} key={job.id}>
                      {(job.department || "其他部门")} - {job.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                推送备注
                <textarea value={transferForm.note} onChange={(event) => setTransferForm((current) => ({ ...current, note: event.target.value }))} />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setTransferTarget(null)}>取消</button>
                <button type="submit">确认推送</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

const rootEl = document.getElementById("root");
window.__AI_RECRUITMENT_ROOT__ ||= createRoot(rootEl);
window.__AI_RECRUITMENT_ROOT__.render(<App />);
