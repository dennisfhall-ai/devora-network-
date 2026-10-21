import { randomUUID } from "node:crypto";

const MAX_TEXT = 2000;
export function createRegistry() {
  const projects = new Map();
  const applications = new Map();
  const events = [];
  const audit = (type, id) => events.push(Object.freeze({ sequence: events.length + 1, type, id }));
  const valid = (s, max = MAX_TEXT) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
  return Object.freeze({
    submitProject({ title, description, ownerId }) {
      if (![title, description, ownerId].every(x => valid(x)) || title.length > 120 || ownerId.length > 128) throw new TypeError("Invalid project");
      const project = Object.freeze({ id: randomUUID(), title: title.trim(), description: description.trim(), ownerId: ownerId.trim(), status: "submitted" });
      projects.set(project.id, project); audit("project.submitted", project.id);
      return project;
    },
    applyForGrant({ projectId, applicantId, statement }) {
      if (!projects.has(projectId) || !valid(applicantId, 128) || !valid(statement)) throw new TypeError("Invalid application");
      const project = projects.get(projectId);
      if (project.ownerId !== applicantId.trim()) throw new Error("Applicant must own project");
      if ([...applications.values()].some(a => a.projectId === projectId && a.applicantId === applicantId.trim())) throw new Error("Duplicate application");
      const application = Object.freeze({ id: randomUUID(), projectId, applicantId: applicantId.trim(), statement: statement.trim(), status: "pending_review" });
      applications.set(application.id, application); audit("grant.applied", application.id);
      return application;
    },
    listProjects: () => [...projects.values()],
    listApplications: () => [...applications.values()],
    auditLog: () => events.map(e => ({ ...e }))
  });
}
