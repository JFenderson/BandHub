// apps/api/prisma/seeders/events.seeder.ts
import { PrismaClient, EventType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Seeder for Events
 * 
 * Events represent competitions, classics, showcases, and other named events
 * that videos can be associated with. This creates searchable, filterable
 * event contexts for video organization.
 * 
 * Data Source:
 * - seed-data/events.json (Extracted from allstar-config.json special events)
 */

interface EventSeedData {
  name: string;
  slug: string;
  aliases: string[];         // For video matching (HBOB, SHC, etc.)
  eventType: EventType;
  tags: string[];
  description?: string;
  location?: string | null;
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  eventDate?: string | null;  // ISO date string from JSON
  endDate?: string | null;    // ISO date string from JSON
  year?: number;               // Required in schema
  isRecurring: boolean;
  imageUrl?: string | null;
  isActive: boolean;
}
export async function seedEvents(prisma: PrismaClient): Promise<void> {
  console.log('\n🏆 Seeding Events...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Load data file
  const eventsPath = path.resolve(process.cwd(), 'prisma/seed-data/events.json');
  const events: EventSeedData[] = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));

  console.log(`📊 Data loaded: ${events.length} events\n`);

  // Group events by type for better console output
  const eventsByType = events.reduce((acc, event) => {
    if (!acc[event.eventType]) {
      acc[event.eventType] = [];
    }
    acc[event.eventType].push(event);
    return acc;
  }, {} as Record<EventType, EventSeedData[]>);

  let created = 0;
  let updated = 0;
  let errors = 0;

  // Seed each event type group
  for (const [eventType, typeEvents] of Object.entries(eventsByType)) {
    console.log(`📅 Seeding ${eventType.replace('_', ' ')} Events...\n`);
    
    for (const event of typeEvents) {
      try {
        const result = await upsertEvent(prisma, event);
        if (result === 'created') {
          console.log(`   ✅ Created: ${event.name}`);
          created++;
        } else {
          console.log(`   🔄 Updated: ${event.name}`);
          updated++;
        }
      } catch (error) {
        console.error(`   ❌ Error with ${event.name}:`, error.message);
        errors++;
      }
    }
    console.log(''); // Empty line between groups
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Events Seeding Complete!\n');
  console.log(`📈 Results:`);
  console.log(`   • Created: ${created}`);
  console.log(`   • Updated: ${updated}`);
  console.log(`   • Errors: ${errors}`);
  console.log(`   • Total Processed: ${created + updated + errors}`);
  
  // Breakdown by type
  console.log('\n📊 Events by Type:');
  for (const [eventType, typeEvents] of Object.entries(eventsByType)) {
    console.log(`   • ${eventType.replace('_', ' ')}: ${typeEvents.length}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Upsert a single event
 * Uses slug as the unique identifier
 * Returns 'created' or 'updated'
 */
async function upsertEvent(
  prisma: PrismaClient,
  event: EventSeedData
): Promise<'created' | 'updated'> {
  
  // Check if event exists
  const existing = await prisma.event.findUnique({
    where: { slug: event.slug },
  });

  // Prepare data object
   const eventData = {
    name: event.name,
    slug: event.slug,
    aliases: event.aliases || [],  // For video matching
    eventType: event.eventType,
    tags: event.tags || [],
    description: event.description || null,
    location: event.location || null,
    venue: event.venue || null,
    city: event.city || null,
    state: event.state || null,
    eventDate: event.eventDate ? new Date(event.eventDate) : null,
    endDate: event.endDate ? new Date(event.endDate) : null,
    year: event.year || null,
    isRecurring: event.isRecurring,
    imageUrl: event.imageUrl || null,
    isActive: event.isActive,
  };

  // Upsert the event
  await prisma.event.upsert({
    where: { slug: event.slug },
    create: eventData,
    update: eventData,
  });

  return existing ? 'updated' : 'created';
}