import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const valid = (s, max = 2000) => typeof s === "string" && s.trim().length > 0 && s.length <= max;
const actor = (principal) => {
  if (!principal || principal.verified !== true || !valid(principal.subject, 256)) throw new Error("Verified principal required");
  return principal.subject;
};

/**
 * Local prototype persistence. DatabaseSync requires a Node runtime with node:sqlite.
 * Caller must supply a verified principal from trusted identity middleware.
 * The database is not an internet-facing API.
 */
export function createPersistentRegistry(filename) {
  if (!valid(filename, 4096)) throw new TypeError("Database path required");
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, owner_subject TEXT NOT NULL, title TEXT NOT NULL,
    description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted'
  );
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
    applicant_subject TEXT NOT NULL, statement TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review',
    UNIQUE(project_id, applicant_subject)
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
    object_id TEXT NOT NULL, actor_subject TEXT NOT NULL
  );`);
  const addProject = db.prepare("INSERT INTO projects(id,owner_subject,title,description) VALUES(?,?,?,?)");
  const addApplication = db.prepare("INSERT INTO applications(id,project_id,applicant_subject,statement) VALUES(?,?,?,?)");
  const addAudit = db.prepare("INSERT INTO audit_events(type,object_id,actor_subject) VALUES(?,?,?)");
  const findProject = db.prepare("SELECT id, owner_subject AS ownerId, title, description, status FROM projects WHERE id = ?");
  const findApplication = db.prepare("SELECT id, project_id AS projectId, applicant_subject AS applicantId, statement, status FROM applications WHERE id = ?");
  const runAtomic = (work) => {
    db.exec("BEGIN IMMEDIATE");
    try { const result = work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  return Object.freeze({
    submitProject({ title, description }, principal) {
      const ownerId = actor(principal);
      if (!valid(title, 120) || !valid(description)) throw new TypeError("Invalid project");
      const id = randomUUID();
      return runAtomic(() => {
        addProject.run(id, ownerId, title.trim(), description.trim());
        addAudit.run("project.submitted", id, ownerId);
        return findProject.get(id);
      });
    },
    applyForGrant({ projectId, statement }, principal) {
      const applicantId = actor(principal);
      if (!valid(projectId, 128) || !valid(statement)) throw new TypeError("Invalid application");
      const project = findProject.get(projectId);
      if (!project || project.ownerId !== applicantId) throw new Error("Project unavailable to applicant");
      const id = randomUUID();
      return runAtomic(() => {
        addApplication.run(id, projectId, applicantId, statement.trim());
        addAudit.run("grant.applied", id, applicantId);
        return findApplication.get(id);
      });
    },
    listOwnProjects(principal) {
      return db.prepare("SELECT id, owner_subject AS ownerId, title, description, status FROM projects WHERE owner_subject = ?").all(actor(principal));
    },
    listOwnApplications(principal) {
      return db.prepare("SELECT id, project_id AS projectId, applicant_subject AS applicantId, statement, status FROM applications WHERE applicant_subject = ?").all(actor(principal));
    },
    close: () => db.close()
  });
}
