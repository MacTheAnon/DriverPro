// Shared app-wide constants
// Update IRS_RATE_PER_MILE here each year — it flows to TrackScreen, PDFGenerator, and ChatScreen automatically.

export const IRS_RATE_PER_MILE = 0.67;   // 2024 IRS standard mileage rate
export const COST_PER_MILE = 0.30;        // Estimated per-mile operating cost for net profit calc
export const TAX_YEAR = new Date().getFullYear().toString();
