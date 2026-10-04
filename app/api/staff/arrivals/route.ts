import { arrivalSummary } from "@/lib/check-in";
import { apiError, logFailure, privateJson } from "@/lib/server";
import { requireCheckInOperator } from "@/lib/staff";
export async function GET() {
  try {
    if (!(await requireCheckInOperator())) return apiError("Sesi petugas berakhir. Masuk kembali.", 403);
    return privateJson(await arrivalSummary());
  } catch (error) { logFailure("arrival_summary", error); return apiError("Data kedatangan belum bisa diperbarui.", 503); }
}
