const isLocalDev = ["127.0.0.1", "localhost"].includes(window.location.hostname)
  && ["5173", "5174"].includes(window.location.port);
const API_BASE = window.__API_BASE__ || (isLocalDev ? "http://127.0.0.1:8000" : "");

export const API_ORIGIN = API_BASE;

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

export async function listJobs() {
  return request("/api/jobs");
}

export async function listInterviewers() {
  return request("/api/interviewers");
}

export async function interviewerSchedule(interviewer) {
  return request(`/api/interviewers/${encodeURIComponent(interviewer)}/schedule`);
}

export async function createJob(payload) {
  return request("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateJob(jobId, payload) {
  return request(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteJob(jobId) {
  return request(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
  });
}

export async function submitApplication(payload) {
  const form = new FormData();
  form.append("resume", payload.resume);
  form.append("intended_position", payload.intended_position);
  form.append("name", payload.name || "");
  form.append("phone", payload.phone || "");
  form.append("email", payload.email || "");
  form.append("education", payload.education || "");
  form.append("school", payload.school || "");
  form.append("work_years", payload.work_years || "");
  form.append("application_json", JSON.stringify(payload.application || {}));
  form.append("repeat_forms_json", JSON.stringify(payload.repeatForms || {}));
  return request("/api/applications", { method: "POST", body: form });
}

export async function createCandidate(candidate) {
  return request("/api/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(candidate),
  });
}

export async function listCandidates(position = "") {
  const query = position ? `?position=${encodeURIComponent(position)}` : "";
  return request(`/api/candidates${query}`);
}

export async function getCandidate(candidateId) {
  return request(`/api/candidates/${candidateId}`);
}

export async function createInterview(payload) {
  return request("/api/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function summarizeRecording(candidateId, file) {
  const form = new FormData();
  form.append("candidate_id", Number(candidateId));
  form.append("file", file);
  return request("/api/interviews/recording-summary", { method: "POST", body: form });
}

export async function advanceCandidate(candidateId, payload) {
  return request(`/api/candidates/${candidateId}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateCandidate(candidateId, payload) {
  return request(`/api/candidates/${candidateId}`, {
    method: "PATCH",
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
