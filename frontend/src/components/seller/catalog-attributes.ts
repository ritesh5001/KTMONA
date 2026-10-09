/* Category-specific fields for the single catalog form, like Meesho's
   "Product Details" section. Picked from the category path (main / group / leaf). */

export interface AttributeDef {
  key: string;
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

const COLORS = ["Black", "White", "Red", "Maroon", "Pink", "Peach", "Orange", "Yellow", "Mustard", "Green", "Olive", "Teal", "Blue", "Navy Blue", "Sky Blue", "Purple", "Lavender", "Grey", "Brown", "Beige", "Cream", "Gold", "Silver", "Multicolor"];
const OCCASIONS = ["Casual", "Daily", "Party", "Festive", "Wedding", "Ethnic", "Formal", "Sports", "Traditional"];
const FABRICS = ["Cotton", "Cotton Blend", "Rayon", "Viscose", "Silk", "Art Silk", "Georgette", "Chiffon", "Crepe", "Net", "Linen", "Polyester", "Lycra", "Denim", "Velvet", "Wool", "Satin", "Organza", "Khadi"];
const PATTERNS = ["Solid", "Printed", "Embroidered", "Striped", "Checked", "Floral", "Self Design", "Woven Design", "Zari Work", "Sequinned", "Embellished"];

const COLOR: AttributeDef = { key: "Color", label: "Color", required: true, options: COLORS };
const OCCASION: AttributeDef = { key: "Occasion", label: "Occasion", required: true, options: OCCASIONS };
const NET_QTY: AttributeDef = { key: "Net Quantity (N)", label: "Net Quantity (N)", required: true, options: ["1", "2", "3", "4", "5", "6", "8", "10", "12", "More than 12"] };
const GENERIC: AttributeDef = { key: "Generic Name", label: "Generic Name", required: true, placeholder: "e.g. Saree, Kurta, Bangles" };
const BRAND: AttributeDef = { key: "Brand", label: "Brand", placeholder: "Leave blank if unbranded" };
const MATERIAL: AttributeDef = { key: "Material", label: "Material", required: true, placeholder: "e.g. Plastic, Steel, Wood" };

const SETS: { match: RegExp; attrs: AttributeDef[] }[] = [
  {
    match: /saree|sari/i,
    attrs: [COLOR, { key: "Saree Fabric", label: "Saree Fabric", required: true, options: FABRICS }, { key: "Blouse", label: "Blouse", required: true, options: ["Running Blouse", "Separate Blouse Piece", "Without Blouse", "Stitched Blouse"] }, { key: "Blouse Fabric", label: "Blouse Fabric", options: FABRICS }, { key: "Pattern", label: "Pattern", required: true, options: PATTERNS }, { key: "Border", label: "Border", options: ["Zari", "Woven", "Embroidered", "Lace", "Printed", "No Border"] }, { key: "Saree Length", label: "Saree Length (m)", required: true, options: ["5.5", "6.3", "6.5"] }, OCCASION, NET_QTY],
  },
  {
    match: /kurt|dupatta|salwar|lehenga|gown|suit|dress material|ethnic/i,
    attrs: [COLOR, { key: "Fabric", label: "Fabric", required: true, options: FABRICS }, { key: "Pattern", label: "Pattern", required: true, options: PATTERNS }, { key: "Sleeve Length", label: "Sleeve Length", required: true, options: ["Sleeveless", "Short Sleeves", "Three-Quarter Sleeves", "Long Sleeves"] }, { key: "Neck", label: "Neck", options: ["Round Neck", "V-Neck", "Mandarin Collar", "Boat Neck", "Square Neck", "Collar"] }, { key: "Length", label: "Length", options: ["Calf Length", "Knee Length", "Ankle Length", "Hip Length"] }, { key: "Stitch Type", label: "Stitch Type", required: true, options: ["Stitched", "Semi-Stitched", "Unstitched"] }, OCCASION, NET_QTY],
  },
  {
    match: /bangle|bracelet|necklace|earring|jewel|ring|anklet|pendant|mangalsutra|maang|nose|kamarband/i,
    attrs: [COLOR, { key: "Base Metal", label: "Base Metal", required: true, options: ["Alloy", "Brass", "Copper", "Silver", "Stainless Steel", "Glass", "Plastic", "Lac"] }, { key: "Plating", label: "Plating", required: true, options: ["Gold Plated", "Rhodium Plated", "Silver Plated", "Oxidised", "No Plating"] }, { key: "Stone Type", label: "Stone Type", required: true, options: ["Kundan", "American Diamond", "Pearl", "Cubic Zirconia", "Crystal", "Artificial Stones", "No Stone"] }, { key: "Trend", label: "Trend", options: ["Traditional", "Contemporary", "Fusion", "Minimal"] }, { key: "Type", label: "Type", required: true, placeholder: "e.g. Bangle Set, Jhumka" }, { key: "Sizing", label: "Sizing", options: ["Adjustable", "Non-Adjustable"] }, OCCASION, NET_QTY],
  },
  {
    match: /shoe|footwear|sandal|slipper|heel|flats|boot|sneaker|flip/i,
    attrs: [COLOR, { key: "Upper Material", label: "Upper Material", required: true, options: ["Synthetic", "PU", "Leather", "Mesh", "Canvas", "Fabric", "Rubber"] }, { key: "Sole Material", label: "Sole Material", required: true, options: ["Rubber", "EVA", "PU", "TPR", "PVC"] }, { key: "Closure", label: "Closure", options: ["Lace-Up", "Slip-On", "Velcro", "Buckle", "Zip"] }, { key: "Heel Height", label: "Heel Height", options: ["Flat", "Low (1-2 in)", "Medium (2-3 in)", "High (3+ in)"] }, OCCASION, NET_QTY],
  },
  {
    match: /bag|wallet|clutch|backpack|purse|luggage/i,
    attrs: [COLOR, { key: "Material", label: "Material", required: true, options: ["PU", "Leather", "Canvas", "Polyester", "Nylon", "Jute", "Fabric"] }, { key: "Closure", label: "Closure", options: ["Zip", "Magnetic", "Button", "Drawstring", "Open"] }, { key: "Compartments", label: "No. of Compartments", options: ["1", "2", "3", "4+"] }, OCCASION, NET_QTY],
  },
  {
    match: /men|shirt|t-shirt|tshirt|jeans|trouser|top|dress|western|jacket|track|shorts|lingerie|bra|night|innerwear|kids/i,
    attrs: [COLOR, { key: "Fabric", label: "Fabric", required: true, options: FABRICS }, { key: "Pattern", label: "Pattern", required: true, options: PATTERNS }, { key: "Fit/Shape", label: "Fit / Shape", options: ["Regular", "Slim", "Relaxed", "Oversized", "Skinny", "Straight", "A-Line"] }, { key: "Sleeve Length", label: "Sleeve Length", options: ["Sleeveless", "Short Sleeves", "Three-Quarter Sleeves", "Long Sleeves"] }, OCCASION, NET_QTY],
  },
  {
    match: /beauty|health|makeup|skin|hair|perfume|grocery|ayurved|wellness/i,
    attrs: [GENERIC, { key: "Net Content", label: "Net Content", required: true, placeholder: "e.g. 100 ml, 50 g" }, { key: "Skin/Hair Type", label: "Skin / Hair Type", options: ["All", "Oily", "Dry", "Normal", "Sensitive", "Combination"] }, { key: "Expiry Date", label: "Expiry / Best Before", required: true, placeholder: "MM/YYYY" }, { key: "Ingredients", label: "Key Ingredients" }, NET_QTY],
  },
  {
    match: /electronic|electrical|mobile|charger|earphone|speaker|watch|appliance/i,
    attrs: [COLOR, GENERIC, { key: "Model Name", label: "Model Name", required: true }, { key: "Warranty", label: "Warranty", required: true, options: ["No Warranty", "1 Month", "3 Months", "6 Months", "1 Year", "2 Years"] }, { key: "Power Source", label: "Power Source", options: ["Battery", "Electric", "USB", "Solar", "Manual"] }, NET_QTY],
  },
  {
    match: /home|kitchen|decor|bedsheet|curtain|furnish|storage|toy|sport|fitness|car|motorbike|office|stationery|pet|music|book/i,
    attrs: [COLOR, GENERIC, MATERIAL, { key: "Dimensions", label: "Product Dimensions (L x W x H)", placeholder: "e.g. 30 x 20 x 10 cm" }, NET_QTY],
  },
];

const FALLBACK: AttributeDef[] = [COLOR, GENERIC, MATERIAL, NET_QTY];

export function attributesFor(pathNames: string[]): AttributeDef[] {
  // Most specific (leaf) name first.
  for (const name of [...pathNames].reverse()) {
    const set = SETS.find((s) => s.match.test(name));
    if (set) return [...set.attrs, BRAND];
  }
  return [...FALLBACK, BRAND];
}

export function sizePresetsFor(pathNames: string[]): string[] {
  const path = pathNames.join(" ").toLowerCase();
  if (/bangle|bracelet/.test(path)) return ["2.2", "2.4", "2.6", "2.8", "2.10", "Free Size"];
  if (/ring/.test(path)) return ["6", "7", "8", "9", "10", "11", "12", "Adjustable"];
  if (/shoe|footwear|sandal|slipper|heel|flats|boot|sneaker|flip/.test(path)) return ["IND-3", "IND-4", "IND-5", "IND-6", "IND-7", "IND-8", "IND-9", "IND-10", "IND-11"];
  if (/jeans|trouser|pant|shorts/.test(path)) return ["26", "28", "30", "32", "34", "36", "38", "40"];
  if (/kid|baby/.test(path)) return ["0-6 Months", "6-12 Months", "1-2 Years", "2-3 Years", "3-4 Years", "4-5 Years", "5-6 Years", "7-8 Years", "9-10 Years"];
  if (/saree|dupatta|jewel|necklace|earring|bag|wallet|watch|beauty|grocery|electronic|home|kitchen|book/.test(path)) return ["Free Size"];
  return ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free Size"];
}

export const LEGAL_FIELDS: AttributeDef[] = [
  { key: "countryOfOrigin", label: "Country of Origin", required: true, options: ["India", "China", "Bangladesh", "Vietnam", "Other"] },
  { key: "manufacturerName", label: "Manufacturer Name", required: true },
  { key: "manufacturerAddress", label: "Manufacturer Address", required: true },
  { key: "manufacturerPincode", label: "Manufacturer Pincode", required: true },
  { key: "packerName", label: "Packer Name", required: true },
  { key: "packerAddress", label: "Packer Address", required: true },
  { key: "packerPincode", label: "Packer Pincode", required: true },
  { key: "importerName", label: "Importer Name" },
  { key: "importerAddress", label: "Importer Address" },
  { key: "importerPincode", label: "Importer Pincode" },
];

export const IMAGE_SLOTS = [
  { key: "front", label: "Front Image", hint: "Upload front view image", required: true },
  { key: "zoomed", label: "Zoomed In Image", hint: "Upload close-up view", required: true },
  { key: "tabletop", label: "Table top Image", hint: "Add top view", required: true },
  { key: "sizechart", label: "Size Chart", hint: "Size-wise body measurements", required: false },
  { key: "extra", label: "Other Image", hint: "Back / side view", required: false },
] as const;

export const NOT_ALLOWED_IMAGES = [
  "Watermark image",
  "Fake branded / 1st copy",
  "Image with price",
  "Pixelated image",
  "Inverted image",
  "Blur / unclear image",
  "Incomplete image",
  "Stretched / shrunk image",
  "Image with props",
  "Image with text",
];
