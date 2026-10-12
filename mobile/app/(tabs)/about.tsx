import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { LegalScreen } from "../../src/components/LegalScreen";
import { aboutPolicy } from "../../src/data/legal-policies";
import { apiRequest } from "../../src/services/api";

interface Founder {
  name: string;
  title: string;
  bio: string;
  quote: string | null;
}

/** About Us, with the founders managed in Admin → About Us: Founders. */
export default function AboutScreen() {
  const { data } = useQuery({
    queryKey: ["site", "founders"],
    queryFn: ({ signal }) => apiRequest<{ data: { founders: Founder[] } }>("/v1/site/founders", { method: "GET", signal }),
    staleTime: 10 * 60 * 1000,
  });
  const founders = data?.data.founders;
  const sections = React.useMemo(() => {
    if (!founders) return aboutPolicy.sections;
    const founderSections = founders.map((f) => ({
      title: founders.length === 1 ? "Meet Our Founder" : f.name,
      body: [`${f.name}${f.title ? `, ${f.title}` : ""}`, f.bio, f.quote ? `“${f.quote}”\n— ${f.name}` : ""].filter(Boolean).join("\n\n"),
    }));
    const rest = aboutPolicy.sections.filter((s) => s.title !== "Meet Our Founder");
    return [rest[0]!, ...founderSections, ...rest.slice(1)];
  }, [founders]);
  return <LegalScreen title={aboutPolicy.title} intro={aboutPolicy.intro} updatedAt={aboutPolicy.updatedAt} sections={sections} />;
}
