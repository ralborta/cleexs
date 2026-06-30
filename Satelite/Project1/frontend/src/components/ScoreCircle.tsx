interface ScoreCircleProps {
  score: number;
}

export default function ScoreCircle({ score }: ScoreCircleProps) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 80) return "var(--success)";
    if (score >= 50) return "var(--warning)";
    return "var(--critical)";
  };

  const getLabel = () => {
    if (score >= 80) return "Excelente";
    if (score >= 60) return "Bueno";
    if (score >= 40) return "Regular";
    return "Critico";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="animate-score-fill"
            style={{ "--score-offset": offset } as React.CSSProperties}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold" style={{ color: getColor() }}>
            {score}
          </span>
          <span className="text-xs text-[var(--text-muted)]">/ 100</span>
        </div>
      </div>
      <span
        className="mt-2 text-sm font-semibold"
        style={{ color: getColor() }}
      >
        {getLabel()}
      </span>
    </div>
  );
}
