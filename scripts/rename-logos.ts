import fs from 'fs';
import path from 'path';

const LOGOS_DIR = './apps/web/public/band-logos'; // Adjust to your actual path

const logoFilenameMapping: Record<string, string> = {
  // Current filename → Standardized slug (alphabetized by output slug)
  'alabama-aam.jpg': 'alabama-am.png',
  'bama state.jpg': 'alabama-state.png',
  'albany-state.jpg': 'albany-state.png',
  'alcorn-state-university.png': 'alcorn-state.png',
  'allen-university.png': 'allen.png',
  'uapb.png': 'arkansas-pine-bluff.png',
  'benedict-college.png': 'benedict.png',
  'bethune-cookman.png': 'bethune-cookman.png',
  'Bethune–Cookman_Wildcats_logo.svg': 'bethune-cookman-alt.png', // Duplicate - rename to alt
  'bluefield-state.jpg': 'bluefield-state.png',
  'bowie state.png': 'bowie-state.png',
  'central-state.jpg': 'central-state.png',
  'clark-atlanta.jpg': 'clark-atlanta.png',
  'delaware-state.jpg': 'delaware-state.png',
  'edward-waters.png': 'edward-waters.png',
  'ecsu.jpg': 'elizabeth-city-state.png',
  'fayetteville-state.jpg': 'fayetteville-state.png',
  'fisk-university.png': 'fisk.png',
  'florida-aam.png': 'florida-am.png',
  'florida-memorial.jpg': 'florida-memorial.png',
  'fort-valley-state.png': 'fort-valley-state.png',
  'grambling-state.png': 'grambling-state.png',
  'hampton.png': 'hampton.png',
  'howard.jpg': 'howard.png',
  'jackson-state.png': 'jackson-state.png',
  'johnson-c-smith.png': 'johnson-c-smith.png',
  'kentucky-state.jpg': 'kentucky-state.png',
  'lane-college.jpg': 'lane.png',
  'langston u.jpg': 'langston.png',
  'lincoln-university.jpg': 'lincoln.png',
  'livingstone-college.png': 'livingstone.png',
  'miles-college.jpg': 'miles.png',
  'msvu.jpg': 'mississippi-valley-state.png',
  'morehouse-college.jpg': 'morehouse.png',
  'morgan-state.jpg': 'morgan-state.png',
  'norfolk-state-university.jpg': 'norfolk-state.png',
  'north-carolina-aat-state.png': 'north-carolina-at.png',
  'nccu.png': 'north-carolina-central.png',
  'pvamu.jpg': 'prairie-view-am.png',
  'rust-college.png': 'rust.png',
  'savannah-state-university.png': 'savannah-state.png',
  'shaw-university.jpg': 'shaw.png',
  'south-carolina-state.png': 'south-carolina-state.png',
  'southern-university.jpg': 'southern.png',
  'talladega-college.jpg': 'talladega.png',
  'tennessee-state.jpg': 'tennessee-state.png',
  'texas-college.jpg': 'texas-college.png',
  'texas-southern-university.jpg': 'texas-southern.png',
  'tougaloo-college.png': 'tougaloo.png',
  'tuskegee.jpg': 'tuskegee.png',
  'virginia-state-university.jpg': 'virginia-state.png',
  'virginia-union.jpg': 'virginia-union.png',
  'wiley.jpg': 'wiley.png',
  'winston-salem-state.png': 'winston-salem-state.png',
};

async function renameLogos() {
  console.log('🎯 Starting logo rename process...\n');

  const processedFiles = new Set<string>();
  let renamed = 0;
  let skipped = 0;
  let errors = 0;

  for (const [oldName, newName] of Object.entries(logoFilenameMapping)) {
    const oldPath = path.join(LOGOS_DIR, oldName);
    const newPath = path.join(LOGOS_DIR, newName);

    try {
      // Skip if old file doesn't exist
      if (!fs.existsSync(oldPath)) {
        console.log(`⚠️  Skip: ${oldName} (file not found)`);
        skipped++;
        continue;
      }

      // Handle duplicates (e.g., M3.jpg and florida-aam.png both → florida-am.png)
      if (processedFiles.has(newName)) {
        console.log(`⚠️  Skip: ${oldName} → ${newName} (duplicate target)`);
        skipped++;
        continue;
      }

      // Rename file
      fs.renameSync(oldPath, newPath);
      processedFiles.add(newName);
      console.log(`✅ Renamed: ${oldName} → ${newName}`);
      renamed++;

    } catch (error) {
      console.error(`❌ Error renaming ${oldName}:`, error);
      errors++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Renamed: ${renamed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`\n🎉 Done!`);
}

renameLogos();