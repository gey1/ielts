# Import and backup formats

The app reads content files with `schema_version: 1` and full backups with `backup_version: 1`. Unknown keys are rejected. Unknown **block type names** are allowed and shown with that name as the heading. Unknown **card types** import with a warning and are rendered as plain text.

Content is stored and shown as text. HTML is not interpreted.

## Content file

```json
{
  "schema_version": 1,
  "collections": [
    { "id": "topic-environment", "name": "Environment", "kind": "topic", "description": "optional" }
  ],
  "cards": [
    {
      "id": "vocab-deteriorate",
      "type": "vocabulary",
      "front": { "text": "Deteriorate" },
      "back": { "text": "恶化；变坏" },
      "collections": ["Environment"],
      "tags": ["writing"],
      "notes": [
        { "type": "definition", "content": "To become progressively worse." },
        { "type": "example", "content": "Air quality has deteriorated." }
      ],
      "blocks": []
    }
  ]
}
```

`notes` and `blocks` are the same kind of content. If both are present, `notes` come first. This matches the short example:

```json
{"schema_version":1,"cards":[{"type":"vocabulary","front":{"text":"Deteriorate"},"back":{"text":"恶化；变坏"},"notes":[{"type":"definition","content":"To become progressively worse."},{"type":"example","content":"Air quality has deteriorated."}]}]}
```

### Cards

| Field | Required | Notes |
| --- | --- | --- |
| `id` | no | Stable key, `[A-Za-z0-9][A-Za-z0-9_-]{0,79}`. If omitted, the id is derived from the type plus the normalised front text, so importing the same card again updates it. Two different cards with the same front and type need explicit ids. |
| `type` | yes | Usual values: `vocabulary`, `collocation`, `paraphrasing`, `sentence_structure`, `grammar_pattern`, `register`. Other strings are kept. |
| `front.text` | yes | English prompt. |
| `back.text` | no | Usually the Chinese gloss, or the model paraphrase. |
| `collections` | no | Ids or names. `Environment` and `环境` both map to the preset `topic-environment`. Unknown names become custom collections. |
| `tags` | no | Created if missing. Matched case-insensitively. |
| `notes`, `blocks` | no | `{ "type", "content" }`. Empty content is dropped. |

Built-in block types: `definition`, `translation`, `example`, `pronunciation`, `synonyms`, `antonyms`, `collocations`, `grammar`, `usage_note`, `common_mistakes`. Anything else, such as `band_tip`, still renders.

Preset topic ids: `topic-education`, `topic-environment`, `topic-technology`, `topic-healthcare`, `topic-economics`, `topic-employment`, `topic-society`, `topic-culture`, `topic-government`, `topic-globalisation`.

### What an import changes

A matching id **updates content** (front, back, blocks, collections, tags) and does **not** read or write FSRS records or review logs. A new id inserts a card with no schedule until the first review. The write is one IndexedDB transaction. The file is rejected as a whole when validation fails; nothing from that file is saved.

Each successful import is stored. Only the latest applied batch can be rolled back. Rollback deletes cards that batch created (including reviews done since) and restores the previous text of cards it updated. Scheduling of updated cards stays as it is.

## Backup file

```json
{
  "backup_version": 1,
  "exported_at": "2026-11-26T00:00:00.000Z",
  "app": "cijing",
  "cards": [],
  "blocks": [],
  "collections": [],
  "tags": [],
  "cardCollections": [],
  "cardTags": [],
  "srsRecords": [],
  "reviewLogs": [],
  "importBatches": [],
  "settings": { "id": "app" }
}
```

Restore clears those stores and writes the file inside one transaction, then ensures the ten preset topics exist. A content file cannot be restored as a backup, and a backup is not an incremental import.
