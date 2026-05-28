import argparse
import json
import os
import sys
from urllib import request


DEFAULT_TIMEOUT_SECONDS = 10


def send_text_message(webhook_url: str, content: str) -> dict:
    """Send a plain text message to a WeCom group robot."""
    if not webhook_url:
        raise ValueError("webhook_url is required")
    if not content:
        raise ValueError("content is required")

    payload = {
        "msgtype": "text",
        "text": {
            "content": content,
        },
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        webhook_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with request.urlopen(req, timeout=DEFAULT_TIMEOUT_SECONDS) as resp:
        response_body = resp.read().decode("utf-8")
        return json.loads(response_body)


def build_recruiting_status_message(
    candidate_name: str,
    position: str,
    status: str,
    score: str = "",
    summary: str = "",
    next_action: str = "",
) -> str:
    lines = [
        "【招聘状态更新】",
        f"岗位：{position}",
        f"候选人：{candidate_name}",
        f"当前状态：{status}",
    ]

    if score:
        lines.append(f"综合评分：{score}")
    if summary:
        lines.append(f"面试摘要：{summary}")
    if next_action:
        lines.append(f"下一步：{next_action}")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Send recruiting updates to a WeCom group robot.")
    parser.add_argument("--webhook", default=os.getenv("WECOM_WEBHOOK_URL"), help="WeCom robot webhook URL")
    parser.add_argument("--candidate", default="张三", help="Candidate name")
    parser.add_argument("--position", default="售前解决方案顾问", help="Job position")
    parser.add_argument("--status", default="一面通过，待终面", help="Current recruiting status")
    parser.add_argument("--score", default="88", help="Candidate score")
    parser.add_argument(
        "--summary",
        default="表达清晰，项目经验匹配度较高，技术深度需终面确认。",
        help="Interview summary",
    )
    parser.add_argument("--next-action", default="安排业务负责人终面", help="Next action")
    args = parser.parse_args()

    message = build_recruiting_status_message(
        candidate_name=args.candidate,
        position=args.position,
        status=args.status,
        score=args.score,
        summary=args.summary,
        next_action=args.next_action,
    )

    try:
        result = send_text_message(args.webhook, message)
    except Exception as exc:
        print(f"发送失败：{exc}", file=sys.stderr)
        return 1

    print("发送成功")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
