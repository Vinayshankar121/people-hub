import { useEffect, useState } from "react";
import {
  Wallet,
  TrendingUp,
  Award,
  CalendarDays,
  Sparkles,
  ClipboardCheck,
  Star,
  Download,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/hrms/StatCard";
import { toast } from "sonner";
import {
  fetchAppraisalCycles,
  createAppraisalCycle,
  updateAppraisalCycle,
  fetchAdminAppraisals,
  fetchEmployeeAppraisals,
  saveSelfAppraisal,
  adminReviewAppraisal,
  ceoApproveAppraisal,
  finalizeSalaryRevision,
} from "@/lib/admin.appraisals.functions";
import {
  downloadAppraisalReportPDF,
  downloadSalaryRevisionLetterPDF
} from "@/lib/appraisal-pdf";
import { fmtDate, fmtMoney } from "@/lib/hrms-utils";

const RATINGS = [5, 4, 3, 2, 1] as const;

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  "Self Submitted": "bg-blue-50 text-blue-700 border-blue-200",
  "Admin Reviewed": "bg-amber-50 text-amber-700 border-amber-200",
  "CEO Approved": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Payroll Updated": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Send Back": "bg-purple-50 text-purple-700 border-purple-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
  Closed: "bg-slate-200 text-slate-800 border-slate-300",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

export function AppraisalsPage() {
  const { profile } = useAuth();
  if (!profile) return null;

  if (profile.role === "CEO") return <CeoAppraisals />;
  if (profile.role === "Admin") return <AdminAppraisals />;
  return <EmployeeAppraisals />;
}

// ── EMPLOYEE VIEW ──────────────────────────────────────────────────
function EmployeeAppraisals() {
  const { profile } = useAuth();
  const [cycles, setCycles] = useState<any[]>([]);
  const [myAppraisals, setMyAppraisals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [showSelfForm, setShowSelfForm] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<string>("");
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [selfRating, setSelfRating] = useState<number>(3);
  const [achievements, setAchievements] = useState("");
  const [projectsWorked, setProjectsWorked] = useState("");
  const [skillsLearned, setSkillsLearned] = useState("");
  const [certifications, setCertifications] = useState("");
  const [challengesFaced, setChallengesFaced] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [futureGoals, setFutureGoals] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const allCycles = await fetchAppraisalCycles();
      // filter only active/closed cycles for employees
      setCycles(allCycles.filter((c: any) => c.status === "Active" || c.status === "Closed"));

      const appraisals = await fetchEmployeeAppraisals();
      setMyAppraisals(appraisals);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load appraisal details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenSelfAppraisal = (cycleName: string, existing?: any) => {
    setSelectedCycle(cycleName);
    if (existing) {
      setEditingId(existing.id);
      setSelfRating(existing.self_rating || 3);
      setAchievements(existing.achievements || "");
      setProjectsWorked(existing.projects_worked || "");
      setSkillsLearned(existing.skills_learned || "");
      setCertifications(existing.certifications || "");
      setChallengesFaced(existing.challenges_faced || "");
      setSuggestions(existing.suggestions || "");
      setFutureGoals(existing.future_goals || "");
    } else {
      setEditingId(undefined);
      setSelfRating(3);
      setAchievements("");
      setProjectsWorked("");
      setSkillsLearned("");
      setCertifications("");
      setChallengesFaced("");
      setSuggestions("");
      setFutureGoals("");
    }
    setShowSelfForm(true);
  };

  const handleSaveSelfAppraisal = async (submitType: "Draft" | "Self Submitted") => {
    if (!selectedCycle) {
      toast.error("Cycle is missing");
      return;
    }

    try {
      await saveSelfAppraisal({
        data: {
          id: editingId,
          appraisal_cycle: selectedCycle,
          self_rating: selfRating,
          achievements,
          projects_worked: projectsWorked,
          skills_learned: skillsLearned,
          certifications,
          challenges_faced: challengesFaced,
          suggestions,
          future_goals: futureGoals,
          status: submitType,
        },
      });
      toast.success(submitType === "Draft" ? "Self appraisal saved as draft" : "Self appraisal submitted successfully!");
      setShowSelfForm(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit appraisal");
    }
  };

  const handleDownloadReport = async (appraisal: any) => {
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_uid", appraisal.employee_auth_uid)
        .single();
      await downloadAppraisalReportPDF(appraisal, emp);
    } catch (e: any) {
      toast.error("Error generating PDF: " + e.message);
    }
  };

  const handleDownloadLetter = async (appraisal: any) => {
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_uid", appraisal.employee_auth_uid)
        .single();
      await downloadSalaryRevisionLetterPDF(appraisal, emp);
    } catch (e: any) {
      toast.error("Error generating Revision Letter PDF: " + e.message);
    }
  };

  const latestAppraisal = myAppraisals[0];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Performance & Appraisals</h1>
        <p className="text-sm text-slate-500 mt-1">Review active cycles, submit self-evaluations, and view salary updates.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Salary"
          value={profile.salary ? fmtMoney(profile.salary) : "—"}
          icon={Wallet}
          color="blue"
        />
        <StatCard
          title="Revised Salary"
          value={latestAppraisal?.status === "Completed" || latestAppraisal?.status === "CEO Approved" ? fmtMoney(latestAppraisal.ceo_proposed_salary) : "—"}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Self Rating Score"
          value={latestAppraisal ? `${latestAppraisal.self_rating || 0}/5` : "—"}
          icon={Award}
          color="amber"
        />
        <StatCard
          title="Latest Appraisal Cycle"
          value={latestAppraisal ? latestAppraisal.appraisal_cycle : "None"}
          icon={CalendarDays}
          color="violet"
        />
      </div>

      {/* Active Cycles Section */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Active Appraisal Cycles</h2>
        {cycles.filter((c: any) => c.status === "Active").length === 0 ? (
          <p className="text-sm text-slate-500">There are no active appraisal cycles right now.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cycles.filter((c: any) => c.status === "Active").map((cycle: any) => {
              const existingAppraisal = myAppraisals.find((a) => a.appraisal_cycle === cycle.name);
              const canSubmit = !existingAppraisal || existingAppraisal.status === "Draft" || existingAppraisal.status === "Send Back";
              
              return (
                <div key={cycle.id} className="border rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition bg-slate-50/50">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">{cycle.name}</h3>
                      <StatusBadge status={existingAppraisal ? existingAppraisal.status : "Not Started"} />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Created: {new Date(cycle.created_at).toLocaleDateString()}
                    </p>
                    {existingAppraisal?.admin_comments && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700">
                        <strong>Admin Feedback:</strong> {existingAppraisal.admin_comments}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    {canSubmit ? (
                      <button
                        onClick={() => handleOpenSelfAppraisal(cycle.name, existingAppraisal)}
                        className="w-full bg-brand text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-brand-dark transition"
                      >
                        {existingAppraisal ? "Edit Evaluation" : "Start Self-Appraisal"}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full bg-slate-200 text-slate-400 text-xs font-semibold py-2.5 rounded-xl cursor-not-allowed"
                      >
                        Submitted - Pending Approval
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-slate-900">Appraisal History</h2>
          <p className="text-xs text-slate-500 mt-1">Download official report PDFs and revised salary letters here.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase">
              <tr>
                <th className="px-6 py-4">Appraisal Cycle</th>
                <th className="px-6 py-4">Self Rating</th>
                <th className="px-6 py-4">Final Revised Salary</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Effective From</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-600">
              {myAppraisals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                    No appraisal history available.
                  </td>
                </tr>
              ) : (
                myAppraisals.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{app.appraisal_cycle}</td>
                    <td className="px-6 py-4">{app.self_rating || "—"} / 5</td>
                    <td className="px-6 py-4 text-emerald-600 font-semibold">
                      {app.status === "CEO Approved" || app.status === "Completed" ? fmtMoney(app.ceo_proposed_salary) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-6 py-4">{fmtDate(app.effective_from)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {["CEO Approved", "Payroll Updated", "Completed"].includes(app.status) ? (
                          <>
                            <button
                              onClick={() => handleDownloadReport(app)}
                              className="inline-flex items-center gap-1 bg-white border text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-slate-50 transition"
                            >
                              <Download className="h-3 w-3" /> Report
                            </button>
                            <button
                              onClick={() => handleDownloadLetter(app)}
                              className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition"
                            >
                              <FileText className="h-3 w-3" /> Letter
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Downloads lock after CEO approval</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Self Appraisal Input Form Modal */}
      {showSelfForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Self-Appraisal Evaluation</h3>
                <p className="text-xs text-slate-500 mt-1">Cycle: {selectedCycle}</p>
              </div>
              <button
                onClick={() => setShowSelfForm(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Self Performance Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelfRating(star)}
                      className="p-1 hover:scale-110 transition"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= selfRating ? "fill-amber-400 text-amber-500" : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Key Achievements</label>
                  <textarea
                    value={achievements}
                    onChange={(e) => setAchievements(e.target.value)}
                    rows={3}
                    placeholder="List accomplishments, milestones met..."
                    className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Projects Worked</label>
                  <textarea
                    value={projectsWorked}
                    onChange={(e) => setProjectsWorked(e.target.value)}
                    rows={3}
                    placeholder="Provide details about projects handled..."
                    className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Skills Learned / Developed</label>
                  <textarea
                    value={skillsLearned}
                    onChange={(e) => setSkillsLearned(e.target.value)}
                    rows={3}
                    placeholder="New technological tools, processes, soft skills..."
                    className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Certifications Earned</label>
                  <textarea
                    value={certifications}
                    onChange={(e) => setCertifications(e.target.value)}
                    rows={3}
                    placeholder="Courses completed, certifications achieved..."
                    className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Challenges Faced</label>
                  <textarea
                    value={challengesFaced}
                    onChange={(e) => setChallengesFaced(e.target.value)}
                    rows={3}
                    placeholder="Describe hurdles faced and how you overcame them..."
                    className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Suggestions for Organization</label>
                  <textarea
                    value={suggestions}
                    onChange={(e) => setSuggestions(e.target.value)}
                    rows={3}
                    placeholder="Feedback, tooling suggestions, workspace enhancements..."
                    className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Future Goals</label>
                <textarea
                  value={futureGoals}
                  onChange={(e) => setFutureGoals(e.target.value)}
                  rows={2}
                  placeholder="Goals for the next appraisal cycle..."
                  className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex gap-2 justify-end">
              <button
                onClick={() => handleSaveSelfAppraisal("Draft")}
                className="px-4 py-2 border rounded-xl text-slate-700 bg-white font-semibold hover:bg-slate-50 transition text-sm"
              >
                Save Draft
              </button>
              <button
                onClick={() => handleSaveSelfAppraisal("Self Submitted")}
                className="px-5 py-2 bg-brand text-white font-semibold hover:bg-brand-dark rounded-xl transition text-sm"
              >
                Submit Appraisal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ADMIN VIEW ─────────────────────────────────────────────────────
function AdminAppraisals() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Cycle management state
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [newCycleName, setNewCycleName] = useState("");

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedAppraisal, setSelectedAppraisal] = useState<any | null>(null);

  // Review inputs
  const [adminRating, setAdminRating] = useState<number>(3);
  const [strengths, setStrengths] = useState("");
  const [areasForImprovement, setAreasForImprovement] = useState("");
  const [adminComments, setAdminComments] = useState("");
  const [recommendationType, setRecommendationType] = useState("Salary Revision");
  const [incrementPercent, setIncrementPercent] = useState<number>(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const allCycles = await fetchAppraisalCycles();
      setCycles(allCycles);

      const allAppraisals = await fetchAdminAppraisals({});
      setAppraisals(allAppraisals.appraisals);
    } catch (e: any) {
      toast.error(e?.message ?? "Error loading appraisals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCycle = async () => {
    if (!newCycleName.trim()) {
      toast.error("Please enter a cycle name");
      return;
    }
    try {
      await createAppraisalCycle({ data: { name: newCycleName, status: "Draft" } });
      toast.success("Appraisal cycle created successfully!");
      setNewCycleName("");
      setShowCycleModal(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? "Error creating cycle");
    }
  };

  const handleToggleCycleStatus = async (id: string, currentStatus: string) => {
    let nextStatus: "Draft" | "Active" | "Closed" = "Active";
    if (currentStatus === "Active") nextStatus = "Closed";
    else if (currentStatus === "Closed") nextStatus = "Draft";

    try {
      await updateAppraisalCycle({ id, status: nextStatus });
      toast.success(`Cycle updated to ${nextStatus}`);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? "Error updating cycle status");
    }
  };

  const handleOpenReview = (appraisal: any) => {
    setSelectedAppraisal(appraisal);
    setAdminRating(appraisal.admin_rating || appraisal.self_rating || 3);
    setStrengths(appraisal.strengths || "");
    setAreasForImprovement(appraisal.areas_for_improvement || "");
    setAdminComments(appraisal.admin_comments || "");
    setRecommendationType(appraisal.recommendation_type || "Salary Revision");
    setIncrementPercent(appraisal.admin_increment_percentage || 0);
    setShowReviewModal(true);
  };

  const handleRecommendAction = async (status: "Admin Reviewed" | "Send Back" | "Rejected") => {
    if (!selectedAppraisal) return;

    // Calculate proposed salary and amount
    const currentSal = Number(selectedAppraisal.current_salary || 0);
    const incAmt = Math.round((currentSal * (incrementPercent / 100)) * 100) / 100;
    const proposedSal = Math.round((currentSal + incAmt) * 100) / 100;

    try {
      await adminReviewAppraisal({
        data: {
          id: selectedAppraisal.id,
          admin_rating: adminRating,
          strengths,
          areas_for_improvement: areasForImprovement,
          admin_comments: adminComments,
          recommendation_type: recommendationType,
          admin_increment_percentage: incrementPercent,
          admin_increment_amount: incAmt,
          admin_proposed_salary: proposedSal,
          status,
        },
      });

      toast.success(`Appraisal status updated to "${status}"`);
      setShowReviewModal(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? "Error processing recommendation");
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Appraisal Cycles & Reviews</h1>
          <p className="text-sm text-slate-500 mt-1">Admin dashboard for performance appraisal configuration and validation.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCycleModal(true)}
            className="bg-brand text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-dark transition"
          >
            + Create Cycle
          </button>
        </div>
      </div>

      {/* Appraisal Cycles Config */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4 text-slate-400" />
          Manage Appraisal Cycles
        </h2>
        {cycles.length === 0 ? (
          <p className="text-sm text-slate-500">No appraisal cycles exist yet. Click "+ Create Cycle" to create one.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cycles.map((c) => (
              <div key={c.id} className="border rounded-2xl p-4 flex flex-col justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-semibold text-slate-900">{c.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">Created: {new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center justify-between mt-4 border-t pt-3">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${
                    c.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    c.status === "Closed" ? "bg-slate-100 text-slate-700 border-slate-300" :
                    "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>{c.status}</span>
                  <button
                    onClick={() => handleToggleCycleStatus(c.id, c.status)}
                    className="text-xs text-brand hover:underline font-semibold"
                  >
                    Change Status
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submitted Appraisals list */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-slate-900">Appraisal Submissions</h2>
          <p className="text-xs text-slate-500 mt-1">Review employee self-evaluations and submit recommendations to the CEO.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Cycle</th>
                <th className="px-6 py-4">Self Rating</th>
                <th className="px-6 py-4">Current Salary</th>
                <th className="px-6 py-4">Recommended Increment</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-600">
              {appraisals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-sm">
                    No appraisals found.
                  </td>
                </tr>
              ) : (
                appraisals.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{app.employee_name}</div>
                      <div className="text-xs text-slate-400">{app.employee_id}</div>
                    </td>
                    <td className="px-6 py-4">{app.appraisal_cycle}</td>
                    <td className="px-6 py-4">{app.self_rating || "—"} / 5</td>
                    <td className="px-6 py-4">{fmtMoney(app.current_salary)}</td>
                    <td className="px-6 py-4">
                      {app.admin_increment_percentage ? `+${app.admin_increment_percentage}%` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {["Self Submitted", "Admin Reviewed"].includes(app.status) ? (
                        <button
                          onClick={() => handleOpenReview(app)}
                          className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-brand-dark transition"
                        >
                          Review & Recommend
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No action required</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cycle Modal */}
      {showCycleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Create New Appraisal Cycle</h3>
            <p className="text-xs text-slate-500 mb-4">Set up a new appraisal cycle (e.g. FY 2026-2027).</p>
            
            <input
              type="text"
              placeholder="Appraisal Cycle Name (e.g., Q2 2026)"
              value={newCycleName}
              onChange={(e) => setNewCycleName(e.target.value)}
              className="w-full border rounded-xl p-3 text-sm mb-4 focus:ring-1 focus:ring-brand focus:outline-none"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCycleModal(false)}
                className="px-4 py-2 border rounded-xl text-slate-700 bg-white font-semibold hover:bg-slate-50 transition text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCycle}
                className="px-4 py-2 bg-brand text-white font-semibold hover:bg-brand-dark rounded-xl transition text-xs"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Review Modal */}
      {showReviewModal && selectedAppraisal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Admin Review Console</h3>
                <p className="text-xs text-slate-500 mt-1">Reviewing: {selectedAppraisal.employee_name} ({selectedAppraisal.employee_id})</p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Employee self inputs preview */}
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Employee Self Evaluation Preview</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="block text-slate-400">Self Rating</span>
                    <span className="font-semibold text-slate-900">{selectedAppraisal.self_rating || 0} / 5</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Achievements</span>
                    <span className="font-semibold text-slate-900 block truncate">{selectedAppraisal.achievements || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Projects Worked</span>
                    <span className="font-semibold text-slate-900 block truncate">{selectedAppraisal.projects_worked || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Challenges</span>
                    <span className="font-semibold text-slate-900 block truncate">{selectedAppraisal.challenges_faced || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Admin Recommendation Details</h4>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Recommended Rating (1-5)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setAdminRating(star)}
                        className="p-1 hover:scale-110 transition"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            star <= adminRating ? "fill-amber-400 text-amber-500" : "text-slate-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Key Strengths</label>
                    <textarea
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                      rows={2}
                      placeholder="Strengths observed during this cycle..."
                      className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Areas for Improvement</label>
                    <textarea
                      value={areasForImprovement}
                      onChange={(e) => setAreasForImprovement(e.target.value)}
                      rows={2}
                      placeholder="Identified training needs or performance improvements..."
                      className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Admin Evaluation Comments</label>
                  <textarea
                    value={adminComments}
                    onChange={(e) => setAdminComments(e.target.value)}
                    rows={2}
                    placeholder="General performance notes..."
                    className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 border rounded-2xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Action Type</label>
                    <select
                      value={recommendationType}
                      onChange={(e) => setRecommendationType(e.target.value)}
                      className="w-full border rounded-xl p-2.5 text-sm bg-white"
                    >
                      <option value="Salary Revision">Salary Revision</option>
                      <option value="Promotion & Salary Revision">Promotion & Revision</option>
                      <option value="Performance Plan">Performance Plan</option>
                      <option value="No Change">No Change</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Recommended Increment %</label>
                    <input
                      type="number"
                      value={incrementPercent}
                      onChange={(e) => setIncrementPercent(Math.max(0, Number(e.target.value)))}
                      className="w-full border rounded-xl p-2.5 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Proposed Monthly Salary</label>
                    <div className="p-2.5 border rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                      {fmtMoney(
                        Math.round((Number(selectedAppraisal.current_salary || 0) * (1 + incrementPercent / 100)) * 100) / 100
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex flex-wrap gap-2 justify-between">
              <button
                onClick={() => handleRecommendAction("Send Back")}
                className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 font-semibold hover:bg-purple-100 rounded-xl transition text-xs"
              >
                Send Back to Employee
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleRecommendAction("Rejected")}
                  className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 font-semibold hover:bg-rose-100 rounded-xl transition text-xs"
                >
                  Reject Recommendation
                </button>
                <button
                  onClick={() => handleRecommendAction("Admin Reviewed")}
                  className="px-5 py-2 bg-brand text-white font-semibold hover:bg-brand-dark rounded-xl transition text-xs"
                >
                  Send to CEO for Final Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CEO VIEW ───────────────────────────────────────────────────────
function CeoAppraisals() {
  const [appraisals, setAppraisals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Decision Modal
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [selectedAppraisal, setSelectedAppraisal] = useState<any | null>(null);

  // Decision inputs
  const [ceoComments, setCeoComments] = useState("");
  const [ceoIncrementPercent, setCeoIncrementPercent] = useState<number>(0);
  const [ceoEffectiveDate, setCeoEffectiveDate] = useState(new Date().toISOString().slice(0, 10));

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchAdminAppraisals({});
      setAppraisals(result.appraisals);
    } catch (e: any) {
      toast.error(e?.message ?? "Error loading executive appraisals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDecision = (appraisal: any) => {
    setSelectedAppraisal(appraisal);
    setCeoComments(appraisal.ceo_comments || appraisal.admin_comments || "");
    setCeoIncrementPercent(appraisal.ceo_increment_percentage || appraisal.admin_increment_percentage || 0);
    setCeoEffectiveDate(
      appraisal.ceo_effective_date
        ? appraisal.ceo_effective_date.slice(0, 10)
        : appraisal.effective_from
        ? appraisal.effective_from.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setShowDecisionModal(true);
  };

  const handleCeoDecisionSubmit = async (decision: "Approved" | "Rejected") => {
    if (!selectedAppraisal) return;

    const currentSal = Number(selectedAppraisal.current_salary || 0);
    const incAmt = Math.round((currentSal * (ceoIncrementPercent / 100)) * 100) / 100;
    const proposedSal = Math.round((currentSal + incAmt) * 100) / 100;

    try {
      await ceoApproveAppraisal({
        data: {
          id: selectedAppraisal.id,
          ceo_comments: ceoComments,
          ceo_increment_percentage: ceoIncrementPercent,
          ceo_increment_amount: incAmt,
          ceo_proposed_salary: proposedSal,
          ceo_effective_date: ceoEffectiveDate,
          ceo_decision: decision,
        },
      });

      toast.success(decision === "Approved" ? "Appraisal approved by CEO" : "Appraisal marked as rejected by CEO");
      setShowDecisionModal(false);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? "Error saving CEO decision");
    }
  };

  const handleFinalizeSalaryUpdate = async (appraisal: any) => {
    const ok = window.confirm(`Are you sure you want to finalize this salary revision? This will update ${appraisal.employee_name}'s database salary structure and mark this appraisal cycle as Completed.`);
    if (!ok) return;

    try {
      await finalizeSalaryRevision({ id: appraisal.id });
      toast.success("Salary updated in base employee table. Status marked Completed.");
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? "Error updating salary");
    }
  };

  const handleDownloadReport = async (appraisal: any) => {
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_uid", appraisal.employee_auth_uid)
        .single();
      await downloadAppraisalReportPDF(appraisal, emp);
    } catch (e: any) {
      toast.error("Error generating report PDF: " + e.message);
    }
  };

  const handleDownloadLetter = async (appraisal: any) => {
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_uid", appraisal.employee_auth_uid)
        .single();
      await downloadSalaryRevisionLetterPDF(appraisal, emp);
    } catch (e: any) {
      toast.error("Error generating Revision Letter PDF: " + e.message);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">CEO Approvals & Salary Revision</h1>
        <p className="text-sm text-slate-500 mt-1">Review recommended appraisals and authorize salary increases.</p>
      </div>

      {/* Pending approvals section */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Pending Executive Actions</h2>
            <p className="text-xs text-slate-500 mt-1">Appraisals reviewed by HR/Managers awaiting your approval.</p>
          </div>
          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-xs px-2.5 py-1 rounded-full font-bold">
            {appraisals.filter((a) => a.status === "Admin Reviewed").length} Action(s) Required
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase border-b">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Appraisal Cycle</th>
                <th className="px-6 py-4">Admin Recommendation</th>
                <th className="px-6 py-4">Proposed New Salary</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Appraisal Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-600">
              {appraisals.filter((a) => a.status === "Admin Reviewed").length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                    No appraisals are currently pending CEO approval.
                  </td>
                </tr>
              ) : (
                appraisals.filter((a) => a.status === "Admin Reviewed").map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{app.employee_name}</div>
                      <div className="text-xs text-slate-400">{app.employee_id}</div>
                    </td>
                    <td className="px-6 py-4">{app.appraisal_cycle}</td>
                    <td className="px-6 py-4">
                      Rating: {app.admin_rating || "—"}/5<br />
                      Increment: +{app.admin_increment_percentage || 0}%
                    </td>
                    <td className="px-6 py-4 text-emerald-600 font-semibold">{fmtMoney(app.admin_proposed_salary)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenDecision(app)}
                        className="bg-brand text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-dark transition"
                      >
                        Decide & Approve
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary revision console */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-slate-900">Salary Revision History & Finalization</h2>
          <p className="text-xs text-slate-500 mt-1">Finalize salary data and download generated appraisal reports/letters.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase border-b">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Cycle</th>
                <th className="px-6 py-4">CEO Final Increment</th>
                <th className="px-6 py-4">Effective Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action Console</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-600">
              {appraisals.filter((a) => a.status !== "Admin Reviewed").length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                    No historical appraisal records.
                  </td>
                </tr>
              ) : (
                appraisals.filter((a) => a.status !== "Admin Reviewed").map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{app.employee_name}</div>
                      <div className="text-xs text-slate-400">{app.employee_id}</div>
                    </td>
                    <td className="px-6 py-4">{app.appraisal_cycle}</td>
                    <td className="px-6 py-4">
                      {app.ceo_increment_percentage ? (
                        <>
                          <span className="text-emerald-600 font-semibold">+{app.ceo_increment_percentage}%</span><br />
                          <span className="text-slate-400 text-xs">New: {fmtMoney(app.ceo_proposed_salary)}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4">{fmtDate(app.ceo_effective_date || app.effective_from)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {app.status === "CEO Approved" && (
                          <button
                            onClick={() => handleFinalizeSalaryUpdate(app)}
                            className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-emerald-700 transition"
                          >
                            Finalize Salary Update
                          </button>
                        )}
                        {["CEO Approved", "Payroll Updated", "Completed"].includes(app.status) && (
                          <>
                            <button
                              onClick={() => handleDownloadReport(app)}
                              className="inline-flex items-center gap-1 bg-white border text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-slate-50 transition"
                            >
                              <Download className="h-3 w-3" /> Report
                            </button>
                            <button
                              onClick={() => handleDownloadLetter(app)}
                              className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition"
                            >
                              <FileText className="h-3 w-3" /> Letter
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CEO Decision Modal */}
      {showDecisionModal && selectedAppraisal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">CEO Executive Decision Console</h3>
                <p className="text-xs text-slate-500 mt-1">Reviewing: {selectedAppraisal.employee_name} ({selectedAppraisal.employee_id})</p>
              </div>
              <button
                onClick={() => setShowDecisionModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Appraisal summary card */}
              <div className="grid grid-cols-2 gap-4 border p-4 rounded-2xl bg-slate-50 text-xs">
                <div>
                  <span className="block text-slate-400 font-medium">Employee self rating</span>
                  <span className="font-semibold text-slate-900 text-sm">{selectedAppraisal.self_rating || "—"} / 5</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-medium">Current Monthly Salary</span>
                  <span className="font-semibold text-slate-900 text-sm">{fmtMoney(selectedAppraisal.current_salary)}</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-medium">Admin Recommended Rating</span>
                  <span className="font-semibold text-slate-900 text-sm">{selectedAppraisal.admin_rating || "—"} / 5</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-medium">Admin Recommended Increment</span>
                  <span className="font-semibold text-emerald-600 text-sm">+{selectedAppraisal.admin_increment_percentage || 0}%</span>
                </div>
              </div>

              <div className="p-4 border border-purple-100 bg-purple-50/50 rounded-2xl text-xs space-y-1">
                <span className="block text-purple-800 font-bold uppercase tracking-wider">Manager / Admin comments</span>
                <p className="text-slate-700 italic">"{selectedAppraisal.admin_comments || "No comments provided."}"</p>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Final Salary Revision Authorization</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Approved Increment %</label>
                    <input
                      type="number"
                      value={ceoIncrementPercent}
                      onChange={(e) => setCeoIncrementPercent(Math.max(0, Number(e.target.value)))}
                      className="w-full border rounded-xl p-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Revised Monthly Salary</label>
                    <div className="p-2.5 border rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                      {fmtMoney(
                        Math.round((Number(selectedAppraisal.current_salary || 0) * (1 + ceoIncrementPercent / 100)) * 100) / 100
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Effective Date</label>
                    <input
                      type="date"
                      value={ceoEffectiveDate}
                      onChange={(e) => setCeoEffectiveDate(e.target.value)}
                      className="w-full border rounded-xl p-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">CEO Executive Comments</label>
                  <textarea
                    value={ceoComments}
                    onChange={(e) => setCeoComments(e.target.value)}
                    rows={3}
                    placeholder="Enter final appraisal outcome reasons or congratulatory remarks..."
                    className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex gap-2 justify-end">
              <button
                onClick={() => handleCeoDecisionSubmit("Rejected")}
                className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 font-semibold hover:bg-rose-100 rounded-xl transition text-xs"
              >
                Reject Appraisal
              </button>
              <button
                onClick={() => handleCeoDecisionSubmit("Approved")}
                className="px-5 py-2 bg-brand text-white font-semibold hover:bg-brand-dark rounded-xl transition text-xs"
              >
                Approve & Save Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
