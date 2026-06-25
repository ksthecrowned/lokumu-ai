# Cultural Corpus Drop Folder

Place additional cultural source files here for ingestion.

Supported formats:
- `.json` files containing one `CulturalEntry` object or an array of entries.
- `.md` and `.txt` files (ingested as plain text).

Language constraints:
- `fra`, `eng`, `lin`, `kit` only.

Run ingestion from `lokumu-api`:

```bash
npm run ingest:cultural -- ../data/cultural
```
