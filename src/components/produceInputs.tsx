"use client";

import { useEffect, useRef, useState } from "react";

// Amount input with a fixed GH₵ prefix inside the field.
// The user types digits only; the cedis sign is always shown.
export function PriceInput({
  value,
  onChange,
  placeholder = "0.00",
  required = false,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const display = focused || value ? value : "";

  return (
    <div className={`relative mt-1 ${className}`}>
      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none ${focused || value ? "text-[#1b5e20]" : "text-gray-400"}`}>
        GH₵
      </span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder={placeholder}
        required={required}
        value={display}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2.5 pl-12 border-2 border-gray-200 rounded-lg outline-none focus:border-[#43a047] bg-white"
      />
    </div>
  );
}

// Crop/product picker: suggestions = built-in ghanaCrops + farmer-added products.
// Farmers can type ANY product name; new ones are auto-saved to the Product
// table when the listing is posted.
export function ProductInput({
  value,
  onChange,
  builtinCrops,
  id,
  placeholder = "Select or type your product",
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  builtinCrops: string[];
  id: string; // unique datalist id per form
  placeholder?: string;
  required?: boolean;
}) {
  const [products, setProducts] = useState<string[]>([]);
  const datalistId = `product-list-${id}`;

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((names) => { if (Array.isArray(names)) setProducts(names); })
      .catch(() => { });
  }, []);

  const all = Array.from(new Set([...builtinCrops, ...products])).sort((a, b) => a.localeCompare(b));
  const isNew = value.trim().length >= 2 && !all.some((c) => c.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className="mt-1">
      <input
        type="text"
        list={datalistId}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2.5 border-2 border-gray-200 rounded-lg outline-none focus:border-[#43a047]"
      />
      <datalist id={datalistId}>
        {all.map((c) => <option key={c} value={c} />)}
      </datalist>
      {isNew && (
        <div className="text-xs text-[#1b5e20] mt-1.5 flex items-center gap-1">
          <span className="bg-[#e8f5e9] border border-[#43a047] rounded px-1.5 py-0.5 font-semibold">NEW</span>
          &ldquo;{value.trim()}&rdquo; will be added to the product list for all farmers
        </div>
      )}
    </div>
  );
}