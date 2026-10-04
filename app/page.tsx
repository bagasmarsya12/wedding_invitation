import { WeddingExperience } from "./wedding-experience";
import { loadHomepageContent } from "@/lib/homepage-content";

export const dynamic = "force-dynamic";
export default async function Home() {
  return <WeddingExperience {...await loadHomepageContent()} />;
}
