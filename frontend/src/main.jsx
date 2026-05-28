import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as echarts from "echarts";
import {
  createCandidate,
  createInterview,
  dashboardSummary,
  groupCopyMessage,
  listCandidates,
  positionReport,
  seedDemoData,
  uploadResume,
} from "./api";
import "./styles.css";

const DEFAULT_JD = "负责客户沟通、需求分析、方案撰写与项目推进，要求表达清晰、逻辑完整。";

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
  const [tab, setTab] = useState("upload");
  const [candidates, setCandidates] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [file, setFile] = useState(null);
  const [position, setPosition] = useState("售前解决方案顾问");
  const [jobDescription, setJobDescription] = useState(DEFAULT_JD);
  const [selectedId, setSelectedId] = useState("");
  const [transcript, setTranscript] = useState("候选人表达清晰，能结合项目经验说明客户需求分析和方案落地过程。技术细节回答较完整。");
  const [score, setScore] = useState(88);
  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const items = await listCandidates();
    setCandidates(items);
    if (items[0] && !items.some((item) => String(item.id) === selectedId)) {
      setSelectedId(String(items[0].id));
    }
    setDashboard(await dashboardSummary());
    return items;
  }

  useEffect(() => {
    refresh().catch((error) => setNotice(error.message));
  }, []);

  async function handleUpload(event) {
    event.preventDefault();
    if (!file) return setNotice("请先选择简历文件");
    const result = await uploadResume(file, position, jobDescription);
    setParsed(result.parsed);
    setNotice("AI 解析完成，请确认后入库");
  }

  async function handleCreateCandidate() {
    if (!parsed) return;
    const item = await createCandidate(parsed);
    setSelectedId(String(item.id));
    setParsed(null);
    await refresh();
    setNotice("候选人已入库");
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

  return (
    <main>
      <aside>
        <h1>AI 招聘提效</h1>
        {["upload", "candidates", "interview", "dashboard", "report"].map((key) => (
          <button className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)}>
            {({ upload: "简历录入", candidates: "候选人", interview: "面试反馈", dashboard: "数据看板", report: "报告同步" })[key]}
          </button>
        ))}
      </aside>

      <section className="content">
        {notice && <div className="notice">{notice}</div>}

        {tab === "upload" && (
          <div className="panel">
            <h2>候选人录入</h2>
            <form onSubmit={handleUpload} className="grid">
              <label>
                简历文件
                <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0])} />
              </label>
              <label>
                岗位
                <input value={position} onChange={(e) => setPosition(e.target.value)} />
              </label>
              <label className="wide">
                岗位 JD
                <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
              </label>
              <button type="submit">AI 解析</button>
            </form>
            {parsed && (
              <div className="result">
                <h3>解析结果</h3>
                <pre>{JSON.stringify(parsed, null, 2)}</pre>
                <button onClick={handleCreateCandidate}>确认入库</button>
              </div>
            )}
          </div>
        )}

        {tab === "candidates" && (
          <div className="panel">
            <h2>候选人列表</h2>
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

createRoot(document.getElementById("root")).render(<App />);
