import { randomUUID } from "node:crypto";

const MAX_TEXT = 2000;
const valid = (s, max = MAX_TEXT) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
const subject = (principal) => {
  if (!principal || principal.verified !== true || !valid(principal.subject, 128)) throw new Error("Verified principal required");
  return principal.subject.trim();
};

// An already verified principal must be supplied by a trusted server-side identity adapter.
// Never deserialize principal from an untrusted HTTP request body.
export function createRegistry() {
  const projects = new Map(), applications = new Map(), events = [];
  const audit = (type, id) => events.push(Object.freeze({ sequence: events.length + 1, type, id }));
  return Object.freeze({
    submitProject({ title, description }, principal) {
      const ownerId = subject(principal);
      if (![title, description].every(x => valid(x)) || title.length > 120) throw new TypeError("Invalid project");
      const project = Object.freeze({ id: randomUUID(), title: title.trim(), description: description.trim(), ownerId, status: "submitted" });
      projects.set(project.id, project); audit("project.submitted", project.id); return project;
    },
    applyForGrant({ projectId, statement }, principal) {
      const applicantId = subject(principal);
      if (!projects.has(projectId) || !valid(statement)) throw new TypeError("Invalid application");
      if (projects.get(projectId).ownerId !== applicantId) throw new Error("Applicant must own project");
      if ([...applications.values()].some(a => a.projectId === projectId && a.applicantId === applicantId)) throw new Error("Duplicate application");
      const application = Object.freeze({ id: randomUUID(), projectId, applicantId, statement: statement.trim(), status: "pending_review" });
      applications.set(application.id, application); audit("grant.applied", application.id); return application;
    },
    listProjects: () => [...projects.values()],
    listApplications: () => [...applications.values()],
    auditLog: () => events.map(e => ({ ...e }))
  });
}
