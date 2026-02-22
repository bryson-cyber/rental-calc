/**
 * Import buyers from HubSpot CSV into suppression_contacts table.
 * Run: node import-buyers.mjs
 */
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const CSV_PATH = '/home/ubuntu/upload/hubspot-crm-exports-all-program-buyers-excluding-s-2026-02-22.csv';

function normalizePhone(p) {
  if (!p) return null;
  const digits = p.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return digits.length >= 7 ? `+1${digits}` : null;
}

function parseCSV(text) {
  const lines = text.split('\n');
  const headers = lines[0].split('","').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split('","').map(v => v.replace(/^"|"$/g, '').trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

async function main() {
  const csvText = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length} rows from CSV`);

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  let imported = 0;
  let skipped = 0;
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch
      .map(r => {
        const phone = normalizePhone(r['Phone Number']);
        const email = r['Email']?.trim() || null;
        if (!phone && !email) return null;
        return {
          phone,
          email,
          firstName: r['First Name']?.trim() || null,
          lastName: r['Last Name']?.trim() || null,
          hubspotRecordId: r['Record ID - Contact']?.trim() || null,
        };
      })
      .filter(Boolean);

    if (values.length === 0) { skipped += batch.length; continue; }

    for (const v of values) {
      try {
        await conn.execute(
          `INSERT INTO suppression_contacts (phone, email, firstName, lastName, tag, source, hubspotRecordId, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 'buyer', 'hubspot_import', ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE updatedAt = NOW()`,
          [v.phone, v.email, v.firstName, v.lastName, v.hubspotRecordId]
        );
        imported++;
      } catch (err) {
        // Check if it's a duplicate — try matching by phone
        if (v.phone) {
          const [existing] = await conn.execute(
            'SELECT id FROM suppression_contacts WHERE phone = ? AND tag = ?',
            [v.phone, 'buyer']
          );
          if (existing.length > 0) {
            skipped++;
            continue;
          }
        }
        console.error(`Failed to import: ${v.firstName} ${v.lastName} (${v.phone}): ${err.message}`);
        skipped++;
      }
    }

    if ((i + batchSize) % 500 === 0 || i + batchSize >= rows.length) {
      console.log(`Progress: ${Math.min(i + batchSize, rows.length)}/${rows.length} — imported: ${imported}, skipped: ${skipped}`);
    }
  }

  console.log(`\nDone! Imported: ${imported}, Skipped: ${skipped}, Total: ${rows.length}`);
  
  // Verify
  const [countResult] = await conn.execute('SELECT COUNT(*) as cnt FROM suppression_contacts WHERE tag = ?', ['buyer']);
  console.log(`Buyers in suppression_contacts: ${countResult[0].cnt}`);

  await conn.end();
}

main().catch(console.error);
