# API 与数据结构

## API

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/resumes/upload` | POST | 上传简历并返回解析结果 |
| `/api/jobs` | GET | 获取在招岗位列表 |
| `/api/applications` | POST | 面试者提交申请并创建候选人 |
| `/api/ai/parse-resume` | POST | 根据文本和岗位 JD 解析候选人 |
| `/api/candidates` | GET/POST | 查询或新增候选人 |
| `/api/candidates/{id}` | GET/PATCH | 查看或更新候选人 |
| `/api/ai/analyze-interview` | POST | 分析面试纪要 |
| `/api/interviews` | POST | 保存面试记录 |
| `/api/dashboard/summary` | GET | 获取看板统计 |
| `/api/reports/position/{position}` | GET | 生成岗位汇总 Markdown 报告 |
| `/api/messages/group-copy` | POST | 生成群同步文案 |
| `/api/export/candidates` | GET | 导出候选人 CSV |
| `/api/demo/seed` | POST | 生成 10 人演示数据 |

## 前端脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务 |
| `npm run build:esbuild` | 使用 esbuild 生成生产产物 |

## candidates

| 字段 | 说明 |
| --- | --- |
| id | 候选人 ID |
| name | 姓名 |
| position | 应聘岗位 |
| phone_masked | 脱敏手机号 |
| email_masked | 脱敏邮箱 |
| education | 学历 |
| school | 学校 |
| work_years | 工作年限 |
| status | 当前状态 |
| match_score | 简历匹配分 |
| tags | JSON 标签数组 |
| risk_points | JSON 风险点数组 |
| summary | 简历摘要 |
| screening_suggestion | 初筛建议 |

## interviews

| 字段 | 说明 |
| --- | --- |
| id | 面试记录 ID |
| candidate_id | 候选人 ID |
| interviewer | 面试官 |
| interview_time | 面试时间 |
| transcript | 面试纪要 |
| ai_summary | AI 面试摘要 |
| strengths | JSON 优势数组 |
| risks | JSON 风险数组 |
| human_score | 面试官评分 |
| ai_suggestion | AI 建议 |
| final_result | 最终状态 |
| reason_category | 原因分类 |
