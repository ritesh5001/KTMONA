"use client";

import * as React from "react";
import {
    SPECTRUM_GREYS,
    SPECTRUM_ROWS,
    normalizeHex,
} from "@/lib/color-swatches";

/**
 * Grid of swatches an admin picks from for one vendor-named colour. The name is
 * the vendor's; this only chooses the hex the storefront paints.
 */
export function ColorSwatchPicker({
    colorLabel,
    value,
    onChange,
}: {
    colorLabel: string;
    value: string | null;
    onChange: (hex: string | null) => void;
}) {
    const selected = normalizeHex(value);
    const [custom, setCustom] = React.useState(selected ?? "#000000");

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Swatch for {colorLabel}
                </p>
                <div className="flex items-center gap-2">
                    {selected ? (
                        <>
                            <span
                                className="h-5 w-5 rounded-full border border-border-soft"
                                style={{ backgroundColor: selected }}
                            />
                            <span className="text-[11px] uppercase text-muted-foreground">
                                {selected}
                            </span>
                            <button
                                type="button"
                                onClick={() => onChange(null)}
                                className="text-[11px] text-muted-foreground underline hover:text-foreground"
                            >
                                Clear
                            </button>
                        </>
                    ) : (
                        <span className="text-[11px] text-muted-foreground">
                            Not set — no circle will show
                        </span>
                    )}
                </div>
            </div>

            {/* Full spectrum: hue across, lightness down, greys on their own row. */}
            <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Spectrum
                </p>
                <div className="space-y-0.5">
                    {[...SPECTRUM_ROWS, SPECTRUM_GREYS].map((row, rowIndex) => (
                        <div key={rowIndex} className="flex gap-0.5">
                            {row.map((hex) => {
                                const isSelected = selected === hex;
                                return (
                                    <button
                                        key={hex}
                                        type="button"
                                        title={hex}
                                        aria-label={hex}
                                        aria-pressed={isSelected}
                                        onClick={() => onChange(hex)}
                                        className={`h-5 flex-1 transition ${
                                            isSelected
                                                ? "ring-2 ring-brand ring-offset-1 ring-offset-card relative z-10"
                                                : "hover:scale-125 hover:relative hover:z-10"
                                        }`}
                                        style={{ backgroundColor: hex }}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Custom
                </p>
                <input
                    type="color"
                    value={custom}
                    onChange={(event) => {
                        setCustom(event.target.value);
                        onChange(event.target.value);
                    }}
                    className="h-7 w-12 cursor-pointer border border-border-soft bg-card"
                />
            </div>
        </div>
    );
}
