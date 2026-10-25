import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import "./invitation-acceptance.css";

interface InvitationValidation {
  valid: boolean;
  email: string;
  role: "employee" | "project_manager" | string;
  expires_at: string;
}

function apiError(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } })
      .response;
    const detail = response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          typeof item === "object" && item && "msg" in item
            ? String(item.msg)
            : "Invalid input",
        )
        .join(" ");
    }
  }
  return "We couldn't connect to TeamSpace. Check your connection and try again.";
}

function parseList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function roleName(role: string) {
  if (role === "project_manager") return "Project Manager";
  return "Teammate";
}

export default function InvitationAcceptancePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const token = searchParams.get("token") ?? "";
  const [invitation, setInvitation] = useState<InvitationValidation | null>(
    null,
  );
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [techStack, setTechStack] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      setChecking(true);
      setError("");
      if (!token) {
        setInvitation(null);
        setError(
          "This invitation link is missing its token. Ask your workspace Admin for a new link.",
        );
        setChecking(false);
        return;
      }
      try {
        const response = await api.get<InvitationValidation>(
          "/api/v1/invitations/validate",
          { params: { token } },
        );
        if (!cancelled) setInvitation(response.data);
      } catch (err) {
        if (!cancelled) {
          setInvitation(null);
          setError(apiError(err));
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError(
        "Use at least one letter, one number, and one symbol in your password.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/v1/invitations/accept", {
        token,
        full_name: fullName.trim(),
        password,
        department: department.trim() || null,
        job_title: jobTitle.trim() || null,
        bio: bio.trim() || null,
        skills: parseList(skills),
        tech_stack: parseList(techStack),
      });
      // Acceptance is public and does not create a session. Clear any existing
      // session cookie before sending this browser to the sign-in page.
      try {
        await logout();
      } catch {
        /* The account was created; still continue to sign-in. */
      }
      navigate("/login", {
        replace: true,
        state: { invitationAccepted: true },
      });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="ts-invitation-page">
      <section className="ts-invitation-card">
        <div className="ts-invitation-brand">
          <span>
            <UserRound size={22} />
          </span>
          <div>
            <strong>TeamSpace</strong>
            <small>Team workspace</small>
          </div>
        </div>
        {checking ? (
          <div className="ts-invitation-state">
            <LoaderCircle className="ts-invitation-spin" size={28} />
            <h1>Verifying invitation</h1>
            <p>Please wait while we check your secure invitation link.</p>
          </div>
        ) : !invitation ? (
          <div className="ts-invitation-state">
            <span className="ts-invitation-error-icon">
              <AlertCircle size={24} />
            </span>
            <h1>Invitation unavailable</h1>
            <p>
              {error || "This invitation is invalid or no longer available."}
            </p>
            <p className="ts-invitation-help">
              Invitation links expire or can be revoked. Ask your workspace
              Admin to create a new invitation.
            </p>
            <Link to="/login" className="ts-invitation-secondary-link">
              Return to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="ts-invitation-heading">
              <span className="ts-invitation-secure">
                <ShieldCheck size={15} /> Secure invitation
              </span>
              <h1>Join your TeamSpace</h1>
              <p>Complete your profile to activate your workspace account.</p>
            </div>
            <div className="ts-invitation-summary">
              <span className="ts-invitation-summary-icon">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <strong>{invitation.email}</strong>
                <span>Invited as {roleName(invitation.role)}</span>
              </div>
            </div>
            {error && (
              <div role="alert" className="ts-invitation-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            <form
              className="ts-invitation-form"
              onSubmit={(event) => void handleSubmit(event)}
            >
              <div className="ts-invitation-field">
                <label htmlFor="invite-full-name">
                  Full name <span>*</span>
                </label>
                <input
                  id="invite-full-name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={150}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="ts-invitation-field">
                <label htmlFor="invite-email-readonly">Email address</label>
                <input
                  id="invite-email-readonly"
                  type="email"
                  value={invitation.email}
                  readOnly
                  aria-readonly="true"
                />
              </div>
              <div className="ts-invitation-form-grid">
                <div className="ts-invitation-field">
                  <label htmlFor="invite-department">Department</label>
                  <input
                    id="invite-department"
                    maxLength={100}
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div className="ts-invitation-field">
                  <label htmlFor="invite-job-title">Job title</label>
                  <input
                    id="invite-job-title"
                    maxLength={120}
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    placeholder="e.g. Frontend Developer"
                  />
                </div>
              </div>
              <div className="ts-invitation-field">
                <label htmlFor="invite-bio">About you</label>
                <textarea
                  id="invite-bio"
                  maxLength={1000}
                  rows={3}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="A short introduction (optional)"
                />
              </div>
              <div className="ts-invitation-field">
                <label htmlFor="invite-skills">Skills</label>
                <input
                  id="invite-skills"
                  value={skills}
                  onChange={(event) => setSkills(event.target.value)}
                  placeholder="React, Communication, Testing"
                />
                <small>Separate items with commas.</small>
              </div>
              <div className="ts-invitation-field">
                <label htmlFor="invite-tech-stack">Tech stack</label>
                <input
                  id="invite-tech-stack"
                  value={techStack}
                  onChange={(event) => setTechStack(event.target.value)}
                  placeholder="TypeScript, FastAPI, PostgreSQL"
                />
                <small>Separate technologies with commas.</small>
              </div>
              <div className="ts-invitation-field">
                <label htmlFor="invite-password">
                  Create password <span>*</span>
                </label>
                <input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
                <small>Include a letter, a number, and a symbol.</small>
              </div>
              <div className="ts-invitation-field">
                <label htmlFor="invite-confirm-password">
                  Confirm password <span>*</span>
                </label>
                <input
                  id="invite-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter your password again"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="ts-invitation-submit"
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="ts-invitation-spin" size={17} />{" "}
                    Creating account...
                  </>
                ) : (
                  "Accept invitation and create account"
                )}
              </button>
            </form>
            <p className="ts-invitation-footnote">
              Your role is assigned by the invitation. You cannot change it
              during registration.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
