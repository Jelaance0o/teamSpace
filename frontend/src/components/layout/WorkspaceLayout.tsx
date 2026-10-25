import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Camera, ClipboardList, FolderKanban, LogOut, Menu, Users, X, LayoutDashboard } from "lucide-react";
import ThemeSelector from "../ThemeSelector";
import AuthenticatedProfileImage from "../AuthenticatedProfileImage";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../lib/api";

type NavigationItem = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  roles: string[];
};

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "project_manager", "employee"],
  },
  {
    label: "Team Members",
    path: "/team",
    icon: Users,
    roles: ["admin", "project_manager"],
  },
  {
    label: "Tasks",
    path: "/tasks",
    icon: ClipboardList,
    roles: ["admin", "project_manager", "employee"],
  },
  {
    label: "Projects",
    path: "/projects",
    icon: FolderKanban,
    roles: ["admin", "project_manager", "employee"],
  },
];

export default function WorkspaceLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pictureVersion, setPictureVersion] = useState(0);
  const [pictureUrl, setPictureUrl] = useState<string | null>(user?.profile_picture_url ?? null);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [pictureMessage, setPictureMessage] = useState("");

  useEffect(() => {
    setPictureUrl(user?.profile_picture_url ?? null);
  }, [user?.id, user?.profile_picture_url]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const visibleNavigation = navigation.filter((item) =>
    item.roles.includes(user.role),
  );

  async function handleProfilePicture(file?: File) {
    if (!file || !user) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setPictureMessage("Choose a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPictureMessage("Profile images must be 5 MB or smaller.");
      return;
    }
    setPictureBusy(true);
    setPictureMessage("");
    try {
      const response = await api.put<{ profile_picture_url?: string | null }>(
        "/api/v1/teammates/me/picture",
        file,
        { headers: { "Content-Type": file.type } },
      );
      setPictureUrl(response.data.profile_picture_url ?? `/api/v1/teammates/${user.id}/picture`);
      setPictureVersion(Date.now());
      setPictureMessage("Profile picture updated.");
    } catch {
      setPictureMessage("Could not upload the profile picture. Please try again.");
    } finally {
      setPictureBusy(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logout();
    } catch {
      // The local session is cleared even if the server request fails.
    } finally {
      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  }

  const roleLabel: Record<string, string> = {
    admin: "Administrator",
    project_manager: "Project Manager",
    employee: "Teammate",
  };

  return (
    <div className="ts-page min-h-screen">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`ts-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Branding */}
        <div className="flex h-20 items-center gap-3 border-b px-6">
          <div className="rounded-xl bg-white p-2.5 text-white">
            <img
              src="https://ik.imagekit.io/jktxr9q9s/image.png"
              alt="Logo"
              className="h-[28px] w-[28px] object-contain"
            />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">TeamSpace</h1>
            <p className="text-xs text-slate-500">Team workspace</p>
          </div>

          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
            className="ts-focus ml-auto rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <div className="px-4 pt-6">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Workspace
          </p>

          <nav className="mt-3 space-y-1">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `ts-nav-item ts-focus ${
                      isActive ? "ts-nav-item-active" : ""
                    }`
                  }
                >
                  <Icon size={19} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User profile and logout */}
        <div className="mt-auto border-t p-4">
          <div className="ts-profile-card mb-3 flex items-center gap-3 rounded-xl p-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 font-semibold text-indigo-700">
              <span>{user.full_name.charAt(0).toUpperCase()}</span>
              {pictureUrl && (
                <AuthenticatedProfileImage
                  src={pictureUrl}
                  refreshKey={pictureVersion}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <label
                aria-label="Change profile picture"
                title={
                  pictureBusy ? "Uploading picture" : "Change profile picture"
                }
                className="absolute bottom-0 right-0 grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-indigo-600 text-white shadow disabled:opacity-50"
              >
                <Camera size={11} />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={pictureBusy}
                  onChange={(event) => {
                    void handleProfilePicture(event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.full_name}</p>
              <p className="truncate text-xs text-slate-500">
                {roleLabel[user.role] ?? user.role}
              </p>
              {pictureMessage && (
                <p role="status" className="mt-1 text-[10px] text-slate-500">
                  {pictureMessage}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            className="ts-logout ts-focus flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition disabled:opacity-50"
          >
            <LogOut size={18} />
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main workspace */}
      <div className="min-h-screen lg:pl-64">
        {/* Header */}
        <header className="ts-header sticky top-0 z-30 flex h-20 items-center justify-between border-b px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
              className="ts-focus rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            >
              <Menu size={21} />
            </button>

            <div className="min-w-0">
              <p className="text-sm text-slate-500">Your workspace</p>
              <h2 className="truncate font-semibold">
                Welcome, {user.full_name}
              </h2>
            </div>
          </div>

          {/* Theme selector and role */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeSelector />

            <div className="ts-role-pill hidden items-center gap-2 rounded-full px-3 py-2 text-sm sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {roleLabel[user.role] ?? user.role}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

