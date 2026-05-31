# 在线部署说明

当前服务器部署方式：FastAPI + 前端静态资源由后端托管，Nginx 反向代理到 `8000`。

线上入口：

- HR 后台：`http://43.139.250.199/`
- 面试者投递入口：`http://43.139.250.199/apply`
- 面试官入口：`http://43.139.250.199/interviewer`

## 环境变量

服务器环境变量放在：

```bash
/home/ubuntu/recruitment_assistant/.env
```

必须包含：

| 变量 | 说明 |
| --- | --- |
| `RECRUITMENT_LLM_BASE_URL` | 阿里云百炼兼容 OpenAI API 地址 |
| `RECRUITMENT_LLM_API_KEY` | API Key，不提交到 Git |
| `RECRUITMENT_LLM_MODEL` | `deepseek-v4-flash` |

## 服务命令

```bash
sudo systemctl status recruitment-assistant
sudo systemctl restart recruitment-assistant
sudo journalctl -u recruitment-assistant -n 100 --no-pager

sudo systemctl status nginx
sudo systemctl reload nginx
```

## 更新部署

1. 本地构建前端：`cd frontend && npm run build:esbuild`
2. 上传代码与 `frontend/dist` 到服务器 `/home/ubuntu/recruitment_assistant`
3. 服务器安装依赖：`. .venv/bin/activate && pip install -r requirements.txt`
4. 重启服务：`sudo systemctl restart recruitment-assistant`

## 备用 Docker

仓库保留 `Dockerfile`，可用于支持 Docker Hub 或镜像源稳定的平台部署。
