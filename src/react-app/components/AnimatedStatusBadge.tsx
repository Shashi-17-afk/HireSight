import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  applied:      { label: "Applied",       cls: "status-applied" },
  under_review: { label: "Under Review",  cls: "status-review" },
  shortlisted:  { label: "Shortlisted",   cls: "status-shortlisted" },
  interview:    { label: "Interview",     cls: "status-interview" },
  rejected:     { label: "Not Selected",  cls: "status-rejected" },
  hired:        { label: "Hired",         cls: "status-hired" },
};

interface AnimatedStatusBadgeProps {
  status: string | null;
}

export default function AnimatedStatusBadge({ status }: AnimatedStatusBadgeProps) {
  const reduceMotion = useReducedMotion();

  if (!status) return null;

  const meta = STATUS_META[status] ?? { label: status, cls: "status-applied" };

  if (reduceMotion) {
    return <span className={`status-badge ${meta.cls}`}>{meta.label}</span>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        className={`status-badge ${meta.cls}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        {meta.label}
      </motion.span>
    </AnimatePresence>
  );
}
