import { SuggestEditChip, type RecordKind } from "@/components/suggest-edit/suggest-edit-chip"

interface IProfileFieldProps {
  label: string
  /** Stable machine identifier for the field, used in the Issue body. */
  fieldName: string
  /**
   * The rendered value. Pass `null` for a null/missing field, a string
   * for a formatted value, or arbitrary nodes for richer renderings.
   */
  value: React.ReactNode | null | undefined
  /**
   * The raw value written into the Issue pre-fill as "current value".
   * If undefined, nothing is pre-filled (visitor fills it in).
   */
  currentValueHint?: string
  recordKind: RecordKind
  recordId: string
  recordName: string
  /** Longer fields benefit from a stacked layout. Default is row. */
  layout?: "row" | "stacked"
}

export function ProfileField({
  label,
  fieldName,
  value,
  currentValueHint,
  recordKind,
  recordId,
  recordName,
  layout = "row",
}: IProfileFieldProps) {
  const isMissing = value === null || value === undefined || value === ""
  const valueNode = isMissing ? (
    <span className="text-annotation-red font-mono text-[14px] font-bold uppercase tracking-wider">
      null
    </span>
  ) : (
    value
  )

  // Null/missing fields always show the chip; populated fields show it on hover.
  const visibility = isMissing ? "always" : "hover"

  const rowClass =
    layout === "stacked"
      ? "group flex flex-col gap-1 py-3"
      : "group flex items-baseline justify-between gap-4 py-2.5"

  return (
    <div className={`${rowClass} border-blueprint-navy/5 border-b last:border-b-0`}>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-blueprint-navy/60 font-mono text-[13px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className={`text-blueprint-navy min-w-0 break-all text-sm ${isMissing ? "" : "font-medium"}`}>
          {valueNode}
        </div>
        <SuggestEditChip
          currentValueHint={currentValueHint}
          fieldLabel={label}
          fieldName={fieldName}
          layout="inline"
          recordId={recordId}
          recordKind={recordKind}
          recordName={recordName}
          visibility={visibility}
        />
      </div>
    </div>
  )
}
