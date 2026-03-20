import { useEffect, useMemo, useState } from "react";
import * as OTPAuth from "otpauth";
import { QRCodeSVG } from "qrcode.react";

// ─── Password strength checker ─────────────────────────────────────────────
const checkPassword = (pw) => ({
  length:    pw.length >= 8,
  uppercase: /[A-Z]/.test(pw),
  number:    /[0-9]/.test(pw),
  special:   /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
});
const isPasswordValid = (pw) => Object.values(checkPassword(pw)).every(Boolean);

function PasswordStrengthIndicator({ password }) {
  const checks = checkPassword(password);
  const rules = [
    { key: "length",    label: "At least 8 characters" },
    { key: "uppercase", label: "At least 1 uppercase letter" },
    { key: "number",    label: "At least 1 number" },
    { key: "special",   label: "At least 1 special character (!@#$%...)" },
  ];
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1">
      {rules.map(({ key, label }) => (
        <li key={key} className={`flex items-center gap-2 text-xs ${checks[key] ? "text-green-600" : "text-red-500"}`}>
          <span>{checks[key] ? "✓" : "✗"}</span>{label}
        </li>
      ))}
    </ul>
  );
}
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Legend, Cell,
} from "recharts";
import {
  Users, Activity, HeartPulse, TrendingUp,
  ArrowUpRight, ArrowDownRight, Minus, Search,
  Database, Filter, ExternalLink, ShieldAlert, Lock,
  ArrowUp, Settings, X, Eye, EyeOff,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE;

// ─── Account Settings Modal ────────────────────────────────────────────────
function AccountSettings({ onClose }) {
  const username = sessionStorage.getItem("username") || "";
  const role = sessionStorage.getItem("role") || "";

  const [activeTab, setActiveTab] = useState("profile");

  // Password change state
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [showPw, setShowPw] = useState(false);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetupUri, setMfaSetupUri] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaSuccess, setMfaSuccess] = useState("");
  const [mfaStep, setMfaStep] = useState("idle"); // idle | setup | disable

  const getUsers = () => JSON.parse(localStorage.getItem("hinsight_users") || "[]");
  const saveUsers = (u) => localStorage.setItem("hinsight_users", JSON.stringify(u));
  const currentUser = () => getUsers().find((u) => u.username === username);

  useEffect(() => {
    const u = currentUser();
    setMfaEnabled(!!(u && u.totpSecret));
  }, []);

  // ── Password Change ──────────────────────────────────────────────
  const handlePasswordChange = (e) => {
    e.preventDefault();
    setPwError(""); setPwSuccess("");
    const users = getUsers();
    const u = users.find((x) => x.username === username);
    if (!u || u.password !== pwForm.current) { setPwError("Current password is incorrect."); return; }
    if (!isPasswordValid(pwForm.next)) { setPwError("New password does not meet the security requirements."); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError("New passwords do not match."); return; }
    saveUsers(users.map((x) => x.username === username ? { ...x, password: pwForm.next, passwordChangedAt: new Date().toISOString() } : x));
    setPwSuccess("Password updated successfully.");
    setPwForm({ current: "", next: "", confirm: "" });
  };

  // ── MFA Enable ───────────────────────────────────────────────────
  const handleStartMfaSetup = () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: "Hinsight", label: username,
      algorithm: "SHA1", digits: 6, period: 30, secret,
    });
    // Temporarily store secret for verification
    sessionStorage.setItem("pending_totp_secret", secret.base32);
    setMfaSetupUri(totp.toString());
    setMfaStep("setup");
    setMfaError(""); setMfaSuccess("");
  };

  const handleVerifyMfaSetup = (e) => {
    e.preventDefault();
    setMfaError("");
    const pendingSecret = sessionStorage.getItem("pending_totp_secret");
    if (!pendingSecret) { setMfaError("Setup expired. Please try again."); return; }
    const totp = new OTPAuth.TOTP({
      issuer: "Hinsight", label: username,
      algorithm: "SHA1", digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(pendingSecret),
    });
    const delta = totp.validate({ token: mfaCode.trim(), window: 1 });
    if (delta === null) { setMfaError("Invalid code. Please try again."); return; }
    const users = getUsers();
    saveUsers(users.map((u) => u.username === username ? { ...u, totpSecret: pendingSecret } : u));
    sessionStorage.removeItem("pending_totp_secret");
    setMfaEnabled(true);
    setMfaStep("idle");
    setMfaSuccess("MFA enabled successfully.");
    setMfaCode("");
  };

  // ── MFA Disable ──────────────────────────────────────────────────
  const handleDisableMfa = (e) => {
    e.preventDefault();
    setMfaError("");
    const u = currentUser();
    if (!u || !u.totpSecret) return;
    const totp = new OTPAuth.TOTP({
      issuer: "Hinsight", label: username,
      algorithm: "SHA1", digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(u.totpSecret),
    });
    const delta = totp.validate({ token: mfaCode.trim(), window: 1 });
    if (delta === null) { setMfaError("Invalid code. Please try again."); return; }
    const users = getUsers();
    saveUsers(users.map((x) => { const c = { ...x }; if (c.username === username) delete c.totpSecret; return c; }));
    setMfaEnabled(false);
    setMfaStep("idle");
    setMfaSuccess("MFA has been disabled.");
    setMfaCode("");
  };

  // Login activity
  const loginActivity = useMemo(() => {
    const activityKey = `hinsight_activity_${username}`;
    return JSON.parse(localStorage.getItem(activityKey) || "[]");
  }, [username]);

  const tabs = ["profile", "security", "session"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Account Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`py-3 px-4 text-sm font-medium capitalize border-b-2 transition ${
                activeTab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "session" ? "Session" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">

          {/* ── Profile Tab ── */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center text-white text-xl font-bold">
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-800">{username}</p>
                    <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      role === "support" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {role === "support" ? "Support User" : "Authorized User"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Username</span>
                  <span className="font-medium text-gray-800">{username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Role</span>
                  <span className="font-medium text-gray-800 capitalize">{role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">MFA Status</span>
                  <span className={`font-medium ${mfaEnabled ? "text-green-600" : "text-red-500"}`}>
                    {mfaEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                {loginActivity.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Login</span>
                    <span className="font-medium text-gray-800">
                      {new Date(loginActivity[0].time).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Login Activity Log */}
              {loginActivity.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Login Activity</h3>
                  <div className="rounded-2xl border border-gray-200 overflow-hidden">
                    {loginActivity.map((entry, i) => (
                      <div key={i} className={`flex items-center justify-between px-4 py-3 text-sm ${i !== 0 ? "border-t border-gray-100" : ""}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${entry.type === "success" ? "bg-green-500" : "bg-red-500"}`}></span>
                          <span className={entry.type === "success" ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                            {entry.type === "success" ? "Successful login" : "Failed attempt"}
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs">{new Date(entry.time).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Security Tab ── */}
          {activeTab === "security" && (
            <div className="space-y-6">

              {/* Change Password */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Change Password</h3>
                {pwError && <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{pwError}</div>}
                {pwSuccess && <div className="mb-3 rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{pwSuccess}</div>}
                <form onSubmit={handlePasswordChange} className="space-y-3">
                  {[
                    { label: "Current Password", field: "current" },
                    { label: "New Password", field: "next" },
                    { label: "Confirm New Password", field: "confirm" },
                  ].map(({ label, field }) => (
                    <div key={field} className="relative">
                      <label className="block text-sm text-gray-600 mb-1">{label}</label>
                      <input
                        type={showPw ? "text" : "password"}
                        value={pwForm[field]}
                        onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={label}
                      />
                      {field === "next" && <PasswordStrengthIndicator password={pwForm.next} />}
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowPw(!showPw)} className="text-xs text-gray-500 flex items-center gap-1">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showPw ? "Hide passwords" : "Show passwords"}
                    </button>
                  </div>
                  <button type="submit" className="w-full rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800 transition">
                    Update Password
                  </button>
                </form>
              </div>

              <hr className="border-gray-200" />

              {/* MFA Toggle */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Multi-Factor Authentication</h3>
                <p className="text-xs text-gray-500 mb-3">
                  {mfaEnabled ? "MFA is currently active on your account." : "Add an extra layer of security to your account."}
                </p>

                {mfaError && <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{mfaError}</div>}
                {mfaSuccess && <div className="mb-3 rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{mfaSuccess}</div>}

                {mfaStep === "idle" && (
                  <button
                    onClick={() => { setMfaError(""); setMfaSuccess(""); setMfaCode(""); mfaEnabled ? setMfaStep("disable") : handleStartMfaSetup(); }}
                    className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      mfaEnabled
                        ? "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {mfaEnabled ? "Disable MFA" : "Enable MFA"}
                  </button>
                )}

                {mfaStep === "setup" && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Scan this QR code with <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong>, then enter the 6-digit code to confirm.</p>
                    <div className="flex justify-center">
                      <QRCodeSVG value={mfaSetupUri} size={160} />
                    </div>
                    <form onSubmit={handleVerifyMfaSetup} className="space-y-3">
                      <input
                        type="text" inputMode="numeric" maxLength={6}
                        value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="000000" autoFocus
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setMfaStep("idle"); setMfaCode(""); sessionStorage.removeItem("pending_totp_secret"); }} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                        <button type="submit" className="flex-1 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition">Verify & Enable</button>
                      </div>
                    </form>
                  </div>
                )}

                {mfaStep === "disable" && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Enter your current authenticator code to confirm disabling MFA.</p>
                    <form onSubmit={handleDisableMfa} className="space-y-3">
                      <input
                        type="text" inputMode="numeric" maxLength={6}
                        value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="000000" autoFocus
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setMfaStep("idle"); setMfaCode(""); }} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                        <button type="submit" className="flex-1 rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 transition">Confirm Disable</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Session Tab ── */}
          {activeTab === "session" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">Session Timeout</p>
                <p className="text-sm text-blue-700">Your session automatically expires after <strong>15 minutes</strong> of inactivity. This is required under HIPAA security standards.</p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Timeout Duration</span>
                  <span className="font-medium text-gray-800">15 minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Can be disabled?</span>
                  <span className="font-medium text-red-500">No — HIPAA required</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">What happens on timeout?</span>
                  <span className="font-medium text-gray-800">Redirected to login</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">Tip: Note your active filters before stepping away — they will be lost on session expiry.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Admin Panel Modal ─────────────────────────────────────────────────────
function AdminPanel({ onClose }) {
  const getUsers = () => JSON.parse(localStorage.getItem("hinsight_users") || "[]");
  const saveUsers = (u) => localStorage.setItem("hinsight_users", JSON.stringify(u));

  const [users, setUsers] = useState(getUsers());
  const [successMsg, setSuccessMsg] = useState("");

  const refresh = () => setUsers(getUsers());

  const isLocked = (username) => {
    const lockout = localStorage.getItem(`hinsight_lockout_${username}`);
    if (!lockout) return false;
    return Date.now() - parseInt(lockout, 10) < 30 * 60 * 1000;
  };

  const handleRoleChange = (username, newRole) => {
    saveUsers(users.map((u) => u.username === username ? { ...u, role: newRole } : u));
    setSuccessMsg(`Role updated for ${username}`);
    refresh();
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleUnlock = (username) => {
    localStorage.removeItem(`hinsight_lockout_${username}`);
    localStorage.removeItem(`hinsight_attempts_${username}`);
    setSuccessMsg(`Account unlocked for ${username}`);
    refresh();
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleResetMfa = (username) => {
    saveUsers(users.map((u) => {
      const c = { ...u };
      if (c.username === username) delete c.totpSecret;
      return c;
    }));
    setSuccessMsg(`MFA reset for ${username} — they will set up MFA on next login`);
    refresh();
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDeleteUser = (username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) return;
    saveUsers(users.filter((u) => u.username !== username));
    refresh();
    setSuccessMsg(`User ${username} deleted`);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Admin — User Management</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage roles, lockouts, and MFA for all users</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X size={20} /></button>
        </div>

        <div className="px-6 py-4 max-h-[75vh] overflow-y-auto">
          {successMsg && (
            <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{successMsg}</div>
          )}

          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Username</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">MFA</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.username} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.username, e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="authorized">Authorized</option>
                        <option value="support">Support</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${u.totpSecret ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.totpSecret ? "Enabled" : "Not set"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${isLocked(u.username) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {isLocked(u.username) ? "Locked" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isLocked(u.username) && (
                          <button onClick={() => handleUnlock(u.username)} className="text-xs px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition">
                            Unlock
                          </button>
                        )}
                        {u.totpSecret && (
                          <button onClick={() => handleResetMfa(u.username)} className="text-xs px-2 py-1 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 hover:bg-yellow-100 transition">
                            Reset MFA
                          </button>
                        )}
                        <button onClick={() => handleDeleteUser(u.username)} className="text-xs px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
function Dashboard() {
  const [activePage, setActivePage] = useState("risk");
  const [activeSection, setActiveSection] = useState("community");
  const [currentRole, setCurrentRole] = useState("");
  const isSupport = currentRole === "support";
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const isAdmin = currentRole === "admin";

  const [summaryStats, setSummaryStats] = useState([]);
  const [factorSufferingData, setFactorSufferingData] = useState([]);
  const [factorRiskData, setFactorRiskData] = useState([]);
  const [conditionSufferingData, setConditionSufferingData] = useState([]);
  const [conditionRiskData, setConditionRiskData] = useState([]);
  const [factorConditionRows, setFactorConditionRows] = useState([]);
  const [severityRows, setSeverityRows] = useState([]);
  const [improvementRows, setImprovementRows] = useState([]);
  const [factorImprovementData, setFactorImprovementData] = useState([]);

  const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
  const [selectedCondition, setSelectedCondition] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [filterOptions, setFilterOptions] = useState({ regions: [], tenants: [] });
  const [globalFilters, setGlobalFilters] = useState({ startDate: "", endDate: "", region: "", tenant: "", factor: "" });

  const [explorerRows, setExplorerRows] = useState([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerError, setExplorerError] = useState("");
  const [explorerFilters, setExplorerFilters] = useState({ search: "", status: "", severity: "", factor: "", condition: "" });

  const riskSections = [
    { id: "community", label: "Community Health Overview" },
    { id: "correlation", label: "Condition Correlation" },
    { id: "severity", label: "Severity Distribution" },
  ];
  const improvementSections = [
    { id: "recovery", label: "Chronic Condition Recovery" },
    { id: "factor-improvement", label: "Factor Improvement" },
    { id: "high-priority", label: "High-Priority Success Rate" },
  ];
  const explorerSections = [{ id: "explorer", label: "Database Records" }];
  const currentSections = activePage === "risk" ? riskSections : activePage === "improvement" ? improvementSections : explorerSections;

  useEffect(() => { setActiveSection(currentSections[0].id); window.scrollTo({ top: 0, behavior: "smooth" }); }, [activePage]);
  useEffect(() => { if (isSupport && activePage === "explorer") setActivePage("risk"); }, [isSupport, activePage]);
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => {
    const savedRole = sessionStorage.getItem("role");
    if (!savedRole) window.location.href = "/";
    else setCurrentRole(savedRole);
  }, []);
  useEffect(() => {
    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        sessionStorage.removeItem("role");
        alert("Session expired due to inactivity. Please log in again.");
        window.location.href = "/";
      }, SESSION_TIMEOUT_MS);
    };
    const events = ["mousemove", "keydown", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => { clearTimeout(timeoutId); events.forEach((e) => window.removeEventListener(e, resetTimer)); };
  }, []);
  useEffect(() => {
    const handleScroll = () => {
      const sectionIds = currentSections.map((item) => item.id);
      const scrollPosition = window.scrollY + 180;
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const section = document.getElementById(sectionIds[i]);
        if (section && section.offsetTop <= scrollPosition) { setActiveSection(sectionIds[i]); break; }
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activePage, currentSections]);

  const buildGlobalQueryString = () => {
    const params = new URLSearchParams();
    if (globalFilters.startDate) params.append("start_date", globalFilters.startDate);
    if (globalFilters.endDate) params.append("end_date", globalFilters.endDate);
    if (globalFilters.region) params.append("region", globalFilters.region);
    if (globalFilters.tenant) params.append("tenant", globalFilters.tenant);
    if (globalFilters.factor) params.append("factor", globalFilters.factor);
    return params.toString();
  };

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/filter-options`);
        if (!res.ok) throw new Error();
        setFilterOptions(await res.json());
      } catch { console.error("Error fetching filter options"); }
    };
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    const fetchAllDashboardData = async () => {
      try {
        setLoading(true); setPageError("");
        const query = buildGlobalQueryString();
        const [sR, fsR, frR, csR, crR, fcR, sevR, impR, fiR] = await Promise.all([
          fetch(`${API_BASE}/api/summary-cards?${query}`),
          fetch(`${API_BASE}/api/factor-suffering-overview?${query}`),
          fetch(`${API_BASE}/api/factor-risk-overview?${query}`),
          fetch(`${API_BASE}/api/condition-suffering-overview?${query}`),
          fetch(`${API_BASE}/api/condition-risk-overview?${query}`),
          fetch(`${API_BASE}/api/factor-condition-suffering?${query}`),
          fetch(`${API_BASE}/api/factor-severity-suffering?${query}`),
          fetch(`${API_BASE}/api/condition-factor-improvement-suffering?${query}`),
          fetch(`${API_BASE}/api/factor-improvement-suffering?${query}`),
        ]);
        const responses = [sR, fsR, frR, csR, crR, fcR, sevR, impR, fiR];
        if (responses.find((r) => !r.ok)) throw new Error();
        const [sJ, fsJ, frJ, csJ, crJ, fcJ, sevJ, impJ, fiJ] = await Promise.all(responses.map((r) => r.json()));
        setSummaryStats(sJ); setFactorSufferingData(fsJ); setFactorRiskData(frJ);
        setConditionSufferingData(csJ); setConditionRiskData(crJ); setFactorConditionRows(fcJ);
        setSeverityRows(sevJ); setImprovementRows(impJ);
        setFactorImprovementData(fiJ.map((i) => ({ factor: i.factor, rate: Number(i.improvement_rate_percent) })));
      } catch { setPageError("Unable to load dashboard data from the backend."); }
      finally { setLoading(false); }
    };
    fetchAllDashboardData();
  }, [globalFilters]);

  useEffect(() => {
    if (activePage !== "explorer" || isSupport) return;
    const controller = new AbortController();
    const fetchExplorerData = async () => {
      try {
        setExplorerLoading(true); setExplorerError("");
        const params = new URLSearchParams();
        if (explorerFilters.search) params.append("search", explorerFilters.search);
        if (explorerFilters.status) params.append("status", explorerFilters.status);
        if (explorerFilters.severity) params.append("severity", explorerFilters.severity);
        if (explorerFilters.factor) params.append("condition_factor", explorerFilters.factor);
        if (explorerFilters.condition) params.append("condition", explorerFilters.condition);
        if (globalFilters.startDate) params.append("start_date", globalFilters.startDate);
        if (globalFilters.endDate) params.append("end_date", globalFilters.endDate);
        if (globalFilters.region) params.append("region", globalFilters.region);
        if (globalFilters.tenant) params.append("tenant", globalFilters.tenant);
        if (globalFilters.factor) params.append("factor", globalFilters.factor);
        const res = await fetch(`${API_BASE}/api/data-explorer?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error();
        setExplorerRows(await res.json());
      } catch (err) { if (err.name !== "AbortError") setExplorerError("Unable to load explorer records."); }
      finally { setExplorerLoading(false); }
    };
    fetchExplorerData();
    return () => controller.abort();
  }, [activePage, explorerFilters, globalFilters, isSupport]);

  const iconMap = { users: Users, activity: Activity, heart: HeartPulse, chart: TrendingUp };
  const supportSummaryStats = [
    { title: "Accessible Modules", value: "2", change: "Limited access", trend: "neutral", icon: "users" },
    { title: "Dashboard Status", value: "Active", change: "System online", trend: "neutral", icon: "activity" },
    { title: "Data Refresh", value: "Available", change: "Latest sync ready", trend: "neutral", icon: "chart" },
    { title: "Record Access", value: "Restricted", change: "Raw data hidden", trend: "neutral", icon: "heart" },
  ];
  const getTrendStyles = (trend) => {
    if (trend === "up") return { text: "text-red-600", bg: "bg-red-100", icon: <ArrowUpRight size={16} /> };
    if (trend === "down") return { text: "text-green-600", bg: "bg-green-100", icon: <ArrowDownRight size={16} /> };
    return { text: "text-yellow-700", bg: "bg-yellow-100", icon: <Minus size={16} /> };
  };
  const displaySummaryStats = isSupport ? supportSummaryStats : summaryStats;

  const conditionOptions = useMemo(() => [...new Set(factorConditionRows.map((r) => r.health_condition))].sort(), [factorConditionRows]);
  useEffect(() => { if (!selectedCondition && conditionOptions.length > 0) setSelectedCondition(conditionOptions[0]); }, [conditionOptions, selectedCondition]);
  const filteredCorrelationData = useMemo(() => factorConditionRows.filter((r) => r.health_condition === selectedCondition).map((r) => ({ factor: r.factor, employees: Number(r.number_of_employees_suffering) })).sort((a, b) => b.employees - a.employees), [factorConditionRows, selectedCondition]);

  const severityPercentData = useMemo(() => {
    const grouped = {};
    severityRows.forEach((row) => {
      const f = row.factor, s = (row.severity || "").toLowerCase(), v = Number(row.number_of_employees_suffering || 0);
      if (!grouped[f]) grouped[f] = { factor: f, important: 0, veryImportant: 0 };
      if (s === "important") grouped[f].important += v;
      if (s === "very important") grouped[f].veryImportant += v;
    });
    return Object.values(grouped).map((item) => {
      const total = item.important + item.veryImportant || 1;
      return { factor: item.factor, important: Number(((item.important / total) * 100).toFixed(1)), veryImportant: Number(((item.veryImportant / total) * 100).toFixed(1)) };
    });
  }, [severityRows]);

  const recoveryDonutData = useMemo(() => {
    const grouped = {};
    improvementRows.forEach((r) => {
      const c = r.health_condition, v = Number(r.improvement_rate_percent);
      if (!grouped[c]) grouped[c] = { total: 0, count: 0 };
      grouped[c].total += v; grouped[c].count += 1;
    });
    return Object.entries(grouped).map(([condition, s]) => ({ condition, rate: Number((s.total / s.count).toFixed(2)) })).sort((a, b) => b.rate - a.rate);
  }, [improvementRows]);

  const topConditionsForImprovement = useMemo(() => recoveryDonutData.slice(0, 4).map((i) => i.condition), [recoveryDonutData]);
  const groupedImprovementData = useMemo(() => {
    const grouped = {};
    improvementRows.filter((r) => topConditionsForImprovement.includes(r.health_condition)).forEach((r) => {
      if (!grouped[r.factor]) grouped[r.factor] = { factor: r.factor };
      grouped[r.factor][r.health_condition] = Number(r.improvement_rate_percent);
    });
    return Object.values(grouped);
  }, [improvementRows, topConditionsForImprovement]);

  const highPrioritySuccessData = useMemo(() => {
    const vip = new Set(severityRows.filter((r) => (r.severity || "").toLowerCase() === "very important" && Number(r.number_of_employees_suffering) > 0).map((r) => r.factor));
    return factorImprovementData.filter((i) => vip.has(i.factor)).sort((a, b) => b.rate - a.rate);
  }, [severityRows, factorImprovementData]);

  const explorerStatusOptions = useMemo(() => [...new Set(explorerRows.map((r) => r.status).filter(Boolean))].sort(), [explorerRows]);
  const explorerSeverityOptions = useMemo(() => [...new Set(explorerRows.map((r) => r.severity).filter(Boolean))].sort(), [explorerRows]);
  const explorerFactorOptions = useMemo(() => [...new Set(explorerRows.map((r) => r.factor).filter(Boolean))].sort(), [explorerRows]);
  const explorerConditionOptions = useMemo(() => [...new Set(explorerRows.map((r) => r.health_condition).filter(Boolean))].sort(), [explorerRows]);

  const handleExplorerFilterChange = (field, value) => setExplorerFilters((prev) => ({ ...prev, [field]: value }));
  const resetExplorerFilters = () => setExplorerFilters({ search: "", status: "", severity: "", factor: "", condition: "" });
  const resetGlobalFilters = () => setGlobalFilters({ startDate: "", endDate: "", region: "", tenant: "", factor: "" });
  const handleFactorBarClick = (state) => { if (state?.activeLabel) setGlobalFilters((prev) => ({ ...prev, factor: state.activeLabel })); };

  // Password expiry check
  const PASSWORD_EXPIRY_DAYS = 90;
  const passwordDaysLeft = useMemo(() => {
    const username = sessionStorage.getItem("username") || "";
    const users = JSON.parse(localStorage.getItem("hinsight_users") || "[]");
    const u = users.find((x) => x.username === username);
    if (!u || !u.passwordChangedAt) return null;
    const diff = Math.floor((Date.now() - new Date(u.passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24));
    return PASSWORD_EXPIRY_DAYS - diff;
  }, [showSettings]);

  return (
    <div className="min-h-screen bg-gray-100">
      {showSettings && <AccountSettings onClose={() => setShowSettings(false)} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-80 bg-slate-900 text-white p-6 flex-col">
        <h2 className="text-3xl font-bold mb-8">Hinsight</h2>
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">Analysis Pages</p>
          <div className="space-y-3">
            {[{ id: "risk", label: "Risk & Condition Analysis" }, { id: "improvement", label: "Improvement & Recovery Performance" }].map(({ id, label }) => (
              <button key={id} onClick={() => setActivePage(id)} className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-semibold transition ${activePage === id ? "bg-blue-600 text-white shadow-md" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}>{label}</button>
            ))}
            {!isSupport && (
              <button onClick={() => setActivePage("explorer")} className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-semibold transition ${activePage === "explorer" ? "bg-blue-600 text-white shadow-md" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}>Data Explorer</button>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">Page Sections</p>
          <nav className="space-y-2">
            {currentSections.map((item) => (
              <button key={item.id} onClick={() => { setActiveSection(item.id); document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-medium transition ${activeSection === item.id ? "bg-slate-700 text-white" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"}`}>{item.label}</button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="p-6 md:ml-80">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Hinsight Wellbeing Dashboard</h1>
              <p className="text-gray-600 mb-4">Employee wellbeing, health conditions, risk levels, improvement analytics, and data exploration.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium border border-gray-200 bg-white shadow-sm ${isSupport ? "text-amber-700" : "text-slate-700"}`}>
                <Lock size={14} />
                <span>{isSupport ? "Support User" : "Authorized User"}</span>
              </div>
              {isAdmin && (
                <button onClick={() => setShowAdmin(true)} className="flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 shadow-sm hover:bg-purple-100 transition">
                  <Users size={14} />
                  Admin
                </button>
              )}
              <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-gray-50 transition">
                <Settings size={14} />
                Settings
              </button>
              <button onClick={() => { sessionStorage.removeItem("role"); sessionStorage.removeItem("username"); window.location.href = "/"; }} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-gray-50 transition">
                Logout
              </button>
            </div>
          </div>

          {/* Password Expiry Banner */}
          {passwordDaysLeft !== null && passwordDaysLeft <= 14 && (
            <div className={`mb-6 rounded-2xl border p-4 flex items-start gap-3 ${
              passwordDaysLeft <= 0
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-yellow-50 border-yellow-200 text-yellow-800"
            }`}>
              <ShieldAlert size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {passwordDaysLeft <= 0
                    ? "Your password has expired!"
                    : `Your password expires in ${passwordDaysLeft} day${passwordDaysLeft === 1 ? "" : "s"}`}
                </p>
                <p className="text-sm mt-1">
                  Please update your password in{" "}
                  <button onClick={() => setShowSettings(true)} className="underline font-medium">
                    Settings → Security
                  </button>{" "}
                  to maintain access.
                </p>
              </div>
            </div>
          )}

          {isSupport && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="mt-0.5" />
                <div>
                  <p className="font-semibold">Sensitive health data is restricted for support users.</p>
                  <p className="text-sm mt-1">This demo view hides health metrics, analytics charts, and raw employee health records to reduce privacy exposure.</p>
                </div>
              </div>
            </div>
          )}

          {/* Global Filters */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={18} className="text-slate-600" />
              <h3 className="text-lg font-semibold text-gray-800">Global Filters</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Start Date</label>
                <input type="date" value={globalFilters.startDate} onChange={(e) => setGlobalFilters((p) => ({ ...p, startDate: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">End Date</label>
                <input type="date" value={globalFilters.endDate} onChange={(e) => setGlobalFilters((p) => ({ ...p, endDate: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <FilterSelect label="Region" value={globalFilters.region} onChange={(v) => setGlobalFilters((p) => ({ ...p, region: v }))} options={filterOptions.regions} />
              <FilterSelect label="Tenant" value={globalFilters.tenant} onChange={(v) => setGlobalFilters((p) => ({ ...p, tenant: v }))} options={filterOptions.tenants} />
              <div className="flex items-end">
                <button onClick={resetGlobalFilters} className="w-full rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition">Reset Filters</button>
              </div>
            </div>
            {globalFilters.factor && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-sm">
                Active Factor: {globalFilters.factor}
                <button onClick={() => setGlobalFilters((p) => ({ ...p, factor: "" }))} className="font-semibold">×</button>
              </div>
            )}
          </div>

          {pageError && activePage !== "explorer" && (
            <div className="mb-6 bg-red-50 text-red-600 border border-red-200 rounded-2xl p-4">{pageError}</div>
          )}

          {activePage !== "explorer" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
              {loading ? [...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 animate-pulse">
                  <div className="h-4 w-28 bg-gray-200 rounded mb-4"></div>
                  <div className="h-8 w-20 bg-gray-200 rounded mb-6"></div>
                  <div className="h-8 w-24 bg-gray-200 rounded"></div>
                </div>
              )) : displaySummaryStats.map((item) => {
                const IconComponent = iconMap[item.icon];
                const trendStyle = getTrendStyles(item.trend);
                return (
                  <div key={item.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">{item.title}</p>
                        <h2 className="text-2xl font-bold text-gray-800 mt-2">{item.value}</h2>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-100">
                        {IconComponent && <IconComponent size={22} className="text-slate-700" />}
                      </div>
                    </div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${trendStyle.text} ${trendStyle.bg}`}>
                      {trendStyle.icon}<span>{item.change}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activePage === "risk" && (
            <>
              <section id="community" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Community Health Overview</h2>
                <p className="text-gray-500 mb-6">Combined view of who is affected and who is currently at risk.</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Panel title="Users Suffering from Each Factor" loading={loading} restricted={isSupport}><BarChart data={factorSufferingData} onClick={handleFactorBarClick}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="factor" interval={0} /><YAxis /><Tooltip /><Bar dataKey="employees" fill="#2563eb" animationDuration={1200} /></BarChart></Panel>
                  <Panel title="Users at Risk by Factor" loading={loading} restricted={isSupport}><BarChart data={factorRiskData} onClick={handleFactorBarClick}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="factor" interval={0} /><YAxis /><Tooltip /><Bar dataKey="employees" fill="#60a5fa" animationDuration={1200} /></BarChart></Panel>
                  <Panel title="Users Living with Chronic Conditions" loading={loading} restricted={isSupport}><BarChart data={[...conditionSufferingData].sort((a, b) => b.employees - a.employees)} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="condition" width={180} /><Tooltip /><Bar dataKey="employees" fill="#2563eb" radius={[0, 8, 8, 0]} animationDuration={1200} /></BarChart></Panel>
                  <Panel title="Users at Risk of Developing Conditions" loading={loading} restricted={isSupport}><BarChart data={[...conditionRiskData].sort((a, b) => b.employees - a.employees)} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="condition" width={180} /><Tooltip /><Bar dataKey="employees" fill="#60a5fa" radius={[0, 8, 8, 0]} animationDuration={1200} /></BarChart></Panel>
                </div>
              </section>

              <section id="correlation" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Health Condition × Contributing Factor Correlation</h2>
                <p className="text-gray-500 mb-6">Select one condition to compare how strongly it appears across factors.</p>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <h3 className="text-lg font-semibold">Distribution by Selected Health Condition</h3>
                    {!isSupport && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Condition</label>
                        <select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {conditionOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {loading ? <EmptyChart text="Loading chart..." /> : isSupport ? <RestrictedChart text="Correlation chart hidden for support role." /> : (
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={filteredCorrelationData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 10 }} onClick={(s) => { if (s?.activeLabel) setGlobalFilters((p) => ({ ...p, factor: s.activeLabel })); }}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="factor" width={110} /><Tooltip />
                        <Bar dataKey="employees" fill="#2563eb" radius={[0, 8, 8, 0]} animationDuration={1200} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section id="severity" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Severity of Suffering Distribution</h2>
                <p className="text-gray-500 mb-6">100% stacked view of Important vs Very Important severity by factor.</p>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  {loading ? <EmptyChart text="Loading chart..." /> : isSupport ? <RestrictedChart text="Severity distribution hidden for support role." /> : (
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={severityPercentData} onClick={(s) => { if (s?.activeLabel) setGlobalFilters((p) => ({ ...p, factor: s.activeLabel })); }}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="factor" interval={0} /><YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} /><Tooltip formatter={(v) => `${v}%`} /><Legend />
                        <Bar dataKey="important" stackId="a" fill="#93c5fd" animationDuration={1200} />
                        <Bar dataKey="veryImportant" stackId="a" fill="#1d4ed8" animationDuration={1200} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>
            </>
          )}

          {activePage === "improvement" && (
            <>
              <section id="recovery" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Chronic Condition Recovery</h2>
                <p className="text-gray-500 mb-6">Average improvement percentage across conditions.</p>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  {loading ? <EmptyChart text="Loading chart..." /> : isSupport ? <RestrictedChart text="Recovery chart hidden for support role." /> : (
                    <ResponsiveContainer width="100%" height={380}>
                      <PieChart>
                        <Pie data={recoveryDonutData} dataKey="rate" nameKey="condition" innerRadius={80} outerRadius={130} paddingAngle={2} label>
                          {recoveryDonutData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section id="factor-improvement" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Contributing Factor Improvement</h2>
                <p className="text-gray-500 mb-6">Clustered comparison of factor improvement by top conditions.</p>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  {loading ? <EmptyChart text="Loading chart..." /> : isSupport ? <RestrictedChart text="Improvement chart hidden for support role." /> : (
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={groupedImprovementData} onClick={(s) => { if (s?.activeLabel) setGlobalFilters((p) => ({ ...p, factor: s.activeLabel })); }}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="factor" interval={0} /><YAxis /><Tooltip /><Legend />
                        {topConditionsForImprovement.map((c, i) => <Bar key={c} dataKey={c} fill={BAR_COLORS[i % BAR_COLORS.length]} animationDuration={1200} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section id="high-priority" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">High-Priority Success Rate</h2>
                <p className="text-gray-500 mb-6">Improvement rates for factors marked with Very Important severity.</p>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  {loading ? <EmptyChart text="Loading chart..." /> : isSupport ? <RestrictedChart text="High-priority success data hidden for support role." /> : (
                    <ResponsiveContainer width="100%" height={360}>
                      <PieChart>
                        <Pie data={highPrioritySuccessData} dataKey="rate" nameKey="factor" outerRadius={120} label>
                          {highPrioritySuccessData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>
            </>
          )}

          {activePage === "explorer" && !isSupport && (
            <section id="explorer" className="scroll-mt-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Data Explorer</h2>
              <p className="text-gray-500 mb-6">Search and filter records directly from the database.</p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2"><Database size={18} className="text-slate-600" /><h3 className="text-lg font-semibold text-gray-800">Search & Filters</h3></div>
                  <a href="https://lookerstudio.google.com/reporting/6efe4716-3bf4-4d86-a2bd-ca76c8563c1e" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition"><ExternalLink size={16} />Looker Studio Report</a>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
                  <div className="xl:col-span-1">
                    <label className="block text-sm text-gray-600 mb-2">Keyword Search</label>
                    <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" value={explorerFilters.search} onChange={(e) => handleExplorerFilterChange("search", e.target.value)} placeholder="Search records..." className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  </div>
                  <FilterSelect label="Status" value={explorerFilters.status} onChange={(v) => handleExplorerFilterChange("status", v)} options={explorerStatusOptions} />
                  <FilterSelect label="Severity" value={explorerFilters.severity} onChange={(v) => handleExplorerFilterChange("severity", v)} options={explorerSeverityOptions} />
                  <FilterSelect label="Factor" value={explorerFilters.factor} onChange={(v) => handleExplorerFilterChange("factor", v)} options={explorerFactorOptions} />
                  <FilterSelect label="Condition" value={explorerFilters.condition} onChange={(v) => handleExplorerFilterChange("condition", v)} options={explorerConditionOptions} />
                </div>
                <div className="flex justify-end"><button onClick={resetExplorerFilters} className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition">Reset Filters</button></div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Database Records</h3>
                  <span className="text-sm text-gray-500">{explorerRows.length} record(s)</span>
                </div>
                {explorerError && <div className="m-5 bg-red-50 text-red-600 border border-red-200 rounded-xl p-4">{explorerError}</div>}
                {explorerLoading ? <div className="p-10 text-center text-gray-400">Loading records...</div> : explorerRows.length === 0 ? <div className="p-10 text-center text-gray-400">No records found.</div> : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>{["Date","Employee ID","Region","Factor","Health Condition","Status","Severity","Value","Unit","Improvement Rate","Tenant"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {explorerRows.map((row, i) => (
                          <tr key={`${row.employee_id}-${row.date}-${i}`} className="border-t border-gray-100 hover:bg-slate-50">
                            <td className="px-4 py-3 whitespace-nowrap">{row.date}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.employee_id}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.region}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.factor}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.health_condition}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.status}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.severity}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.value}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.unit}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.improvement_rate}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{row.tenant}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {showBackToTop && (
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 bg-slate-900/90 text-white p-3 rounded-xl shadow-lg hover:bg-slate-800 hover:scale-105 transition">
            <ArrowUp size={18} />
          </button>
        )}
      </main>
    </div>
  );
}

function Panel({ title, loading, restricted = false, children }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {loading ? <EmptyChart text="Loading chart..." /> : restricted ? <RestrictedChart text="This chart is hidden for support users." /> : <ResponsiveContainer width="100%" height={380}>{children}</ResponsiveContainer>}
    </div>
  );
}
function EmptyChart({ text }) { return <div className="h-[380px] flex items-center justify-center text-gray-400">{text}</div>; }
function RestrictedChart({ text }) {
  return (
    <div className="min-h-[380px] flex flex-col items-center justify-center text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
      <Lock size={28} className="mb-3 text-slate-400" />
      <p className="font-medium">{text}</p>
      <p className="text-sm mt-1">Visible only to authorized users.</p>
    </div>
  );
}
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">All</option>
        {options.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  );
}

const BAR_COLORS = ["#2563eb","#60a5fa","#93c5fd","#1d4ed8","#38bdf8","#818cf8","#22c55e","#f59e0b"];
export default Dashboard;
