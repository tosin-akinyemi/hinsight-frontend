import { useState } from "react";

function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    role: "authorized",
  });

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const getStoredUsers = () => {
  const users = localStorage.getItem("hinsight_users");

  if (users) {
    return JSON.parse(users);
  }

  // default demo users
  const defaultUsers = [
    {
      username: "admin",
      password: "admin123",
      role: "authorized",
    },
    {
      username: "support",
      password: "support123",
      role: "support",
    },
  ];

  localStorage.setItem("hinsight_users", JSON.stringify(defaultUsers));
  return defaultUsers;
};

  const saveUsers = (users) => {
    localStorage.setItem("hinsight_users", JSON.stringify(users));
  };

  const handleLoginChange = (field, value) => {
    setLoginForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRegisterChange = (field, value) => {
    setRegisterForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const users = getStoredUsers();

    const matchedUser = users.find(
      (user) =>
        user.username === loginForm.username.trim() &&
        user.password === loginForm.password
    );

    if (!matchedUser) {
      setError("Invalid username or password.");
      return;
    }

    sessionStorage.setItem("role", matchedUser.role);
    sessionStorage.setItem("username", matchedUser.username);

    window.location.href = "/dashboard";
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const username = registerForm.username.trim();
    const password = registerForm.password;

    if (!username || !password) {
      setError("Please complete all required fields.");
      return;
    }

    const users = getStoredUsers();

    const existingUser = users.find((user) => user.username === username);

    if (existingUser) {
      setError("This username already exists.");
      return;
    }

    const newUser = {
      username,
      password,
      role: registerForm.role,
    };

    const updatedUsers = [...users, newUser];
    saveUsers(updatedUsers);

    setSuccessMessage("Registration successful. You can now sign in.");
    setRegisterForm({
      username: "",
      password: "",
      role: "authorized",
    });
    setIsRegisterMode(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Hinsight Access Portal
        </h1>
        <p className="text-gray-500 mb-6">
          {isRegisterMode
            ? "Create a demo account to access the dashboard."
            : "Sign in to continue to the dashboard."}
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {!isRegisterMode ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Username
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) =>
                  handleLoginChange("username", e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Password
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  handleLoginChange("password", e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-medium hover:bg-slate-800 transition"
            >
              Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Username
              </label>
              <input
                type="text"
                value={registerForm.username}
                onChange={(e) =>
                  handleRegisterChange("username", e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Create username"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Password
              </label>
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) =>
                  handleRegisterChange("password", e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Create password"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Role
              </label>
              <select
                value={registerForm.role}
                onChange={(e) =>
                  handleRegisterChange("role", e.target.value)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="authorized">Authorized User</option>
                <option value="support">Support User</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 text-white px-4 py-3 text-sm font-medium hover:bg-blue-700 transition"
            >
              Register User
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          {!isRegisterMode ? (
            <button
              onClick={() => {
                setIsRegisterMode(true);
                setError("");
                setSuccessMessage("");
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Create a new user
            </button>
          ) : (
            <button
              onClick={() => {
                setIsRegisterMode(false);
                setError("");
                setSuccessMessage("");
              }}
              className="text-sm text-slate-600 hover:text-slate-700 font-medium"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;