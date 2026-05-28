# ARCHITECTURE.md

## 顶层结构

```text
frontend/               React + Vite 页面
backend/app/            FastAPI 后端
data/                   SQLite 数据库，运行时生成
docs/                   分层项目维护文档
```

## 业务闭环

```text
简历上传
  -> Mock AI 解析
  -> 候选人入库
  -> 面试纪要分析
  -> 状态与评分更新
  -> 看板统计
  -> 岗位 10 人 Markdown 汇总报告
  -> 企业微信群同步文案
```

## 前端

前端入口是 `frontend/src/main.jsx`。

主要页面：

- 简历录入
- 候选人列表
- 面试反馈
- 数据看板
- 报告同步

接口封装在 `frontend/src/api.js`。样式在 `frontend/src/styles.css`。

## 后端

后端入口是 `backend/app/main.py`。

模块职责：

- `main.py`：API 路由、文件上传、报告、看板、演示数据
- `storage.py`：SQLite 初始化、连接、JSON 字段转换
- `ai_mock.py`：Mock AI 简历解析和面试分析

## 数据

当前使用 SQLite。运行时数据库位于 `data/recruitment.db`，不提交到 Git。

核心表：

- `candidates`
- `interviews`

详见：[docs/generated/api-and-schema.md](./docs/generated/api-and-schema.md)

## AI 替换点

当前 AI 能力集中在 `backend/app/ai_mock.py`。后续接入真实模型时，优先保持返回结构不变，替换实现，不改前端。

## 外部系统

当前不接企业微信机器人，因为没有权限。Demo 采用“生成群同步文案 + 人工复制到企业微信群”。

腾讯在线文档暂不做 API 写入，优先支持本地数据、报告和后续 CSV/Excel 导出。
