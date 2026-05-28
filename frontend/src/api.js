const API_BASE = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/plain")) return response.text();
  return response.json();
}

export async function uploadResume(file, position, jobDescription) {
  const form = new FormData();
  form.append("file", file);
  form.append("position", position);
  form.append("job_description", jobDescription);
  return request("/api/resumes/upload", { method: "POST", body: form });
}

export async function createCandidate(candidate) {
  return request("/api/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(candidate),
  });
}

export async function listCandidates() {
  return request("/api/candidates");
}

export async function createInterview(payload) {
  return request("/api/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function dashboardSummary() {
  return request("/api/dashboard/summary");
}

export async function positionReport(position) {
  return request(`/api/reports/position/${encodeURIComponent(position)}`);
}

export async function groupCopyMessage(candidateId, nextAction) {
  return request("/api/messages/group-copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_id: Number(candidateId), next_action: nextAction }),
  });
}

export async function seedDemoData() {
  return request("/api/demo/seed", { method: "POST" });
}
