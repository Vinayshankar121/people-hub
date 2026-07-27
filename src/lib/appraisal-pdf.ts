// Appraisal PDF generation utility - Professional HRMS format
// @ts-ignore
import { jsPDF } from "jspdf";
// @ts-ignore
import autoTable from "jspdf-autotable";

function fmtCurrency(value?: number): string {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString("en-IN", {
    maximumFractionDigits: 0
  })}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function downloadAppraisalReportPDF(appraisal: any, employee: any) {
  const doc = new jsPDF("portrait", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 15;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175); // Indigo
  doc.text("TECH MINDS IT SOLUTIONS", pageWidth / 2, y, { align: "center" });

  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text("PERFORMANCE APPRAISAL REPORT", pageWidth / 2, y, { align: "center" });

  y += 8;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  
  y += 8;

  // Metadata Table (Employee Info & Cycle)
  autoTable(doc, {
    startY: y,
    head: [["Employee Details", "Appraisal Cycle Details"]],
    body: [
      [
        `Name: ${employee.name || appraisal.employee_name || "—"}\nID: ${employee.employee_id || appraisal.employee_id || "—"}\nDept: ${employee.department || "—"}\nDesg: ${employee.designation || "—"}`,
        `Cycle: ${appraisal.appraisal_cycle || "—"}\nStatus: ${appraisal.status || "—"}\nCurrent Salary: ${fmtCurrency(appraisal.current_salary)}\nEffective Date: ${formatDate(appraisal.effective_from)}`
      ]
    ],
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Self Appraisal Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 175);
  doc.text("1. Employee Self-Appraisal", margin, y);
  y += 4;

  const selfRatingStar = appraisal.self_rating ? "★".repeat(appraisal.self_rating) + "☆".repeat(5 - appraisal.self_rating) : "—";
  
  autoTable(doc, {
    startY: y,
    head: [["Section", "Employee Inputs"]],
    body: [
      ["Self Rating", `${selfRatingStar} (${appraisal.self_rating || "0"}/5)`],
      ["Achievements", appraisal.achievements || "—"],
      ["Projects Worked", appraisal.projects_worked || "—"],
      ["Skills Learned", appraisal.skills_learned || "—"],
      ["Certifications", appraisal.certifications || "—"],
      ["Challenges Faced", appraisal.challenges_faced || "—"],
      ["Suggestions", appraisal.suggestions || "—"],
      ["Future Goals", appraisal.future_goals || "—"],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Admin Review Section
  if (appraisal.status !== "Draft" && appraisal.status !== "Self Submitted") {
    // Check page overflow
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 175);
    doc.text("2. Admin Review & Recommendation", margin, y);
    y += 4;

    const adminRatingStar = appraisal.admin_rating ? "★".repeat(appraisal.admin_rating) + "☆".repeat(5 - appraisal.admin_rating) : "—";

    autoTable(doc, {
      startY: y,
      head: [["Evaluation Metric", "Admin Inputs & Values"]],
      body: [
        ["Performance Rating", `${adminRatingStar} (${appraisal.admin_rating || "0"}/5)`],
        ["Key Strengths", appraisal.strengths || "—"],
        ["Areas for Improvement", appraisal.areas_for_improvement || "—"],
        ["Admin Feedback", appraisal.admin_comments || "—"],
        ["Recommendation Type", appraisal.recommendation_type || "—"],
        ["Recommended Increment %", `${appraisal.admin_increment_percentage || 0}%`],
        ["Recommended Salary", fmtCurrency(appraisal.admin_proposed_salary)],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [15, 23, 42],
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: "bold" },
        1: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // CEO Decision Section
  if (appraisal.status === "CEO Approved" || appraisal.status === "Payroll Updated" || appraisal.status === "Completed") {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 175);
    doc.text("3. CEO Final Decision", margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Final Item", "Details"]],
      body: [
        ["Decision Status", appraisal.status || "—"],
        ["Final Comments", appraisal.ceo_comments || "—"],
        ["Approved Increment %", `${appraisal.ceo_increment_percentage || 0}%`],
        ["Approved Increment Amount", fmtCurrency(appraisal.ceo_increment_amount)],
        ["Approved Revised Salary", fmtCurrency(appraisal.ceo_proposed_salary)],
        ["Effective Date", formatDate(appraisal.ceo_effective_date || appraisal.effective_from)],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [22, 163, 74], // Green
        textColor: [255, 255, 255],
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [15, 23, 42],
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: "bold" },
        1: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Footer / Signatures
  if (y > pageHeight - 30) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Tech Minds IT Solutions | HR Performance appraisal system", margin, pageHeight - 14);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, pageHeight - 14, { align: "right" });

  doc.save(`Appraisal_Report_${employee.employee_id || appraisal.employee_id}_${appraisal.appraisal_cycle}.pdf`);
}

export async function downloadSalaryRevisionLetterPDF(appraisal: any, employee: any) {
  const doc = new jsPDF("portrait", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = 20;

  // Header Letterhead
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 64, 175);
  doc.text("TECH MINDS IT SOLUTIONS", margin, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Nellore, Andhra Pradesh, India - 524002 | contact@techminds.com", margin, y);

  y += 5;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // Date and To address
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, pageWidth - margin, y, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("To,", margin, y);
  
  y += 5;
  doc.setFont("helvetica", "normal");
  const employeeName = employee.name || appraisal.employee_name || "—";
  const empCode = employee.employee_id || appraisal.employee_id || "—";
  const designation = employee.designation || "—";
  const department = employee.department || "—";

  doc.text([
    employeeName,
    `Employee ID: ${empCode}`,
    `${designation}, ${department}`,
    "Tech Minds IT Solutions",
  ], margin, y);

  y += 25;
  doc.setFont("helvetica", "bold");
  doc.text("Subject: Salary Revision and Appraisal Increment", margin, y);

  y += 10;
  doc.setFont("helvetica", "normal");
  const greeting = `Dear ${employeeName},`;
  doc.text(greeting, margin, y);

  y += 8;
  const introText = `Following the completion of the performance appraisal process for the appraisal cycle "${appraisal.appraisal_cycle}", the management is pleased to recognize your contributions and dedication. Your performance rating has been evaluated, and we are happy to inform you that your compensation has been revised.`;
  const splitIntro = doc.splitTextToSize(introText, pageWidth - margin * 2);
  doc.text(splitIntro, margin, y);

  y += splitIntro.length * 5 + 4;
  doc.text("Your revised compensation details are outlined below:", margin, y);

  y += 6;
  const currentSalVal = appraisal.current_salary || employee.salary || 0;
  const revisedSalVal = appraisal.ceo_proposed_salary || appraisal.proposed_salary || 0;
  const incPercent = appraisal.ceo_increment_percentage || appraisal.increment_percentage || 0;
  const incAmt = appraisal.ceo_increment_amount || (revisedSalVal - currentSalVal);
  const effDate = appraisal.ceo_effective_date || appraisal.effective_from;

  autoTable(doc, {
    startY: y,
    head: [["Item", "Details / Value"]],
    body: [
      ["Current Monthly Salary", fmtCurrency(currentSalVal)],
      ["Increment Percentage", `${incPercent}%`],
      ["Increment Amount", fmtCurrency(incAmt)],
      ["Revised Monthly Salary", fmtCurrency(revisedSalVal)],
      ["Effective Date", formatDate(effDate)],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontSize: 9.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60 },
      1: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  const closingText = "All other terms and conditions of your employment contract remain unchanged. We appreciate your efforts and commitment to Tech Minds IT Solutions, and we look forward to your continued contribution to the company's growth and success.";
  const splitClosing = doc.splitTextToSize(closingText, pageWidth - margin * 2);
  doc.text(splitClosing, margin, y);

  y += splitClosing.length * 5 + 15;
  doc.text("Sincerely,", margin, y);
  
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("HR Department", margin, y);
  
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text("Tech Minds IT Solutions", margin, y);

  // Sign-off signature line
  y += 15;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("This is a computer-generated letter and does not require a physical signature.", margin, y);

  doc.save(`Salary_Increment_Letter_${empCode}.pdf`);
}
