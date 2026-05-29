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

- 简历上传与 Mock AI 解析
- 候选人入库和列表
- 面试纪要分析与评分
- 招聘数据看板
- 岗位 10 人 Markdown 汇总报告
- 企业微信群同步文案生成
- 候选人 CSV 导出

## 演示流程

1. 启动后端和前端。
2. 进入“报告同步”。
3. 点击“生成 10 人演示数据”。
4. 查看岗位 Markdown 汇总报告。
5. 进入“数据看板”查看图表。
6. 进入“候选人”导出 CSV。
7. 生成群同步文案并复制到企业微信群。
