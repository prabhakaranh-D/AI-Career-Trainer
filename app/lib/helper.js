// Helper function to convert entries to ATS-friendly markdown
export function entriesToMarkdown(entries, type) {
  if (!entries?.length) return "";

  return (
    `## ${type}\n\n` +
    entries
      .map((entry) => {
        const dateRange = entry.current
          ? `${entry.startDate} - Present`
          : `${entry.startDate} - ${entry.endDate}`;
        const locationLine = entry.location ? `\n${entry.location}` : "";
        return `### ${entry.title} | ${entry.organization}\n${dateRange}${locationLine}\n\n${entry.description}`;
      })
      .join("\n\n")
  );
}
