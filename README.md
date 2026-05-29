# AI 招聘提效 Demo

面向 HR 招聘流程的数据自动化记录、面试反馈分析、岗位候选人汇总报告与数据看板。

## 运行后端

```powershell
conda env create -f .\environment.yml
conda activate ai-recruitment-demo
python -m uvicorn backend.app.main:app --reload
```

## 运行前端

```powershell
cd .\frontend
cmd /c npm install
cmd /c npm run dev
```

## 生产构建

Vite 开发服务可正常使用。当前 Windows + Node 24 环境下，`vite build` 在本机存在构建链异常，项目提供稳定的 esbuild 构建脚本：

```powershell
cd .\frontend
cmd /c npm run build:esbuild
```

## P0 功能

- 面试者投递申请页
- 简历上传与 Mock AI 解析
- 候选人入库和列表
- 面试纪要分析与评分
- 招聘数据看板
- 岗位 10 人 Markdown 汇总报告
- 企业微信群同步文案生成
- 候选人 CSV 导出
- 候选人按在招岗位筛选

## 演示流程

1. 启动后端和前端。
2. 面试者打开独立投递入口：`http://127.0.0.1:5173/apply`。该入口不从 HR 后台跳转。
3. 选择意向岗位并上传 PDF 简历。
4. 确认申请信息后点击“投递”。
5. HR 打开后台入口：`http://127.0.0.1:5173/`。
6. 进入“候选人”，按在招岗位筛选并查看新投递候选人。
7. 进入“报告同步”，点击“生成 10 人演示数据”。
8. 查看岗位 Markdown 汇总报告。
9. 进入“数据看板”查看图表。
10. 进入“候选人”导出 CSV。
11. 生成群同步文案并复制到企业微信群。
