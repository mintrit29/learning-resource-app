import { db } from "@/lib/db";
import { embedTexts } from "@/lib/embedding/client";
import { findExactTagOrAlias } from "@/lib/taxonomy/canonical-tags";
import { normalizeTagName } from "@/lib/taxonomy/normalize-tag";
import { toSqliteVectorBlob } from "@/lib/vector/sqlite-vector-store";

function uniqueClean(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const clean = value.trim();
    const normalized = normalizeTagName(clean);
    if (!clean || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(clean);
  }

  return result;
}

async function syncAliases(tagId: string, canonicalName: string, aliases: string[]) {
  const canonicalNormalized = normalizeTagName(canonicalName);
  const uniqueAliases = uniqueClean(aliases).filter((alias) => normalizeTagName(alias) !== canonicalNormalized);

  for (const alias of uniqueAliases) {
    const normalizedAlias = normalizeTagName(alias);
    await db.tagAlias.upsert({
      where: { tagId_normalizedAlias: { tagId, normalizedAlias } },
      create: { tagId, alias, normalizedAlias },
      update: { alias },
    });
  }
}

export async function getExistingTopicContext(userId: string) {
  const usedTopics = await db.document.findMany({
    where: { userId, primaryTopic: { not: null } },
    distinct: ["primaryTopic"],
    select: { primaryTopic: true },
    orderBy: { primaryTopic: "asc" },
    take: 30,
  });

  const names = usedTopics.flatMap((topic) => (topic.primaryTopic ? [topic.primaryTopic] : []));
  if (names.length === 0) return "Chưa có chủ đề chuẩn nào trong thư viện.";

  const normalizedNames = names.map(normalizeTagName);
  const tags = await db.tag.findMany({
    where: { createdByUserId: userId, normalizedName: { in: normalizedNames } },
    include: { aliases: { orderBy: { createdAt: "asc" }, take: 8 } },
  });

  const aliasByNormalizedName = new Map(tags.map((tag) => [tag.normalizedName, tag.aliases.map((alias) => alias.alias)]));

  return names
    .map((name) => {
      const aliases = aliasByNormalizedName.get(normalizeTagName(name)) ?? [];
      return aliases.length > 0 ? `- ${name} (alias: ${aliases.join(", ")})` : `- ${name}`;
    })
    .join("\n");
}

export async function canonicalizePrimaryTopic(userId: string, suggestedTopic: string, aliases: string[]) {
  const candidates = uniqueClean([suggestedTopic, ...aliases]);
  const fallbackTopic = candidates[0] ?? "Khác";

  for (const candidate of candidates) {
    const match = await findExactTagOrAlias(userId, candidate);
    if (match) {
      await syncAliases(match.id, match.name, candidates);
      return match.name;
    }
  }

  const normalizedName = normalizeTagName(fallbackTopic);
  const tag = await db.tag.create({
    data: {
      name: fallbackTopic,
      normalizedName,
      createdByUserId: userId,
    },
  });

  const embedded = await embedTexts([fallbackTopic]);
  await db.tag.update({
    where: { id: tag.id },
    data: { embedding: toSqliteVectorBlob(embedded.embeddings[0]) },
  });
  await syncAliases(tag.id, tag.name, candidates);

  return tag.name;
}
