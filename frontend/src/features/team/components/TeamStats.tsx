import { UserCog, UserRound, Users } from "lucide-react";
import type { Teammate } from "../team.types";

export default function TeamStats({
  teammates,
  activeCount,
  filteredCount,
  page,
  pageSize,
}: {
  teammates: Teammate[];
  activeCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
}) {
  const stats = [
    {
      label: "Accounts on this page",
      value: teammates.length,
      caption: `Page ${page + 1} · Up to ${pageSize} accounts`,
      Icon: Users,
      iconClass: "ts-stat-icon-accent",
    },
    {
      label: "Active accounts",
      value: activeCount,
      caption: "Active accounts on the current page",
      Icon: UserRound,
      iconClass: "ts-stat-icon-success",
    },
    {
      label: "Filtered results",
      value: filteredCount,
      caption: "Matches on the current page",
      Icon: UserCog,
      iconClass: "ts-stat-icon-review",
    },
  ];

  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {stats.map(({ label, value, caption, Icon, iconClass }) => (
        <article className="ts-stat-card ts-team-stat-card" key={label}>
          <div className="ts-team-stat-main">
            <div className={`ts-stat-icon ${iconClass}`}>
              <Icon size={20} strokeWidth={1.8} />
            </div>

            <div className="ts-team-stat-content">
              <p className="ts-team-stat-label">{label}</p>
              <p className="ts-team-stat-value">{value.toLocaleString()}</p>
            </div>
          </div>

          <p className="ts-team-stat-caption">{caption}</p>
        </article>
      ))}
    </div>
  );
}
