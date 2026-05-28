# AGENTS.md

本文件是项目维护目录表，只放导航和稳定约定。具体设计、计划、接口、债务和产品说明放到 `docs/` 下，按需读取。

## 项目定位

AI 招聘提效 Demo：面向 HR 招聘流程，实现简历解析、候选人管理、面试反馈分析、数据看板、岗位候选人汇总报告和企业微信群同步文案。

## 快速入口

- 顶层架构地图：[ARCHITECTURE.md](./ARCHITECTURE.md)
- 当前开发计划：[docs/exec-plans/active/p0-demo-plan.md](./docs/exec-plans/active/p0-demo-plan.md)
- 技术债跟踪：[docs/exec-plans/tech-debt-tracker.md](./docs/exec-plans/tech-debt-tracker.md)
- 数据/API 结构：[docs/generated/api-and-schema.md](./docs/generated/api-and-schema.md)
- 产品需求：[docs/product-specs/recruitment-ai-requirements.md](./docs/product-specs/recruitment-ai-requirements.md)
- 外部参考：[docs/references/](./docs/references/)

## 当前技术栈

- 前端：React + Vite + ECharts
- 后端：FastAPI
- Python 环境：Conda，环境名 `ai-recruitment-demo`
- 数据：SQLite
- AI：当前为 Mock AI，后续可替换为真实模型 API

## 运行命令

后端：

```powershell
conda activate ai-recruitment-demo
python -m uvicorn backend.app.main:app --reload
```

前端：

```powershell
cd frontend
cmd /c npm install
cmd /c npm run dev
```

## 维护约定

- 根目录文档保持短小，详细内容放入 `docs/`。
- 需求变化先更新产品说明或执行计划，再改代码。
- 架构变化更新 `ARCHITECTURE.md`。
- 接口或表结构变化更新 `docs/generated/api-and-schema.md`。
- 未完成问题记录到技术债跟踪，不藏在聊天记录里。
- 不提交 `node_modules/`、`dist/`、数据库、截图和本地缓存。

## 当前优先级

P0：保证 Demo 可演示，包括 10 名候选人最终筛选、面试评分、看板和 Markdown 报告。

P1：完善生产构建、CSV 导出入口、真实模型接入开关。

P2：腾讯文档 API、企业微信机器人、权限体系、本地模型部署。
