/**
 * Lightweight, zero-dependency PDF generator for HireSight Offer Letters.
 * Outputs standard PDF 1.4 bytes compatible with all PDF viewers.
 */

export interface OfferLetterData {
	candidateName: string;
	candidateEmail: string;
	companyName: string;
	jobTitle: string;
	salary: string;
	startDate: string;
	employmentType?: string;
	workLocation?: string;
	reportingManager?: string;
	expiryDate?: string;
	benefitsSummary?: string;
	customNotes?: string;
	recruiterName?: string;
}

/** Sanitize text for standard Type 1 Helvetica encoding (ASCII/Latin-1 only) */
function sanitizePdfText(str: string): string {
	if (!str) return "";
	return str
		.replace(/₹/g, "INR ")
		.replace(/[“”]/g, '"')
		.replace(/[‘’]/g, "'")
		.replace(/[—–]/g, "-")
		.replace(/[•]/g, "*")
		.replace(/[^\x20-\x7E]/g, " ") // keep printable ASCII
		.replace(/\\/g, "\\\\")
		.replace(/\(/g, "\\(")
		.replace(/\)/g, "\\)");
}

/**
 * Generate a formal, publication-ready Offer Letter PDF.
 * Returns raw bytes as Uint8Array (and provides a base64 helper).
 */
