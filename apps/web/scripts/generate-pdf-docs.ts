/**
 * Generates cover thumbnails + metadata for all PDFs in public/docs.
 *
 * - Renders the first page of each PDF to a PNG cover image
 *   (public/docs/covers/<slug>.png)
 * - Extracts a title (from PDF metadata, falling back to filename) and a
 *   short description (from the first meaningful line of extracted text)
 * - Writes the result to data/docs.json, consumed by the /trial-chat/docs page
 *
 * Run with: npx tsx scripts/generate-pdf-docs.ts
 */
import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const DOCS_DIR = path.join(process.cwd(), "public", "docs");
const COVERS_DIR = path.join(DOCS_DIR, "covers");
const OUTPUT_JSON = path.join(process.cwd(), "data", "docs.json");

interface DocEntry {
  id: string;
  title: string;
  description: string;
  file: string;
  cover: string;
}

function slugify(fileName: string): string {
  return path
    .basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromFileName(fileName: string): string {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^-+/, "")
    .trim();
}

/** Detects PDF-extraction artifacts where a stylized heading was rendered
 * with one letter per glyph, producing text like "C L I N I C A L". */
function isLetterSpacedNoise(line: string): boolean {
  const tokens = line.split(" ").filter(Boolean);
  if (tokens.length < 4) return false;
  const singleCharTokens = tokens.filter((t) => t.length === 1).length;
  return singleCharTokens / tokens.length > 0.6;
}

/** Pull a short, human-readable description out of extracted PDF text. */
function descriptionFromText(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isLetterSpacedNoise(l));

  // Prefer a line that reads like a full sentence; fall back to whatever is
  // available.
  const candidate =
    lines.find((l) => l.length >= 40) ?? lines[0] ?? "";

  const cleaned = candidate.replace(/\s+/g, " ").trim();
  return cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned;
}

async function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`Docs directory not found: ${DOCS_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(COVERS_DIR, { recursive: true });

  const pdfFiles = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"));

  if (pdfFiles.length === 0) {
    console.warn("No PDF files found in public/docs.");
    return;
  }

  const entries: DocEntry[] = [];

  for (const fileName of pdfFiles) {
    const fullPath = path.join(DOCS_DIR, fileName);
    const slug = slugify(fileName);
    const coverFileName = `${slug}.png`;
    const coverFullPath = path.join(COVERS_DIR, coverFileName);

    console.log(`Processing: ${fileName}`);

    const dataBuffer = fs.readFileSync(fullPath);
    const parser = new PDFParse({ data: dataBuffer });

    const info = await parser.getInfo();
    const textResult = await parser.getText();
    const screenshot = await parser.getScreenshot({ first: 1, scale: 2, imageBuffer: true });

    const pdfTitle = (info.info as { Title?: string } | undefined)?.Title?.trim();
    const rawTitle = pdfTitle && pdfTitle.length > 0 ? pdfTitle : titleFromFileName(fileName);
    const title = rawTitle.replace(/^-+\s*/, "").trim();
    const description = descriptionFromText(textResult.text);

    const firstPage = screenshot.pages[0];
    if (firstPage?.data) {
      fs.writeFileSync(coverFullPath, firstPage.data);
    }

    await parser.destroy();

    entries.push({
      id: slug,
      title,
      description,
      file: `/docs/${encodeURIComponent(fileName)}`,
      cover: `/docs/covers/${coverFileName}`,
    });

    console.log(`  -> title: ${title}`);
    console.log(`  -> cover: public/docs/covers/${coverFileName}`);
  }

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(entries, null, 2) + "\n");
  console.log(`\nWrote ${entries.length} entries to data/docs.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
