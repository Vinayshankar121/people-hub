// Payslip PDF generation utility - Professional HRMS format
// @ts-ignore
import { jsPDF } from "jspdf";
// @ts-ignore
import autoTable from "jspdf-autotable";


interface PayslipData {
  month: number;
  year: number;
  employee: {
    name: string;
    employee_id: string;
    department?: string;
    designation?: string;
    email?: string;
    phone?: string;
    joiningDate?: string;
    date_of_birth?: string;
    location?: string;
    bank_name?: string;
    bank_account_no?: string;
    pan_no?: string;
    pf_no?: string;
    universal_account_number?: string;
  };
  salary: {
    monthlySalary: number;
    yearlySalary: number;
    basicSalary: number;
    hra: number;
    otherAllowances: number;
    yearlyBasic: number;
    yearlyHra: number;
    yearlyOtherAllowances: number;
  };
  attendance: {
    workingDays: number;
    presentDays: number;
    absentDays: number;
    approvedLeaves: number;
    holidays: number;
  };
  deductions: number;
  netSalary: number;
  status: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

function toWords(num: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred ${convert(n % 100)}`.trim();
    if (n < 100000) return `${convert(Math.floor(n / 1000))} Thousand ${convert(n % 1000)}`.trim();
    if (n < 10000000) return `${convert(Math.floor(n / 100000))} Lakh ${convert(n % 100000)}`.trim();
    return `${convert(Math.floor(n / 10000000))} Crore ${convert(n % 10000000)}`.trim();
  }

  const rounded = Math.round(num || 0);
  return rounded === 0 ? "Zero Rupees Only" : `${convert(rounded)} Rupees Only`;
}

export function generatePayslipPDF(data: PayslipData, fileName?: string) {
  const doc = new jsPDF("portrait", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = 12;

  const grossMonthly =
    Number(data.salary.basicSalary || 0) +
    Number(data.salary.hra || 0) +
    Number(data.salary.otherAllowances || 0);

  const grossYearly =
    Number(data.salary.yearlyBasic || 0) +
    Number(data.salary.yearlyHra || 0) +
    Number(data.salary.yearlyOtherAllowances || 0);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175);
  doc.text("TECH MINDS IT SOLUTIONS", pageWidth / 2, y, { align: "center" });

  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`PAYSLIP - ${MONTHS[data.month - 1]} ${data.year}`, pageWidth / 2, y, {
    align: "center",
  });

  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(22, 163, 74);
  doc.roundedRect(pageWidth - margin - 28, 10, 28, 8, 2, 2, "F");
  doc.text(data.status || "Paid", pageWidth - margin - 14, 15.5, { align: "center" });

  y += 8;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Employee Details
  autoTable(doc, {
    startY: y,
    head: [["Employee Code", "Employee Name", "DOB", "Joining Date", "Designation"]],
    body: [[
      data.employee.employee_id || "—",
      data.employee.name || "—",
      formatDate(data.employee.date_of_birth),
      formatDate(data.employee.joiningDate),
      data.employee.designation || "—",
    ]],
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      halign: "center",
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Bank Details
  autoTable(doc, {
    startY: y,
    head: [["Bank Name", "Bank A/C No", "PAN No", "PF No", "UAN"]],
    body: [[
      data.employee.bank_name || "—",
      data.employee.bank_account_no || "—",
      data.employee.pan_no || "—",
      data.employee.pf_no || "—",
      data.employee.universal_account_number || "—",
    ]],
    theme: "grid",
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      halign: "center",
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Attendance Details
  const lopDays = Math.max(
  Number(data.attendance.absentDays || 0),
  0
);
 autoTable(doc, {
  startY: y,
  head: [["Location", "Working Days", "Present Days", "Absent Days", "Leaves", "Holidays", "LOP"]],
  body: [[
    data.employee.location || "—",
    String(data.attendance.workingDays || 0),
    String(data.attendance.presentDays || 0),
    String(data.attendance.absentDays || 0),
    String(data.attendance.approvedLeaves || 0),
    String(data.attendance.holidays || 0),
    String(lopDays),
    
         ]],
  
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      halign: "center",
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // Earnings
  autoTable(doc, {
    startY: y,
    head: [["Earnings", "Monthly", "Yearly"]],
    body: [
      ["Basic Salary", fmtCurrency(data.salary.basicSalary), fmtCurrency(data.salary.yearlyBasic)],
      ["HRA", fmtCurrency(data.salary.hra), fmtCurrency(data.salary.yearlyHra)],
      ["Other Allowances", fmtCurrency(data.salary.otherAllowances), fmtCurrency(data.salary.yearlyOtherAllowances)],
      ["Gross Earnings", fmtCurrency(grossMonthly), fmtCurrency(grossYearly)],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      1: { halign: "right" },
      2: { halign: "right" },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Deductions - No PT / No PF
  autoTable(doc, {
    startY: y,
    head: [["Deductions", "Amount"]],
    body: [
      ["Gross Deductions", fmtCurrency(data.deductions || 0)],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [185, 28, 28],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      1: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // Net Pay Box
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(22, 163, 74);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(21, 128, 61);
  doc.text("NET PAY", margin + 5, y + 9);

  doc.setFontSize(14);
  doc.text(
  fmtCurrency(Number(data.netSalary || 0)),
  pageWidth - margin - 5,
  y + 9,
  { align: "right" }
);
   
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Amount in words: ${toWords(data.netSalary)}`, margin + 5, y + 18);

  // Footer
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "This is an electronically generated payslip. No signature required.",
    margin,
    pageHeight - 14
  );

  doc.text(
    `Generated on: ${new Date().toLocaleDateString("en-IN")}`,
    pageWidth - margin,
    pageHeight - 14,
    { align: "right" }
  );

  doc.text(
    "Tech Minds IT Solutions | Nellore, Andhra Pradesh -524002",
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  const pdfFileName =
    fileName || `Payslip_${data.employee.employee_id}_${data.month}_${data.year}.pdf`;

  doc.save(pdfFileName);
}