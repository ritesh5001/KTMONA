import React from "react";
import type { PolicyDocument } from "@/lib/legal-policies";

export function PolicyDocumentView({ policy }: { policy: PolicyDocument }) {
  return (
    <div className="space-y-10">
      {policy.intro && (
        <div className="space-y-4 text-base leading-7 text-ink/85">
          {policy.intro}
        </div>
      )}

      <div className="space-y-8">
        {policy.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-28 border-t border-border-soft pt-8 first:border-t-0 first:pt-0"
          >
            <h2 className="mb-4 text-2xl font-serif font-light text-ink">
              {section.title}
            </h2>
            <div className="space-y-4 text-base leading-7 text-ink/85">
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
