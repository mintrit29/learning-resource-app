import { db } from "../src/lib/db";
import { ensureCurriculumTopics } from "../src/lib/taxonomy/curriculum-topics";

await ensureCurriculumTopics();
console.log(JSON.stringify({ mode: "local", defaultTopics: 27 }, null, 2));
await db.$disconnect();
