import { formatAmount, formatGrandTotal } from "@/lib/estimation";
import { SHEET_COLUMNS, SHEET_TABS, type SheetColId } from "@/lib/sheet-columns";
import type { QuoteLine } from "@/lib/quote-analysis";
import type { SourceMode } from "@/lib/types";

function cellValue(col: SheetColId, line: QuoteLine) {
  switch (col) {
    case "sn":
      return null;
    case "currency":
      return line.source === "Local" ? "NGN" : line.currency;
    case "item":
      return line.item || "—";
    case "qty":
      return line.qty || "0";
    case "base":
      return fieldValue(line.base);
    case "other":
      return fieldValue(line.msc);
    case "bank1":
      return formatAmount(line.bank);
    case "deliveryCity":
    case "delivery":
      return formatAmount(line.deliveryCharge);
    case "deliveryOutside":
      return fieldValue(line.deliveryOutside ?? "0");
    case "markup":
      return formatAmount(line.markupAmount);
    case "totalNgn":
    case "subNgn":
      return formatGrandTotal(line.unitNgn);
    case "commission":
      return formatAmount(line.commission);
    case "installation":
      return formatGrandTotal(line.installationCharge);
    case "grand":
      return formatGrandTotal(line.extendedNgn);
    case "surcharge":
      return formatAmount(line.surcharge);
    case "insurance":
      return formatAmount(line.insurance);
    case "bank2":
      return formatAmount(line.bank2);
    case "freight":
      return fieldValue(line.freight);
    case "customs":
      return formatAmount(line.customs);
    case "soncap":
      return line.applySoncap ? fieldValue(line.soncapAmount ?? String(line.soncap)) : "—";
    case "agency":
      return formatAmount(line.agent);
    case "shipping":
      return formatAmount(line.shipping);
    case "warehouse":
      return formatAmount(line.warehouseCharge);
    case "subFx":
      return formatAmount(line.systemCost);
    case "exRate":
      return line.exchangeRateOverride?.trim() || String(line.rate || "—");
    default:
      return "—";
  }
}

function fieldValue(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  if (!value.trim() || !Number.isFinite(amount)) return value || "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
}

export function SheetPreview({
  lines,
  emptyLabel = "Open an estimate to see the quote-analysis breakdown.",
}: {
  lines: QuoteLine[];
  emptyLabel?: string;
}) {
  const named = lines.filter((line) => line.item.trim());
  const groups = SHEET_TABS.map((tab) => ({
    ...tab,
    rows: named.filter((line) => line.source === tab.source),
  })).filter((group) => group.rows.length > 0);

  if (groups.length === 0) {
    return (
      <div className="table-scroll">
        <table className="data-table breakdown-table">
          <tbody>
            <tr>
              <td className="table-empty">{emptyLabel}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="sheet-preview-stack">
      {groups.map((group) => (
        <SheetGroup key={group.source} source={group.source} label={group.label} lines={group.rows} />
      ))}
    </div>
  );
}

function SheetGroup({
  source,
  label,
  lines,
}: {
  source: SourceMode;
  label: string;
  lines: QuoteLine[];
}) {
  const columns = SHEET_COLUMNS[source];
  const total = lines.reduce((sum, line) => sum + line.extendedNgn, 0);
  return (
    <div className="sheet-preview-group">
      {label ? <h3 className="text-block-title">{label}</h3> : null}
      <div className="table-scroll">
        <table className="data-table breakdown-table sheet-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id}>
                {columns.map((column) => (
                  <td key={column.id} className={column.id === "grand" ? "sheet-line-subtotal" : undefined}>
                    {column.id === "sn" ? index + 1 : cellValue(column.id, line)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="breakdown-grand">
        <span>Sheet total (NGN)</span>
        <strong>{formatGrandTotal(total)}</strong>
      </div>
    </div>
  );
}
