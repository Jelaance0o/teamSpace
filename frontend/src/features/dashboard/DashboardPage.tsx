import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboard.css";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FolderKanban,
  LoaderCircle,
  RefreshCw,
  Users,
  UserRound,
  UserCog,
  ArrowUpRight,
} from "lucide-react";

import api from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";

interface Project {
  id: number;
  name: string;
  description: string | null;
  status: "planned" | "active" | "on_hold" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  project_manager_id: number | null;
  project_manager_name?: string | null;
}

interface Task {
  id: number;
  project_id: number;
  title: string;
  status: "To Do" | "In Progress" | "In Review" | "Changes Required" | "Done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  assigned_to_id: number | null;
  project_name?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  assigned_to_name?: string | null;
  project_manager_name?: string | null;
}

interface Teammate {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "project_manager" | "employee" | string;
  is_active: boolean;
}

function formatDate(value: string | null) {
  if (!value) return "No deadline";

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", year: "numeric" },
  );
}

function isOverdue(task: Task) {
  if (!task.due_date || task.status === "Done") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${task.due_date.slice(0, 10)}T00:00:00`);
  return dueDate < today;
}

function getStatusClass(status: string) {
  switch (status) {
    case "Done":
    case "completed":
      return "ts-status-success";
    case "In Progress":
    case "active":
      return "ts-status-accent";
    case "In Review":
      return "ts-status-review";
    case "Changes Required":
    case "cancelled":
      return "ts-status-danger";
    case "on_hold":
      return "ts-status-muted";
    default:
      return "ts-status-muted";
  }
}



function StatCard({
  label,
  value,
  description,
  icon: Icon,
  variant = "accent",
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof FolderKanban;
  variant?: "accent" | "success" | "danger" | "neutral" | "review";
}) {
  return (
    <article className="ts-stat-card">
      <div className="ts-stat-card-header">
        <div className="ts-stat-card-content">
          <p className="ts-stat-card-label">{label}</p>
          <p className="ts-stat-card-value">{value.toLocaleString()}</p>
          <p className="ts-stat-card-description">{description}</p>
        </div>

        <div className={`ts-stat-icon ts-stat-icon-${variant}`}>
          <Icon size={20} strokeWidth={1.8} />
        </div>
      </div>
    </article>
  );
}



export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<number>>(new Set());
  const [projectTasksById, setProjectTasksById] = useState<Record<number, Task[]>>({});
  const [projectMembersById, setProjectMembersById] = useState<Record<number, Teammate[]>>({});
  const [projectMemberLoadingIds, setProjectMemberLoadingIds] = useState<Set<number>>(new Set());
  const [projectMemberErrors, setProjectMemberErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      setExpandedProjectIds(new Set());
      setProjectTasksById({});
      setProjectMembersById({});
      setProjectMemberLoadingIds(new Set());
      setProjectMemberErrors({});

      try {
        const pageSize = 100;
        const [firstProjects, firstTasks] = await Promise.all([
          api.get<Project[]>("/api/v1/projects", { params: { limit: pageSize, offset: 0 } }),
          api.get<Task[]>("/api/v1/tasks", { params: { limit: pageSize, offset: 0 } }),
        ]);

        const allProjects = [...firstProjects.data];
        for (let offset = pageSize; firstProjects.data.length === pageSize; offset += pageSize) {
          const response = await api.get<Project[]>("/api/v1/projects", { params: { limit: pageSize, offset } });
          allProjects.push(...response.data);
          if (response.data.length < pageSize) break;
        }

        const allTasks = [...firstTasks.data];
        for (let offset = pageSize; firstTasks.data.length === pageSize; offset += pageSize) {
          const response = await api.get<Task[]>("/api/v1/tasks", { params: { limit: pageSize, offset } });
          allTasks.push(...response.data);
          if (response.data.length < pageSize) break;
        }

        const tasksByProject: Record<number, Task[]> = {};
        const priorityRank: Record<Task["priority"], number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        for (const task of allTasks) {
          (tasksByProject[task.project_id] ??= []).push(task);
        }
        for (const projectTasks of Object.values(tasksByProject)) {
          projectTasks.sort((left, right) => {
            const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority];
            if (priorityDifference !== 0) return priorityDifference;
            if (!left.due_date && !right.due_date) return left.title.localeCompare(right.title);
            if (!left.due_date) return 1;
            if (!right.due_date) return -1;
            return left.due_date.localeCompare(right.due_date);
          });
        }

        let allTeammates: Teammate[] = [];
        if (user?.role === "admin") {
          for (let offset = 0; ; offset += pageSize) {
            const response = await api.get<Teammate[]>("/api/v1/teammates", {
              params: { limit: pageSize, offset },
            });
            allTeammates.push(...response.data);
            if (response.data.length < pageSize) break;
          }
        }

        if (!cancelled) {
          setProjects(allProjects);
          setTasks(allTasks);
          setProjectTasksById(tasksByProject);
          setTeammates(allTeammates);
        }
      } catch {
        if (!cancelled) {
          setError("We couldn't load your workspace data. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    return () => { cancelled = true; };
  }, [user?.role, refreshKey]);

  async function fetchProjectMembers(projectId: number) {
    const project = projects.find((item) => item.id === projectId);
    const canViewMembers = user?.role === "admin" || (user?.role === "project_manager" && project?.project_manager_id === user.id);
    if (!canViewMembers || Object.prototype.hasOwnProperty.call(projectMembersById, projectId) || projectMemberLoadingIds.has(projectId)) return;

    setProjectMemberLoadingIds((current) => new Set(current).add(projectId));
    setProjectMemberErrors((current) => { const next = { ...current }; delete next[projectId]; return next; });
    try {
      const response = await api.get<Teammate[]>(`/api/v1/projects/${projectId}/members`);
      setProjectMembersById((current) => ({ ...current, [projectId]: response.data }));
    } catch {
      setProjectMemberErrors((current) => ({ ...current, [projectId]: "We couldn't load this project's member list." }));
    } finally {
      setProjectMemberLoadingIds((current) => { const next = new Set(current); next.delete(projectId); return next; });
    }
  }

  function toggleProjectTasks(projectId: number) {
    const willExpand = !expandedProjectIds.has(projectId);
    setExpandedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    if (willExpand) void fetchProjectMembers(projectId);
  }

  function getPriorityClass(priority: Task["priority"]) {
    if (priority === "urgent" || priority === "high") return "ts-status-danger";
    if (priority === "medium") return "ts-status-accent";
    return "ts-status-muted";
  }

  const activeProjects = projects.filter(
    (project) => project.status === "active",
  ).length;

  const completedTasks = tasks.filter((task) => task.status === "Done").length;

  const pendingTasks = tasks.filter((task) => task.status !== "Done").length;

  const overdueTasks = tasks.filter(isOverdue);

  const activeTeammates = teammates.filter((teammate) => teammate.is_active);

  const activeMembers = activeTeammates.filter(
    (teammate) => teammate.role === "employee",
  ).length;

  const activeManagers = activeTeammates.filter(
    (teammate) => teammate.role === "project_manager",
  ).length;

  if (loading) {
    return (
      <div className="ts-page flex min-h-64 items-center justify-center gap-3">
        <LoaderCircle className="animate-spin ts-accent" size={22} />
        <p className="text-sm ts-secondary">Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <section className="ts-surface rounded-xl p-6">
        <div className="flex items-center gap-3">
          <AlertCircle
            className="shrink-0"
            style={{ color: "var(--ts-danger)" }}
            size={22}
          />
          <p className="text-sm ts-text">{error}</p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="ts-button-secondary ts-focus mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="ts-page space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest ts-accent">
            Workspace overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight ts-text">
            Dashboard
          </h1>
          <p className="mt-2 text-sm ts-secondary">
            A clear view of your projects, tasks, and team.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="ts-button-secondary ts-focus inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <RefreshCw size={15} />
          Refresh data
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total projects"
          value={projects.length}
          description={`${activeProjects} currently active`}
          icon={FolderKanban}
          variant="accent"
        />

        <StatCard
          label="Pending tasks"
          value={pendingTasks}
          description="Tasks not yet completed"
          icon={Clock3}
          variant="neutral"
        />

        <StatCard
          label="Completed tasks"
          value={completedTasks}
          description="Tasks marked as done"
          icon={CheckCircle2}
          variant="success"
        />

        <StatCard
          label="Overdue tasks"
          value={overdueTasks.length}
          description="Uncompleted tasks past their deadline"
          icon={AlertCircle}
          variant="danger"
        />

        {user?.role === "admin" && (
          <>
            <StatCard
              label="Total teammates"
              value={teammates.length}
              description={`${activeTeammates.length} active accounts across all roles`}
              icon={Users}
              variant="accent"
            />

            <StatCard
              label="Members"
              value={activeMembers}
              description="Active employee accounts"
              icon={UserRound}
              variant="success"
            />

            <StatCard
              label="Team managers"
              value={activeManagers}
              description="Active project managers"
              icon={UserCog}
              variant="review"
            />
          </>
        )}
      </div>

      <section
        className="grid grid-cols-1 gap-4 xl:grid-cols-2"
        aria-label="Workspace analytics"
      >
        <article className="ts-panel rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold ts-text">
                Task status overview
              </h2>
              <p className="mt-1 text-xs ts-muted">
                Based on tasks visible to your account
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "var(--ts-accent-soft)",
                color: "var(--ts-accent)",
              }}
            >
              {tasks.length} tasks
            </span>
          </div>
          {tasks.length === 0 ? (
            <p
              className="rounded-xl p-5 text-sm ts-muted"
              style={{ background: "var(--ts-surface-muted)" }}
            >
              Task analytics will appear when tasks are assigned.
            </p>
          ) : (
            <div className="space-y-4">
              {[
                {
                  label: "To Do",
                  count: tasks.filter((t) => t.status === "To Do").length,
                },
                {
                  label: "In Progress",
                  count: tasks.filter((t) => t.status === "In Progress").length,
                },
                {
                  label: "In Review",
                  count: tasks.filter((t) => t.status === "In Review").length,
                },
                {
                  label: "Changes Required",
                  count: tasks.filter((t) => t.status === "Changes Required")
                    .length,
                },
                { label: "Done", count: completedTasks },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="ts-secondary">{item.label}</span>
                    <strong className="ts-text">{item.count}</strong>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full"
                    style={{ background: "var(--ts-surface-muted)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((item.count / Math.max(tasks.length, 1)) * 100)}%`,
                        background:
                          item.label === "Done"
                            ? "var(--ts-success, #238636)"
                            : item.label === "Changes Required"
                              ? "var(--ts-danger)"
                              : "var(--ts-accent)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="ts-panel rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold ts-text">Project progress</h2>
            <p className="mt-1 text-xs ts-muted">
              Completion calculated from real task statuses
            </p>
          </div>
          {projects.length === 0 ? (
            <p
              className="rounded-xl p-5 text-sm ts-muted"
              style={{ background: "var(--ts-surface-muted)" }}
            >
              Project progress will appear when projects are available.
            </p>
          ) : (
            <div className="space-y-4">
              {projects.slice(0, 5).map((project) => {
                const projectTasks = tasks.filter(
                  (task) => task.project_id === project.id,
                );
                const done = projectTasks.filter(
                  (task) => task.status === "Done",
                ).length;
                const progress = projectTasks.length
                  ? Math.round((done / projectTasks.length) * 100)
                  : 0;
                return (
                  <div key={project.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate ts-secondary">
                        {project.name}
                      </span>
                      <strong className="shrink-0 ts-text">{progress}%</strong>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full"
                      style={{ background: "var(--ts-surface-muted)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          background: "var(--ts-accent)",
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] ts-muted">
                      {done} of {projectTasks.length} tasks completed
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <div className="grid grid-cols-1 gap-5">
        <div className="ts-panel overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b px-5 py-4 ts-divider">
            <div>
              <h2 className="text-sm font-semibold ts-text">Projects</h2>
              <p className="mt-1 text-xs ts-muted">
                Projects available to your account
              </p>
            </div>
            <FolderKanban className="ts-muted" size={19} />
          </div>

          {projects.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FolderKanban className="mx-auto ts-muted" size={28} />
              <p className="mt-3 text-sm font-medium ts-text">
                No projects yet
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm ts-secondary">
                Projects will appear here when they're created or assigned to
                you.
              </p>
            </div>
          ) : (
            <div className="divide-y ts-divider">
              {projects.map((project) => {
                const expanded = expandedProjectIds.has(project.id);
                const projectTasks = projectTasksById[project.id] ?? [];
                const completedProjectTasks = projectTasks.filter(
                  (task) => task.status === "Done",
                ).length;
                const pendingProjectTasks =
                  projectTasks.length - completedProjectTasks;
                const overdueProjectTasks =
                  projectTasks.filter(isOverdue).length;
                const projectProgress = projectTasks.length
                  ? Math.round(
                      (completedProjectTasks / projectTasks.length) * 100,
                    )
                  : 0;
                const canSeeAllProjectTasks =
                  user?.role === "admin" ||
                  (user?.role === "project_manager" &&
                    project.project_manager_id === user.id);
                const taskScopeLabel = canSeeAllProjectTasks
                  ? "Project tasks"
                  : "My tasks";

                return (
                  <div key={project.id}>
                    <div className="flex flex-col items-start justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium ts-text">
                          {project.name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs ts-muted">
                          {project.description || "No project description"}
                        </p>
                        <p className="mt-1 text-xs ts-muted">
                          Manager:{" "}
                          {project.project_manager_name || "Not assigned"} · Due{" "}
                          {formatDate(project.due_date)}
                        </p>
                      </div>

                      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
                        <span
                          className={`ts-status ${getStatusClass(project.status)}`}
                        >
                          {project.status.replace("_", " ")}
                        </span>
                        <span
                          className={`ts-status ${getPriorityClass(project.priority === "urgent" ? "urgent" : project.priority)}`}
                        >
                          {project.priority}
                        </span>
                        <button
                          type="button"
                          className="ts-button-secondary ts-focus inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium"
                          aria-expanded={expanded}
                          aria-controls={`project-top-tasks-${project.id}`}
                          onClick={() => toggleProjectTasks(project.id)}
                        >
                          {expanded ? "Hide tasks" : "View tasks"}
                          {expanded ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="px-5 pb-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs ts-muted">
                        <span>
                          {taskScopeLabel}: {projectTasks.length} ·{" "}
                          {completedProjectTasks} completed ·{" "}
                          {pendingProjectTasks} pending · {overdueProjectTasks}{" "}
                          overdue
                        </span>
                        <span>{projectProgress}% complete</span>
                      </div>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full"
                        style={{ background: "var(--ts-surface-muted)" }}
                        aria-label={`Project task completion ${projectProgress}%`}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={projectProgress}
                      >
                        <span
                          className="block h-full rounded-full transition-all"
                          style={{
                            width: `${projectProgress}%`,
                            background: "var(--ts-accent)",
                          }}
                        />
                      </div>
                    </div>

                    {expanded && (
                      <div
                        id={`project-top-tasks-${project.id}`}
                        className="ts-project-task-expansion border-t px-4 py-3 sm:px-5"
                        style={{
                          borderColor: "var(--ts-border)",
                          background: "var(--ts-surface-muted)",
                        }}
                      >
                        {user?.role !== "employee" && (
                          <section
                            className="mb-4 rounded-lg border p-3"
                            style={{
                              borderColor: "var(--ts-border)",
                              background: "var(--ts-surface)",
                            }}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold ts-text">
                                Project members
                              </p>
                              {projectMembersById[project.id] && (
                                <span className="text-xs ts-muted">
                                  {projectMembersById[project.id].length}
                                </span>
                              )}
                            </div>
                            {user?.role === "employee" ||
                            (user?.role === "project_manager" &&
                              project.project_manager_id !== user.id) ? (
                              <p className="text-xs ts-muted">
                                Member roster is available to this project's
                                assigned manager and Admins.
                              </p>
                            ) : projectMemberLoadingIds.has(project.id) ? (
                              <div className="flex items-center gap-2 py-1 text-xs ts-secondary">
                                <LoaderCircle
                                  className="animate-spin"
                                  size={14}
                                />
                                Loading members...
                              </div>
                            ) : projectMemberErrors[project.id] ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className="text-xs"
                                  style={{ color: "var(--ts-danger)" }}
                                >
                                  {projectMemberErrors[project.id]}
                                </p>
                                <button
                                  type="button"
                                  className="text-xs font-semibold ts-accent"
                                  onClick={() =>
                                    void fetchProjectMembers(project.id)
                                  }
                                >
                                  Retry
                                </button>
                              </div>
                            ) : projectMembersById[project.id]?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {projectMembersById[project.id].map(
                                  (member) => (
                                    <span
                                      key={member.id}
                                      className="rounded-full border px-2.5 py-1 text-xs ts-secondary"
                                      style={{
                                        borderColor: "var(--ts-border)",
                                      }}
                                    >
                                      {member.full_name}
                                      {member.role === "project_manager"
                                        ? " · PM"
                                        : member.role === "admin"
                                          ? " · Admin"
                                          : ""}
                                    </span>
                                  ),
                                )}
                              </div>
                            ) : (
                              <p className="text-xs ts-muted">
                                No active project members are assigned yet.
                              </p>
                            )}
                          </section>
                        )}
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide ts-muted">
                            {taskScopeLabel} · {projectTasks.length}
                          </p>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-semibold ts-accent"
                            onClick={() =>
                              navigate(`/tasks?projectId=${project.id}`)
                            }
                          >
                            Open task workspace <ArrowUpRight size={13} />
                          </button>
                        </div>
                        {projectTasks.length === 0 ? (
                          <p className="py-2 text-sm ts-secondary">
                            {canSeeAllProjectTasks
                              ? "No tasks have been created for this project yet."
                              : "No tasks are assigned to you in this project yet."}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {projectTasks.map((task) => (
                              <button
                                key={task.id}
                                type="button"
                                onClick={() =>
                                  navigate(`/tasks?taskId=${task.id}`)
                                }
                                className="w-full rounded-lg border p-3 text-left transition hover:border-[var(--ts-focus)]"
                                style={{
                                  borderColor: "var(--ts-border)",
                                  background: "var(--ts-surface)",
                                }}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <p className="min-w-0 flex-1 break-words text-sm font-medium ts-text">
                                    {task.title}
                                  </p>
                                  <ArrowUpRight
                                    size={15}
                                    className="shrink-0 ts-muted"
                                  />
                                </div>
                                <p className="mt-1 text-xs ts-muted">
                                  Assigned to:{" "}
                                  {task.assigned_to_name || "Unassigned"} ·
                                  Assigned by:{" "}
                                  {task.created_by_name || "Unknown"} · Project
                                  Manager:{" "}
                                  {task.project_manager_name ||
                                    project.project_manager_name ||
                                    "Not assigned"}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span
                                    className={`ts-status ${getStatusClass(task.status)}`}
                                  >
                                    {task.status}
                                  </span>
                                  <span
                                    className={`ts-status ${getPriorityClass(task.priority)}`}
                                  >
                                    {task.priority}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-xs ts-muted">
                                    <CalendarDays size={13} />
                                    {formatDate(task.due_date)}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {overdueTasks.length > 0 && (
        <div className="ts-alert-danger flex items-start gap-3 rounded-xl p-5">
          <AlertCircle className="mt-0.5 shrink-0" size={19} />
          <div>
            <h2 className="text-sm font-semibold">Attention needed</h2>
            <p className="mt-1 text-sm">
              You have {overdueTasks.length} overdue{" "}
              {overdueTasks.length === 1 ? "task" : "tasks"}. Review their
              deadlines and update their status.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
