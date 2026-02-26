import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_TIER_CONFIG } from "../src/lib/constants";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// Placeholder images using picsum.photos
const ITEMS = [
  { label: "TypeScript", imageUrl: "https://picsum.photos/seed/ts/200/200" },
  { label: "JavaScript", imageUrl: "https://picsum.photos/seed/js/200/200" },
  { label: "Python", imageUrl: "https://picsum.photos/seed/py/200/200" },
  { label: "Rust", imageUrl: "https://picsum.photos/seed/rust/200/200" },
  { label: "Go", imageUrl: "https://picsum.photos/seed/go/200/200" },
  { label: "Java", imageUrl: "https://picsum.photos/seed/java/200/200" },
  { label: "C#", imageUrl: "https://picsum.photos/seed/csharp/200/200" },
  { label: "Swift", imageUrl: "https://picsum.photos/seed/swift/200/200" },
  { label: "Kotlin", imageUrl: "https://picsum.photos/seed/kotlin/200/200" },
  { label: "Ruby", imageUrl: "https://picsum.photos/seed/ruby/200/200" },
  { label: "PHP", imageUrl: "https://picsum.photos/seed/php/200/200" },
  { label: "C++", imageUrl: "https://picsum.photos/seed/cpp/200/200" },
];

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.bracketVote.deleteMany();
  await prisma.bracketMatchup.deleteMany();
  await prisma.bracket.deleteMany();
  await prisma.tierVote.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.sessionItem.deleteMany();
  await prisma.session.deleteMany();
  await prisma.templateItem.deleteMany();
  await prisma.template.deleteMany();

  // Create template
  const template = await prisma.template.create({
    data: {
      name: "Programming Languages",
      description: "Rank the best programming languages!",
      items: {
        create: ITEMS.map((item, i) => ({
          label: item.label,
          imageUrl: item.imageUrl,
          sortOrder: i,
        })),
      },
    },
    include: { items: true },
  });

  console.log(`Created template: ${template.name} (${template.items.length} items)`);

  // Create a session
  const session = await prisma.session.create({
    data: {
      name: "Friday Rankings",
      templateId: template.id,
      joinCode: "DEMO1234",
      tierConfig: JSON.parse(JSON.stringify(DEFAULT_TIER_CONFIG)),
      items: {
        create: template.items.map((item) => ({
          templateItemId: item.id,
          label: item.label,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder,
        })),
      },
    },
    include: { items: true },
  });

  console.log(`Created session: ${session.name} (join code: ${session.joinCode})`);
  console.log(`\nDone! Visit http://localhost:3000 to try it out.`);
  console.log(`Join the demo session with code: DEMO1234`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