export function generateOfferLetterPdf(data: OfferLetterData): Uint8Array {
	const company = sanitizePdfText(data.companyName || "HireSight Technologies");
	const candidate = sanitizePdfText(data.candidateName || "Candidate");
	const email = sanitizePdfText(data.candidateEmail || "");
	const role = sanitizePdfText(data.jobTitle || "Software Engineer");
	const comp = sanitizePdfText(data.salary || "Competitive Compensation");
	const start = sanitizePdfText(data.startDate || "To be mutually agreed");
	const empType = sanitizePdfText(data.employmentType || "Full-Time, Permanent");
	const location = sanitizePdfText(data.workLocation || "Remote / Flexible");
	const manager = sanitizePdfText(data.reportingManager || "Department Head / VP of Engineering");
	const expiry = sanitizePdfText(data.expiryDate || "7 days from receipt");
	const benefits = sanitizePdfText(
		data.benefitsSummary ||
			"Comprehensive health, dental and vision insurance, 20 days paid annual leave, flexible work hours, and equipment stipend."
	);
	const recruiter = sanitizePdfText(data.recruiterName || "Talent Acquisition Team");

	const today = sanitizePdfText(
		new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
	);

	// Page coordinates: US Letter is 612 x 792 pt
	const streams: string[] = [];

	// Background accent top bar (Indigo #4f46e5 -> r=0.31, g=0.27, b=0.90)
	streams.push("q");
	streams.push("0.31 0.27 0.90 rg");
	streams.push("0 782 612 10 re f");
	streams.push("Q");

	// Header
	streams.push("BT");
	streams.push("/F2 20 Tf"); // Helvetica-Bold 20pt
	streams.push("0.08 0.11 0.19 rg");
	streams.push(`50 735 Td (${company}) Tj`);
	streams.push("ET");

	streams.push("BT");
	streams.push("/F1 9 Tf");
	streams.push("0.45 0.50 0.58 rg");
	streams.push(`50 720 Td (OFFICIAL EMPLOYMENT OFFER - CONFIDENTIAL) Tj`);
	streams.push("ET");

	// Date & Candidate Details
	streams.push("BT");
	streams.push("/F1 10 Tf");
	streams.push("0.20 0.25 0.35 rg");
	streams.push(`50 685 Td (Date: ${today}) Tj`);
	streams.push("ET");

	streams.push("BT");
	streams.push("/F2 11 Tf");
	streams.push("0.10 0.15 0.25 rg");
	streams.push(`50 665 Td (To: ${candidate}) Tj`);
	streams.push("/F1 10 Tf");
	streams.push("0.35 0.40 0.50 rg");
	streams.push(`0 -14 Td (Email: ${email}) Tj`);
	streams.push("ET");

	// Horizontal Rule
	streams.push("q 0.85 0.88 0.93 RG 1 w 50 635 m 562 635 l S Q");

	// Opening statement
	streams.push("BT");
	streams.push("/F1 10.5 Tf");
	streams.push("0.15 0.18 0.25 rg");
	streams.push(`50 615 Td (Dear ${candidate},) Tj`);
	streams.push(
		`0 -18 Td (On behalf of ${company}, we are thrilled to extend this formal offer of employment for the) Tj`
	);
	streams.push(
		`0 -15 Td (position of ${role}. Our team was thoroughly impressed by your experience and interview results.) Tj`
	);
	streams.push("ET");

	// Terms Box (Table Container)
	streams.push("q 0.96 0.97 0.99 rg 0.85 0.88 0.93 RG 1 w 50 405 512 165 re f S Q");

	// Table Header
	streams.push("BT");
	streams.push("/F2 11 Tf");
	streams.push("0.31 0.27 0.90 rg");
	streams.push(`65 550 Td (SUMMARY OF EMPLOYMENT TERMS) Tj`);
	streams.push("ET");

	// Terms rows
	const rows = [
		["Position Title:", role],
		["Compensation (Base):", comp],
		["Employment Type:", empType],
		["Work Location / Mode:", location],
		["Reporting Manager:", manager],
		["Proposed Start Date:", start],
		["Offer Acceptance Deadline:", expiry],
	];

	let rowY = 530;
	for (const [label, val] of rows) {
		streams.push("BT");
		streams.push("/F2 9.5 Tf");
		streams.push("0.30 0.35 0.45 rg");
		streams.push(`65 ${rowY} Td (${label}) Tj`);
		streams.push("/F1 9.5 Tf");
		streams.push("0.10 0.15 0.25 rg");
		streams.push(`175 0 Td (${val}) Tj`);
		streams.push("ET");
		rowY -= 17;
	}

	// Benefits Section
	streams.push("BT");
	streams.push("/F2 11 Tf");
	streams.push("0.10 0.15 0.25 rg");
	streams.push("50 380 Td (Benefits & Standard Terms) Tj");
	streams.push("/F1 9.5 Tf");
	streams.push("0.25 0.30 0.40 rg");
	streams.push("0 -16 Td (You will be eligible to participate in our comprehensive benefits package, including:) Tj");
	streams.push(`0 -14 Td (${benefits}) Tj`);
	streams.push(
		"0 -16 Td (Employment with the company is subject to standard verification, reference checks, and the signing) Tj"
	);
	streams.push("0 -14 Td (of our standard proprietary information and confidentiality agreement.) Tj");
	streams.push("ET");

	// Acceptance Instructions
	streams.push("BT");
	streams.push("/F2 10.5 Tf");
	streams.push("0.10 0.15 0.25 rg");
	streams.push("50 280 Td (Acceptance of Offer) Tj");
	streams.push("/F1 9.5 Tf");
	streams.push("0.25 0.30 0.40 rg");
	streams.push(
		`0 -15 Td (To accept this offer, please sign and return this document or confirm acceptance via your portal) Tj`
	);
	streams.push(`0 -14 Td (by ${expiry}. Please do not hesitate to contact us if you have any questions.) Tj`);
	streams.push("ET");

	// Signatures block
	// Company signature
	streams.push("BT");
	streams.push("/F1 9.5 Tf");
	streams.push("0.25 0.30 0.40 rg");
	streams.push("50 205 Td (Sincerely,) Tj");
	streams.push("/F2 10.5 Tf");
	streams.push("0.10 0.15 0.25 rg");
	streams.push(`0 -16 Td (${recruiter}) Tj`);
	streams.push("/F1 9 Tf");
	streams.push("0.45 0.50 0.58 rg");
	streams.push(`0 -12 Td (${company}) Tj`);
	streams.push("ET");

	// Candidate acceptance lines
	streams.push("q 0.70 0.75 0.82 RG 1 w 50 115 m 250 115 l S Q");
	streams.push("q 0.70 0.75 0.82 RG 1 w 350 115 m 550 115 l S Q");

	streams.push("BT");
	streams.push("/F1 8.5 Tf");
	streams.push("0.45 0.50 0.58 rg");
	streams.push("50 100 Td (Candidate Signature: " + candidate + ") Tj");
	streams.push("350 100 Td (Date) Tj");
	streams.push("ET");

	// Footer watermark
	streams.push("BT");
	streams.push("/F1 8 Tf");
	streams.push("0.65 0.70 0.78 rg");
	streams.push("50 40 Td (Generated securely by HireSight AI Recruitment Platform | Verification Code: " + Math.random().toString(36).substring(2, 10).toUpperCase() + ") Tj");
	streams.push("ET");

	const streamContent = streams.join("\n");
	const streamLength = new TextEncoder().encode(streamContent).length;

	// Assemble PDF objects
	const objects: string[] = [
		// 1 0 obj: Catalog
		"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
		// 2 0 obj: Pages
		"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
		// 3 0 obj: Page
		"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj",
		// 4 0 obj: Font F1 (Helvetica Regular)
		"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
		// 5 0 obj: Font F2 (Helvetica Bold)
		"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj",
		// 6 0 obj: Contents Stream
		`6 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`,
	];

	// Build xref table
	let offset = 9; // length of "%PDF-1.4\n"
	const xrefOffsets: number[] = [0];

	let pdfBody = "%PDF-1.4\n";
	for (let i = 0; i < objects.length; i++) {
		xrefOffsets.push(offset);
		const chunk = objects[i] + "\n";
		pdfBody += chunk;
		offset += new TextEncoder().encode(chunk).length;
	}

	const startXref = offset;
	let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (let i = 1; i <= objects.length; i++) {
		const offStr = String(xrefOffsets[i]).padStart(10, "0");
		xref += `${offStr} 00000 n \n`;
	}

	const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
	const fullPdf = pdfBody + xref + trailer;

	return new TextEncoder().encode(fullPdf);
}

/** Convert Uint8Array to base64 string for email attachment */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = "";
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}
