# Prompt for generating 词径 cards

Give this to an external model. Paste the JSON it returns into 词径 → 导入, or save it as a `.json` file. Do not ask the model to call this app, and do not put an API key in the frontend.

---

You write IELTS vocabulary material for a Chinese-speaking learner. Reply with one JSON object and no markdown fence. Use only the fields below. Do not invent HTML.

```json
{
  "schema_version": 1,
  "collections": [{ "name": "Environment" }],
  "cards": []
}
```

Rules:

- `schema_version` is the number 1.
- Each card needs `type`, `front.text`, and usually `back.text` in Simplified Chinese.
- `type` is one of `vocabulary`, `collocation`, `paraphrasing`, `sentence_structure`, `grammar_pattern`, `register`.
- Always set a stable `id` such as `vocab-mitigate`. Use the same id if you revise the card later. Ids contain only letters, digits, `_` and `-`.
- Put the card in one or more of: Education, Environment, Technology, Healthcare, Economics, Employment, Society, Culture, Government, Globalisation. Those names map to the built-in topics. Add a custom collection only when the card does not fit.
- Tags are short, like `writing` or `speaking`.
- `notes` is an array of `{ "type", "content" }`. Prefer `definition`, `pronunciation` (IPA in slashes), `example`, `collocations`, `usage_note`, `common_mistakes`. Use `grammar` for patterns. An extra type such as `band_tip` is allowed.
- Examples are original sentences a candidate could say or write. No quotations from textbooks, exams or news articles. Academic but natural. One sentence is enough.
- Vocabulary and collocations: English lemma or phrase on the front, Chinese on the back, a definition that does not simply repeat the headword, one example that contains the item.
- Paraphrasing: a plain sentence on the front, a more precise or formal version on the back, plus a `usage_note` about when each is appropriate.
- Sentence structure and grammar: the pattern on the front, a short Chinese label on the back, a `grammar` note, an example, and a `common_mistakes` note.
- Register: show the informal and formal options on the front, explain the difference in Chinese on the back.
- Say when a verb is intransitive, when a noun is uncountable, and what the usual collocation is. Flag errors such as “despite of”.
- Do not include answers that only work as multiple choice, and do not wrap examples in HTML or markdown links.
- Aim for cards the learner must produce, not a list of synonyms with no context.

A minimal valid card is:

```json
{"schema_version":1,"cards":[{"id":"vocab-deteriorate","type":"vocabulary","front":{"text":"Deteriorate"},"back":{"text":"恶化；变坏"},"collections":["Environment"],"tags":["writing"],"notes":[{"type":"definition","content":"To become progressively worse."},{"type":"example","content":"Air quality has deteriorated."}]}]}
```
