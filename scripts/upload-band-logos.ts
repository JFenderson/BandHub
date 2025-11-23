const { createReadStream } = require('fs');
const { join } = require('path');

// Using require for better compatibility
const fetch = require('node-fetch');
const FormData = require('form-data');

const API_URL = process.env.API_URL || 'http://localhost:3001';

// Map of band IDs to logo filenames
const bandLogoMap: Record<string, string> = {
  // Add your band IDs here after getting them from Prisma Studio
  // Example:
  // 'clx1234567890': 'southern-university.png',
};

async function uploadLogo(bandId: string, logoPath: string) {
  try {
    const form = new FormData();
    form.append('logo', createReadStream(logoPath));

    const response = await fetch(`${API_URL}/bands/${bandId}/logo`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }

    const result = await response.json();
    console.log(`✓ Uploaded logo for band ${bandId}`);
    return result;
  } catch (error) {
    console.error(`✗ Failed to upload logo for band ${bandId}:`, error);
  }
}

async function main() {
  const logosDir = join(__dirname, 'logos');
  
  console.log(`Uploading logos from: ${logosDir}\n`);

  if (Object.keys(bandLogoMap).length === 0) {
    console.error('❌ No band mappings found!');
    console.log('\nPlease update bandLogoMap in this script with your actual band IDs.');
    console.log('You can get band IDs by running: npx prisma studio');
    return;
  }

  for (const [bandId, filename] of Object.entries(bandLogoMap)) {
    const logoPath = join(logosDir, filename);
    await uploadLogo(bandId, logoPath);
  }

  console.log('\n✓ Upload process completed!');
}

main().catch(console.error);