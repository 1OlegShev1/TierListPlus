import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const templates = await prisma.template.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { items: true, sessions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const programming = templates
    .filter((t) => t.name === "Programming Languages")
    .sort((a, b) => b._count.items - a._count.items)[0];
  const burgers9 = templates
    .filter((t) => t.name === "Burgers of Oslo" && t._count.items === 9)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

  if (!programming) {
    throw new Error('Template "Programming Languages" not found');
  }
  if (!burgers9) {
    throw new Error('Template "Burgers of Oslo" with 9 items not found');
  }

  const keepIds = [programming.id, burgers9.id];

  await prisma.$transaction(async (tx) => {
    await tx.bracketVote.deleteMany({});
    await tx.bracketMatchup.deleteMany({});
    await tx.bracket.deleteMany({});
    await tx.tierVote.deleteMany({});
    await tx.participant.deleteMany({});
    await tx.sessionItem.deleteMany({});
    await tx.session.deleteMany({});
    await tx.template.deleteMany({
      where: { id: { notIn: keepIds } },
    });
  });

  const summary = {
    sessions: await prisma.session.count(),
    participants: await prisma.participant.count(),
    tierVotes: await prisma.tierVote.count(),
    brackets: await prisma.bracket.count(),
    bracketVotes: await prisma.bracketVote.count(),
  };
  const remainingTemplates = await prisma.template.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { items: true, sessions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("Cleanup complete.");
  console.log(summary);
  console.dir(remainingTemplates, { depth: 5 });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
