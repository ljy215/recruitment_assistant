# AI 招聘提效 Demo

面向 HR 招聘流程的 AI 应用 Demo，围绕“手动记录招聘数据、跟踪状态、整理面试反馈成本高”的痛点，提供面试者投递、简历解析、AI 初筛、候选人管理、面试官反馈、排班推进、数据看板和岗位候选人报告生成能力。

## 在线预览

- HR 后台：[http://43.139.250.199/](http://43.139.250.199/)
- 面试者投递入口：[http://43.139.250.199/apply](http://43.139.250.199/apply)
- 面试官工作台：[http://43.139.250.199/interviewer](http://43.139.250.199/interviewer)

## 核心功能

- 面试者独立投递入口：填写申请信息，上传 PDF 简历，提交后进入候选人库。
- 简历解析：PDF 文本抽取使用本地规则完成，避免基础字段解析消耗大模型费用。
- AI 初筛：基于候选人简历信息和岗位 JD/RAG 知识库，生成匹配分、标签、风险点和初筛建议。
- 岗位管理：支持新增、更新、删除岗位，岗位职责、要求和面试轮次入库。
- RAG 自动构建：岗位内容变更后自动重建岗位知识索引。
- 候选人管理：支持岗位筛选、状态推进、选择面试官和近 5 个工作日空闲时间。
- 面试官工作台：查看面试人员、预览 PDF 原简历或结构化简历、上传纪要、填写评分和标签。
- 数据看板：使用 ECharts 展示招聘状态、岗位分布、标签和原因统计。
- 报告生成：选择岗位后，使用大模型精简输出终面候选人报告，不超过 300 字。

## 技术方案

```text
React + Vite + ECharts
        |
        | REST API
        v
FastAPI Backend
        |
        +-- SQLite：岗位、候选人、面试记录
        +-- 本地 PDF 解析：pypdf
        +-- RAG 索引：岗位 JD -> data/job_rag_index.json
        +-- LangChain / OpenAI-compatible API：简历匹配与报告精简
```

### 前端

- `frontend/src/main.jsx`：HR 后台、投递入口、面试官入口。
- `frontend/src/api.js`：统一封装后端 API。
- `frontend/src/styles.css`：页面样式。
- ECharts 用于招聘数据可视化。

### 后端

- `backend/app/main.py`：FastAPI 路由、文件上传、候选人状态流转、报告接口。
- `backend/app/storage.py`：SQLite 初始化和 JSON 字段转换。
- `backend/app/rag_index.py`：岗位 RAG 索引构建。
- `backend/app/matching_agent.py`：大模型 Agent 匹配分析、报告精简、纪要精炼。
- `backend/app/ai_mock.py`：本地规则解析与降级能力。

## 大模型接入方式

项目使用 OpenAI-compatible 调用方式，可接入阿里云百炼等兼容接口。当前线上使用阿里云百炼 API 服务，模型名为 `deepseek-v4-flash`。

配置环境变量：

```powershell
$env:RECRUITMENT_LLM_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
$env:RECRUITMENT_LLM_API_KEY="你的 API Key"
$env:RECRUITMENT_LLM_MODEL="deepseek-v4-flash"
```

Linux/systemd 部署时写入 `.env`：

```bash
RECRUITMENT_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
RECRUITMENT_LLM_API_KEY=你的 API Key
RECRUITMENT_LLM_MODEL=deepseek-v4-flash
```

未配置 API Key 时，系统会自动使用本地降级匹配逻辑，保证 Demo 仍可运行。

### AI 工作流

1. 候选人上传 PDF 简历。
2. 后端使用 `pypdf` 抽取简历文本，并用本地规则回填基础字段。
3. 系统读取岗位库，岗位 JD 自动构建为 RAG 知识索引。
4. Agent 接收“候选人信息 + 投递岗位 + RAG 召回岗位 JD”。
5. 大模型输出 JSON：匹配分、标签、风险点、摘要、AI 初筛建议。
6. HR 推进面试后，面试官填写评分和标签，系统更新候选人状态。
7. 终面候选人报告由大模型压缩成 300 字以内的 Markdown 摘要。

## 本地运行

### 后端

```powershell
conda env create -f .\environment.yml
conda activate ai-recruitment-demo
python -m uvicorn backend.app.main:app --reload
```

后端默认地址：`http://127.0.0.1:8000`

### 前端

```powershell
cd frontend
cmd /c npm install
cmd /c npm run dev
```

前端默认地址：`http://127.0.0.1:5173`

### 生产构建

```powershell
cd frontend
cmd /c npm run build:esbuild
```

构建后后端会托管 `frontend/dist`，可直接访问 `/`、`/apply`、`/interviewer`。

## API 概览

| API | 说明 |
| --- | --- |
| `GET /api/jobs` | 获取岗位列表 |
| `POST /api/jobs` | 新增岗位并重建 RAG |
| `PATCH /api/jobs/{id}` | 更新岗位并重建 RAG |
| `DELETE /api/jobs/{id}` | 删除岗位并重建 RAG |
| `POST /api/applications` | 提交投递申请 |
| `GET /api/candidates` | 获取候选人列表 |
| `GET /api/candidates/{id}` | 获取候选人详情 |
| `GET /api/candidates/{id}/resume` | 预览候选人 PDF 简历 |
| `POST /api/candidates/{id}/advance` | 推进候选人流程并排期 |
| `POST /api/interviews` | 保存面试反馈 |
| `POST /api/interviews/recording-summary` | 精炼面试纪要 |
| `GET /api/dashboard/summary` | 数据看板统计 |
| `GET /api/reports/position/{position}` | 生成岗位候选人报告 |

## 部署说明

当前线上部署方式：

- Ubuntu Server
- FastAPI + Uvicorn
- systemd 常驻服务
- Nginx 反向代理到 `8000`
- SQLite 数据库存储在服务器 `data/recruitment.db`

详细部署命令见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 项目维护文档

- [AGENTS.md](./AGENTS.md)：项目维护目录表
- [ARCHITECTURE.md](./ARCHITECTURE.md)：架构地图
- [docs/product-specs/recruitment-ai-requirements.md](./docs/product-specs/recruitment-ai-requirements.md)：产品需求
- [docs/generated/api-and-schema.md](./docs/generated/api-and-schema.md)：API 与数据结构

## 说明

当前 Demo 为低成本作业展示版本，未接入企业微信机器人和腾讯文档 API。企业微信相关能力暂以“生成同步文案，人工复制到群聊”的方式替代，后续具备权限后可扩展机器人推送。
