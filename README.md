# AI 招聘提效 Demo

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

## P0 功能

- 简历上传与 Mock AI 解析
- 候选人入库和列表
- 面试纪要分析与评分
- 招聘数据看板
- 岗位 10 人 Markdown 汇总报告
- 企业微信群同步文案生成
