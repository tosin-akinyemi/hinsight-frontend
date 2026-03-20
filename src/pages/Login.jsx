
import { useState } from "react";
import * as OTPAuth from "otpauth";
import { QRCodeSVG } from "qrcode.react";

const MAX_ATTEMPTS = 5;

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
          <span>{checks[key] ? "✓" : "✗"}</span>
          {label}
        </li>
      ))}
    </ul>
  );
}

function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", password: "" });

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [isNewDevice, setIsNewDevice] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  // ─── Storage helpers ───────────────────────────────────────────────
  const getUsers = () => {
    const users = localStorage.getItem("hinsight_users");
    if (users) return JSON.parse(users);
    const defaultUsers = [
      { username: "admin", password: "admin123", role: "admin", passwordChangedAt: new Date().toISOString() },
      { username: "authorized", password: "auth123", role: "authorized", passwordChangedAt: new Date().toISOString() },
      { username: "support", password: "support123", role: "support", passwordChangedAt: new Date().toISOString() },
    ];
    localStorage.setItem("hinsight_users", JSON.stringify(defaultUsers));
    return defaultUsers;
  };

  const saveUsers = (users) =>
    localStorage.setItem("hinsight_users", JSON.stringify(users));

  // ─── Lockout helpers ───────────────────────────────────────────────
  const getLockoutKey  = (u) => `hinsight_lockout_${u}`;
  const getAttemptsKey = (u) => `hinsight_attempts_${u}`;

  const isAccountLocked = (username) => {
    const lockout = localStorage.getItem(getLockoutKey(username));
    if (!lockout) return false;
    if (Date.now() - parseInt(lockout, 10) < 30 * 60 * 1000) return true;
    localStorage.removeItem(getLockoutKey(username));
    localStorage.removeItem(getAttemptsKey(username));
    return false;
  };

  const getFailedAttempts = (username) =>
    parseInt(localStorage.getItem(getAttemptsKey(username)) || "0", 10);

  const incrementFailedAttempts = (username) => {
    const attempts = getFailedAttempts(username) + 1;
    localStorage.setItem(getAttemptsKey(username), attempts);
    if (attempts >= MAX_ATTEMPTS)
      localStorage.setItem(getLockoutKey(username), Date.now().toString());

    // Record failed login activity
    const activityKey = `hinsight_activity_${username}`;
    const existing = JSON.parse(localStorage.getItem(activityKey) || "[]");
    const updated = [
      { type: "failed", time: new Date().toISOString() },
      ...existing,
    ].slice(0, 10);
    localStorage.setItem(activityKey, JSON.stringify(updated));

    return attempts;
  };

  const clearFailedAttempts = (username) => {
    localStorage.removeItem(getAttemptsKey(username));
    localStorage.removeItem(getLockoutKey(username));
  };

  // ─── Form handlers ─────────────────────────────────────────────────
  const handleLoginChange    = (f, v) => setLoginForm((p)    => ({ ...p, [f]: v }));
  const handleRegisterChange = (f, v) => setRegisterForm((p) => ({ ...p, [f]: v }));

  // ─── Step 1: Verify username + password ───────────────────────────
  const handleLogin = (e) => {
    e.preventDefault();
    setError(""); setSuccessMessage("");
    const username = loginForm.username.trim();

    if (isAccountLocked(username)) {
      setError("Your account has been locked due to too many failed login attempts. Please wait 30 minutes or contact your administrator.");
      return;
    }

    const users = getUsers();
    const matchedUser = users.find(
      (u) => u.username === username && u.password === loginForm.password
    );

    if (!matchedUser) {
      const attempts  = incrementFailedAttempts(username);
      const remaining = MAX_ATTEMPTS - attempts;
      if (remaining <= 0) {
        setError("Your account has been locked due to too many failed login attempts. Please wait 30 minutes or contact your administrator.");
      } else {
        setError(`Invalid username or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`);
      }
      return;
    }

    clearFailedAttempts(username);
    setPendingUser(matchedUser);

    if (matchedUser.totpSecret) {
      setIsNewDevice(false);
      setMfaStep(true);
    } else {
      const secret = new OTPAuth.Secret({ size: 20 });
      const totp   = new OTPAuth.TOTP({ issuer: "Hinsight", label: matchedUser.username, algorithm: "SHA1", digits: 6, period: 30, secret });
      saveUsers(users.map((u) => u.username === matchedUser.username ? { ...u, totpSecret: secret.base32 } : u));
      setPendingUser({ ...matchedUser, totpSecret: secret.base32 });
      setTotpUri(totp.toString());
      setIsNewDevice(true);
      setMfaStep(true);
    }
  };

  // ─── Step 2: Verify TOTP ───────────────────────────────────────────
  const handleVerifyMfa = (e) => {
    e.preventDefault();
    setError("");
    const totp = new OTPAuth.TOTP({ issuer: "Hinsight", label: pendingUser.username, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(pendingUser.totpSecret) });
    if (totp.validate({ token: mfaCode.trim(), window: 1 }) === null) { setError("Invalid code. Please try again."); return; }
    sessionStorage.setItem("role", pendingUser.role);
    sessionStorage.setItem("username", pendingUser.username);

    // Record login activity
    const activityKey = `hinsight_activity_${pendingUser.username}`;
    const existing = JSON.parse(localStorage.getItem(activityKey) || "[]");
    const updated = [
      { type: "success", time: new Date().toISOString() },
      ...existing,
    ].slice(0, 10);
    localStorage.setItem(activityKey, JSON.stringify(updated));

    // Save passwordChangedAt if not already set
    const users = getUsers();
    const u = users.find((x) => x.username === pendingUser.username);
    if (!u.passwordChangedAt) {
      saveUsers(users.map((x) => x.username === pendingUser.username
        ? { ...x, passwordChangedAt: new Date().toISOString() }
        : x
      ));
    }

    window.location.href = "/dashboard";
  };

  // ─── Register ──────────────────────────────────────────────────────
  const handleRegister = (e) => {
    e.preventDefault();
    setError(""); setSuccessMessage("");
    const username = registerForm.username.trim();
    const password = registerForm.password;

    if (!username || !password) { setError("Please complete all required fields."); return; }
    if (!isPasswordValid(password)) { setError("Password does not meet the security requirements below."); return; }

    const users = getUsers();
    if (users.find((u) => u.username === username)) { setError("This username already exists."); return; }

    saveUsers([...users, { username, password, role: "support", createdAt: new Date().toISOString(), passwordChangedAt: new Date().toISOString() }]);
    setSuccessMessage("Registration successful. You have been assigned restricted access. Contact your administrator to request full access. You can now sign in.");
    setRegisterForm({ username: "", password: "" });
    setIsRegisterMode(false);
  };

  // ─── UI ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-sm border border-gray-200 p-8">

        {/* ── MFA Screen ── */}
        {mfaStep ? (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Two-Factor Authentication</h1>
            {isNewDevice ? (
              <>
                <p className="text-gray-500 mb-4 text-sm">Scan this QR code with <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong>, then enter the 6-digit code below.</p>
                <div className="flex justify-center mb-6"><QRCodeSVG value={totpUri} size={180} /></div>
              </>
            ) : (
              <p className="text-gray-500 mb-6 text-sm">Open your authenticator app and enter the 6-digit code for <strong>Hinsight</strong>.</p>
            )}
            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">6-Digit Code</label>
                <input type="text" inputMode="numeric" maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="000000" autoFocus />
              </div>
              <button type="submit" className="w-full rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-medium hover:bg-slate-800 transition">Verify & Sign In</button>
            </form>
            <div className="mt-6 text-center">
              <button onClick={() => { setMfaStep(false); setMfaCode(""); setError(""); setPendingUser(null); }} className="text-sm text-slate-600 hover:text-slate-700 font-medium">← Back to sign in</button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Hinsight Access Portal</h1>
            <p className="text-gray-500 mb-6">
              {isRegisterMode ? "Create an account. Your administrator will assign your role." : "Sign in to continue to the dashboard."}
            </p>

            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {successMessage && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>}

            {!isRegisterMode ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Username</label>
                  <input type="text" value={loginForm.username} onChange={(e) => handleLoginChange("username", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter username" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Password</label>
                  <input type="password" value={loginForm.password} onChange={(e) => handleLoginChange("password", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter password" />
                </div>
                <button type="submit" className="w-full rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-medium hover:bg-slate-800 transition">Sign In</button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Username</label>
                  <input type="text" value={registerForm.username} onChange={(e) => handleRegisterChange("username", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Create username" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Password</label>
                  <input type="password" value={registerForm.password} onChange={(e) => handleRegisterChange("password", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Create a strong password" />
                  <PasswordStrengthIndicator password={registerForm.password} />
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                  New accounts are assigned <strong>restricted access</strong> by default in accordance with HIPAA's Minimum Necessary Standard. Contact your administrator to request full access.
                </div>
                <button type="submit" className="w-full rounded-xl bg-blue-600 text-white px-4 py-3 text-sm font-medium hover:bg-blue-700 transition">Register User</button>
              </form>
            )}

            <div className="mt-6 text-center">
              {!isRegisterMode ? (
                <button onClick={() => { setIsRegisterMode(true); setError(""); setSuccessMessage(""); }} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Create a new user</button>
              ) : (
                <button onClick={() => { setIsRegisterMode(false); setError(""); setSuccessMessage(""); }} className="text-sm text-slate-600 hover:text-slate-700 font-medium">Back to sign in</button>
              )}
            </div>


          </>
        )}
      </div>
    </div>
  );
}

export default Login;
