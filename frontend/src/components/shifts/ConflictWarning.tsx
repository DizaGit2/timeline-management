import { ShiftConflict } from "../../api/shifts";

interface Props {
  conflicts: ShiftConflict[];
}

export function ConflictWarning({ conflicts }: Props) {
  if (conflicts.length === 0) return null;

  return (
    <div style={styles.container}>
      <span style={styles.icon}>⚠️</span>
      <div>
        {conflicts.map((c, i) => (
          <div key={i} style={styles.message}>
            Warning: {c.message}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    gap: 8,
    backgroundColor: "#fffbeb",
    border: "1px solid #f59e0b",
    borderRadius: 6,
    padding: "10px 12px",
    marginTop: 8,
    color: "#92400e",
    fontSize: 13,
  },
  icon: { flexShrink: 0, lineHeight: "20px" },
  message: { lineHeight: "20px" },
};
