import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
  Cell,
} from "recharts";
import {
  Users,
  Activity,
  HeartPulse,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Search,
  Database,
  Filter,
  ExternalLink,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE;

function Dashboard() {
  const [activePage, setActivePage] = useState("risk");
  const [activeSection, setActiveSection] = useState("community");

  const [summaryStats, setSummaryStats] = useState([]);
  const [factorSufferingData, setFactorSufferingData] = useState([]);
  const [factorRiskData, setFactorRiskData] = useState([]);
  const [conditionSufferingData, setConditionSufferingData] = useState([]);
  const [conditionRiskData, setConditionRiskData] = useState([]);
  const [factorConditionRows, setFactorConditionRows] = useState([]);
  const [severityRows, setSeverityRows] = useState([]);
  const [improvementRows, setImprovementRows] = useState([]);
  const [factorImprovementData, setFactorImprovementData] = useState([]);

  const [selectedCondition, setSelectedCondition] = useState("");

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [filterOptions, setFilterOptions] = useState({
    regions: [],
    tenants: [],
  });

  const [globalFilters, setGlobalFilters] = useState({
    startDate: "",
    endDate: "",
    region: "",
    tenant: "",
    factor: "",
  });

  // Data Explorer
  const [explorerRows, setExplorerRows] = useState([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerError, setExplorerError] = useState("");
  const [explorerFilters, setExplorerFilters] = useState({
    search: "",
    status: "",
    severity: "",
    factor: "",
    condition: "",
  });

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

  const currentSections =
    activePage === "risk"
      ? riskSections
      : activePage === "improvement"
      ? improvementSections
      : explorerSections;

  useEffect(() => {
    setActiveSection(currentSections[0].id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activePage]);

  useEffect(() => {
    const handleScroll = () => {
      const sectionIds = currentSections.map((item) => item.id);
      const scrollPosition = window.scrollY + 180;

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const section = document.getElementById(sectionIds[i]);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sectionIds[i]);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [activePage]);

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
        const response = await fetch(`${API_BASE}/api/filter-options`);
        if (!response.ok) {
          throw new Error("Failed to fetch filter options");
        }
        const data = await response.json();
        setFilterOptions(data);
      } catch (error) {
        console.error("Error fetching filter options:", error);
      }
    };

    fetchFilterOptions();
  }, []);

  useEffect(() => {
    const fetchAllDashboardData = async () => {
      try {
        setLoading(true);
        setPageError("");

        const query = buildGlobalQueryString();

        const [
          summaryRes,
          factorSufferingRes,
          factorRiskRes,
          conditionSufferingRes,
          conditionRiskRes,
          factorConditionRes,
          severityRes,
          improvementConditionRes,
          factorImprovementRes,
        ] = await Promise.all([
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

        const responses = [
          summaryRes,
          factorSufferingRes,
          factorRiskRes,
          conditionSufferingRes,
          conditionRiskRes,
          factorConditionRes,
          severityRes,
          improvementConditionRes,
          factorImprovementRes,
        ];

        const failed = responses.find((res) => !res.ok);
        if (failed) {
          throw new Error("One or more dashboard API requests failed.");
        }

        const [
          summaryJson,
          factorSufferingJson,
          factorRiskJson,
          conditionSufferingJson,
          conditionRiskJson,
          factorConditionJson,
          severityJson,
          improvementConditionJson,
          factorImprovementJson,
        ] = await Promise.all(responses.map((res) => res.json()));

        setSummaryStats(summaryJson);
        setFactorSufferingData(factorSufferingJson);
        setFactorRiskData(factorRiskJson);
        setConditionSufferingData(conditionSufferingJson);
        setConditionRiskData(conditionRiskJson);
        setFactorConditionRows(factorConditionJson);
        setSeverityRows(severityJson);
        setImprovementRows(improvementConditionJson);
        setFactorImprovementData(
          factorImprovementJson.map((item) => ({
            factor: item.factor,
            rate: Number(item.improvement_rate_percent),
          }))
        );
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        setPageError("Unable to load dashboard data from the backend.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllDashboardData();
  }, [globalFilters]);

  useEffect(() => {
    if (activePage !== "explorer") return;

    const controller = new AbortController();

    const fetchExplorerData = async () => {
      try {
        setExplorerLoading(true);
        setExplorerError("");

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

        const response = await fetch(
          `${API_BASE}/api/data-explorer?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch explorer data.");
        }

        const data = await response.json();
        setExplorerRows(data);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error fetching explorer data:", error);
          setExplorerError("Unable to load explorer records.");
        }
      } finally {
        setExplorerLoading(false);
      }
    };

    fetchExplorerData();

    return () => controller.abort();
  }, [activePage, explorerFilters, globalFilters]);

  const iconMap = {
    users: Users,
    activity: Activity,
    heart: HeartPulse,
    chart: TrendingUp,
  };

  const getTrendStyles = (trend) => {
    if (trend === "up") {
      return {
        text: "text-red-600",
        bg: "bg-red-100",
        icon: <ArrowUpRight size={16} />,
      };
    }

    if (trend === "down") {
      return {
        text: "text-green-600",
        bg: "bg-green-100",
        icon: <ArrowDownRight size={16} />,
      };
    }

    return {
      text: "text-yellow-700",
      bg: "bg-yellow-100",
      icon: <Minus size={16} />,
    };
  };

  const conditionOptions = useMemo(() => {
    const unique = [...new Set(factorConditionRows.map((row) => row.health_condition))];
    return unique.sort();
  }, [factorConditionRows]);

  useEffect(() => {
    if (!selectedCondition && conditionOptions.length > 0) {
      setSelectedCondition(conditionOptions[0]);
    }
  }, [conditionOptions, selectedCondition]);

  const filteredCorrelationData = useMemo(() => {
    return factorConditionRows
      .filter((row) => row.health_condition === selectedCondition)
      .map((row) => ({
        factor: row.factor,
        employees: Number(row.number_of_employees_suffering),
      }))
      .sort((a, b) => b.employees - a.employees);
  }, [factorConditionRows, selectedCondition]);

  const severityPercentData = useMemo(() => {
    const grouped = {};

    severityRows.forEach((row) => {
      const factor = row.factor;
      const severity = (row.severity || "").toLowerCase();
      const value = Number(row.number_of_employees_suffering || 0);

      if (!grouped[factor]) {
        grouped[factor] = {
          factor,
          important: 0,
          veryImportant: 0,
        };
      }

      if (severity === "important") grouped[factor].important += value;
      if (severity === "very important") grouped[factor].veryImportant += value;
    });

    return Object.values(grouped).map((item) => {
      const total = item.important + item.veryImportant || 1;
      return {
        factor: item.factor,
        important: Number(((item.important / total) * 100).toFixed(1)),
        veryImportant: Number(((item.veryImportant / total) * 100).toFixed(1)),
      };
    });
  }, [severityRows]);

  const recoveryDonutData = useMemo(() => {
    const grouped = {};

    improvementRows.forEach((row) => {
      const condition = row.health_condition;
      const value = Number(row.improvement_rate_percent);

      if (!grouped[condition]) {
        grouped[condition] = { total: 0, count: 0 };
      }

      grouped[condition].total += value;
      grouped[condition].count += 1;
    });

    return Object.entries(grouped)
      .map(([condition, stats]) => ({
        condition,
        rate: Number((stats.total / stats.count).toFixed(2)),
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [improvementRows]);

  const topConditionsForImprovement = useMemo(() => {
    return recoveryDonutData.slice(0, 4).map((item) => item.condition);
  }, [recoveryDonutData]);

  const groupedImprovementData = useMemo(() => {
    const grouped = {};

    improvementRows
      .filter((row) => topConditionsForImprovement.includes(row.health_condition))
      .forEach((row) => {
        const factor = row.factor;
        const condition = row.health_condition;
        const value = Number(row.improvement_rate_percent);

        if (!grouped[factor]) {
          grouped[factor] = { factor };
        }

        grouped[factor][condition] = value;
      });

    return Object.values(grouped);
  }, [improvementRows, topConditionsForImprovement]);

  const highPrioritySuccessData = useMemo(() => {
    const veryImportantFactors = new Set(
      severityRows
        .filter((row) => (row.severity || "").toLowerCase() === "very important")
        .filter((row) => Number(row.number_of_employees_suffering) > 0)
        .map((row) => row.factor)
    );

    return factorImprovementData
      .filter((item) => veryImportantFactors.has(item.factor))
      .sort((a, b) => b.rate - a.rate);
  }, [severityRows, factorImprovementData]);

  const explorerStatusOptions = useMemo(() => {
    const values = [...new Set(explorerRows.map((row) => row.status).filter(Boolean))];
    return values.sort();
  }, [explorerRows]);

  const explorerSeverityOptions = useMemo(() => {
    const values = [...new Set(explorerRows.map((row) => row.severity).filter(Boolean))];
    return values.sort();
  }, [explorerRows]);

  const explorerFactorOptions = useMemo(() => {
    const values = [...new Set(explorerRows.map((row) => row.factor).filter(Boolean))];
    return values.sort();
  }, [explorerRows]);

  const explorerConditionOptions = useMemo(() => {
    const values = [...new Set(explorerRows.map((row) => row.health_condition).filter(Boolean))];
    return values.sort();
  }, [explorerRows]);

  const handleExplorerFilterChange = (field, value) => {
    setExplorerFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetExplorerFilters = () => {
    setExplorerFilters({
      search: "",
      status: "",
      severity: "",
      factor: "",
      condition: "",
    });
  };

  const resetGlobalFilters = () => {
    setGlobalFilters({
      startDate: "",
      endDate: "",
      region: "",
      tenant: "",
      factor: "",
    });
  };

  const handleFactorBarClick = (state) => {
    if (state && state.activeLabel) {
      setGlobalFilters((prev) => ({
        ...prev,
        factor: state.activeLabel,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-80 bg-slate-900 text-white p-6 flex-col">
        <h2 className="text-3xl font-bold mb-8">Hinsight</h2>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">
            Analysis Pages
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setActivePage("risk")}
              className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activePage === "risk"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              Risk & Condition Analysis
            </button>

            <button
              onClick={() => setActivePage("improvement")}
              className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activePage === "improvement"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              Improvement & Recovery Performance
            </button>

            <button
              onClick={() => setActivePage("explorer")}
              className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                activePage === "explorer"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              Data Explorer

              
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">
            Page Sections
          </p>

          <nav className="space-y-2">
            {currentSections.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  const el = document.getElementById(item.id);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={`w-full text-left rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  activeSection === item.id
                    ? "bg-slate-700 text-white"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="p-6 md:ml-80">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Hinsight Wellbeing Dashboard
          </h1>
          <p className="text-gray-600 mb-6">
            Employee wellbeing, health conditions, risk levels, improvement analytics, and data exploration.
          </p>

          {/* Global Filters */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={18} className="text-slate-600" />
              <h3 className="text-lg font-semibold text-gray-800">Global Filters</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Start Date</label>
                <input
                  type="date"
                  value={globalFilters.startDate}
                  onChange={(e) =>
                    setGlobalFilters((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">End Date</label>
                <input
                  type="date"
                  value={globalFilters.endDate}
                  onChange={(e) =>
                    setGlobalFilters((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <FilterSelect
                label="Region"
                value={globalFilters.region}
                onChange={(value) =>
                  setGlobalFilters((prev) => ({ ...prev, region: value }))
                }
                options={filterOptions.regions}
              />

              <FilterSelect
                label="Tenant"
                value={globalFilters.tenant}
                onChange={(value) =>
                  setGlobalFilters((prev) => ({ ...prev, tenant: value }))
                }
                options={filterOptions.tenants}
              />

              <div className="flex items-end">
                <button
                  onClick={resetGlobalFilters}
                  className="w-full rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {globalFilters.factor && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-sm">
                Active Factor: {globalFilters.factor}
                <button
                  onClick={() =>
                    setGlobalFilters((prev) => ({ ...prev, factor: "" }))
                  }
                  className="font-semibold"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {pageError && activePage !== "explorer" && (
            <div className="mb-6 bg-red-50 text-red-600 border border-red-200 rounded-2xl p-4">
              {pageError}
            </div>
          )}

          {activePage !== "explorer" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
              {loading ? (
                [...Array(4)].map((_, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 animate-pulse"
                  >
                    <div className="h-4 w-28 bg-gray-200 rounded mb-4"></div>
                    <div className="h-8 w-20 bg-gray-200 rounded mb-6"></div>
                    <div className="h-8 w-24 bg-gray-200 rounded"></div>
                  </div>
                ))
              ) : (
                summaryStats.map((item) => {
                  const IconComponent = iconMap[item.icon];
                  const trendStyle = getTrendStyles(item.trend);

                  return (
                    <div
                      key={item.title}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-sm text-gray-500">{item.title}</p>
                          <h2 className="text-2xl font-bold text-gray-800 mt-2">
                            {item.value}
                          </h2>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-100">
                          {IconComponent && (
                            <IconComponent size={22} className="text-slate-700" />
                          )}
                        </div>
                      </div>

                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${trendStyle.text} ${trendStyle.bg}`}
                      >
                        {trendStyle.icon}
                        <span>{item.change}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activePage === "risk" && (
            <>
              <section id="community" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  Community Health Overview
                </h2>
                <p className="text-gray-500 mb-6">
                  Combined view of who is affected and who is currently at risk.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Panel title="Users Suffering from Each Factor" loading={loading}>
                    <BarChart data={factorSufferingData} onClick={handleFactorBarClick}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="factor" interval={0} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="employees" fill="#2563eb" animationDuration={1200} />
                    </BarChart>
                  </Panel>

                  <Panel title="Users at Risk by Factor" loading={loading}>
                    <BarChart data={factorRiskData} onClick={handleFactorBarClick}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="factor" interval={0} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="employees" fill="#60a5fa" animationDuration={1200} />
                    </BarChart>
                  </Panel>

                  <Panel title="Users Living with Chronic Conditions" loading={loading}>
                    <BarChart
                      data={[...conditionSufferingData].sort((a, b) => b.employees - a.employees)}
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="condition" width={180} />
                      <Tooltip />
                      <Bar
                        dataKey="employees"
                        fill="#2563eb"
                        radius={[0, 8, 8, 0]}
                        animationDuration={1200}
                      />
                    </BarChart>
                  </Panel>

                  <Panel title="Users at Risk of Developing Conditions" loading={loading}>
                    <BarChart
                      data={[...conditionRiskData].sort((a, b) => b.employees - a.employees)}
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="condition" width={180} />
                      <Tooltip />
                      <Bar
                        dataKey="employees"
                        fill="#60a5fa"
                        radius={[0, 8, 8, 0]}
                        animationDuration={1200}
                      />
                    </BarChart>
                  </Panel>
                </div>
              </section>

              <section id="correlation" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  Health Condition × Contributing Factor Correlation
                </h2>
                <p className="text-gray-500 mb-6">
                  Select one condition to compare how strongly it appears across factors.
                </p>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <h3 className="text-lg font-semibold">
                      Distribution by Selected Health Condition
                    </h3>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Condition</label>
                      <select
                        value={selectedCondition}
                        onChange={(e) => setSelectedCondition(e.target.value)}
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {conditionOptions.map((condition) => (
                          <option key={condition} value={condition}>
                            {condition}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {loading ? (
                    <EmptyChart text="Loading chart..." />
                  ) : (
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart
                        data={filteredCorrelationData}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                        onClick={(state) => {
                          if (state && state.activeLabel) {
                            setGlobalFilters((prev) => ({
                              ...prev,
                              factor: state.activeLabel,
                            }));
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="factor" width={110} />
                        <Tooltip />
                        <Bar
                          dataKey="employees"
                          fill="#2563eb"
                          radius={[0, 8, 8, 0]}
                          animationDuration={1200}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section id="severity" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  Severity of Suffering Distribution
                </h2>
                <p className="text-gray-500 mb-6">
                  100% stacked view of Important vs Very Important severity by factor.
                </p>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  {loading ? (
                    <EmptyChart text="Loading chart..." />
                  ) : (
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart
                        data={severityPercentData}
                        onClick={(state) => {
                          if (state && state.activeLabel) {
                            setGlobalFilters((prev) => ({
                              ...prev,
                              factor: state.activeLabel,
                            }));
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="factor" interval={0} />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar
                          dataKey="important"
                          stackId="a"
                          fill="#93c5fd"
                          animationDuration={1200}
                        />
                        <Bar
                          dataKey="veryImportant"
                          stackId="a"
                          fill="#1d4ed8"
                          animationDuration={1200}
                        />
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
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  Chronic Condition Recovery
                </h2>
                <p className="text-gray-500 mb-6">
                  Average improvement percentage across conditions.
                </p>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  {loading ? (
                    <EmptyChart text="Loading chart..." />
                  ) : (
                    <ResponsiveContainer width="100%" height={380}>
                      <PieChart>
                        <Pie
                          data={recoveryDonutData}
                          dataKey="rate"
                          nameKey="condition"
                          innerRadius={80}
                          outerRadius={130}
                          paddingAngle={2}
                          label
                        >
                          {recoveryDonutData.map((_, index) => (
                            <Cell
                              key={index}
                              fill={BAR_COLORS[index % BAR_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section id="factor-improvement" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  Contributing Factor Improvement
                </h2>
                <p className="text-gray-500 mb-6">
                  Clustered comparison of factor improvement by top conditions.
                </p>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  {loading ? (
                    <EmptyChart text="Loading chart..." />
                  ) : (
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart
                        data={groupedImprovementData}
                        onClick={(state) => {
                          if (state && state.activeLabel) {
                            setGlobalFilters((prev) => ({
                              ...prev,
                              factor: state.activeLabel,
                            }));
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="factor" interval={0} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {topConditionsForImprovement.map((condition, index) => (
                          <Bar
                            key={condition}
                            dataKey={condition}
                            fill={BAR_COLORS[index % BAR_COLORS.length]}
                            animationDuration={1200}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section id="high-priority" className="mb-12 scroll-mt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  High-Priority Success Rate
                </h2>
                <p className="text-gray-500 mb-6">
                  Improvement rates for factors marked with Very Important severity.
                </p>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                  {loading ? (
                    <EmptyChart text="Loading chart..." />
                  ) : (
                    <ResponsiveContainer width="100%" height={360}>
                      <PieChart>
                        <Pie
                          data={highPrioritySuccessData}
                          dataKey="rate"
                          nameKey="factor"
                          outerRadius={120}
                          label
                        >
                          {highPrioritySuccessData.map((_, index) => (
                            <Cell
                              key={index}
                              fill={BAR_COLORS[index % BAR_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>
            </>
          )}

          {activePage === "explorer" && (
            <section id="explorer" className="scroll-mt-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Data Explorer
              </h2>
              <p className="text-gray-500 mb-6">
                Search and filter records directly from the database.
              </p>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
  <div className="flex items-center gap-2">
    <Database size={18} className="text-slate-600" />
    <h3 className="text-lg font-semibold text-gray-800">
      Search & Filters
    </h3>
  </div>

  <a
    href="https://lookerstudio.google.com/reporting/6efe4716-3bf4-4d86-a2bd-ca76c8563c1e"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition"
  >
    <ExternalLink size={16} />
    Looker Studio Report
  </a>
</div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
                  <div className="xl:col-span-1">
                    <label className="block text-sm text-gray-600 mb-2">
                      Keyword Search
                    </label>
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        value={explorerFilters.search}
                        onChange={(e) =>
                          handleExplorerFilterChange("search", e.target.value)
                        }
                        placeholder="Search records..."
                        className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <FilterSelect
                    label="Status"
                    value={explorerFilters.status}
                    onChange={(value) => handleExplorerFilterChange("status", value)}
                    options={explorerStatusOptions}
                  />

                  <FilterSelect
                    label="Severity"
                    value={explorerFilters.severity}
                    onChange={(value) => handleExplorerFilterChange("severity", value)}
                    options={explorerSeverityOptions}
                  />

                  <FilterSelect
                    label="Factor"
                    value={explorerFilters.factor}
                    onChange={(value) => handleExplorerFilterChange("factor", value)}
                    options={explorerFactorOptions}
                  />

                  <FilterSelect
                    label="Condition"
                    value={explorerFilters.condition}
                    onChange={(value) => handleExplorerFilterChange("condition", value)}
                    options={explorerConditionOptions}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={resetExplorerFilters}
                    className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Database Records
                  </h3>
                  <span className="text-sm text-gray-500">
                    {explorerRows.length} record(s)
                  </span>
                </div>

                {explorerError && (
                  <div className="m-5 bg-red-50 text-red-600 border border-red-200 rounded-xl p-4">
                    {explorerError}
                  </div>
                )}

                {explorerLoading ? (
                  <div className="p-10 text-center text-gray-400">
                    Loading records...
                  </div>
                ) : explorerRows.length === 0 ? (
                  <div className="p-10 text-center text-gray-400">
                    No records found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Date</th>
                          <th className="px-4 py-3 text-left font-medium">Employee ID</th>
                          <th className="px-4 py-3 text-left font-medium">Region</th>
                          <th className="px-4 py-3 text-left font-medium">Factor</th>
                          <th className="px-4 py-3 text-left font-medium">Health Condition</th>
                          <th className="px-4 py-3 text-left font-medium">Status</th>
                          <th className="px-4 py-3 text-left font-medium">Severity</th>
                          <th className="px-4 py-3 text-left font-medium">Value</th>
                          <th className="px-4 py-3 text-left font-medium">Unit</th>
                          <th className="px-4 py-3 text-left font-medium">Improvement Rate</th>
                          <th className="px-4 py-3 text-left font-medium">Tenant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {explorerRows.map((row, index) => (
                          <tr
                            key={`${row.employee_id}-${row.date}-${index}`}
                            className="border-t border-gray-100 hover:bg-slate-50"
                          >
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
      </main>
    </div>
  );
}

function Panel({ title, loading, children }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {loading ? (
        <EmptyChart text="Loading chart..." />
      ) : (
        <ResponsiveContainer width="100%" height={380}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <div className="h-[380px] flex items-center justify-center text-gray-400">
      {text}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

const BAR_COLORS = [
  "#2563eb",
  "#60a5fa",
  "#93c5fd",
  "#1d4ed8",
  "#38bdf8",
  "#818cf8",
  "#22c55e",
  "#f59e0b",
];

export default Dashboard;