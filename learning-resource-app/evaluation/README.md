# Week 11 Evaluation

This folder keeps the manual ground-truth labels and generated evaluation reports.

## What Codex/scripts handle

1. Generate a label template from documents already in the database.
2. Run classification evaluation for topic and difficulty.
3. Run semantic search evaluation against manually marked relevant documents/chunks.
4. Compare semantic search with keyword search.
5. Check sample tag/alias normalization pairs.
6. Save JSON and Markdown reports for the final thesis/report.

## Manual part for the owner

1. Run `npm run eval:template` inside `learning-resource-app`.
2. Open `evaluation/labels.json`.
3. Fill or correct:
   - `expectedPrimaryTopic`
   - `expectedDifficulty`
   - `searchQueries[].expectedDocumentIds`
   - optional `searchQueries[].expectedChunkIds`
   - optional `tagAliases`
4. Run `npm run eval:week11`.

The scripts intentionally do not invent ground-truth labels. AI can prefill suggestions, but the final labels should be reviewed manually.
