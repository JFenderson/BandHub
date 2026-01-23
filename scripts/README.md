# BandHub Database Maintenance Scripts

This directory contains utility scripts for maintaining and fixing the BandHub database.

## 📋 Table of Contents

- [Find Duplicate Bands](#find-duplicate-bands)
- [Merge Duplicate Bands](#merge-duplicate-bands)
- [Restore Band Colors](#restore-band-colors)
- [Safety Guidelines](#safety-guidelines)

---

## 🔍 Find Duplicate Bands

**Script:** `find-duplicate-bands.ts`

Identifies duplicate band entries in the database and generates a detailed report.

### What it does:
- Scans all bands and groups them by `schoolName`
- Identifies which entries have logos, videos, colors, etc.
- Calculates a "completeness score" for each band
- Recommends which band should be kept as primary
- Exports a detailed JSON report

### Usage:

```bash
npx tsx scripts/find-duplicate-bands.ts
```

### Output:

The script generates:
1. Console output showing duplicates
2. `duplicate-bands-report.json` with detailed information

### Example Output:

```
🔍 Scanning for duplicate band entries...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 DUPLICATE BANDS REPORT

Total bands: 58
Schools with duplicates: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎵 Jackson State University (2 entries)

   Entries:

   👑 sonic-boom-of-the-south
      ID: clx1234567890
      Logo: ✅
      Colors: ✅
      Description: ✅
      Videos: 45
      Favorites: 12
      Shares: 8
      Metrics: ✅
      Created: 2024-01-15T10:30:00.000Z

      jackson-state-band
      ID: clx0987654321
      Logo: ❌
      Colors: ❌
      Description: ❌
      Videos: 0
      Favorites: 0
      Shares: 0
      Metrics: ❌
      Created: 2024-02-20T15:45:00.000Z

   💡 Recommendation: Keep 'sonic-boom-of-the-south' (has 45 videos, 12 favorites). 
      Merge duplicates: jackson-state-band
```

---

## 🔧 Merge Duplicate Bands

**Script:** `merge-duplicate-bands.ts`

Intelligently consolidates duplicate band entries into a single canonical entry.

### What it does:
1. Identifies the "primary" band (most complete data)
2. Merges all fields from duplicates (logos, colors, descriptions)
3. Reassigns all videos to the primary band
4. Updates related records:
   - User favorites
   - Band shares
   - Band metrics
   - Featured clicks
   - Reviews
5. Safely deletes duplicate entries
6. Uses database transactions for data integrity

### Dry Run Mode (Recommended First):

```bash
DRY_RUN=true npx tsx scripts/merge-duplicate-bands.ts
```

This shows what would happen without making any changes.

### Live Mode:

```bash
npx tsx scripts/merge-duplicate-bands.ts
```

⚠️ **IMPORTANT:** Always backup your database before running in live mode!

### Backup Command:

```bash
pg_dump $DATABASE_URL > backup_before_merge_$(date +%Y%m%d_%H%M%S).sql
```

### How it selects the primary band:

The script calculates a "completeness score" based on:
- Number of videos (×10 points)
- Has logo (+5 points)
- Has both colors (+3 points)
- Has description (+2 points)
- User favorites (×2 points)
- Shares (×1 point)
- Age of record (up to +5 points)

The band with the highest score becomes the primary.

### Example Output:

```
🔧 Starting duplicate band merge process...

⚠️  LIVE MODE - Changes will be committed to the database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 Merging: Jackson State University
   Found 2 entries

   👑 Primary: sonic-boom-of-the-south (ID: clx1234567890)
   📊 Videos: 45, Favorites: 12

   🔄 Processing duplicate: jackson-state-band

      🗑️  Deleted duplicate band

   ✅ Merged 1 duplicate(s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 MERGE SUMMARY

   Schools merged: 1
   Duplicate bands removed: 1
   Mode: LIVE

✅ Merge completed successfully!
```

---

## 🎨 Restore Band Colors

**Script:** `restore-band-colors.ts`

Restores `primaryColor` and `secondaryColor` for all bands from the original seed data.

### What it does:
- Loads colors from `apps/api/prisma/seed-data/hbcu-bands.json`
- Updates each band with its official school colors
- Skips bands that already have correct colors
- Reports summary of changes

### Usage:

```bash
npx tsx scripts/restore-band-colors.ts
```

### Example Output:

```
🎨 Restoring band colors from seed data...

📂 Loaded 58 bands from seed data

✅ Updated: Alabama A&M University
   Primary: #660000, Secondary: #FFFFFF
✅ Updated: Alabama State University
   Primary: #000000, Secondary: #C99700
⏭️  Already has colors: Florida A&M University

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 COLOR RESTORATION SUMMARY

   Total in seed data: 58
   Colors updated: 45
   Already set: 10
   Not found in DB: 2
   No colors in seed: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Band colors restored successfully!

   Band cards will now display with school colors.
```

---

## 🛡️ Safety Guidelines

### Before Running Any Script:

1. **Backup your database:**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run diagnostic first:**
   ```bash
   npx tsx scripts/find-duplicate-bands.ts
   ```

3. **Review the report:**
   - Check `duplicate-bands-report.json`
   - Verify the recommended merges make sense

4. **Test with dry run:**
   ```bash
   DRY_RUN=true npx tsx scripts/merge-duplicate-bands.ts
   ```

5. **Execute the merge:**
   ```bash
   npx tsx scripts/merge-duplicate-bands.ts
   ```

6. **Restore colors:**
   ```bash
   npx tsx scripts/restore-band-colors.ts
   ```

7. **Verify the results:**
   - Check the band listings
   - Verify logos are present
   - Confirm video counts are accurate
   - Check band colors appear on cards

### Rollback Plan:

If something goes wrong, restore from backup:

```bash
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

### Environment Variables:

These scripts use the same `DATABASE_URL` from your `.env` file.

Make sure it's set correctly:
```bash
DATABASE_URL="postgresql://user:password@host:port/database"
```

---

## 📝 Notes

- All scripts use Prisma transactions for data integrity
- Changes are atomic - they either all succeed or all fail
- The merge script prioritizes data preservation
- No data is ever lost during merging
- Videos, favorites, and other relationships are always preserved

## 🐛 Troubleshooting

### "Cannot find module '@prisma/client'"

Run:
```bash
npm run prisma:generate
```

### "Database connection error"

Check your `DATABASE_URL` in `.env`

### "Permission denied"

Make sure you have write access to the database

---

## 📞 Support

If you encounter issues:
1. Check the error messages carefully
2. Review the backup before restoring
3. Contact the development team for assistance

**Remember:** Always test with DRY_RUN first!
